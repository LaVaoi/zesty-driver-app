// controllers/notificationController.js
import { saveDeviceToken, removeDeviceToken } from '../utils/notificationService.js';
import pool from "../config/db.js"; // CHANGE TO THIS

export const registerToken = async (req, res) => {
  try {
    const { userType, userId, token, platform } = req.body;
    if (!userType || !userId || !token) return res.status(400).json({ error: 'Missing fields' });
    await saveDeviceToken({ userType, userId, token, platform });
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
};

export const unregisterToken = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'token required' });
    await removeDeviceToken(token);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// start the notification service on server start
export const getNotifications = async (req, res) => {
  console.log('🔔 getNotifications called');
  console.log('📱 User ID from token:', req.clientId || req.userId);
  
  try {
    const user_id = req.clientId || req.userId;
    const { limit = 20, offset = 0 } = req.query;
    
    if (!user_id) {
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized' 
      });
    }
    
    console.log(`🔍 Querying notifications for user ${user_id}`);
    
    const [notifications] = await pool.query(
      `SELECT 
        id,
        title,
        message,
        is_read,
        data,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as created_at
       FROM notifications 
       WHERE user_type = 'client' AND user_id = ? 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [parseInt(user_id), parseInt(limit), parseInt(offset)]
    );

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total 
       FROM notifications 
       WHERE user_type = 'client' AND user_id = ?`,
      [parseInt(user_id)]
    );

    const [unreadResult] = await pool.query(
      `SELECT COUNT(*) as unread_count 
       FROM notifications 
       WHERE user_type = 'client' AND user_id = ? AND is_read = FALSE`,
      [parseInt(user_id)]
    );

    res.json({
      success: true,
      notifications,
      pagination: {
        total: countResult[0]?.total || 0,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + notifications.length) < (countResult[0]?.total || 0)
      },
      unread_count: unreadResult[0]?.unread_count || 0
    });
    
  } catch (error) {
    console.error('❌ Error in getNotifications:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

export const markNotificationAsRead = async (req, res) => {
  try {
    const { notification_id } = req.body;
    
    if (!notification_id) {
      return res.status(400).json({
        success: false,
        message: 'notification_id is required'
      });
    }

    const [result] = await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = ?',
      [parseInt(notification_id)]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read'
    });
  }
};

export const markAllNotificationsAsRead = async (req, res) => {
  try {
    const user_id = req.clientId || req.userId;
    
    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: 'User ID not found in token'
      });
    }

    const [result] = await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE user_type = "client" AND user_id = ?',
      [parseInt(user_id)]
    );

    res.json({
      success: true,
      message: `Marked ${result.affectedRows} notifications as read`
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read'
    });
  }
};

export const getUnreadCount = async (req, res) => {
  try {
    const user_id = req.clientId;
    const { after } = req.query;
    
    if (!user_id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    let query = `SELECT COUNT(*) as count FROM notifications 
                 WHERE user_type = 'client' AND user_id = ? AND is_read = FALSE`;
    const params = [user_id];
    
    if (after) {
      query += ' AND created_at > ?';
      params.push(after);
    }

    const [result] = await pool.query(query, params);
    const count = result[0]?.count || 0;
    
    res.json({ success: true, count });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const createNotification = async (req, res) => {
  try {
    const { user_type, user_id, title, message } = req.body;
    
    if (!user_type || !user_id || !title || !message) {
      return res.status(400).json({
        success: false,
        message: 'user_type, user_id, title, and message are required'
      });
    }

    const [result] = await pool.query(
      `INSERT INTO notifications (user_type, user_id, title, message) 
       VALUES (?, ?, ?, ?)`,
      [user_type, parseInt(user_id), title, message]
    );
    res.json({
      success: true,
      message: 'Notification created successfully',
      notification_id: result.insertId
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create notification'
    });
  }
};