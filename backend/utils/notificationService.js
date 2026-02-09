import { executeQuery } from "../config/db.js";
import { sendFCMNotification } from "./fcmService.js";
import { sendNotificationToUser } from '../server.js';
// Global WebSocket function reference

/**
 * Set WebSocket function reference from server
 */
export function setWebSocketFunction(wsFunction) {
  sendNotificationToUser = wsFunction;
  console.log('✅ WebSocket function set in notification service');
}

/**
 * Save device token for push notifications
 */
export async function saveDeviceToken({ userType, userId, token, platform = 'android' }) {
  try {
    const sql = `
      INSERT INTO device_tokens (user_type, user_id, fcm_token, platform)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE last_seen = CURRENT_TIMESTAMP;
    `;
    await executeQuery(sql, [userType, userId, token, platform]);
    console.log(`✅ Device token saved for ${userType} #${userId}`);
  } catch (error) {
    console.error('❌ Error saving device token:', error.message);
    throw error;
  }
}

/**
 * Remove device token
 */
export async function removeDeviceToken(token) {
  try {
    await executeQuery('DELETE FROM device_tokens WHERE fcm_token = ?', [token]);
    console.log(`✅ Device token removed`);
  } catch (error) {
    console.error('❌ Error removing device token:', error.message);
    throw error;
  }
}

/**
 * Get device tokens for a user
 */
export async function getDeviceTokens(userType, userId) {
  try {
    const [result] = await executeQuery(
      "SELECT fcm_token FROM device_tokens WHERE user_type = ? AND user_id = ?",
      [userType, userId]
    );
    return result.map(row => row.fcm_token).filter(token => token);
  } catch (error) {
    console.error('❌ Error getting device tokens:', error.message);
    return [];
  }
}

/**
 * Complete notification system - BOTH WebSocket AND FCM
 */
