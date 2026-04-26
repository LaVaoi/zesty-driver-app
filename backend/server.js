import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import db, { initDB } from "./config/db.js";
import pool from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import dealRoutes from "./routes/dealRoutes.js";
import deliveryManRoutes from "./routes/deliveryManRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import notificationRoutes from './routes/notificationRoutes.js';
import restaurantRoutes from "./routes/restaurantRoutes.js";
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import adminNotificationRoutes from './routes/adminNotificationRoutes.js';
import { checkAndUpdateIsOpen } from './controllers/adminController.js';
dotenv.config();

const app = express();

// Configure CORS with explicit options
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));

app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/restaurants", restaurantRoutes); // Add this line
app.use("/api/delivery", deliveryManRoutes);
app.use("/api/admin", adminRoutes);
app.use('/uploads', express.static('uploads'));
app.use("/api/deals", dealRoutes);
app.use("/search", searchRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/notifications', adminNotificationRoutes); // Add this line
const PORT = process.env.PORT || 8000;

// Create HTTP server
const server = createServer(app);

// Create WebSocket server attached to the same HTTP server
const wss = new WebSocketServer({
  server,
  perMessageDeflate: {
    zlibDeflateOptions: {
      chunkSize: 1024,
      memLevel: 7,
      level: 3
    },
    zlibInflateOptions: {
      chunkSize: 10 * 1024
    },
    clientNoContextTakeover: true,
    serverNoContextTakeover: true,
    serverMaxWindowBits: 10,
    concurrencyLimit: 10,
    threshold: 1024
  }
});

// Store connected clients: {userId}_{userType} -> WebSocket
const connectedClients = new Map();

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`🔌 New WebSocket connection from ${clientIp}`);

  // Set up ping/pong to keep connection alive
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', async (message) => {
    let connection1 = null; // For subscribe
    let connection2 = null; // For notification_read

    try {
      const data = JSON.parse(message.toString());
      console.log('📨 WebSocket message received:', data.type, 'from', data.userId, data.userType);

      if (data.type === 'subscribe' && data.userId && data.userType) {
        const clientKey = `${data.userId}_${data.userType}`;

        // Store connection with client key
        connectedClients.set(clientKey, ws);
        ws.clientKey = clientKey;
        ws.userId = data.userId;
        ws.userType = data.userType;

        console.log(`📱 ${data.userType} ${data.userId} subscribed to notifications`);
        console.log(`🔗 Total connected clients: ${connectedClients.size}`);

        // Send current unread count
        try {
          connection1 = await pool.getConnection();
          const [result] = await connection1.query(
            "SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND user_type = ? AND is_read = 0",
            [data.userId, data.userType]
          );

          const unreadCount = result[0]?.count || 0;
          console.log(`📊 Sending unread count to ${data.userType} ${data.userId}: ${unreadCount}`);

          ws.send(JSON.stringify({
            type: 'unread_count_update',
            count: unreadCount
          }));
        } catch (error) {
          console.error('Error fetching unread count:', error);
        }
      }

      if (data.type === 'notification_read' && data.notificationId) {
        // Handle notification read receipt
        try {
          connection2 = await pool.getConnection(); // SEPARATE connection

          // Mark notification as read
          await connection2.query(
            "UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ? AND user_type = ?",
            [data.notificationId, ws.userId, ws.userType]
          );
          console.log(`✅ Notification ${data.notificationId} marked as read by ${ws.userType} ${ws.userId}`);

          // Get updated unread count
          const [result] = await connection2.query(
            "SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND user_type = ? AND is_read = 0",
            [ws.userId, ws.userType]
          );

          const unreadCount = result[0]?.count || 0;

          // Send updated unread count to the client who marked it as read
          ws.send(JSON.stringify({
            type: 'unread_count_update',
            count: unreadCount
          }));

          console.log(`📊 Updated unread count for ${ws.userType} ${ws.userId}: ${unreadCount}`);

        } catch (error) {
          console.error('Error updating notification read status:', error);
        }
      }

    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    } finally {
      // RELEASE BOTH connections if they exist
      if (connection1) {
        try {
          connection1.release();
        } catch (releaseError) {
          console.error('Error releasing connection1:', releaseError.message);
        }
      }
      if (connection2) {
        try {
          connection2.release();
        } catch (releaseError) {
          console.error('Error releasing connection2:', releaseError.message);
        }
      }
    }
  });

  ws.on('close', () => {
    if (ws.clientKey) {
      connectedClients.delete(ws.clientKey);
      console.log(`👋 ${ws.userType || 'User'} ${ws.userId || 'Unknown'} disconnected from WebSocket`);
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Function to send notification to specific user
export const sendNotificationToUser = (userId, userType, notificationData) => {
  const clientKey = `${userId}_${userType}`;
  const ws = connectedClients.get(clientKey);

  if (ws && ws.readyState === 1) { // 1 = OPEN
    try {
      // First, send the new notification
      ws.send(JSON.stringify({
        type: 'new_notification',
        data: notificationData
      }));

      console.log(`📨 Sent real-time notification to ${userType} ${userId}`);

      // Then, fetch and send updated unread count
      pool.getConnection().then(connection => {
        connection.query(
          "SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND user_type = ? AND is_read = 0",
          [userId, userType]
        ).then(([result]) => {
          const unreadCount = result[0]?.count || 0;

          // Send unread count update
          ws.send(JSON.stringify({
            type: 'unread_count_update',
            count: unreadCount
          }));

          console.log(`📊 Sent unread count update to ${userType} ${userId}: ${unreadCount}`);

          connection.release();
        }).catch(error => {
          console.error(`Error fetching unread count for ${userType} ${userId}:`, error);
          connection.release();
        });
      }).catch(error => {
        console.error(`Error getting connection for unread count:`, error);
      });

      return true;
    } catch (error) {
      console.error(`Error sending to ${userType} ${userId}:`, error);
      return false;
    }
  }

  console.log(`⚠️ ${userType} ${userId} not connected to WebSocket`);
  return false;
};

// Function to broadcast to all users of a type
export const broadcastToUserType = (userType, data) => {
  let sentCount = 0;
  console.log(`📢 Broadcasting to ${userType}, data type: ${data.type}`);

  connectedClients.forEach((ws, key) => {
    if (key.endsWith(`_${userType}`) && ws.readyState === 1) {
      try {
        ws.send(JSON.stringify(data));
        sentCount++;
        console.log(`   ✅ Sent to ${key}`);
      } catch (error) {
        console.error(`   ❌ Error broadcasting to ${key}:`, error.message);
      }
    }
  });

  console.log(`📢 Broadcasted to ${sentCount} ${userType}(s)`);
  return sentCount;
};

// Process notification queue for offline users - FIXED with proper connection management
const processNotificationQueue = async () => {
  let connection; // ADDED: Declare connection variable
  try {
    connection = await pool.getConnection(); // GET CONNECTION

    // Get unprocessed notifications from queue (last 30 minutes)
    const [pendingNotifications] = await connection.query(`
      SELECT nq.*, n.title, n.message, n.is_read, n.created_at
      FROM notification_queue nq
      JOIN notifications n ON nq.notification_id = n.id
      WHERE nq.processed = FALSE
      AND nq.created_at > DATE_SUB(NOW(), INTERVAL 30 MINUTE)
      AND nq.attempts < 3
      ORDER BY nq.created_at ASC
      LIMIT 20
    `);

    if (pendingNotifications.length > 0) {
      console.log(`🔍 Processing ${pendingNotifications.length} queued notifications`);
    }

    for (const queueItem of pendingNotifications) {
      let itemConnection; // ADDED: Separate connection for each item
      try {
        // Parse data field if it exists
        let notificationData = {};
        if (queueItem.data) {
          try {
            notificationData = JSON.parse(queueItem.data);
          } catch (parseError) {
            console.error(`Error parsing data for queue item ${queueItem.id}:`, parseError);
          }
        }

        // Try to send via WebSocket
        const sent = sendNotificationToUser(
          queueItem.user_id.toString(),
          queueItem.user_type,
          {
            id: queueItem.notification_id,
            title: queueItem.title,
            message: queueItem.message,
            is_read: queueItem.is_read,
            created_at: queueItem.created_at,
            data: notificationData
          }
        );

        if (sent) {
          // Mark as processed - use separate connection
          itemConnection = await pool.getConnection();
          await itemConnection.query(
            'UPDATE notification_queue SET processed = TRUE WHERE id = ?',
            [queueItem.id]
          );
          console.log(`✅ Queued notification sent to ${queueItem.user_type} ${queueItem.user_id}`);
        } else {
          // Increment attempts - use separate connection
          if (!itemConnection) itemConnection = await pool.getConnection();
          await itemConnection.query(
            'UPDATE notification_queue SET attempts = attempts + 1 WHERE id = ?',
            [queueItem.id]
          );
        }
      } catch (error) {
        console.error(`Error processing queue item ${queueItem.id}:`, error);
      } finally {
        if (itemConnection) {
          try {
            itemConnection.release(); // RELEASE ITEM CONNECTION
          } catch (releaseError) {
            console.error('Error releasing item connection:', releaseError.message);
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Error processing notification queue:', error);
  } finally {
    if (connection) {
      try {
        connection.release(); // CRITICAL: RELEASE MAIN CONNECTION
      } catch (releaseError) {
        console.error('Error releasing main connection:', releaseError.message);
      }
    }
  }
};

// Keep connections alive with ping/pong - REDUCED FREQUENCY
const pingInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      console.log(`💀 Terminating dead WebSocket connection: ${ws.clientKey || 'unknown'}`);
      return ws.terminate();
    }

    ws.isAlive = false;
    ws.ping();
  });
}, 120000); // CHANGED: Ping every 2 minutes instead of 30 seconds

// Process queue every 30 seconds instead of 3 seconds
const queueInterval = setInterval(processNotificationQueue, 30000); // CHANGED: Every 30 seconds

// Function to log database notification status
const logNotificationStatus = async () => {
  try {
    const connection = await pool.getConnection();

    // Count admin notifications
    const [adminNotifications] = await connection.query(
      "SELECT COUNT(*) as total, SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread FROM notifications WHERE user_type = 'admin'"
    );

    // Count admin notification queue
    const [adminQueue] = await connection.query(
      "SELECT COUNT(*) as total FROM notification_queue WHERE user_type = 'admin' AND processed = FALSE"
    );

    // Count active admins
    const [activeAdmins] = await connection.query(
      "SELECT COUNT(*) as total FROM admins WHERE is_active = 1"
    );

    console.log('📊 NOTIFICATION STATUS:');
    console.log(`   👑 Active Admins: ${activeAdmins[0]?.total || 0}`);
    console.log(`   📨 Admin Notifications: ${adminNotifications[0]?.total || 0} total, ${adminNotifications[0]?.unread || 0} unread`);
    console.log(`   ⏳ Admin Queue Pending: ${adminQueue[0]?.total || 0}`);
    console.log(`   🔗 Connected Clients: ${connectedClients.size}`);

    // List connected admins
    let adminConnections = 0;
    connectedClients.forEach((ws, key) => {
      if (key.includes('_admin')) {
        adminConnections++;
      }
    });
    console.log(`   📱 Connected Admin Clients: ${adminConnections}`);

    connection.release();
  } catch (error) {
    console.error('Error logging notification status:', error);
  }
};

// Add periodic logging
const statusLogInterval = setInterval(logNotificationStatus, 30000); // Every 30 seconds

// Scheduler for automatic is_open updates (runs every minute)
let isOpenSchedulerInterval = null;

const startIsOpenScheduler = async () => {
  const runBatchUpdate = async () => {
    let connection;
    try {
      connection = await pool.getConnection();
      
      // Include both manual_override and its expiration
      const [restaurants] = await connection.execute(
        'SELECT id, name, manual_override, manual_override_expires_at FROM restaurants'
      );
      
      for (const restaurant of restaurants) {
        // ---- Handle manual override with expiration ----
        if (restaurant.manual_override) {
          const now = new Date();
          const expiresAt = restaurant.manual_override_expires_at ? new Date(restaurant.manual_override_expires_at) : null;

          // If expired, clear override and fall through to schedule update
          if (expiresAt && now > expiresAt) {
            console.log(`[Scheduler] ${restaurant.name}: manual override EXPIRED, reverting to schedule`);
            await connection.execute(
              'UPDATE restaurants SET manual_override = false, manual_override_expires_at = NULL WHERE id = ?',
              [restaurant.id]
            );
            // Do NOT skip – continue to calculate and apply schedule
          } else {
            // Still valid manual override – skip this restaurant
            console.log(`[Scheduler] ${restaurant.name}: SKIPPED (manual override active until ${expiresAt?.toLocaleString()})`);
            continue;
          }
        }

        // ---- Calculate schedule-based status ----
        const shouldBeOpen = await calculateIsOpenFromSchedule(connection, restaurant.id);
        
        // Get current value
        const [[current]] = await connection.execute(
          'SELECT is_open FROM restaurants WHERE id = ?',
          [restaurant.id]
        );
        
        // Update only if changed
        if (current && current.is_open !== (shouldBeOpen ? 1 : 0)) {
          await connection.execute(
            'UPDATE restaurants SET is_open = ? WHERE id = ?',
            [shouldBeOpen ? 1 : 0, restaurant.id]
          );
          console.log(`[Scheduler] ${restaurant.name}: ${shouldBeOpen ? 'OPEN' : 'CLOSED'} (updated)`);
        } else {
          console.log(`[Scheduler] ${restaurant.name}: ${shouldBeOpen ? 'OPEN' : 'CLOSED'} (unchanged)`);
        }
      }
    } catch (error) {
      console.error('Error in is_open scheduler batch:', error);
    } finally {
      if (connection) connection.release();
    }
  };

  // Helper function to calculate open status from schedule (without updating)
  const calculateIsOpenFromSchedule = async (connection, restaurant_id) => {
    try {
      const serverTime = new Date();
      const moroccoTimeStr = serverTime.toLocaleString("en-US", {timeZone: "Africa/Casablanca"});
      const moroccoTime = new Date(moroccoTimeStr);
      
      const currentDay = moroccoTime.getDay();
      const yesterday = (currentDay + 6) % 7;

      const [rows] = await connection.execute(`
        SELECT day_of_week, is_closed, open_time, close_time
        FROM restaurant_operating_hours
        WHERE restaurant_id = ? AND day_of_week IN (?, ?)
      `, [restaurant_id, currentDay, yesterday]);

      const todayHours = rows.find(r => r.day_of_week === currentDay);
      const yesterdayHours = rows.find(r => r.day_of_week === yesterday);

      const getShiftDate = (refDate, timeStr, dayOffset = 0) => {
        const d = new Date(refDate);
        d.setDate(d.getDate() + dayOffset);
        const [h, m] = timeStr.split(':');
        d.setHours(parseInt(h), parseInt(m), 0, 0);
        return d;
      };

      // Check today's hours
      if (todayHours && !todayHours.is_closed) {
        const openToday = getShiftDate(moroccoTime, todayHours.open_time);
        let closeToday = getShiftDate(moroccoTime, todayHours.close_time);
        if (closeToday <= openToday) closeToday.setDate(closeToday.getDate() + 1);
        if (moroccoTime >= openToday && moroccoTime < closeToday) return true;
      }

      // Check yesterday's overnight hours
      if (yesterdayHours && !yesterdayHours.is_closed) {
        const openYesterday = getShiftDate(moroccoTime, yesterdayHours.open_time, -1);
        let closeYesterday = getShiftDate(moroccoTime, yesterdayHours.close_time, -1);
        if (closeYesterday <= openYesterday) {
          closeYesterday.setDate(closeYesterday.getDate() + 1);
          if (moroccoTime >= openYesterday && moroccoTime < closeYesterday) return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Error calculating schedule status:', error);
      return false;
    }
  };

  // Run initial update
  await runBatchUpdate();
  
  // Schedule every minute
  setInterval(runBatchUpdate, 60000);
  console.log('⏰ Multi-restaurant scheduler active - respects manual overrides');
};

// Cleanup on server shutdown
server.on('close', () => {
  clearInterval(pingInterval);
  clearInterval(queueInterval);
  clearInterval(statusLogInterval);
  if (isOpenSchedulerInterval) {
    clearInterval(isOpenSchedulerInterval);
    console.log('⏰ Restaurant scheduler stopped');
  }
  console.log('🔌 WebSocket server cleanup complete');
});

// Wrap in async IIFE to call initDB before server starts
(async () => {
  try {
    await initDB(); // ✅ create table if it doesn't exist


    server.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${PORT} (HTTP & WebSocket)`);
      console.log(`🌐 WebSocket URL: ws://localhost:${PORT}`);

      // Start the is_open scheduler
      startIsOpenScheduler();

      // Log initial status after 5 seconds
      setTimeout(() => {
        logNotificationStatus();
      }, 5000);
    });
  } catch (error) {
    console.error("❌ Failed to initialize DB:", error.message);
    process.exit(1);
  }
})();

export { wss };