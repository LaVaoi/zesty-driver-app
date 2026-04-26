// routes/notificationRoutes.js
import express from 'express';
import { createNotification, getNotifications, getUnreadCount, markAllNotificationsAsRead, markNotificationAsRead, registerToken, unregisterToken } from '../controllers/notificationController.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import pool from '../config/db.js';
import jwt from "jsonwebtoken";
const router = express.Router();
router.post('/register-token', registerToken);
router.post('/unregister-token', unregisterToken);



router.use(verifyToken);


// Get notifications with pagination
router.get('/', getNotifications);

// Mark single notification as read
router.post('/mark-read', markNotificationAsRead);

// Mark all notifications as read for a user
router.post('/mark-all-read', markAllNotificationsAsRead);

// Get unread count
router.get('/unread-count', getUnreadCount);

// Create new notification (for testing or admin use)
router.post('/', createNotification);


router.post('/register-token-admin', async (req, res) => {
  // 1. Get token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }
  const token = authHeader.split(' ')[1];

  try {
    // 2. Verify the token and get admin ID
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const adminId = decoded.id; // adjust based on your token payload

    // 3. Get device token from body
    const { token: deviceToken, platform } = req.body;
    if (!deviceToken) {
      return res.status(400).json({ error: 'Device token is required' });
    }

    // 4. Update the admin's fcm_token
    const sql = `UPDATE admins SET fcm_token = ?, updated_at = NOW() WHERE id = ?`;
    const [result] = await pool.execute(sql, [deviceToken, adminId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    console.log(`✅ FCM token updated for admin #${adminId}`);
    res.json({ success: true });
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    console.error('❌ Error saving FCM token:', err);
    res.status(500).json({ error: 'Database error' });
  }
});


export default router;