export async function sendNotification({ toUserType, toUserId, title, message, data = {}, sendPush = true, sendWebSocket = true }) {
  try {
    console.log(`📢 Sending notification to ${toUserType} #${toUserId}: ${title}`);
    
    // 1. ALWAYS save to database first
    const [notificationResult] = await executeQuery(
      `INSERT INTO notifications (user_type, user_id, title, message, is_read, data) 
       VALUES (?, ?, ?, ?, 0, ?)`,
      [toUserType, toUserId, title, message, JSON.stringify(data || {})]
    );
    
    const notificationId = notificationResult.insertId;
    console.log(`✅ Notification #${notificationId} saved to database`);
    
    // 2. Send WebSocket notification (real-time)
    let wsSent = false;
    if (sendWebSocket && sendNotificationToUser) {
      try {
        wsSent = sendNotificationToUser(toUserId.toString(), toUserType, {
          id: notificationId,
          title,
          message,
          is_read: false,
          created_at: new Date().toISOString(),
          data: { ...data, notification_id: notificationId }
        });
      } catch (wsError) {
        console.error('❌ WebSocket error:', wsError);
      }
    }
    
    // 3. Add to queue (for offline users)
    try {
      await executeQuery(
        `INSERT INTO notification_queue (notification_id, user_id, user_type, attempts) 
         VALUES (?, ?, ?, 0)`,
        [notificationId, toUserId, toUserType]
      );
    } catch (queueError) {
      console.log('⚠️ Could not add to queue');
    }
    
    // 4. Send FCM push notification
    let pushSent = false;
    if (sendPush) {
      const deviceTokens = await getDeviceTokens(toUserType, toUserId);
      if (deviceTokens.length > 0) {
        try {
          const pushData = {
            ...data,
            notification_id: notificationId.toString(),
            type: 'order_update'
          };
          
          await sendFCMNotification(deviceTokens, title, message, pushData);
          pushSent = true;
          console.log(`📲 FCM push sent to ${deviceTokens.length} device(s)`);
        } catch (fcmError) {
          console.error('❌ FCM error:', fcmError);
        }
      }
    }
    
    return {
      success: true,
      notificationId,
      webSocketSent: wsSent,
      pushNotificationSent: pushSent
    };
    
  } catch (error) {
    console.error("❌ Error in sendNotification:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send notification to multiple users (e.g., all delivery men)
 */
export async function sendBulkNotification({ toUserType, title, message, data = {}, sendPush = true }) {
  try {
    let userIds = [];
    let users = [];
    
    // Get all users of the specified type
    if (toUserType === "delivery_man") {
      [users] = await executeQuery("SELECT id FROM delivery_men WHERE is_active = 1");
    } else if (toUserType === "client") {
      [users] = await executeQuery("SELECT id FROM clients");
    } else {
      return { success: false, error: "Invalid user type" };
    }
    
    userIds = users.map(user => user.id);
    
    if (userIds.length === 0) {
      console.log('⚠️ No users found for bulk notification');
      return { success: false, message: 'No users found' };
    }
    
    console.log(`📢 Sending bulk notification to ${userIds.length} ${toUserType}(s)`);
    
    const results = [];
    
    // Send to each user individually
    for (const userId of userIds) {
      const result = await sendNotification({
        toUserType,
        toUserId: userId,
        title,
        message,
        data,
        sendPush,
        sendWebSocket: true
      });
      
      results.push(result);
    }
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`📊 Bulk notification results: ${successful} successful, ${failed} failed`);
    
    return {
      success: true,
      total: userIds.length,
      successful,
      failed,
      results
    };
    
  } catch (error) {
    console.error('❌ Bulk notification error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send push notification WITHOUT database storage (legacy support)
 */
export async function sendPushNotificationOnly({ toUserType, toUserId, title, message, data = {} }) {
  try {
    const deviceTokens = await getDeviceTokens(toUserType, toUserId);
    
    if (deviceTokens.length === 0) {
      console.log(`⚠️ No device tokens found for ${toUserType} ${toUserId}`);
      return { success: false, message: 'No device tokens found' };
    }
    
    console.log(`📲 Sending push-only notification to ${deviceTokens.length} device(s)`);
    const result = await sendFCMNotification(deviceTokens, title, message, data);
    
    return { 
      success: true, 
      pushSent: deviceTokens.length,
      fcmResult: result 
    };
  } catch (error) {
    console.error('❌ Error sending push-only notification:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(userType, userId) {
  try {
    const [result] = await executeQuery(
      "SELECT COUNT(*) as count FROM notifications WHERE user_type = ? AND user_id = ? AND is_read = 0",
      [userType, userId]
    );
    
    return result[0]?.count || 0;
  } catch (error) {
    console.error('❌ Error getting unread count:', error);
    return 0;
  }
}

/**
 * Mark notification as read
 */
export async function markAsRead(notificationId) {
  try {
    await executeQuery(
      "UPDATE notifications SET is_read = 1 WHERE id = ?",
      [notificationId]
    );
    console.log(`✅ Notification #${notificationId} marked as read`);
    return { success: true };
  } catch (error) {
    console.error('❌ Error marking notification as read:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userType, userId) {
  try {
    await executeQuery(
      "UPDATE notifications SET is_read = 1 WHERE user_type = ? AND user_id = ? AND is_read = 0",
      [userType, userId]
    );
    console.log(`✅ All notifications marked as read for ${userType} ${userId}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Error marking all notifications as read:', error);
    return { success: false, error: error.message };
  }
}



/**
 * Send notification to ALL users of a specific type (clients or delivery men)
 */
export async function sendBulkNotificationClients({ toUserType, title, message, data = {}, sendPush = true, sendWebSocket = true }) {
  try {
    // Get all users of the specified type
    let users = [];
    
    if (toUserType === "client") {
      [users] = await executeQuery("SELECT id FROM clients");
    } else if (toUserType === "delivery_man") {
      [users] = await executeQuery("SELECT id FROM delivery_men WHERE is_active = 1");
    } else {
      return { success: false, error: "Invalid user type" };
    }
    
    const userIds = users.map(user => user.id);
    
    if (userIds.length === 0) {
      console.log(`⚠️ No ${toUserType}s found for bulk notification`);
      return { success: false, message: 'No users found' };
    }
    
    console.log(`📢 Sending bulk notification to ${userIds.length} ${toUserType}(s): ${title}`);
    
    const results = [];
    
    // Send to each user
    for (const userId of userIds) {
      const result = await sendNotification({
        toUserType,
        toUserId: userId,
        title,
        message,
        data,
        sendPush: false, // We'll send FCM in bulk later
        sendWebSocket
      });
      
      if (result.success) {
        results.push({
          userId,
          notificationId: result.notificationId,
          webSocketSent: result.webSocketSent
        });
      }
    }
    
    // Send FCM push in bulk
    let pushSent = false;
    if (sendPush) {
      try {
        // Get all device tokens for this user type
        const [tokensResult] = await executeQuery(
          `SELECT fcm_token FROM device_tokens WHERE user_type = ?`,
          [toUserType]
        );
        
        const deviceTokens = tokensResult.map(row => row.fcm_token).filter(token => token);
        
        if (deviceTokens.length > 0) {
          const pushData = {
            ...data,
            type: data.type || 'bulk_notification'
          };
          
          await sendFCMNotification(deviceTokens, title, message, pushData);
          pushSent = true;
          console.log(`📲 FCM bulk push sent to ${deviceTokens.length} device(s)`);
        }
      } catch (fcmError) {
        console.error('❌ FCM bulk error:', fcmError);
      }
    }
    
    return {
      success: true,
      totalSent: results.length,
      results,
      pushNotificationSent: pushSent
    };
    
  } catch (error) {
    console.error("❌ Error in sendBulkNotification:", error.message);
    return { success: false, error: error.message };
  }
}