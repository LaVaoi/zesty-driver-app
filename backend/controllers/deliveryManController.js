import pool from "../config/db.js";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import fs from "fs";
import { sendNotification } from "../utils/notificationService.js";

// Get delivery man profile
export const getDeliveryManProfile = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.execute(
      `SELECT id, name, email, phone, vehicle_type, license_number, image,
       is_active, current_latitude, current_longitude, last_location_update, created_at
       FROM delivery_men WHERE id = ?`,
      [req.deliveryManId]
    );
    connection.release();

    if (rows.length === 0) {
      return res.status(404).json({ message: "Delivery man not found" });
    }

    res.json({ deliveryMan: rows[0] });
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Update delivery man profile
export const updateDeliveryManProfile = async (req, res) => {
  let connection;
  try {
    const { name, email, phone, vehicle_type, license_number } = req.body;

    connection = await pool.getConnection();

    // Get old image from DB
    const [oldRows] = await connection.execute(
      "SELECT image FROM delivery_men WHERE id = ?",
      [req.deliveryManId]
    );
    const oldImage = oldRows[0]?.image;

    // ✅ FIX: Only update image if a new file was actually uploaded
    let shouldUpdateImage = false;
    let imagePath = null;

    // Handle uploaded image - ONLY if a file was actually uploaded
    if (req.file) {
      // User uploaded a new image file
      shouldUpdateImage = true;
      imagePath = req.file.filename;

      // Delete old image if exists
      if (oldImage) {
        const oldPath = path.join("uploads/profileImages", oldImage);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
    }
    // ✅ If no file uploaded, don't touch the image field at all

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push("name = ?");
      values.push(name);
    }
    if (email !== undefined) {
      updates.push("email = ?");
      values.push(email);
    }
    if (phone !== undefined) {
      updates.push("phone = ?");
      values.push(phone);
    }
    if (vehicle_type !== undefined) {
      updates.push("vehicle_type = ?");
      values.push(vehicle_type);
    }
    if (license_number !== undefined) {
      updates.push("license_number = ?");
      values.push(license_number);
    }
    // ✅ FIX: Only add image to update if new file was uploaded
    if (shouldUpdateImage) {
      updates.push("image = ?");
      values.push(imagePath);
    }

    if (updates.length === 0) {
      connection.release();
      return res.status(400).json({ message: "No fields to update" });
    }

    values.push(req.deliveryManId);
    await connection.execute(
      `UPDATE delivery_men SET ${updates.join(", ")} WHERE id = ?`,
      values
    );

    // Get updated profile
    const [updatedRows] = await connection.execute(
      `SELECT id, name, email, phone, vehicle_type, license_number, image,
       is_active, current_latitude, current_longitude, last_location_update, created_at
       FROM delivery_men WHERE id = ?`,
      [req.deliveryManId]
    );

    connection.release();

    res.json({
      message: "Profile updated successfully",
      deliveryMan: updatedRows[0],
    });
  } catch (error) {
    if (connection) connection.release();
    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Update delivery man location
export const updateDeliveryManLocation = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const connection = await pool.getConnection();

    await connection.execute(
      "UPDATE delivery_men SET current_latitude = ?, current_longitude = ?, last_location_update = NOW() WHERE id = ?",
      [latitude, longitude, req.deliveryManId]
    );
    connection.release();

    res.json({ message: "Location updated successfully" });
  } catch (error) {
    console.error("Error updating location:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get dashboard metrics
export const getDashboardMetrics = async (req, res) => {
  try {
    const connection = await pool.getConnection();

    // Get deliveryManId from JWT token (should be set by your auth middleware)
    const deliveryManId = req.deliveryManId || req.user?.id;

    if (!deliveryManId) {
      return res.status(401).json({ message: "Delivery man ID not found in request" });
    }

    console.log("Fetching metrics for delivery man ID:", deliveryManId);

    // First, let's verify the delivery man exists
    const [deliveryMan] = await connection.execute(
      "SELECT id FROM delivery_men WHERE id = ?",
      [deliveryManId]
    );

    if (deliveryMan.length === 0) {
      connection.release();
      return res.status(404).json({ message: "Delivery man not found" });
    }

    // Debug: Check what orders exist for this delivery man
    const [debugOrders] = await connection.execute(
      "SELECT status, COUNT(*) as count FROM orders WHERE delivery_man_id = ? GROUP BY status",
      [deliveryManId]
    );
    console.log("Orders by status:", debugOrders);

    // Overall order statistics - ALL orders assigned to delivery man
    const [orderStats] = await connection.execute(
      `SELECT 
        COUNT(*) as total_orders,
        SUM(CASE WHEN status = 'Delivered' THEN 1 ELSE 0 END) as completed_orders,
        SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending_orders,
        SUM(CASE WHEN status = 'OutForDelivery' THEN 1 ELSE 0 END) as out_for_delivery_orders,
        SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END) as cancelled_orders,
        SUM(CASE WHEN status = 'Preparing' THEN 1 ELSE 0 END) as preparing_orders
       FROM orders WHERE delivery_man_id = ?`,
      [deliveryManId]
    );

    // Comprehensive earnings analysis - using COALESCE to handle NULL values
    const [earningsAnalysis] = await connection.execute(
      `SELECT 
        COALESCE(SUM(delivery_fee), 0) as total_delivery_fees,
        COALESCE(SUM(total_price), 0) as total_order_revenue,
        COALESCE(SUM(final_price), 0) as total_earnings,
        COUNT(*) as total_count,
        COALESCE(AVG(total_price), 0) as avg_order_value
       FROM orders WHERE delivery_man_id = ? AND status = 'Delivered'`,
      [deliveryManId]
    );

    console.log("Raw earnings analysis:", earningsAnalysis[0]);

    // Today's performance - use COALESCE for all calculations
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [todayPerformance] = await connection.execute(
      `SELECT 
          COUNT(*) AS today_orders,

          -- Counts by status
          SUM(CASE WHEN status = 'Delivered' THEN 1 ELSE 0 END) AS today_completed,
          SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END) AS today_cancelled,
          SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) AS today_pending,
          SUM(CASE WHEN status = 'OutForDelivery' THEN 1 ELSE 0 END) AS today_out_for_delivery,
          SUM(CASE WHEN status = 'Preparing' THEN 1 ELSE 0 END) AS today_preparing,

          -- Earnings only from delivered orders
          COALESCE(SUM(CASE WHEN status = 'Delivered' THEN delivery_fee ELSE 0 END), 0) AS today_delivery_fees,
          COALESCE(SUM(CASE WHEN status = 'Delivered' THEN total_price ELSE 0 END), 0) AS today_order_revenue,
          COALESCE(SUM(CASE WHEN status = 'Delivered' THEN final_price ELSE 0 END), 0) AS today_total_earnings,
          COALESCE(AVG(CASE WHEN status = 'Delivered' THEN total_price END), 0) AS today_avg_order_value

      FROM orders
      WHERE delivery_man_id = ?
        AND DATE(created_at) = CURDATE()`,
      [deliveryManId]
    );
    // Yesterday's performance
    const [yesterdayPerformance] = await connection.execute(
      `SELECT 
          COUNT(*) AS yesterday_orders,

          -- Counts by status
          SUM(CASE WHEN status = 'Delivered' THEN 1 ELSE 0 END) AS yesterday_completed,
          SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END) AS yesterday_cancelled,
          SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) AS yesterday_pending,
          SUM(CASE WHEN status = 'OutForDelivery' THEN 1 ELSE 0 END) AS yesterday_out_for_delivery,
          SUM(CASE WHEN status = 'Preparing' THEN 1 ELSE 0 END) AS yesterday_preparing,

          -- Earnings only from delivered orders
          COALESCE(SUM(CASE WHEN status = 'Delivered' THEN delivery_fee ELSE 0 END), 0) AS yesterday_delivery_fees,
          COALESCE(SUM(CASE WHEN status = 'Delivered' THEN total_price ELSE 0 END), 0) AS yesterday_order_revenue,
          COALESCE(SUM(CASE WHEN status = 'Delivered' THEN final_price ELSE 0 END), 0) AS yesterday_total_earnings,
          COALESCE(AVG(CASE WHEN status = 'Delivered' THEN total_price END), 0) AS yesterday_avg_order_value

      FROM orders 
      WHERE delivery_man_id = ? 
        AND DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)`,
      [deliveryManId]
    );
    // Weekly performance (last 7 days)
    const [weeklyPerformance] = await connection.execute(
      `SELECT 
          COUNT(*) AS weekly_orders,
          -- Counts by status
          SUM(CASE WHEN status = 'Delivered' THEN 1 ELSE 0 END) AS weekly_delivered,
          SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END) AS weekly_cancelled,
          SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) AS weekly_pending,
          SUM(CASE WHEN status = 'OutForDelivery' THEN 1 ELSE 0 END) AS weekly_out_for_delivery,
          SUM(CASE WHEN status = 'Preparing' THEN 1 ELSE 0 END) AS weekly_preparing,

          -- Earnings only from delivered orders
          COALESCE(SUM(CASE WHEN status = 'Delivered' THEN delivery_fee ELSE 0 END), 0) AS weekly_delivery_fees,
          COALESCE(SUM(CASE WHEN status = 'Delivered' THEN total_price ELSE 0 END), 0) AS weekly_order_revenue,
          COALESCE(SUM(CASE WHEN status = 'Delivered' THEN final_price ELSE 0 END), 0) AS weekly_total_earnings,
          COALESCE(AVG(CASE WHEN status = 'Delivered' THEN total_price END), 0) AS weekly_avg_order_value

      FROM orders
      WHERE delivery_man_id = ?
        AND DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`,
      [deliveryManId]
    );
    connection.release();

    const stats = orderStats[0];
    const earnings = earningsAnalysis[0];
    const today = todayPerformance[0];
    const yesterday = yesterdayPerformance[0];
    const weekly = weeklyPerformance[0];

    // Process metrics with proper defaults
    const processedMetrics = {
      // Order Statistics
      totalOrders: parseInt(stats?.total_orders) || 0,
      completedOrders: parseInt(stats?.completed_orders) || 0,
      pendingOrders: parseInt(stats?.pending_orders) || 0,
      outForDeliveryOrders: parseInt(stats?.out_for_delivery_orders) || 0,
      cancelledOrders: parseInt(stats?.cancelled_orders) || 0,
      preparingOrders: parseInt(stats?.preparing_orders) || 0,

      // Earnings Breakdown
      totalEarnings: parseFloat(earnings?.total_earnings) || 0,
      totalDeliveryFees: parseFloat(earnings?.total_delivery_fees) || 0,
      totalOrderRevenue: parseFloat(earnings?.total_order_revenue) || 0,
      averageOrderValue: parseFloat(earnings?.avg_order_value) || 0,

      // Today's Performance
      todayOrders: parseInt(today?.today_orders) || 0,
      todayCompleted: parseInt(today?.today_completed) || 0,
      todayOutForDelivery: parseInt(today?.today_out_for_delivery) || 0,
      todayPending: parseInt(today?.today_pending) || 0,
      todayPreparing: parseInt(today?.today_preparing) || 0,
      todayCancelled: parseInt(today?.today_cancelled) || 0,
      todayEarnings: parseFloat(today?.today_total_earnings) || 0,
      todayDeliveryFees: parseFloat(today?.today_delivery_fees) || 0,
      todayOrderRevenue: parseFloat(today?.today_order_revenue) || 0,
      todayAverageOrderValue: parseFloat(today?.today_avg_order_value) || 0,

      // Yesterday's Performance
      yesterdayOrders: parseInt(yesterday?.yesterday_orders) || 0,
      yesterdayCompleted: parseInt(yesterday?.yesterday_completed) || 0,
      yesterdayOutForDelivery: parseInt(yesterday?.yesterday_out_for_delivery) || 0,
      yesterdayPending: parseInt(yesterday?.yesterday_pending) || 0,
      yesterdayPreparing: parseInt(yesterday?.yesterday_preparing) || 0,
      yesterdayCancelled: parseInt(yesterday?.yesterday_cancelled) || 0,
      yesterdayEarnings: parseFloat(yesterday?.yesterday_total_earnings) || 0,
      yesterdayDeliveryFees: parseFloat(yesterday?.yesterday_delivery_fees) || 0,
      yesterdayOrderRevenue: parseFloat(yesterday?.yesterday_order_revenue) || 0,
      yesterdayAverageOrderValue: parseFloat(yesterday?.yesterday_avg_order_value) || 0,

      // Weekly Performance
      weeklyOrders: parseInt(weekly?.weekly_orders) || 0,
      weeklyCompleted: parseInt(weekly?.weekly_delivered) || 0,
      weeklyCancelled: parseInt(weekly?.weekly_cancelled) || 0,
      weeklyPending: parseInt(weekly?.weekly_pending) || 0,
      weeklyOutForDelivery: parseInt(weekly?.weekly_out_for_delivery) || 0,
      weeklyPreparing: parseInt(weekly?.weekly_preparing) || 0,
      weeklyEarnings: parseFloat(weekly?.weekly_total_earnings) || 0,
      weeklyDeliveryFees: parseFloat(weekly?.weekly_delivery_fees) || 0,
      weeklyOrderRevenue: parseFloat(weekly?.weekly_order_revenue) || 0,
      weeklyAvgOrderRevune: parseFloat(weekly?.weekly_avg_order_value) || 0
    };

    console.log("Processed Metrics:", processedMetrics);

    // Send response
    res.json({
      success: true,
      metrics: processedMetrics,
      debug: {
        deliveryManId,
        hasOrders: stats?.total_orders > 0,
        todayOrders: today?.today_orders,
      }
    });

  } catch (error) {
    console.error("Error fetching metrics:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// Get my assigned orders
export const getMyOrders = async (req, res) => {
  try {
    const connection = await pool.getConnection();

    const [orders] = await connection.execute(
      `SELECT 
        o.id, o.order_number, o.lat, o.lon, o.status, o.delivery_address, o.final_price, 
        o.delivery_fee, o.payment_status, o.created_at, o.delivery_man_id,
        c.name as customer_name, c.phone as customer_phone, c.email as customer_email,
        GROUP_CONCAT(
          CONCAT(oi.quantity, 'x ', p.name, ' (', oi.price_per_unit, ' MAD)')
        ) as items_summary
      FROM orders o
      LEFT JOIN clients c ON o.user_id = c.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE o.delivery_man_id = ?
      GROUP BY o.id
      ORDER BY o.created_at DESC`,
      [req.deliveryManId]
    );

    // Get detailed items for each order
    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const [items] = await connection.execute(
          `SELECT oi.quantity, oi.price_per_unit, p.name as product_name, p.image
           FROM order_items oi
           LEFT JOIN products p ON oi.product_id = p.id
           WHERE oi.order_id = ?`,
          [order.id]
        );
        return {
          ...order,
          items: items.map(item => ({
            product_name: item.product_name,
            quantity: item.quantity,
            price: parseFloat(item.price_per_unit),
            image: item.image,
          })),
        };
      })
    );

    connection.release();
    res.json({ orders: ordersWithItems });
  } catch (error) {
    console.error("Error fetching my orders:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get pending orders (for Active Orders tab) - only unassigned orders
export const getPendingOrders = async (req, res) => {
  try {
    const connection = await pool.getConnection();

    const [orders] = await connection.execute(
      `SELECT 
        o.id, o.order_number, o.status, o.delivery_address, o.final_price, 
        o.delivery_fee, o.payment_status, o.created_at, o.delivery_man_id,
        c.name as customer_name, c.phone as customer_phone, c.email as customer_email,
        GROUP_CONCAT(
          CONCAT(oi.quantity, 'x ', p.name, ' (', oi.price_per_unit, ' MAD)')
        ) as items_summary
      FROM orders o
      LEFT JOIN clients c ON o.user_id = c.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE o.status = 'Pending' AND o.delivery_man_id IS NULL
      GROUP BY o.id
      ORDER BY o.created_at DESC`,
      []
    );

    // Get detailed items for each order
    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const [items] = await connection.execute(
          `SELECT oi.quantity, oi.price_per_unit, p.name as product_name, p.image
           FROM order_items oi
           LEFT JOIN products p ON oi.product_id = p.id
           WHERE oi.order_id = ?`,
          [order.id]
        );
        return {
          ...order,
          items: items.map(item => ({
            product_name: item.product_name,
            quantity: item.quantity,
            price: parseFloat(item.price_per_unit),
            image: item.image,
          })),
        };
      })
    );

    connection.release();
    res.json({ orders: ordersWithItems });
  } catch (error) {
    console.error("Error fetching pending orders:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Accept an order
export const acceptOrder = async (req, res) => {
  let connection;
  try {
    const { order_id } = req.body;

    if (!order_id) {
      return res.status(400).json({ message: "Order ID is required" });
    }

    connection = await pool.getConnection();

    // 1️⃣ Check if order exists AND still pending
    const [orders] = await connection.execute(
      "SELECT * FROM orders WHERE id = ? AND status = 'Pending' AND delivery_man_id IS NULL",
      [order_id]
    );

    if (orders.length === 0) {
      connection.release();
      return res.status(404).json({ message: "Order not found or unavailable" });
    }

    const order = orders[0];

    // 2️⃣ Assign order to delivery man (allow multiple orders)
    const [updateResult] = await connection.execute(
      "UPDATE orders SET delivery_man_id = ?, updated_at = NOW() WHERE id = ? AND delivery_man_id IS NULL",
      [req.deliveryManId, order_id]
    );

    if (updateResult.affectedRows === 0) {
      connection.release();
      return res.status(409).json({ message: "Order already taken" });
    }

    // 3️⃣ Fetch delivery man info (for notification)
    const [deliveryRows] = await connection.execute(
      "SELECT name FROM delivery_men WHERE id = ?",
      [req.deliveryManId]
    );

    const deliveryMan = deliveryRows[0];

    // ------------------ 🔔 NOTIFICATIONS ------------------

    // Notify the client
    await sendNotification({
      toUserType: "client",
      toUserId: order.user_id,
      title: "Delivery Man Assigned",
      message: `${deliveryMan.name} has accepted your order #${order.order_number}.`,
      data: {
        order_id: order_id.toString(),
        delivery_man_id: req.deliveryManId.toString(),
        delivery_man_name: deliveryMan.name,
        type: "delivery_assigned"
      }
    });

    // Notify the delivery man (confirmation)
    await sendNotification({
      toUserType: "delivery_man",
      toUserId: req.deliveryManId,
      title: "Order Accepted",
      message: `You accepted order #${order.order_number}.`,
      data: {
        order_id: order_id.toString(),
        type: "order_accepted"
      }
    });

    // ------------------------------------------------------

    connection.release();
    return res.status(200).json({ message: "Order accepted successfully" });

  } catch (error) {
    console.error("❌ Error accepting order:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (err) {
        console.error("Error releasing connection:", err.message);
      }
    }
  }
};



// Update order status
export const updateOrderStatus = async (req, res) => {
  let connection;
  try {
    const { order_id, status } = req.body;
    connection = await pool.getConnection();

    // Verify order belongs to this delivery man
    const [orderRows] = await connection.execute(
      "SELECT * FROM orders WHERE id = ? AND delivery_man_id = ?",
      [order_id, req.deliveryManId]
    );

    if (orderRows.length === 0) {
      connection.release();
      return res.status(404).json({ message: "Order not found" });
    }

    const currentOrder = orderRows[0];

    // Only allow "Delivered" status if current status is "OutForDelivery"
    if (status === 'Delivered' && currentOrder.status !== 'OutForDelivery') {
      connection.release();
      return res.status(400).json({
        message: "Order must be 'OutForDelivery' before it can be marked as 'Delivered'"
      });
    }

    // Track delivery timestamps
    let updateQuery = "UPDATE orders SET status = ?, updated_at = NOW()";
    const updateParams = [status];

    if (status === 'OutForDelivery') {
      if (!currentOrder.out_for_delivery_at || currentOrder.out_for_delivery_at === null) {
        updateQuery += ", out_for_delivery_at = NOW()";
      }
    } else if (status === 'Delivered') {
      if (!currentOrder.delivered_at || currentOrder.delivered_at === null) {
        updateQuery += ", delivered_at = NOW()";
      }

      // Calculate delivery time and save to delivery_performance
      if (currentOrder.out_for_delivery_at) {
        const [timeResult] = await connection.execute(
          `SELECT TIMESTAMPDIFF(MINUTE, out_for_delivery_at, NOW()) as delivery_time
           FROM orders WHERE id = ?`,
          [order_id]
        );
        const deliveryTime = timeResult[0]?.delivery_time || 0;

        const [ratingResult] = await connection.execute(
          `SELECT delivery_service FROM order_ratings WHERE order_id = ?`,
          [order_id]
        );
        const rating = ratingResult[0]?.delivery_service || null;

        await connection.execute(
          `INSERT INTO delivery_performance 
           (delivery_man_id, order_id, delivery_fee, delivery_time_minutes, rating)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
           delivery_time_minutes = VALUES(delivery_time_minutes),
           rating = VALUES(rating)`,
          [
            req.deliveryManId,
            order_id,
            currentOrder.delivery_fee || 0,
            deliveryTime,
            rating
          ]
        );
      }
    }

    updateQuery += " WHERE id = ?";
    updateParams.push(order_id);

    await connection.execute(updateQuery, updateParams);

    // 🔔 NOTIFY CLIENT ABOUT ORDER DELIVERY (DUAL SYSTEM)
    if (status === 'Delivered') {
      try {
        // Notify client
        await sendNotification({
          toUserType: "client",
          toUserId: currentOrder.user_id,
          title: "Order Delivered 🎉",
          message: `Your order #${currentOrder.order_number} has been delivered successfully!`,
          data: {
            order_id: order_id.toString(),
            order_number: currentOrder.order_number,
            status: 'Delivered',
            type: "order_update"
          },
          sendPush: true,      // Send FCM push
          sendWebSocket: true  // Send WebSocket
        });

        // Also notify delivery man (confirmation)
        await sendNotification({
          toUserType: "delivery_man",
          toUserId: req.deliveryManId,
          title: "Delivery Completed ✅",
          message: `Order #${currentOrder.order_number} marked as delivered.`,
          data: {
            order_id: order_id.toString(),
            order_number: currentOrder.order_number,
            status: 'Delivered',
            type: "delivery_completed"
          },
          sendPush: true,
          sendWebSocket: true
        });

        console.log(`✅ Notifications sent for delivered order #${currentOrder.order_number}`);
      } catch (notificationError) {
        console.error('❌ Notification error (order still delivered):', notificationError);
      }
    }

    // Also notify client if status changed to OutForDelivery
    else if (status === 'OutForDelivery') {
      try {
        await sendNotification({
          toUserType: "client",
          toUserId: currentOrder.user_id,
          title: "Order On The Way 🚚",
          message: `Your order #${currentOrder.order_number} is on its way to you!`,
          data: {
            order_id: order_id.toString(),
            order_number: currentOrder.order_number,
            status: 'OutForDelivery',
            type: "order_update"
          },
          sendPush: true,
          sendWebSocket: true
        });

        console.log(`✅ Notification sent for out-for-delivery order #${currentOrder.order_number}`);
      } catch (notificationError) {
        console.error('❌ Notification error:', notificationError);
      }
    }

    connection.release();

    res.json({
      message: "Order status updated successfully",
      notification_sent: true
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

// Get delivered orders with ratings
export const getDeliveredOrders = async (req, res) => {
  try {
    const connection = await pool.getConnection();

    const [orders] = await connection.execute(
      `SELECT 
        o.id, o.order_number, o.status, o.delivery_address, o.final_price, 
        o.delivery_fee, o.payment_status, o.created_at, o.delivered_at,
        o.out_for_delivery_at, o.delivery_man_id,
        c.name as customer_name, c.phone as customer_phone, c.email as customer_email
      FROM orders o
      LEFT JOIN clients c ON o.user_id = c.id
      WHERE o.delivery_man_id = ? AND o.status = 'Delivered'
      ORDER BY o.delivered_at DESC
      LIMIT 100`,
      [req.deliveryManId]
    );

    // Get detailed items and ratings for each order
    const ordersWithDetails = await Promise.all(
      orders.map(async (order) => {
        const [items] = await connection.execute(
          `SELECT oi.quantity, oi.price_per_unit, p.name as product_name, p.image
           FROM order_items oi
           LEFT JOIN products p ON oi.product_id = p.id
           WHERE oi.order_id = ?`,
          [order.id]
        );

        // Get rating for this order
        const [ratings] = await connection.execute(
          `SELECT id, delivery_service, comment, created_at
           FROM order_ratings
           WHERE order_id = ?`,
          [order.id]
        );

        return {
          ...order,
          items: items.map(item => ({
            product_name: item.product_name,
            quantity: item.quantity,
            price: parseFloat(item.price_per_unit),
            image: item.image,
          })),
          rating: ratings.length > 0 ? {
            id: ratings[0].id,
            rating: parseInt(ratings[0].delivery_service),
            comment: ratings[0].comment,
            created_at: ratings[0].created_at,
          } : null,
        };
      })
    );

    connection.release();
    res.json({ orders: ordersWithDetails });
  } catch (error) {
    console.error("Error fetching delivered orders:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get delivery man statistics
export const getDeliveryStats = async (req, res) => {
  try {
    console.log('=== GET DELIVERY STATS CALLED ===');
    console.log('Delivery Man ID from token:', req.deliveryManId);
    console.log('Request headers:', req.headers);

    const connection = await pool.getConnection();

    // Debug: First check if we have any delivered orders for this delivery man
    const [debugResult] = await connection.execute(
      `SELECT * FROM orders 
       WHERE delivery_man_id = ? AND status = 'Delivered'
       LIMIT 5`,
      [req.deliveryManId]
    );

    console.log('Debug - delivered orders found:', debugResult.length);
    console.log('Sample delivered orders:', debugResult);

    // Get total delivery fees - sum from orders table for all delivered orders
    const [feesResult] = await connection.execute(
      `SELECT COALESCE(SUM(delivery_fee), 0) as total_delivery_fees
       FROM orders
       WHERE delivery_man_id = ? AND status = 'Delivered'`,
      [req.deliveryManId]
    );

    console.log('Fees query result:', feesResult);
    console.log('Fees result [0]:', feesResult[0]);
    console.log('total_delivery_fees value:', feesResult[0].total_delivery_fees);

    // Get average rating - query order_ratings table directly
    // FIX: Use `or` with backticks or use a different alias like 'rating'
    const [ratingResult] = await connection.execute(
      `SELECT COALESCE(AVG(rating.delivery_service), 0) as avg_rating
       FROM order_ratings rating
       INNER JOIN orders o ON rating.order_id = o.id
       WHERE o.delivery_man_id = ? AND rating.delivery_service IS NOT NULL`,
      [req.deliveryManId]
    );

    console.log('Rating query result:', ratingResult);
    console.log('avg_rating value:', ratingResult[0].avg_rating);

    // Get average delivery time
    const [timeResult] = await connection.execute(
      `SELECT COALESCE(AVG(delivery_time_minutes), 0) as avg_delivery_time
       FROM delivery_performance
       WHERE delivery_man_id = ? AND delivery_time_minutes IS NOT NULL`,
      [req.deliveryManId]
    );

    console.log('Time query result:', timeResult);
    console.log('avg_delivery_time value:', timeResult[0].avg_delivery_time);

    // Get total deliveries count
    const [countResult] = await connection.execute(
      `SELECT COUNT(*) as total_deliveries
       FROM orders
       WHERE delivery_man_id = ? AND status = 'Delivered'`,
      [req.deliveryManId]
    );

    console.log('Count query result:', countResult);
    console.log('total_deliveries value:', countResult[0].total_deliveries);

    connection.release();

    const totalDeliveryFees = parseFloat(feesResult[0].total_delivery_fees || 0);
    const avgRating = parseFloat(ratingResult[0].avg_rating || 0);
    const avgDeliveryTime = parseFloat(timeResult[0].avg_delivery_time || 0);
    const totalDeliveries = parseInt(countResult[0].total_deliveries || 0);

    console.log('=== FINAL STATS ===');
    console.log('total_delivery_fees:', totalDeliveryFees);
    console.log('avg_rating:', avgRating);
    console.log('avg_delivery_time:', avgDeliveryTime);
    console.log('total_deliveries:', totalDeliveries);

    res.json({
      total_delivery_fees: totalDeliveryFees,
      avg_rating: avgRating,
      avg_delivery_time: avgDeliveryTime,
      total_deliveries: totalDeliveries
    });
  } catch (error) {
    console.error("Error fetching delivery stats:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
      sql: error.sql
    });
  }
};

// notification system


export const getDeliveryManNotifications = async (req, res) => {
  console.log('🔔 getDeliveryManNotifications called');
  console.log('📱 DeliveryMan ID from token:', req.deliveryManId);

  try {
    const deliveryManId = req.deliveryManId;
    const { limit = 20, offset = 0 } = req.query;

    if (!deliveryManId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    console.log(`🔍 Querying notifications for deliveryman ${deliveryManId}`);

    // FIXED: Remove n.order_id since it doesn't exist
    // Get order_id from data JSON field instead
    const [notifications] = await pool.query(
      `SELECT 
        n.id,
        n.title,
        n.message,
        n.is_read,
        n.data,
        DATE_FORMAT(n.created_at, '%Y-%m-%d %H:%i:%s') as created_at
       FROM notifications n
       WHERE n.user_type = 'delivery_man' 
       AND n.user_id = ? 
       ORDER BY n.created_at DESC 
       LIMIT ? OFFSET ?`,
      [parseInt(deliveryManId), parseInt(limit), parseInt(offset)]
    );

    // Process notifications to extract order_id from data field
    const processedNotifications = await Promise.all(
      notifications.map(async (n) => {
        try {
          const data = n.data ? JSON.parse(n.data) : {};
          const orderId = data.order_id || null;

          let orderDetails = null;
          let customerName = null;

          // If we have an order_id, try to get order details
          if (orderId) {
            try {
              const [orderRows] = await pool.query(
                `SELECT 
                  o.order_number,
                  o.status,
                  o.user_id,
                  c.name as customer_name
                 FROM orders o
                 LEFT JOIN clients c ON o.user_id = c.id
                 WHERE o.id = ?`,
                [orderId]
              );

              if (orderRows.length > 0) {
                orderDetails = orderRows[0];
              }
            } catch (orderError) {
              console.error(`Error fetching order ${orderId}:`, orderError.message);
            }
          }

          return {
            id: n.id,
            order_id: orderId,
            type: data.type || 'general',
            title: n.title,
            message: n.message,
            is_read: n.is_read,
            created_at: n.created_at,
            order_number: orderDetails?.order_number || null,
            status: orderDetails?.status || null,
            customer_name: orderDetails?.customer_name || null,
            data: data
          };
        } catch (error) {
          console.error('Error processing notification:', error);
          return {
            id: n.id,
            order_id: null,
            type: 'general',
            title: n.title,
            message: n.message,
            is_read: n.is_read,
            created_at: n.created_at,
            order_number: null,
            status: null,
            customer_name: null,
            data: {}
          };
        }
      })
    );

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total 
       FROM notifications 
       WHERE user_type = 'delivery_man' AND user_id = ?`,
      [parseInt(deliveryManId)]
    );

    const [unreadResult] = await pool.query(
      `SELECT COUNT(*) as unread_count 
       FROM notifications 
       WHERE user_type = 'delivery_man' AND user_id = ? AND is_read = FALSE`,
      [parseInt(deliveryManId)]
    );

    console.log(`✅ Found ${processedNotifications.length} notifications for deliveryman ${deliveryManId}`);

    res.json({
      success: true,
      notifications: processedNotifications,
      pagination: {
        total: countResult[0]?.total || 0,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + processedNotifications.length) < (countResult[0]?.total || 0)
      },
      unreadCount: unreadResult[0]?.unread_count || 0
    });

  } catch (error) {
    console.error('❌ Error in getDeliveryManNotifications:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export const markDeliveryManNotificationAsRead = async (req, res) => {
  try {
    const deliveryManId = req.deliveryManId;
    const { notification_id } = req.body;

    if (!notification_id) {
      return res.status(400).json({
        success: false,
        message: 'notification_id is required'
      });
    }

    if (!deliveryManId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Verify notification belongs to this deliveryman
    const [verifyResult] = await pool.query(
      'SELECT id FROM notifications WHERE id = ? AND user_type = "delivery_man" AND user_id = ?',
      [parseInt(notification_id), parseInt(deliveryManId)]
    );

    if (verifyResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found or unauthorized'
      });
    }

    const [result] = await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = ?',
      [parseInt(notification_id)]
    );

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

export const markAllDeliveryManNotificationsAsRead = async (req, res) => {
  try {
    const deliveryManId = req.deliveryManId;

    if (!deliveryManId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const [result] = await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE user_type = "delivery_man" AND user_id = ?',
      [parseInt(deliveryManId)]
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

export const getDeliveryManUnreadCount = async (req, res) => {
  try {
    const deliveryManId = req.deliveryManId;
    const { after } = req.query;

    if (!deliveryManId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    let query = `SELECT COUNT(*) as count FROM notifications 
                 WHERE user_type = 'delivery_man' 
                 AND user_id = ? 
                 AND is_read = FALSE`;
    const params = [parseInt(deliveryManId)];

    if (after) {
      query += ' AND created_at > ?';
      params.push(after);
    }

    const [result] = await pool.query(query, params);
    const count = result[0]?.count || 0;

    res.json({
      success: true,
      unreadCount: count
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export const createDeliveryManNotification = async (req, res) => {
  try {
    const { user_id, title, message, data = {}, order_id = null } = req.body;

    if (!user_id || !title || !message) {
      return res.status(400).json({
        success: false,
        message: 'user_id, title, and message are required'
      });
    }

    const dataString = JSON.stringify(data);

    const [result] = await pool.query(
      `INSERT INTO notifications (user_type, user_id, title, message, data, order_id) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['delivery_man', parseInt(user_id), title, message, dataString, order_id]
    );

    // Also add to queue for WebSocket
    await pool.query(
      `INSERT INTO notification_queue (notification_id, user_id, user_type, data) 
       VALUES (?, ?, ?, ?)`,
      [result.insertId, parseInt(user_id), 'delivery_man', dataString]
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

