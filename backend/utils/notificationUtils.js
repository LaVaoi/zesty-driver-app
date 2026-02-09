// utils/notificationUtils.js - SIMPLIFIED
import pool from '../config/db.js';

// Function to send in-app notification (database only)
export const sendInAppNotification = async ({ toUserType, toUserId, title, message, data = {} }) => {
  try {
    console.log(`📱 Saving in-app notification: ${title} to ${toUserType} ${toUserId}`);
    
    const [result] = await pool.query(
      `INSERT INTO notifications (user_type, user_id, title, message) 
       VALUES (?, ?, ?, ?)`,
      [toUserType, toUserId, title, message]
    );
    
    console.log(`✅ In-App Notification saved with ID: ${result.insertId}`);
    
    // Trigger will automatically add to notification_queue
    // WebSocket will pick it up from there
    
    return result.insertId;
  } catch (error) {
    console.error('❌ Error saving in-app notification:', error);
    return null;
  }
};

// REMOVE sendCompleteNotification and sendWebSocketNotification
// They're no longer needed - WebSocket handles it automatically

// Common notification types (keep as is)
export const NOTIFICATION_TYPES = {
  ORDER_PLACED: {
    title: 'Order Confirmed',
    message: (orderNumber) => `Your order #${orderNumber} has been received and is being processed.`
  },
  ORDER_PREPARING: {
    title: 'Order Update',
    message: (orderNumber) => `Your order #${orderNumber} is now being prepared.`
  },
  ORDER_OUT_FOR_DELIVERY: {
    title: 'Out for Delivery',
    message: (orderNumber) => `Your order #${orderNumber} is on its way to you!`
  },
  ORDER_DELIVERED: {
    title: 'Order Delivered',
    message: (orderNumber) => `Your order #${orderNumber} has been delivered. Enjoy your meal!`
  },
  ORDER_CANCELLED: {
    title: 'Order Cancelled',
    message: (orderNumber) => `Your order #${orderNumber} has been cancelled.`
  },
  DELIVERY_MAN_ASSIGNED: {
    title: 'Delivery Man Assigned',
    message: (orderNumber, deliveryManName) => `${deliveryManName} has been assigned to your order #${orderNumber}.`
  },
  PROMOTION: {
    title: 'Special Offer',
    message: (offer) => `New promotion available: ${offer}`
  }
};

// Helper function to send order notifications
export const sendOrderNotification = async (userId, orderNumber, status, deliveryManName = null) => {
  try {
    const notificationType = NOTIFICATION_TYPES[status];
    if (!notificationType) {
      console.log(`⚠️ No notification type found for status: ${status}`);
      return false;
    }
    
    const message = deliveryManName 
      ? notificationType.message(orderNumber, deliveryManName)
      : notificationType.message(orderNumber);
    
    // Just save to DB - WebSocket will pick it up automatically
    const notificationId = await sendInAppNotification({
      toUserType: 'client',
      toUserId: userId,
      title: notificationType.title,
      message: message,
      data: {
        order_number: orderNumber,
        status: status,
        type: 'order_update'
      }
    });
    
    return notificationId !== null;
  } catch (error) {
    console.error(`❌ Error sending order notification (${status}):`, error);
    return false;
  }
};