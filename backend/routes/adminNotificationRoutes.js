import express from 'express';
import db from '../config/db.js';
import { verifyAdminToken } from '../middleware/adminAuth.js';

const router = express.Router();

/**
 * Get unread notification count for admin
 */
router.get('/admin/unread-count', verifyAdminToken, async (req, res) => {
  try {
    const adminId = req.user.id;
    
    const [result] = await db.execute(
      "SELECT COUNT(*) as count FROM notifications WHERE user_type = 'admin' AND user_id = ? AND is_read = 0",
      [adminId]
    );
    
    res.json({
      success: true,
      count: result[0]?.count || 0
    });
    
  } catch (error) {
    console.error('Error fetching admin unread count:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * Get total notification count for admin
 */
router.get('/admin/total', verifyAdminToken, async (req, res) => {
  try {
    const adminId = req.adminId;
    
    const [result] = await db.execute(
      "SELECT COUNT(*) as count FROM notifications WHERE user_type = 'admin' AND user_id = ?",
      [adminId]
    );
    
    res.json({
      success: true,
      count: result[0]?.count || 0
    });
    
  } catch (error) {
    console.error('Error fetching admin total count:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * Get recent notifications for admin
 */
router.post('/admin/recent', verifyAdminToken, async (req, res) => {
  try {
    // Get adminId set by middleware
    const adminId = req.adminId;
    
    // Check for admin ID existence, which is critical.
    if (!adminId) {
        console.error('Error fetching admin notifications: adminId missing');
        return res.status(401).json({ success: false, error: 'Unauthorized: Admin ID not found' });
    }
    
    // Define the SQL query string
    const sqlQuery = `
        SELECT id, title, message, is_read, data, created_at 
        FROM notifications 
        WHERE user_type = 'admin' AND user_id = ?
        ORDER BY created_at DESC 
    `;
    
    // Execute the query, applying .trim() to eliminate leading/trailing whitespace and hidden characters
    const [notifications] = await db.execute(
        sqlQuery.trim(),
      [adminId]
    );
    
    // Parse JSON data
    const formattedNotifications = notifications.map(notification => {
      let data = {};
      try {
            // Check 1: If it's already an object (auto-parsed by MySQL driver from JSON column)
            if (typeof notification.data === 'object' && notification.data !== null) {
                data = notification.data;
            } 
            // Check 2: If it's a non-empty string, attempt to parse it
            else if (typeof notification.data === 'string' && notification.data.trim() !== '') {
                data = JSON.parse(notification.data);
            } 
            // Else, use the default empty object
            else {
                data = {};
            }
      } catch (error) {
        console.error('Error parsing notification data:', error);
        data = {}; // Ensure the response remains stable even on parse failure
      }
      
      return {
        id: notification.id,
        title: notification.title,
        message: notification.message,
        is_read: Boolean(notification.is_read),
        created_at: notification.created_at,
        data: data, // Use the safely parsed or assigned object
        type: data.type || 'general'
      };
    });
    
    res.json({
      success: true,
      notifications: formattedNotifications
    });
  } catch (error) {
    console.error('Error fetching admin notifications:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * Mark notification as read
 */
router.post('/:id/read', verifyAdminToken, async (req, res) => {
  try {
    const notificationId = req.params.id;
    const adminId = req.adminId;
    
    const [result] = await db.execute(
      `UPDATE notifications 
       SET is_read = 1, updated_at = NOW() 
       WHERE id = ? AND user_type = 'admin' AND user_id = ?`,
      [notificationId, adminId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Notification not found or access denied' 
      });
    }
    
    res.json({
      success: true,
      message: 'Notification marked as read'
    });
    
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * Mark all notifications as read for admin
 */
router.post('/admin/mark-all-read', verifyAdminToken, async (req, res) => {
  try {
    const adminId = req.adminId;
    
    const [result] = await db.execute(
      `UPDATE notifications 
       SET is_read = 1, updated_at = NOW() 
       WHERE user_type = 'admin' AND user_id = ? AND is_read = 0`,
      [adminId]
    );
    
    res.json({
      success: true,
      message: `Marked ${result.affectedRows} notifications as read`
    });
    
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * Delete notification
 */
router.delete('/:id', verifyAdminToken, async (req, res) => {
  try {
    const notificationId = req.params.id;
    const adminId = req.user.id;
    
    const [result] = await db.execute(
      `DELETE FROM notifications 
       WHERE id = ? AND user_type = 'admin' AND user_id = ?`,
      [notificationId, adminId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Notification not found or access denied' 
      });
    }
    
    // Also delete from queue
    await db.execute(
      `DELETE FROM notification_queue WHERE notification_id = ?`,
      [notificationId]
    );
    
    res.json({
      success: true,
      message: 'Notification deleted'
    });
    
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * Clear all notifications for admin
 */
router.delete('/admin/clear-all', verifyAdminToken, async (req, res) => {
  try {
    const adminId = req.adminId;
    
    // Get notification IDs first
    const [notifications] = await db.execute(
      `SELECT id FROM notifications 
       WHERE user_type = 'admin' AND user_id = ?`,
      [adminId]
    );
    
    if (notifications.length > 0) {
      const notificationIds = notifications.map(n => n.id);
      
      // Delete from queue first
      await db.execute(
        `DELETE FROM notification_queue 
         WHERE notification_id IN (${notificationIds.map(() => '?').join(',')})`,
        notificationIds
      );
      
      // Delete from notifications
      await db.execute(
        `DELETE FROM notifications 
         WHERE user_type = 'admin' AND user_id = ?`,
        [adminId]
      );
    }
    
    res.json({
      success: true,
      message: 'All notifications cleared'
    });
    
  } catch (error) {
    console.error('Error clearing all notifications:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

export default router;