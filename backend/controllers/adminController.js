import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from 'jsonwebtoken'; // make sure this is imported
import pool, { executeQuery } from "../config/db.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import axios from "axios";
import { sendBulkNotification, sendBulkNotificationClients, sendNotification } from "../utils/notificationService.js";
import { processImageWithSharp } from '../utils/imageProcessor.js';
import { sendPushNotificationOnly } from "../utils/notificationService.js";

// ==================== GENERIC SHARP-BASED MULTER MIDDLEWARES ====================

// For products with Sharp
export const uploadProductImageWithSharp = (req, res, next) => {
  const multerMiddleware = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadPath = 'uploads/productsImages';
        if (!fs.existsSync(uploadPath)) {
          fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `product_${uniqueSuffix}${ext}`);
      }
    }),
    fileFilter: (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|gif|webp/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);

      if (mimetype && extname) {
        cb(null, true);
      } else {
        cb(new Error('Only image files (jpeg, jpg, png, gif, webp) are allowed!'));
      }
    },
    limits: { fileSize: 10 * 1024 * 1024 }
  }).single("image");

  multerMiddleware(req, res, async (err) => {
    if (err) {
      // Handle multer errors
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          message: 'File size too large. Maximum size is 10MB.'
        });
      }
      return res.status(400).json({ message: err.message });
    }

    // If a file was uploaded, process it with Sharp
    if (req.file) {
      try {
        // Process image with Sharp
        const processedFile = await processImageWithSharp(req.file, {
          width: 800,
          height: 800,
          fit: 'inside',
          quality: 80,
          format: 'webp',
          outputDir: 'uploads/productsImages'
        });

        // Check if processedFile is the original file (error case)
        if (processedFile && processedFile.path !== req.file.path) {
          // Update file info with processed version
          req.file = {
            ...req.file,
            path: processedFile.path,
            filename: processedFile.filename,
            mimetype: processedFile.mimetype,
            size: processedFile.size,
            originalname: processedFile.originalname || req.file.originalname,
            destination: processedFile.destination || req.file.destination
          };
          console.log(`✅ Product image processed: ${processedFile.filename} (${Math.round(processedFile.size / 1024)}KB)`);
        } else {
          // Sharp processing failed, keep original file
          console.warn('⚠️ Sharp processing failed, keeping original file:', req.file.filename);
        }

      } catch (sharpError) {
        console.error('❌ Sharp processing error:', sharpError.message);
        // Keep original file if Sharp fails - don't break the request
        console.log('Keeping original file due to Sharp error');
      }
    }

    next();
  });
};

// For categories with Sharp
export const uploadCategoryImageWithSharp = (req, res, next) => {
  const multerMiddleware = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadPath = 'uploads/categoriesImages';
        if (!fs.existsSync(uploadPath)) {
          fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `category_${uniqueSuffix}${ext}`);
      }
    }),
    fileFilter: (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|gif|webp/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);

      if (mimetype && extname) {
        cb(null, true);
      } else {
        cb(new Error('Only image files (jpeg, jpg, png, gif, webp) are allowed!'));
      }
    },
    limits: { fileSize: 10 * 1024 * 1024 }
  }).single("image");

  multerMiddleware(req, res, async (err) => {
    if (err) {
      // Handle multer errors
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          message: 'File size too large. Maximum size is 10MB.'
        });
      }
      return res.status(400).json({ message: err.message });
    }

    if (req.file) {
      try {
        const processedFile = await processImageWithSharp(req.file, {
          width: 400,
          height: 400,
          fit: 'cover',
          quality: 80,
          format: 'webp',
          outputDir: 'uploads/categoriesImages'
        });

        // Check if processedFile is the original file (error case)
        if (processedFile && processedFile.path !== req.file.path) {
          // Update file info with processed version
          req.file = {
            ...req.file,
            path: processedFile.path,
            filename: processedFile.filename,
            mimetype: processedFile.mimetype,
            size: processedFile.size,
            originalname: processedFile.originalname || req.file.originalname,
            destination: processedFile.destination || req.file.destination
          };
          console.log(`✅ Category image processed: ${processedFile.filename} (${Math.round(processedFile.size / 1024)}KB)`);
        } else {
          // Sharp processing failed, keep original file
          console.warn('⚠️ Sharp processing failed, keeping original file:', req.file.filename);
        }

      } catch (sharpError) {
        console.error('❌ Sharp processing error:', sharpError.message);
        // Keep original file if Sharp fails
        console.log('Keeping original file due to Sharp error');
      }
    }

    next();
  });
};

// For delivery men with Sharp
export const uploadDeliveryManImageWithSharp = (req, res, next) => {
  const multerMiddleware = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadPath = 'uploads/deliveryManImages';
        if (!fs.existsSync(uploadPath)) {
          fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `delivery_${uniqueSuffix}${ext}`);
      }
    }),
    fileFilter: (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|gif|webp/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);

      if (mimetype && extname) {
        cb(null, true);
      } else {
        cb(new Error('Only image files (jpeg, jpg, png, gif, webp) are allowed!'));
      }
    },
    limits: { fileSize: 10 * 1024 * 1024 }
  }).single("image");

  multerMiddleware(req, res, async (err) => {
    if (err) {
      // Handle multer errors
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          message: 'File size too large. Maximum size is 10MB.'
        });
      }
      return res.status(400).json({ message: err.message });
    }

    if (req.file) {
      try {
        const processedFile = await processImageWithSharp(req.file, {
          width: 300,
          height: 300,
          fit: 'cover',
          quality: 80,
          format: 'webp',
          outputDir: 'uploads/deliveryManImages'
        });

        // Check if processedFile is the original file (error case)
        if (processedFile && processedFile.path !== req.file.path) {
          // Update file info with processed version
          req.file = {
            ...req.file,
            path: processedFile.path,
            filename: processedFile.filename,
            mimetype: processedFile.mimetype,
            size: processedFile.size,
            originalname: processedFile.originalname || req.file.originalname,
            destination: processedFile.destination || req.file.destination
          };
          console.log(`✅ Delivery man image processed: ${processedFile.filename} (${Math.round(processedFile.size / 1024)}KB)`);
        } else {
          // Sharp processing failed, keep original file
          console.warn('⚠️ Sharp processing failed, keeping original file:', req.file.filename);
        }

      } catch (sharpError) {
        console.error('❌ Sharp processing error:', sharpError.message);
        // Keep original file if Sharp fails
        console.log('Keeping original file due to Sharp error');
      }
    }

    next();
  });
};
// ==================== AUTHENTICATION ====================


export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Basic validation
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // 2. Optimized Query: Join admins with restaurants
    const query = `
      SELECT 
        a.*, 
        r.name AS restaurant_name, 
        r.logo AS restaurant_logo 
      FROM admins a
      LEFT JOIN restaurants r ON a.restaurant_id = r.id
      WHERE a.email = ?
    `;

    const [rows] = await executeQuery(query, [email]);

    // 3. Check if admin exists
    if (rows.length === 0) {
      return res.status(404).json({ message: "No admin account found with this email" });
    }

    const admin = rows[0];

    // 4. Account status check
    if (!admin.is_active) {
      return res.status(403).json({
        message: "Your account has been deactivated. Please contact support.",
      });
    }

    // 5. Password Verification
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // 🔐 6. Generate JWT (instead of random hex)
    const jwtToken = jwt.sign(
      { 
        id: admin.id, 
        email: admin.email, 
        role: admin.role || 'admin' 
      },
      process.env.JWT_SECRET,
      { expiresIn: "36500d" } // match client expiry
    );

    const expiresAt = new Date(Date.now() + 36500 * 24 * 60 * 60 * 1000); // 36500 days

    // Update database with new token and last login timestamp
    await executeQuery(
      "UPDATE admins SET last_login = NOW(), api_token = ?, token_expires_at = ? WHERE id = ?",
      [jwtToken, expiresAt, admin.id]
    );

    // 7. Success Response with Restaurant Data
    return res.status(200).json({
      message: "Login successful",
      adminData: {
        id: admin.id,
        email: admin.email,
        restaurant_id: admin.restaurant_id,
        restaurant_name: admin.restaurant_name,
        restaurant_logo: admin.restaurant_logo
      },
      token: jwtToken,               // now a proper JWT
      tokenExpiresAt: expiresAt,
    });

  } catch (error) {
    console.error("❌ Admin login error:", error.message);
    console.error("Error stack:", error.stack);

    const isConnectionClosed =
      error?.message?.includes("connection is in closed state") ||
      error?.message?.includes("CONNECTION_CLOSED");

    return res.status(500).json({
      message: isConnectionClosed
        ? "Database connection was lost. Please try logging in again."
        : "Server error during login",
    });
  }
};

// Export orders report (daily aggregations)
export const exportOrdersReport = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [dailyOrders] = await connection.execute(
      `SELECT DATE(created_at) as date, COUNT(*) as count, COALESCE(SUM(final_price), 0) as revenue
       FROM orders
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       GROUP BY DATE(created_at)
       ORDER BY date ASC`
    );
    const rows = ["date,orders,revenue"].concat(
      dailyOrders.map(r => `${r.date},${r.count},${parseFloat(r.revenue || 0).toFixed(2)}`)
    );
    const csv = rows.join('\n');
    res.header('Content-Type', 'text/csv');
    res.attachment('orders_report.csv');
    return res.send(csv);
  } catch (error) {
    console.error('❌ Export orders report error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  } finally {
    if (connection) connection.release();
  }
};

// ==================== PROMOTIONS ANALYTICS ====================
export const getPromotionsAnalytics = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    const [[{ total_promotions }]] = await connection.execute(
      `SELECT COUNT(*) AS total_promotions FROM promo_codes`
    );
    const [[{ active_promotions }]] = await connection.execute(
      `SELECT COUNT(*) AS active_promotions FROM promo_codes WHERE is_active = 1 AND (valid_until IS NULL OR valid_until >= NOW())`
    );
    const [[{ total_usage, total_revenue }]] = await connection.execute(
      `SELECT COUNT(*) AS total_usage, COALESCE(SUM(discount_amount), 0) AS total_revenue FROM order_promo_codes`
    );
    const [usageByPromotion] = await connection.execute(
      `SELECT pc.title as name, COUNT(opc.id) as usage_count, COALESCE(SUM(opc.discount_amount), 0) as revenue
       FROM promo_codes pc
       LEFT JOIN order_promo_codes opc ON pc.id = opc.promo_code_id
       GROUP BY pc.id, pc.title
       ORDER BY usage_count DESC`
    );

    connection.release();
    return res.status(200).json({
      total_promotions: parseInt(total_promotions || 0),
      active_promotions: parseInt(active_promotions || 0),
      total_usage: parseInt(total_usage || 0),
      total_revenue: parseFloat(total_revenue || 0),
      usageByPromotion,
    });
  } catch (error) {
    console.error('❌ Get promotions analytics error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  } finally {
    if (connection) connection.release();
  }
};

// ==================== ORDERS: EXTRA ENDPOINTS ====================

export const getOrderHistory = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    connection = await pool.getConnection();
    // Build a simple history from timestamps we have
    const [[order]] = await connection.execute(`SELECT created_at, updated_at, out_for_delivery_at, delivered_at, status FROM orders WHERE id = ?`, [id]);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    const history = [];
    history.push({ label: 'Created', timestamp: order.created_at });
    if (order.out_for_delivery_at) history.push({ label: 'Out For Delivery', timestamp: order.out_for_delivery_at });
    if (order.delivered_at) history.push({ label: 'Delivered', timestamp: order.delivered_at });
    if (order.updated_at && order.updated_at !== order.created_at) history.push({ label: `Updated (${order.status})`, timestamp: order.updated_at });
    return res.status(200).json({ history });
  } catch (error) {
    console.error('❌ Get order history error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  } finally {
    if (connection) connection.release();
  }
};

export const exportOrders = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const { status, payment_status, search, start_date, end_date } = req.query;
    let query = `SELECT o.id, o.order_number, o.status, o.payment_status, o.final_price, o.created_at, c.name as customer_name
                 FROM orders o
                 LEFT JOIN clients c ON o.user_id = c.id`;
    const conditions = [];
    const params = [];
    if (status) { conditions.push('o.status = ?'); params.push(status); }
    if (payment_status) { conditions.push('o.payment_status = ?'); params.push(payment_status); }
    if (search) { const s = `%${search}%`; conditions.push('(o.order_number LIKE ? OR c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)'); params.push(s, s, s, s); }
    if (start_date) { conditions.push('DATE(o.created_at) >= ?'); params.push(start_date); }
    if (end_date) { conditions.push('DATE(o.created_at) <= ?'); params.push(end_date); }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY o.created_at DESC';
    const [rows] = await connection.execute(query, params);
    const headers = ['id', 'order_number', 'status', 'payment_status', 'final_price', 'created_at', 'customer_name'];
    const csvRows = [headers.join(',')].concat(rows.map(r => [r.id, r.order_number, r.status, r.payment_status, parseFloat(r.final_price || 0).toFixed(2), r.created_at, (r.customer_name || '').toString().replace(/,/g, ' ')].join(',')));
    const csv = csvRows.join('\n');
    res.header('Content-Type', 'text/csv');
    res.attachment('orders.csv');
    return res.send(csv);
  } catch (error) {
    console.error('❌ Export orders error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  } finally {
    if (connection) connection.release();
  }
};

export const bulkUpdateOrderStatus = async (req, res) => {
  let connection;
  try {
    const { orderIds, status } = req.body;
    if (!Array.isArray(orderIds) || orderIds.length === 0) return res.status(400).json({ message: 'orderIds required' });
    const allowed = ['Pending', 'Preparing', 'OutForDelivery', 'Delivered', 'Cancelled'];
    if (!allowed.includes(status)) return res.status(400).json({ message: 'Invalid status' });
    connection = await pool.getConnection();

    const placeholders = orderIds.map(() => '?').join(',');
    let updateQuery = `UPDATE orders SET status = ?, updated_at = NOW()`;
    if (status === 'OutForDelivery') updateQuery += `, out_for_delivery_at = COALESCE(out_for_delivery_at, NOW())`;
    if (status === 'Delivered') updateQuery += `, delivered_at = COALESCE(delivered_at, NOW())`;
    updateQuery += ` WHERE id IN (${placeholders})`;
    await connection.execute(updateQuery, [status, ...orderIds]);
    connection.release();
    return res.status(200).json({ message: 'Orders updated' });
  } catch (error) {
    console.error('❌ Bulk update order status error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  } finally {
    if (connection) connection.release();
  }
};

export const updateOrderPaymentStatus = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const { payment_status } = req.body;
    const allowed = ['Paid', 'Unpaid', 'Refunded'];
    if (!allowed.includes(payment_status)) return res.status(400).json({ message: 'Invalid payment status' });
    connection = await pool.getConnection();
    await connection.execute(`UPDATE orders SET payment_status = ?, updated_at = NOW() WHERE id = ?`, [payment_status, id]);
    connection.release();
    return res.status(200).json({ message: 'Payment status updated' });
  } catch (error) {
    console.error('❌ Update order payment status error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  } finally {
    if (connection) connection.release();
  }
};

export const cancelOrder = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const { reason } = req.body;
    connection = await pool.getConnection();
    await connection.execute(`UPDATE orders SET status = 'Cancelled', cancel_reason = ?, updated_at = NOW() WHERE id = ?`, [reason || null, id]);
    connection.release();
    return res.status(200).json({ message: 'Order cancelled' });
  } catch (error) {
    console.error('❌ Cancel order error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  } finally {
    if (connection) connection.release();
  }
};

// ==================== REPORTS ====================

// Revenue report for Reports page
export const getRevenueReport = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    // Daily revenue for last 30 days
    const [dailyRevenue] = await connection.execute(
      `SELECT 
        DATE(created_at) as date,
        COALESCE(SUM(final_price), 0) as revenue,
        COUNT(*) as orders
       FROM orders
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       GROUP BY DATE(created_at)
       ORDER BY date ASC`
    );

    // Aggregates
    const totalRevenue = dailyRevenue.reduce((s, r) => s + parseFloat(r.revenue || 0), 0);
    const averageRevenue = dailyRevenue.length > 0 ? totalRevenue / dailyRevenue.length : 0;

    const [[{ lastMonthRevenue }]] = await connection.execute(
      `SELECT COALESCE(SUM(final_price), 0) as lastMonthRevenue
       FROM orders
       WHERE YEAR(created_at) = YEAR(DATE_SUB(NOW(), INTERVAL 1 MONTH))
         AND MONTH(created_at) = MONTH(DATE_SUB(NOW(), INTERVAL 1 MONTH))`
    );

    const [[{ currentMonthRevenue }]] = await connection.execute(
      `SELECT COALESCE(SUM(final_price), 0) as currentMonthRevenue
       FROM orders
       WHERE YEAR(created_at) = YEAR(NOW())
         AND MONTH(created_at) = MONTH(NOW())`
    );

    const growth = lastMonthRevenue > 0
      ? ((parseFloat(currentMonthRevenue) - parseFloat(lastMonthRevenue)) / parseFloat(lastMonthRevenue)) * 100
      : 0;

    connection.release();
    return res.status(200).json({
      dailyRevenue,
      totalRevenue,
      averageRevenue,
      growth,
      previousPeriod: parseFloat(lastMonthRevenue || 0),
      totalOrders: dailyRevenue.reduce((s, r) => s + (r.orders || 0), 0),
    });
  } catch (error) {
    console.error("❌ Get revenue report error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

// Export revenue report as CSV
export const exportRevenueReport = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [dailyRevenue] = await connection.execute(
      `SELECT DATE(created_at) as date, COALESCE(SUM(final_price), 0) as revenue, COUNT(*) as orders
       FROM orders
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       GROUP BY DATE(created_at)
       ORDER BY date ASC`
    );

    const rows = ["date,revenue,orders"].concat(
      dailyRevenue.map(r => `${r.date},${parseFloat(r.revenue || 0).toFixed(2)},${r.orders || 0}`)
    );
    const csv = rows.join("\n");
    res.header('Content-Type', 'text/csv');
    res.attachment('revenue_report.csv');
    return res.send(csv);
  } catch (error) {
    console.error("❌ Export revenue report error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

// Orders analytics for Reports page
export const getOrdersReport = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    const [[{ totalOrders, totalRevenue }]] = await connection.execute(
      `SELECT COUNT(*) AS totalOrders, COALESCE(SUM(final_price), 0) AS totalRevenue FROM orders`
    );

    const [[{ completedOrders }]] = await connection.execute(
      `SELECT COUNT(*) AS completedOrders FROM orders WHERE status = 'Delivered'`
    );

    const [[{ cancelledOrders }]] = await connection.execute(
      `SELECT COUNT(*) AS cancelledOrders FROM orders WHERE status = 'Cancelled'`
    );

    const [ordersByStatus] = await connection.execute(
      `SELECT status, COUNT(*) as count FROM orders GROUP BY status`
    );

    const [ordersByPayment] = await connection.execute(
      `SELECT payment_status, COUNT(*) as count FROM orders GROUP BY payment_status`
    );

    const [dailyOrders] = await connection.execute(
      `SELECT DATE(created_at) as date, COUNT(*) as count, COALESCE(SUM(final_price), 0) as revenue
       FROM orders
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       GROUP BY DATE(created_at)
       ORDER BY date ASC`
    );

    const averageOrderValue = totalOrders > 0 ? parseFloat(totalRevenue) / parseInt(totalOrders) : 0;

    connection.release();
    return res.status(200).json({
      totalOrders: parseInt(totalOrders || 0),
      averageOrderValue,
      completedOrders: parseInt(completedOrders || 0),
      cancelledOrders: parseInt(cancelledOrders || 0),
      ordersByStatus,
      ordersByPayment,
      dailyOrders,
    });
  } catch (error) {
    console.error("❌ Get orders report error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

// ==================== ORDER RATINGS ====================

export const getOrderRatings = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    // Destructure necessary query parameters (pagination removed)
    const {
      search,
      start_date,
      end_date,
      min_food_quality,
      max_food_quality,
      min_delivery_service,
      max_delivery_service
    } = req.query;

    let query = `
      SELECT 
        r.id, r.order_id, r.user_id, r.food_quality, r.delivery_service, r.comment, r.created_at, r.updated_at,
        o.order_number, o.status, o.final_price, o.delivery_address,
        c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
        dm.name AS delivery_man_name, dm.phone AS delivery_man_phone,
        GROUP_CONCAT(DISTINCT p.name SEPARATOR ', ') AS products_in_order,
        GROUP_CONCAT(DISTINCT p.image SEPARATOR ', ') AS product_images
      FROM order_ratings r
      LEFT JOIN orders o ON r.order_id = o.id
      LEFT JOIN clients c ON r.user_id = c.id
      LEFT JOIN delivery_men dm ON o.delivery_man_id = dm.id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN products p ON oi.product_id = p.id
    `;

    const conditions = [];
    const params = [];

    // --- Build Main Query Conditions ---
    if (search) {
      conditions.push("(c.name LIKE ? OR c.email LIKE ? OR o.order_number LIKE ? OR r.comment LIKE ?)");
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }
    if (start_date) {
      conditions.push("DATE(r.created_at) >= ?");
      params.push(start_date);
    }
    if (end_date) {
      conditions.push("DATE(r.created_at) <= ?");
      params.push(end_date);
    }
    if (min_food_quality) {
      conditions.push("r.food_quality >= ?");
      params.push(parseInt(min_food_quality));
    }
    if (max_food_quality) {
      conditions.push("r.food_quality <= ?");
      params.push(parseInt(max_food_quality));
    }
    if (min_delivery_service) {
      conditions.push("r.delivery_service >= ?");
      params.push(parseInt(min_delivery_service));
    }
    if (max_delivery_service) {
      conditions.push("r.delivery_service <= ?");
      params.push(parseInt(max_delivery_service));
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    // Removed LIMIT/OFFSET. Fetch all matching ratings.
    query += " GROUP BY r.id ORDER BY r.created_at DESC";

    const [ratings] = await connection.execute(query, params);

    // --- Build Count Query Conditions ---
    let countQuery = "SELECT COUNT(DISTINCT r.id) AS total FROM order_ratings r LEFT JOIN orders o ON r.order_id = o.id LEFT JOIN clients c ON r.user_id = c.id";
    const countParams = [];
    const countConditions = [];

    // NOTE: This parameter logic MUST mirror the main query logic exactly
    if (search) {
      countConditions.push("(c.name LIKE ? OR c.email LIKE ? OR o.order_number LIKE ? OR r.comment LIKE ?)");
      const s = `%${search}%`;
      countParams.push(s, s, s, s);
    }
    if (start_date) {
      countConditions.push("DATE(r.created_at) >= ?");
      countParams.push(start_date);
    }
    if (end_date) {
      countConditions.push("DATE(r.created_at) <= ?");
      countParams.push(end_date);
    }
    if (min_food_quality) {
      countConditions.push("r.food_quality >= ?");
      countParams.push(parseInt(min_food_quality));
    }
    if (max_food_quality) {
      countConditions.push("r.food_quality <= ?");
      countParams.push(parseInt(max_food_quality));
    }
    if (min_delivery_service) {
      countConditions.push("r.delivery_service >= ?");
      countParams.push(parseInt(min_delivery_service));
    }
    if (max_delivery_service) {
      countConditions.push("r.delivery_service <= ?");
      countParams.push(parseInt(max_delivery_service));
    }

    if (countConditions.length > 0) {
      countQuery += " WHERE " + countConditions.join(" AND ");
    }

    const [[{ total }]] = await connection.execute(countQuery, countParams);

    connection.release();
    return res.status(200).json({
      ratings,
      total: parseInt(total || 0), // Return total count for reference
    });
  } catch (error) {
    console.error("❌ Get order ratings error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

export const exportOrderRatings = async (req, res) => {
  let connection;
  try {
    const { search, start_date, end_date, min_food_quality, max_food_quality, min_delivery_service, max_delivery_service } = req.query;
    connection = await pool.getConnection();

    let query = `
      SELECT 
        r.id, r.order_id, r.user_id, r.food_quality, r.delivery_service, r.comment, r.created_at, r.updated_at,
        o.order_number, o.status, o.final_price, o.delivery_address,
        c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
        dm.name AS delivery_man_name, dm.phone AS delivery_man_phone,
        GROUP_CONCAT(DISTINCT p.name SEPARATOR ', ') AS products_in_order
      FROM order_ratings r
      LEFT JOIN orders o ON r.order_id = o.id
      LEFT JOIN clients c ON r.user_id = c.id
      LEFT JOIN delivery_men dm ON o.delivery_man_id = dm.id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN products p ON oi.product_id = p.id
    `;

    const conditions = [];
    const params = [];
    const limit = req.query.limit || 1000; // Add this line

    if (search) {
      conditions.push("(c.name LIKE ? OR c.email LIKE ? OR o.order_number LIKE ? OR r.comment LIKE ?)");
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }
    if (start_date) {
      conditions.push("DATE(r.created_at) >= ?");
      params.push(start_date);
    }
    if (end_date) {
      conditions.push("DATE(r.created_at) <= ?");
      params.push(end_date);
    }
    if (min_food_quality) {
      conditions.push("r.food_quality >= ?");
      params.push(parseInt(min_food_quality));
    }
    if (max_food_quality) {
      conditions.push("r.food_quality <= ?");
      params.push(parseInt(max_food_quality));
    }
    if (min_delivery_service) {
      conditions.push("r.delivery_service >= ?");
      params.push(parseInt(min_delivery_service));
    }
    if (max_delivery_service) {
      conditions.push("r.delivery_service <= ?");
      params.push(parseInt(max_delivery_service));
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " GROUP BY r.id ORDER BY r.created_at DESC LIMIT ?"; // Add LIMIT ? here
    params.push(limit); // Add this line

    const [rows] = await connection.execute(query, params);

    const headers = [
      'id', 'order_id', 'order_number', 'user_id', 'customer_name', 'customer_email', 'customer_phone',
      'delivery_man_name', 'delivery_man_phone', 'food_quality', 'delivery_service', 'comment',
      'status', 'final_price', 'delivery_address', 'products_in_order', 'created_at', 'updated_at'
    ];
    const csvRows = [headers.join(',')].concat(
      rows.map(r => [
        r.id,
        r.order_id,
        r.order_number,
        r.user_id,
        (r.customer_name || '').toString().replace(/,/g, ' '),
        (r.customer_email || '').toString().replace(/,/g, ' '),
        (r.customer_phone || '').toString().replace(/,/g, ' '),
        (r.delivery_man_name || '').toString().replace(/,/g, ' '),
        (r.delivery_man_phone || '').toString().replace(/,/g, ' '),
        r.food_quality,
        r.delivery_service,
        (r.comment || '').toString().replace(/,/g, ' '),
        r.status,
        parseFloat(r.final_price || 0).toFixed(2),
        (r.delivery_address || '').toString().replace(/,/g, ' '),
        (r.products_in_order || '').toString().replace(/,/g, ' '),
        r.created_at?.toISOString?.() || r.created_at,
        r.updated_at?.toISOString?.() || r.updated_at
      ].join(','))
    );
    const csv = csvRows.join('\n');
    res.header('Content-Type', 'text/csv');
    res.attachment('order_ratings.csv');
    return res.send(csv);
  } catch (error) {
    console.error('❌ Export order ratings error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  } finally {
    if (connection) connection.release();
  }
};

export const getAdminProfile = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.execute(
      "SELECT id, name, email, is_active, last_login, created_at FROM admins WHERE id = ? AND is_active = 1",
      [req.adminId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Admin not found" });
    }

    return res.status(200).json({ admin: rows[0] });
  } catch (error) {
    console.error("❌ Get admin profile error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

// ==================== OFFERS ====================

// Get all offers with complete data (including inactive ones)
export const getAllOffers = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    const [offers] = await connection.execute(
      `SELECT 
      o.*, 
      COUNT(DISTINCT op.product_id) AS products_count,
      COUNT(DISTINCT ou.user_id) AS total_usage,  -- Count unique users
      SUM(ou.usage_count) AS total_revenue_impact,
      CASE 
        WHEN o.is_active = 1 
          AND (o.start_at IS NULL OR o.start_at <= NOW())
          AND (o.end_at IS NULL OR o.end_at >= NOW())
        THEN 'Active'
        WHEN o.is_active = 0 THEN 'Inactive'
        WHEN o.start_at > NOW() THEN 'Scheduled'
        WHEN o.end_at < NOW() THEN 'Expired'
        ELSE 'Unknown'
      END as status
    FROM offers o
    LEFT JOIN offer_products op ON o.id = op.offer_id
    LEFT JOIN offer_usages ou ON o.id = ou.offer_id
    GROUP BY o.id
    ORDER BY o.created_at DESC`
    );

    connection.release();
    return res.status(200).json({ offers });
  } catch (error) {
    console.error("❌ Get all offers error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

// Get active offers with usage and products count
export const getActiveOffers = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    const [offers] = await connection.execute(
      `SELECT 
         o.*, 
         COUNT(DISTINCT op.product_id) AS products_count,
         COUNT(ou.id) AS total_usage,
         SUM(ou.usage_count) AS total_revenue_impact
       FROM offers o
       LEFT JOIN offer_products op ON o.id = op.offer_id
       LEFT JOIN offer_usages ou ON o.id = ou.offer_id
       WHERE o.is_active = 1 
         AND (o.start_at IS NULL OR o.start_at <= NOW())
         AND (o.end_at IS NULL OR o.end_at >= NOW())
       GROUP BY o.id
       ORDER BY o.created_at DESC`
    );

    connection.release();
    return res.status(200).json({ offers });
  } catch (error) {
    console.error("❌ Get active offers error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

// Get offer details: base offer, products in offer, and usage records
export const getOfferDetails = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    connection = await pool.getConnection();

    const [[offer]] = await connection.execute(
      `SELECT * FROM offers WHERE id = ?`,
      [id]
    );

    if (!offer) {
      connection.release();
      return res.status(404).json({ message: "Offer not found" });
    }

    const [products] = await connection.execute(
      `SELECT 
         op.*, 
         p.name AS product_name, 
         p.image AS product_image,
         p.price AS product_price
       FROM offer_products op
       INNER JOIN products p ON op.product_id = p.id
       WHERE op.offer_id = ?
       ORDER BY p.name ASC`,
      [id]
    );

    const [usage] = await connection.execute(
      `SELECT 
         ou.*, 
         c.name AS customer_name,
         p.name AS product_name,
         p.price AS product_price
       FROM offer_usages ou
       INNER JOIN clients c ON ou.user_id = c.id
       LEFT JOIN products p ON ou.product_id = p.id
       WHERE ou.offer_id = ?
       ORDER BY ou.used_at DESC`,
      [id]
    );

    connection.release();
    return res.status(200).json({ offer, products, usage });
  } catch (error) {
    console.error("❌ Get offer details error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

// ==================== DASHBOARD ====================
// start
// ==================== UPDATED FUNCTIONS ====================

export const getDashboardStats = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    // Get restaurant_id for this admin
    const [adminRows] = await connection.execute(
      'SELECT restaurant_id FROM admins WHERE id = ?',
      [req.adminId]
    );
    if (adminRows.length === 0) {
      return res.status(403).json({ message: 'Admin not found' });
    }
    const restaurantId = adminRows[0].restaurant_id;

    // Global revenue
    const [globalRevenue] = await connection.execute(
      `SELECT COALESCE(SUM(final_price), 0) AS totalRevenue, COUNT(*) AS totalOrders
       FROM orders WHERE status = 'Delivered' AND restaurant_id = ?`,
      [restaurantId]
    );

    // Delivered orders fees
    const [deliveredOrdersFees] = await connection.execute(
      `SELECT COALESCE(SUM(delivery_fee), 0) as totalDeliveryFees, COUNT(*) as deliveredOrders
       FROM orders WHERE status = 'Delivered' AND restaurant_id = ?`,
      [restaurantId]
    );

    // Payment status distribution
    const [paymentStatus] = await connection.execute(
      `SELECT payment_status, COUNT(*) as count,
              ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM orders WHERE restaurant_id = ?), 2) as percentage
       FROM orders WHERE restaurant_id = ? GROUP BY payment_status ORDER BY count DESC`,
      [restaurantId, restaurantId]
    );

    // Daily revenue by payment status (today)
    const [dailyRevenueByStatus] = await connection.execute(
      `SELECT payment_status, COALESCE(SUM(final_price), 0) as revenue, COUNT(*) as order_count
       FROM orders WHERE DATE(created_at) = CURDATE() AND status = 'Delivered' AND restaurant_id = ?
       GROUP BY payment_status ORDER BY revenue DESC`,
      [restaurantId]
    );

    // Hourly status analysis (last 30 days)
    const [hourlyStatusAnalysis] = await connection.execute(
      `SELECT HOUR(created_at) as hour, COUNT(*) as total_orders,
              SUM(CASE WHEN status = 'Delivered' THEN 1 ELSE 0 END) as delivered,
              SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending,
              SUM(CASE WHEN status = 'Preparing' THEN 1 ELSE 0 END) as preparing,
              SUM(CASE WHEN status = 'OutForDelivery' THEN 1 ELSE 0 END) as out_for_delivery,
              SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END) as cancelled,
              AVG(CASE WHEN status = 'Delivered' AND updated_at != created_at THEN TIMESTAMPDIFF(MINUTE, created_at, updated_at) ELSE NULL END) as avg_completion_time,
              AVG(CASE WHEN status = 'OutForDelivery' AND updated_at != created_at THEN TIMESTAMPDIFF(MINUTE, created_at, updated_at) ELSE NULL END) as avg_to_delivery_time
       FROM orders WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND restaurant_id = ?
       GROUP BY HOUR(created_at) ORDER BY hour ASC`,
      [restaurantId]
    );

    // Today orders
    const [todayOrders] = await connection.execute(
      `SELECT COUNT(*) as count, COALESCE(SUM(final_price), 0) as revenue
       FROM orders WHERE DATE(created_at) = CURDATE() AND restaurant_id = ?`,
      [restaurantId]
    );

    // Week orders
    const [weekOrders] = await connection.execute(
      `SELECT COUNT(*) as count, COALESCE(SUM(final_price), 0) as revenue
       FROM orders WHERE YEARWEEK(created_at) = YEARWEEK(NOW()) AND restaurant_id = ?`,
      [restaurantId]
    );

    // Month orders
    const [monthOrders] = await connection.execute(
      `SELECT COUNT(*) as count, COALESCE(SUM(final_price), 0) as revenue
       FROM orders WHERE YEAR(created_at) = YEAR(NOW()) AND MONTH(created_at) = MONTH(NOW()) AND restaurant_id = ?`,
      [restaurantId]
    );

    // Unique clients
    const [clients] = await connection.execute(
      `SELECT COUNT(DISTINCT user_id) as count FROM orders WHERE restaurant_id = ?`,
      [restaurantId]
    );

    // Active delivery men (global)
    const [deliveryMen] = await connection.execute(
      `SELECT COUNT(*) as count FROM delivery_men WHERE is_active = 1`
    );

    // Pending orders
    const [pendingOrders] = await connection.execute(
      `SELECT COUNT(*) as count FROM orders WHERE status = 'Pending' AND restaurant_id = ?`,
      [restaurantId]
    );

    // Active deliveries
    const [activeDeliveries] = await connection.execute(
      `SELECT COUNT(*) as count FROM orders WHERE status = 'OutForDelivery' AND restaurant_id = ?`,
      [restaurantId]
    );

    // Orders by status
    const [ordersByStatus] = await connection.execute(
      `SELECT status, COUNT(*) as count FROM orders WHERE restaurant_id = ? GROUP BY status`,
      [restaurantId]
    );

    // Recent orders with customer and delivery man names
    const [recentOrders] = await connection.execute(
      `SELECT o.*, c.name as customer_name, c.phone as customer_phone, dm.name as delivery_man_name
       FROM orders o
       LEFT JOIN clients c ON o.user_id = c.id
       LEFT JOIN delivery_men dm ON o.delivery_man_id = dm.id
       WHERE o.restaurant_id = ?
       ORDER BY o.created_at DESC LIMIT 10`,
      [restaurantId]
    );

    return res.status(200).json({
      stats: {
        orders: { today: todayOrders[0], week: weekOrders[0], month: monthOrders[0] },
        clients: clients[0].count,
        deliveryMen: deliveryMen[0].count,
        pendingOrders: pendingOrders[0].count,
        activeDeliveries: activeDeliveries[0].count,
        ordersByStatus,
        globalMetrics: {
          totalRevenue: parseFloat(globalRevenue[0].totalRevenue || 0),
          totalOrders: globalRevenue[0].totalOrders || 0,
          totalDeliveryFees: parseFloat(deliveredOrdersFees[0].totalDeliveryFees || 0),
          deliveredOrders: deliveredOrdersFees[0].deliveredOrders || 0,
          paymentStatusDistribution: paymentStatus,
          dailyRevenueByStatus,
        },
        hourlyStatusAnalysis,
      },
      recentOrders,
    });
  } catch (error) {
    console.error("❌ Get dashboard stats error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

// ----------------------------------------------------------------------

export const getTopProducts = async (req, res) => {
  let connection;
  try {
    const { limit = 5 } = req.query;
    const limitNum = parseInt(limit) || 5;

    connection = await pool.getConnection();

    // Get restaurant_id for this admin
    const [adminRows] = await connection.execute(
      'SELECT restaurant_id FROM admins WHERE id = ?',
      [req.adminId]
    );
    if (adminRows.length === 0) {
      return res.status(403).json({ message: 'Admin not found' });
    }
    const restaurantId = adminRows[0].restaurant_id;

    const [products] = await connection.execute(
      `SELECT 
        p.id,
        p.name,
        p.price,
        COUNT(oi.id) as sales_count,
        COALESCE(SUM(oi.price_per_unit * oi.quantity), 0) as total_revenue
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id AND o.status = 'Delivered' AND o.restaurant_id = ?
      WHERE p.restaurant_id = ?
      GROUP BY p.id, p.name, p.price
      ORDER BY sales_count DESC, total_revenue DESC
      LIMIT ${limitNum}`,
      [restaurantId, restaurantId] // Two placeholders: for o.restaurant_id and p.restaurant_id
    );

    return res.status(200).json({ products });
  } catch (error) {
    console.error("❌ Get top products error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

// ----------------------------------------------------------------------

export const getRevenueTrends = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    const [adminRows] = await connection.execute(
      'SELECT restaurant_id FROM admins WHERE id = ?',
      [req.adminId]
    );
    if (adminRows.length === 0) {
      return res.status(403).json({ message: 'Admin not found' });
    }
    const restaurantId = adminRows[0].restaurant_id;

    // Daily revenue for last 30 days for this restaurant
    const [dailyRevenue] = await connection.execute(
      `SELECT 
        DATE(created_at) as date,
        COALESCE(SUM(final_price), 0) as revenue
      FROM orders
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        AND restaurant_id = ?
      GROUP BY DATE(created_at)
      ORDER BY date ASC`,
      [restaurantId]
    );

    // Current month revenue for this restaurant
    const [currentMonth] = await connection.execute(
      `SELECT COALESCE(SUM(final_price), 0) as revenue
       FROM orders
       WHERE YEAR(created_at) = YEAR(NOW()) 
         AND MONTH(created_at) = MONTH(NOW())
         AND restaurant_id = ?`,
      [restaurantId]
    );

    // Last month revenue for this restaurant
    const [lastMonth] = await connection.execute(
      `SELECT COALESCE(SUM(final_price), 0) as revenue
       FROM orders
       WHERE YEAR(created_at) = YEAR(DATE_SUB(NOW(), INTERVAL 1 MONTH))
         AND MONTH(created_at) = MONTH(DATE_SUB(NOW(), INTERVAL 1 MONTH))
         AND restaurant_id = ?`,
      [restaurantId]
    );

    const currentMonthRevenue = parseFloat(currentMonth[0].revenue || 0);
    const lastMonthRevenue = parseFloat(lastMonth[0].revenue || 0);
    const growth = lastMonthRevenue > 0
      ? ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
      : 0;

    return res.status(200).json({
      dailyRevenue: dailyRevenue,
      currentMonth: currentMonthRevenue,
      lastMonth: lastMonthRevenue,
      growth: growth,
    });
  } catch (error) {
    console.error("❌ Get revenue trends error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

// ----------------------------------------------------------------------

export const getTopClients = async (req, res) => {
  let connection;
  try {
    const { limit = 5 } = req.query;
    const limitNum = parseInt(limit) || 5;

    connection = await pool.getConnection();

    const [adminRows] = await connection.execute(
      'SELECT restaurant_id FROM admins WHERE id = ?',
      [req.adminId]
    );
    if (adminRows.length === 0) {
      return res.status(403).json({ message: 'Admin not found' });
    }
    const restaurantId = adminRows[0].restaurant_id;

    const [clients] = await connection.execute(
      `SELECT 
        c.id,
        c.name,
        c.email,
        COUNT(o.id) as total_orders,
        COALESCE(SUM(o.final_price), 0) as total_spent
      FROM clients c
      LEFT JOIN orders o ON c.id = o.user_id AND o.restaurant_id = ?
      GROUP BY c.id, c.name, c.email
      ORDER BY total_spent DESC, total_orders DESC
      LIMIT ${limitNum}`,
      [restaurantId]
    );

    return res.status(200).json({ clients });
  } catch (error) {
    console.error("❌ Get top clients error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

// ----------------------------------------------------------------------

export const getHourlyPerformance = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    const [adminRows] = await connection.execute(
      'SELECT restaurant_id FROM admins WHERE id = ?',
      [req.adminId]
    );
    if (adminRows.length === 0) {
      return res.status(403).json({ message: 'Admin not found' });
    }
    const restaurantId = adminRows[0].restaurant_id;

    // Get orders by hour for today (last 24 hours) for this restaurant
    const [hourlyData] = await connection.execute(
      `SELECT 
        HOUR(created_at) as hour,
        COUNT(*) as orders,
        COALESCE(SUM(final_price), 0) as revenue,
        COUNT(CASE WHEN status = 'Delivered' THEN 1 END) as delivered,
        COUNT(CASE WHEN status = 'OutForDelivery' THEN 1 END) as outForDelivery,
        COUNT(CASE WHEN status = 'Preparing' THEN 1 END) as preparing,
        COUNT(CASE WHEN status = 'Pending' THEN 1 END) as pending
      FROM orders
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        AND restaurant_id = ?
      GROUP BY HOUR(created_at)
      ORDER BY hour ASC`,
      [restaurantId]
    );

    // Create array for all 24 hours and fill missing hours with zeros (same logic as before)
    const allHoursData = [];
    const currentHour = new Date().getHours();
    for (let i = 0; i < 24; i++) {
      const hour = (currentHour - 23 + i + 24) % 24;
      const hourData = hourlyData.find(h => parseInt(h.hour) === hour);
      allHoursData.push({
        hour: hour,
        hourRange: `${hour.toString().padStart(2, '0')}:00 - ${((hour + 1) % 24).toString().padStart(2, '0')}:00`,
        orders: hourData ? parseInt(hourData.orders) : 0,
        revenue: hourData ? parseFloat(hourData.revenue || 0) : 0,
        delivered: hourData ? parseInt(hourData.delivered) : 0,
        outForDelivery: hourData ? parseInt(hourData.outForDelivery) : 0,
        preparing: hourData ? parseInt(hourData.preparing) : 0,
        pending: hourData ? parseInt(hourData.pending) : 0,
      });
    }

    // Get peak hours for today for this restaurant
    const [peakHours] = await connection.execute(
      `SELECT 
        HOUR(created_at) as hour,
        COUNT(*) as order_count
      FROM orders
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        AND restaurant_id = ?
      GROUP BY HOUR(created_at)
      ORDER BY order_count DESC
      LIMIT 3`,
      [restaurantId]
    );

    // Get hourly averages for the last 7 days for this restaurant
    const [hourlyAverages] = await connection.execute(
      `SELECT 
        HOUR(created_at) as hour,
        COUNT(*) as totalOrders,
        COALESCE(SUM(final_price), 0) as totalRevenue
      FROM orders
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        AND restaurant_id = ?
      GROUP BY HOUR(created_at)
      ORDER BY hour ASC`,
      [restaurantId]
    );

    // Get today's total stats for this restaurant
    const [todayStats] = await connection.execute(
      `SELECT 
        COUNT(*) as totalOrders,
        COALESCE(SUM(final_price), 0) as totalRevenue,
        COUNT(CASE WHEN status = 'Delivered' THEN 1 END) as totalDelivered,
        AVG(CASE 
          WHEN status = 'Delivered' AND out_for_delivery_at IS NOT NULL AND delivered_at IS NOT NULL 
          THEN TIMESTAMPDIFF(MINUTE, out_for_delivery_at, delivered_at)
        END) as avgDeliveryTimeToday
      FROM orders
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        AND restaurant_id = ?`,
      [restaurantId]
    );

    return res.status(200).json({
      hourlyData: allHoursData,
      peakHours: peakHours,
      hourlyAverages: hourlyAverages,
      todayStats: todayStats[0],
    });
  } catch (error) {
    console.error("❌ Get hourly performance error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

/// end

// Get delivered orders for dashboard map
export const getDeliveredOrders = async (req, res) => {
  let connection;
  try {
    const { limit = 20 } = req.query;
    // Ensure limit is always a number for direct injection
    const limitNum = parseInt(limit) || 20;

    connection = await pool.getConnection();

    const [orders] = await connection.execute(
      `SELECT 
        o.id,
        o.order_number,
        o.delivery_address,
        o.final_price,
        o.delivered_at,
        c.name as customer_name,
        c.phone as customer_phone,
        o.lat as client_lat,
        o.lon as client_lon
      FROM orders o
      LEFT JOIN clients c ON o.user_id = c.id
      WHERE o.status = 'Delivered' 
      AND o.lat IS NOT NULL AND (o.lon IS NOT NULL)
      ORDER BY o.delivered_at DESC
      LIMIT ${limitNum}`, // <--- FIXED: Injected limitNum directly
      [] // <--- FIXED: Empty parameter array
    );

    connection.release();
    return res.status(200).json({ orders });
  } catch (error) {
    console.error("❌ Get delivered orders error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};


// Get active deliveries for dashboard
export const getActiveDeliveries = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    const [deliveries] = await connection.execute(
      `SELECT 
        o.id,
        o.order_number,
        o.delivery_address,
        o.final_price,
        c.name as customer_name,
        c.phone as customer_phone,
        dm.name as delivery_man_name,
        dm.current_latitude,
        dm.current_longitude,
        o.lat as client_lat,
        o.lon as client_lon
      FROM orders o
      LEFT JOIN clients c ON o.user_id = c.id
      LEFT JOIN delivery_men dm ON o.delivery_man_id = dm.id
      WHERE o.status = 'OutForDelivery'
      ORDER BY o.created_at DESC`
    );

    connection.release();
    return res.status(200).json({ deliveries });
  } catch (error) {
    console.error("❌ Get active deliveries error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

// Get all orders with status for dashboard map
export const getAllOrdersForMap = async (req, res) => {
  let connection;
  try {
    const { status, limit = 100 } = req.query;
    connection = await pool.getConnection();

    let query = `
      SELECT 
        o.id,
        o.order_number,
        o.status,
        o.delivery_address,
        o.final_price,
        o.created_at,
        o.delivered_at,
        c.name as customer_name,
        c.phone as customer_phone,
        dm.name as delivery_man_name,
        o.lat as client_lat,
        o.lon as client_lon
      FROM orders o
      LEFT JOIN clients c ON o.user_id = c.id
      LEFT JOIN delivery_men dm ON o.delivery_man_id = dm.id
    `;

    const params = [];

    if (status && status !== 'all') {
      query += " WHERE o.status = ?";
      params.push(status);
    }

    query += " ORDER BY o.created_at DESC LIMIT ?";
    params.push(parseInt(limit));

    const [orders] = await connection.execute(query, params);

    connection.release();
    return res.status(200).json({ orders });
  } catch (error) {
    console.error("❌ Get all orders for map error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};






// ==================== ORDERS MANAGEMENT ====================

export const getAllOrders = async (req, res) => {
  let connection;
  try {
    const adminId = req.adminId; 

    if (!adminId) {
      return res.status(401).json({ message: "Unauthorized: No admin ID found" });
    }

    connection = await pool.getConnection();

    // 1. Fetch the restaurant_id for this specific admin
    const [adminData] = await connection.execute(
      "SELECT restaurant_id FROM admins WHERE id = ?",
      [adminId]
    );

    if (adminData.length === 0 || !adminData[0].restaurant_id) {
      return res.status(403).json({ message: "Access denied: Admin has no assigned restaurant" });
    }

    const restaurantId = adminData[0].restaurant_id;

    // 2. Base Query: Force BOTH restaurant_id AND today's date
    let query = `
      SELECT o.*, 
             c.name as customer_name, c.phone as customer_phone, c.email as customer_email,
             dm.name as delivery_man_name, dm.phone as delivery_man_phone,
             dm.current_latitude as delivery_man_lat, dm.current_longitude as delivery_man_lon,
             o.lat as client_lat, o.lon as client_lon
      FROM orders o
      LEFT JOIN clients c ON o.user_id = c.id
      LEFT JOIN delivery_men dm ON o.delivery_man_id = dm.id
      WHERE o.restaurant_id = ? 
      AND DATE(o.created_at) = CURDATE()
    `;

    const params = [restaurantId];
    const { status, payment_status, search } = req.query;

    // 3. Optional Filters (Removed start_date/end_date as they conflict with "Today only")
    if (status) {
      query += " AND o.status = ?";
      params.push(status);
    }

    if (payment_status) {
      query += " AND o.payment_status = ?";
      params.push(payment_status);
    }

    if (search) {
      query += " AND (o.order_number LIKE ? OR c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)";
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    query += " ORDER BY o.created_at DESC";

    const [orders] = await connection.execute(query, params);

    return res.status(200).json({ orders });

  } catch (error) {
    console.error("❌ Get today's orders error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

export const getOrderDetails = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    connection = await pool.getConnection();

    // Get order
    const [orders] = await connection.execute(
      `SELECT o.*, 
              c.name as customer_name, c.phone as customer_phone, c.email as customer_email,
              dm.name as delivery_man_name, dm.phone as delivery_man_phone,
              dm.current_latitude as delivery_man_lat, dm.current_longitude as delivery_man_lon,
              o.lat as client_lat, o.lon as client_lon
       FROM orders o
       LEFT JOIN clients c ON o.user_id = c.id
       LEFT JOIN delivery_men dm ON o.delivery_man_id = dm.id
       WHERE o.id = ?`,
      [id]
    );

    if (orders.length === 0) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Get order items
    const [items] = await connection.execute(
      `SELECT oi.*, p.name as product_name, p.image as product_image
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?`,
      [id]
    );

    return res.status(200).json({
      order: orders[0],
      items,
    });
  } catch (error) {
    console.error("❌ Get order details error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};


// mobile version
export const updateOrderStatus = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const { status, estimated_preparing_time } = req.body;

    if (!status || !['Pending', 'Preparing', 'OutForDelivery', 'Delivered', 'Cancelled'].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    connection = await pool.getConnection();

    // UPGRADED: Join with clients table to get current_language
    const [orders] = await connection.execute(
      `SELECT o.*, c.current_language 
       FROM orders o 
       LEFT JOIN clients c ON o.user_id = c.id 
       WHERE o.id = ?`, 
      [id]
    );

    if (orders.length === 0) {
      connection.release();
      return res.status(404).json({ message: "Order not found" });
    }

    const order = orders[0];
    const userLang = order.current_language === 'arabic' ? 'ar' : 'en';

    // 1. MAINTAINED: Main Update Logic
    let updateQuery = "UPDATE orders SET status = ?, updated_at = NOW()";
    const updateParams = [status];

    if (status === 'Preparing' && estimated_preparing_time) {
      updateQuery += ", estimated_preparing_time = ?";
      updateParams.push(estimated_preparing_time);
    }

    if (status === 'OutForDelivery') {
      if (!order.out_for_delivery_at) updateQuery += ", out_for_delivery_at = NOW()";
    } else if (status === 'Delivered') {
      if (!order.delivered_at) updateQuery += ", delivered_at = NOW()";
    } else if (status === 'Preparing') {
      if (!order.set_prepared_at) updateQuery += ", set_prepared_at = NOW()";
    }

    updateQuery += " WHERE id = ?";
    updateParams.push(id);
    await connection.execute(updateQuery, updateParams);

    // 2. MAINTAINED: Notification Helpers
    const notifyClient = async (title, message) => {
      try {
        const wsResult = await sendNotification({
          toUserType: "client",
          toUserId: order.user_id,
          title,
          message,
          data: { order_id: id, order_number: order.order_number, status, type: "order_update" },
          sendPush: true,
          sendWebSocket: true
        });
        if (!wsResult.success || !wsResult.webSocketSent) {
          await sendPushNotificationOnly({
            toUserType: "client",
            toUserId: order.user_id,
            title,
            message,
            data: { order_id: id, order_number: order.order_number, status, type: "order_update" }
          });
        }
      } catch (error) { console.error('❌ Client notification error:', error); }
    };

    const notifyDeliveryMan = async (title, message) => {
      if (!order.delivery_man_id) return;
      try {
        const wsResult = await sendNotification({
          toUserType: "delivery_man",
          toUserId: order.delivery_man_id,
          title,
          message,
          data: { order_id: id, order_number: order.order_number, status, type: "order_update" },
          sendPush: true,
          sendWebSocket: true
        });
        if (!wsResult.success || !wsResult.webSocketSent) {
          await sendPushNotificationOnly({
            toUserType: "delivery_man",
            toUserId: order.delivery_man_id,
            title,
            message,
            data: { order_id: id, order_number: order.order_number, status, type: "order_update" }
          });
        }
      } catch (error) { console.error('❌ Delivery man notification error:', error); }
    };

    // 3. UPGRADED: Language-aware Content Mapping
    const content = {
      Preparing: {
        en: { t: "Order is Being Prepared", m: `Your order #${order.order_number} is now being prepared.` },
        ar: { t: "طلبك قيد التحضير", m: `طلبك رقم #${order.order_number} قيد التحضير الآن.` }
      },
      OutForDelivery: {
        en: { t: "Order On The Way", m: `Your order #${order.order_number} is on its way to you!` },
        ar: { t: "الطلب في الطريق", m: `طلبك رقم #${order.order_number} في الطريق إليك الآن!` }
      },
      Delivered: {
        en: { t: "Order Delivered", m: `Your order #${order.order_number} has been delivered successfully.` },
        ar: { t: "تم توصيل الطلب", m: `تم توصيل طلبك رقم #${order.order_number} بنجاح.` }
      },
      Cancelled: {
        en: { t: "Order Cancelled", m: `Your order #${order.order_number} was cancelled.` },
        ar: { t: "تم إلغاء الطلب", m: `تم إلغاء طلبك رقم #${order.order_number}.` }
      }
    };

    // 4. Trigger Notifications based on mapped language
    if (content[status]) {
      const selected = content[status][userLang];
      await notifyClient(selected.t, selected.m);
      
      // Delivery man receives English (or you can map his language too)
      await notifyDeliveryMan(content[status].en.t, content[status].en.m);
    }

    connection.release();
    return res.status(200).json({ message: "Order status updated successfully", notification_sent: true });

  } catch (error) {
    console.error("❌ Update order status error:", error.message);
    if (connection) connection.release();
    return res.status(500).json({ message: "Server error" });
  }
};

export const assignDeliveryMan = async (req, res) => {
  let connection;
  try {
    const { orderId, deliveryManId } = req.body;
    if (!orderId || !deliveryManId) {
      return res.status(400).json({ message: "Order ID and Delivery Man ID are required" });
    }
    connection = await pool.getConnection();

    // 1. Get delivery man info
    const [deliveryMen] = await connection.execute(
      "SELECT * FROM delivery_men WHERE id = ? AND is_active = 1",
      [deliveryManId]
    );
    if (deliveryMen.length === 0) {
      connection.release();
      return res.status(404).json({ message: "Delivery man not found or inactive" });
    }
    const deliveryMan = deliveryMen[0];

    // 2. UPGRADED: Check if order exists and get Client Language
    const [orders] = await connection.execute(
      `SELECT o.*, c.current_language 
       FROM orders o 
       LEFT JOIN clients c ON o.user_id = c.id 
       WHERE o.id = ?`,
      [orderId]
    );
    
    if (orders.length === 0) {
      connection.release();
      return res.status(404).json({ message: "Order not found" });
    }
    const order = orders[0];
    const userLang = order.current_language === 'arabic' ? 'ar' : 'en';

    // 3. Update order - assign delivery man
    await connection.execute(
      "UPDATE orders SET delivery_man_id = ?, updated_at = NOW() WHERE id = ?",
      [deliveryManId, orderId]
    );

    // 🔔 DUAL NOTIFICATION SYSTEM 🔔

    const notifyClientDelivery = async () => {
      // UPGRADED: Language Content
      const translations = {
        en: { 
          title: "Delivery Man Assigned", 
          message: `${deliveryMan.name} has been assigned to your order #${order.order_number}.` 
        },
        ar: { 
          title: "تم تعيين مندوب توصيل", 
          message: `تم تعيين ${deliveryMan.name} لتوصيل طلبك رقم #${order.order_number}.` 
        }
      };

      const selected = translations[userLang];

      try {
        const wsResult = await sendNotification({
          toUserType: "client",
          toUserId: order.user_id,
          title: selected.title,
          message: selected.message,
          data: {
            order_id: orderId.toString(),
            delivery_man_id: deliveryManId.toString(),
            delivery_man_name: deliveryMan.name,
            order_number: order.order_number,
            type: "delivery_assigned"
          },
          sendPush: true,
          sendWebSocket: true
        });

        if (!wsResult.success) {
          await sendPushNotificationOnly({
            toUserType: "client",
            toUserId: order.user_id,
            title: selected.title,
            message: selected.message,
            data: {
              order_id: orderId.toString(),
              delivery_man_id: deliveryManId.toString(),
              delivery_man_name: deliveryMan.name,
              type: "delivery_assigned"
            }
          });
        }
      } catch (error) {
        console.error('❌ Client delivery notification error:', error);
      }
    };

    const notifyDeliveryManAssignment = async () => {
      try {
        const wsResult = await sendNotification({
          toUserType: "delivery_man",
          toUserId: deliveryManId,
          title: "New Order Assigned",
          message: `You have been assigned to order #${order.order_number}.`,
          data: {
            order_id: orderId.toString(),
            order_number: order.order_number,
            client_id: order.user_id,
            type: "new_assignment"
          },
          sendPush: true,
          sendWebSocket: true
        });

        if (!wsResult.success) {
          await sendPushNotificationOnly({
            toUserType: "delivery_man",
            toUserId: deliveryManId,
            title: "New Order Assigned",
            message: `You have been assigned to order #${order.order_number}.`,
            data: {
              order_id: orderId.toString(),
              type: "new_assignment"
            }
          });
        }
      } catch (error) {
        console.error('❌ Delivery man assignment notification error:', error);
      }
    };

    // Send both notifications concurrently
    await Promise.all([
      notifyClientDelivery(),
      notifyDeliveryManAssignment()
    ]);

    connection.release();
    return res.status(200).json({
      message: "Delivery man assigned successfully",
      notification_sent: true
    });

  } catch (error) {
    console.error("❌ Assign delivery man error:", error.message);
    if (connection) connection.release();
    return res.status(500).json({ message: "Server error" });
  }
};

// Update order (comprehensive update) - Enhanced with dual notifications web version
export const updateOrder = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const {
      status,
      payment_status,
      delivery_address,
      total_price,
      delivery_fee,
      discount,
      final_price,
      delivery_man_id
    } = req.body;

    connection = await pool.getConnection();

    // Check if order exists
    const [orders] = await connection.execute(
      `SELECT * FROM orders WHERE id = ?`,
      [id]
    );

    if (orders.length === 0) {
      connection.release();
      return res.status(404).json({ message: "Order not found" });
    }

    const oldOrder = orders[0];

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (status !== undefined) {
      if (!['Pending', 'Preparing', 'OutForDelivery', 'Delivered', 'Cancelled'].includes(status)) {
        connection.release();
        return res.status(400).json({ message: "Invalid status" });
      }
      updates.push("status = ?");
      values.push(status);

      if (status === 'OutForDelivery') {
        if (!oldOrder.out_for_delivery_at) updates.push("out_for_delivery_at = NOW()");
      } else if (status === 'Delivered') {
        if (!oldOrder.delivered_at) updates.push("delivered_at = NOW()");
      }
    }

    // ... [rest of your update logic remains here]

    updates.push("updated_at = NOW()");
    values.push(id);

    await connection.execute(
      `UPDATE orders SET ${updates.join(", ")} WHERE id = ?`,
      values
    );

    // 🔔 ENHANCED DUAL NOTIFICATION SYSTEM 🔔

    // UPGRADED: Join with clients to get current_language
    const [updatedOrders] = await connection.execute(
      `SELECT o.*, c.current_language 
       FROM orders o 
       LEFT JOIN clients c ON o.user_id = c.id 
       WHERE o.id = ?`, [id]
    );
    const order = updatedOrders[0];
    const userLang = order.current_language === 'arabic' ? 'ar' : 'en';

    const sendDualNotification = async ({ toUserType, toUserId, title, message, data }) => {
      try {
        const primaryResult = await sendNotification({
          toUserType, toUserId, title, message, data,
          sendPush: true, sendWebSocket: true
        });

        if (!primaryResult.success || !primaryResult.webSocketSent) {
          await sendPushNotificationOnly({ toUserType, toUserId, title, message, data });
        }
        return primaryResult;
      } catch (error) {
        console.error(`❌ Dual notification error:`, error);
        return { success: false };
      }
    };
    
    // Language Mapping
    const translations = {
      delivery_assigned: {
        en: { t: "Delivery Man Assigned", m: (name) => `${name} has been assigned to your order #${order.order_number}.` },
        ar: { t: "تم تعيين مندوب توصيل", m: (name) => `تم تعيين ${name} لتوصيل طلبك رقم #${order.order_number}.` }
      },
      Preparing: {
        en: { t: "Order is Being Prepared", m: `Your order #${order.order_number} is now being prepared.` },
        ar: { t: "طلبك قيد التحضير", m: `طلبك رقم #${order.order_number} قيد التحضير الآن.` }
      },
      OutForDelivery: {
        en: { t: "Order On The Way", m: `Your order #${order.order_number} is on its way to you!` },
        ar: { t: "الطلب في الطريق", m: `طلبك رقم #${order.order_number} في الطريق إليك الآن!` }
      },
      Delivered: {
        en: { t: "Order Delivered", m: `Your order #${order.order_number} has been delivered successfully.` },
        ar: { t: "تم توصيل الطلب", m: `تم توصيل طلبك رقم #${order.order_number} بنجاح.` }
      },
      Cancelled: {
        en: { t: "Order Cancelled", m: `Your order #${order.order_number} was cancelled.` },
        ar: { t: "تم إلغاء الطلب", m: `تم إلغاء طلبك رقم #${order.order_number}.` }
      }
    };

    // 1. If admin assigned a delivery man
    if (delivery_man_id !== undefined && delivery_man_id !== oldOrder.delivery_man_id) {
      if (delivery_man_id) {
        const [deliveryMan] = await connection.execute("SELECT name FROM delivery_men WHERE id = ?", [delivery_man_id]);
        const deliveryManName = deliveryMan[0]?.name || 'Delivery Man';

        // Notify delivery man (English)
        await sendDualNotification({
          toUserType: "delivery_man",
          toUserId: delivery_man_id,
          title: "New Delivery Assigned",
          message: `You have been assigned to deliver order #${order.order_number}.`,
          data: { order_id: id, type: 'delivery_assigned' }
        });

        // Notify client (Language Aware)
        const trans = translations.delivery_assigned[userLang];
        await sendDualNotification({
          toUserType: "client",
          toUserId: order.user_id,
          title: trans.t,
          message: trans.m(deliveryManName),
          data: { order_id: id, delivery_man_id, type: 'delivery_assigned' }
        });
      }
    }

    // 2. If admin changed status
    if (status !== undefined && status !== oldOrder.status) {
      const statusNotifications = [];
      const trans = translations[status];

      if (trans) {
        // Notify client (Language Aware)
        statusNotifications.push(sendDualNotification({
          toUserType: "client",
          toUserId: order.user_id,
          title: trans[userLang].t,
          message: trans[userLang].m,
          data: { order_id: id, status, type: 'order_update' }
        }));

        // Notify delivery man (English)
        if (order.delivery_man_id) {
          // Logic for delivery man message selection (Keeping original English strings)
          const dmTitles = { Preparing: "Order Preparing", OutForDelivery: "Out for Delivery", Delivered: "Order Delivered", Cancelled: "Order Cancelled" };
          const dmMsgs = { 
            Preparing: `Order #${order.order_number} is now being prepared.`, 
            OutForDelivery: `Order #${order.order_number} is out for delivery.`,
            Delivered: `Order #${order.order_number} has been delivered successfully.`,
            Cancelled: `Order #${order.order_number} assigned to you has been cancelled.`
          };

          statusNotifications.push(sendDualNotification({
            toUserType: "delivery_man",
            toUserId: order.delivery_man_id,
            title: dmTitles[status],
            message: dmMsgs[status],
            data: { order_id: id, status, type: 'order_update' }
          }));
        }
      }
      await Promise.all(statusNotifications);
    }

    connection.release();
    return res.status(200).json({ message: "Order updated successfully", notification_sent: true });

  } catch (error) {
    console.error("❌ Update error:", error.message);
    if (connection) connection.release();
    return res.status(500).json({ message: "Server error" });
  }
};

// New function to handle new order placement
export const handleNewOrder = async (req, res) => {
  let connection;
  try {
    const { userId, orderNumber, orderData } = req.body;

    if (!userId || !orderNumber) {
      return res.status(400).json({ message: "User ID and order number are required" });
    }

    connection = await pool.getConnection();

    // 🔔 DUAL NOTIFICATION: Notify client about new order
    const notifyClient = await sendNotification({
      toUserType: "client",
      toUserId: userId,
      title: "Order Confirmed",
      message: `Your order #${orderNumber} has been received and is being processed.`,
      data: {
        order_number: orderNumber,
        order_data: orderData,
        type: "new_order"
      },
      sendPush: true,
      sendWebSocket: true
    });

    // Send push-only as backup
    if (!notifyClient.success) {
      await sendPushNotificationOnly({
        toUserType: "client",
        toUserId: userId,
        title: "Order Confirmed",
        message: `Your order #${orderNumber} has been received and is being processed.`,
        data: {
          order_number: orderNumber,
          type: "new_order"
        }
      });
    }

    // 🔔 Notify all delivery men about new order
    const notifyDeliveryMen = await sendBulkNotification({
      toUserType: "delivery_man",
      title: "New Order Available",
      message: `A new order #${orderNumber} is available for delivery.`,
      data: {
        order_number: orderNumber,
        type: "new_order_available"
      },
      sendPush: true
    });

    connection.release();

    return res.status(200).json({
      message: "Order created and notifications sent",
      client_notified: notifyClient.success,
      delivery_men_notified: notifyDeliveryMen.successful,
      notification_sent: true
    });

  } catch (error) {
    console.error("❌ Handle new order error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

// ==================== CLIENTS MANAGEMENT ====================

export const getAllClients = async (req, res) => {
  let connection;
  try {
    // 1. REMOVED: page and limit from destructuring
    const { search, has_favorites, start_date, end_date } = req.query;

    connection = await pool.getConnection();

    // Base query definition
    const mainQueryBase = `
SELECT c.*, 
  (SELECT COUNT(*) FROM orders WHERE user_id = c.id) as total_orders,
  (SELECT COALESCE(SUM(final_price), 0) FROM orders WHERE user_id = c.id) as total_spent,
  (SELECT COUNT(*) FROM favorites WHERE client_id = c.id) as favorites_count
FROM clients c
`;

    let query = mainQueryBase;

    const params = [];
    const conditions = [];

    if (search) {
      conditions.push("(c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)");
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (start_date) {
      conditions.push("c.created_at >= ?");
      params.push(start_date);
    }

    if (end_date) {
      conditions.push("c.created_at <= ?");
      params.push(end_date);
    }

    if (has_favorites === 'true' || has_favorites === true) {
      conditions.push("(SELECT COUNT(*) FROM favorites WHERE client_id = c.id) > 0");
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY c.created_at DESC";

    // 2. REMOVED: LIMIT ? OFFSET ? clause and parameters.

    // 3. EXECUTION: Using .trim() for safety against invisible characters.
    const [clients] = await connection.execute(query.trim(), params);

    // 4. REMOVED: The entire COUNT(*) query logic.

    return res.status(200).json({
      clients,
      // 5. REMOVED: The entire pagination object.
    });
  } catch (error) {
    console.error("❌ Get all clients error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

export const getClientDetails = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    connection = await pool.getConnection();

    const [clients] = await connection.execute(
      "SELECT * FROM clients WHERE id = ?",
      [id]
    );

    if (clients.length === 0) {
      return res.status(404).json({ message: "Client not found" });
    }

    // Get client orders
    const [orders] = await connection.execute(
      `SELECT o.*, dm.name as delivery_man_name
       FROM orders o
       LEFT JOIN delivery_men dm ON o.delivery_man_id = dm.id
       WHERE o.user_id = ?
       ORDER BY o.created_at DESC`,
      [id]
    );

    // Get client favorites with product details (handle deleted products)
    const [favorites] = await connection.execute(
      `SELECT 
        f.id as favorite_id,
        f.created_at as favorited_at,
        p.id as product_id,
        p.name as product_name,
        p.price as product_price,
        p.image as product_image,
        p.active as product_active,
        CASE WHEN p.id IS NULL THEN 1 ELSE 0 END as is_deleted
       FROM favorites f
       LEFT JOIN products p ON f.product_id = p.id
       WHERE f.client_id = ?
       ORDER BY f.created_at DESC
       LIMIT 50`,
      [id]
    );

    return res.status(200).json({
      client: clients[0],
      orders,
      favorites: favorites || [],
      favorites_count: favorites?.length || 0,
    });
  } catch (error) {
    console.error("❌ Get client details error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

export const updateClient = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const { name, email, phone, birthDate, gender, bio } = req.body;

    connection = await pool.getConnection();

    await connection.execute(
      `UPDATE clients 
       SET name = ?, email = ?, phone = ?, birthDate = ?, gender = ?, bio = ?
       WHERE id = ?`,
      [name, email, phone, birthDate || null, gender || null, bio || null, id]
    );

    return res.status(200).json({ message: "Client updated successfully" });
  } catch (error) {
    console.error("❌ Update client error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

// Get client activity log
export const getClientActivity = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    connection = await pool.getConnection();

    // Get all orders for this client with status changes
    const [orders] = await connection.execute(
      `SELECT 
        o.id,
        o.order_number,
        o.status,
        o.payment_status,
        o.final_price,
        o.created_at,
        o.updated_at
      FROM orders o
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC
      LIMIT 50`,
      [id]
    );

    // Build activity log from orders
    const activity = [];
    orders.forEach((order) => {
      // Order created
      activity.push({
        type: 'order',
        action: `Order #${order.order_number} created`,
        details: {
          amount: order.final_price,
          status: order.status,
        },
        timestamp: order.created_at,
      });

      // Status changes (if updated_at is different from created_at)
      if (order.updated_at && order.updated_at !== order.created_at) {
        activity.push({
          type: 'order',
          action: `Order #${order.order_number} status updated to ${order.status}`,
          details: {
            amount: order.final_price,
            status: order.status,
          },
          timestamp: order.updated_at,
        });
      }
    });

    connection.release();
    return res.status(200).json({ activity });
  } catch (error) {
    console.error("❌ Get client activity error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

export const getClientFavorites = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    connection = await pool.getConnection();

    const [favorites] = await connection.execute(
      `SELECT 
        f.id as favorite_id,
        f.created_at as favorited_at,
        p.id as product_id,
        p.name as product_name,
        p.price as product_price,
        p.image as product_image,
        p.active as product_active,
        CASE WHEN p.id IS NULL THEN 1 ELSE 0 END as is_deleted
       FROM favorites f
       LEFT JOIN products p ON f.product_id = p.id
       WHERE f.client_id = ?
       ORDER BY f.created_at DESC`,
      [id]
    );

    connection.release();
    return res.status(200).json({ favorites: favorites || [] });
  } catch (error) {
    console.error("❌ Get client favorites error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

export const deleteClientFavorite = async (req, res) => {
  let connection;
  try {
    const { id, favorite_id } = req.params;
    connection = await pool.getConnection();

    // Verify the favorite belongs to this client
    const [favorites] = await connection.execute(
      "SELECT id FROM favorites WHERE id = ? AND client_id = ?",
      [favorite_id, id]
    );

    if (favorites.length === 0) {
      connection.release();
      return res.status(404).json({ message: "Favorite not found" });
    }

    await connection.execute(
      "DELETE FROM favorites WHERE id = ?",
      [favorite_id]
    );

    return res.status(200).json({ message: "Favorite removed successfully" });
  } catch (error) {
    console.error("❌ Delete client favorite error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

export const exportClients = async (req, res) => {
  let connection;
  try {
    const { search, has_favorites, start_date, end_date } = req.query;
    connection = await pool.getConnection();

    let query = `
      SELECT c.id, c.name, c.email, c.phone, c.is_active, c.is_verified, c.created_at,
             (SELECT COUNT(*) FROM orders WHERE user_id = c.id) as total_orders,
             (SELECT COALESCE(SUM(final_price), 0) FROM orders WHERE user_id = c.id) as total_spent,
             (SELECT COUNT(*) FROM favorites WHERE client_id = c.id) as favorites_count
      FROM clients c
    `;

    const params = [];
    const conditions = [];

    if (search) {
      conditions.push("(c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)");
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    if (has_favorites === 'true') {
      conditions.push("(SELECT COUNT(*) FROM favorites WHERE client_id = c.id) > 0");
    }
    if (has_favorites === 'false') {
      conditions.push("(SELECT COUNT(*) FROM favorites WHERE client_id = c.id) = 0");
    }
    if (start_date) {
      conditions.push("DATE(c.created_at) >= ?");
      params.push(start_date);
    }
    if (end_date) {
      conditions.push("DATE(c.created_at) <= ?");
      params.push(end_date);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY c.created_at DESC LIMIT 1000";

    const [rows] = await connection.execute(query, params);

    const headers = [
      'id', 'name', 'email', 'phone', 'is_active', 'is_verified', 'created_at',
      'total_orders', 'total_spent', 'favorites_count'
    ];
    const csvRows = [headers.join(',')].concat(
      rows.map(r => [
        r.id,
        (r.name || '').toString().replace(/,/g, ' '),
        (r.email || '').toString().replace(/,/g, ' '),
        (r.phone || '').toString().replace(/,/g, ' '),
        r.is_active,
        r.is_verified,
        r.created_at?.toISOString?.() || r.created_at,
        r.total_orders || 0,
        parseFloat(r.total_spent || 0).toFixed(2),
        r.favorites_count || 0
      ].join(','))
    );
    const csv = csvRows.join('\n');
    res.header('Content-Type', 'text/csv');
    res.attachment('clients.csv');
    return res.send(csv);
  } catch (error) {
    console.error('❌ Export clients error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  } finally {
    if (connection) connection.release();
  }
};

export const resetClientPassword = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ message: "New password is required" });
    }

    connection = await pool.getConnection();

    // Check if client exists
    const [clients] = await connection.execute(
      "SELECT id FROM clients WHERE id = ?",
      [id]
    );

    if (clients.length === 0) {
      return res.status(404).json({ message: "Client not found" });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the password
    await connection.execute(
      "UPDATE clients SET password = ? WHERE id = ?",
      [hashedPassword, id]
    );

    return res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("❌ Reset client password error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

export const toggleClientStatus = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    connection = await pool.getConnection();

    // Check if client exists
    const [clients] = await connection.execute(
      "SELECT id, is_active FROM clients WHERE id = ?",
      [id]
    );

    if (clients.length === 0) {
      return res.status(404).json({ message: "Client not found" });
    }

    // Toggle status
    const newStatus = clients[0].is_active ? 0 : 1;
    await connection.execute(
      "UPDATE clients SET is_active = ? WHERE id = ?",
      [newStatus, id]
    );

    return res.status(200).json({
      message: `Client ${newStatus ? 'activated' : 'deactivated'} successfully`,
      is_active: Boolean(newStatus)
    });
  } catch (error) {
    console.error("❌ Toggle client status error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

export const toggleClientVerification = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    connection = await pool.getConnection();

    // Check if client exists
    const [clients] = await connection.execute(
      "SELECT id, is_verified FROM clients WHERE id = ?",
      [id]
    );

    if (clients.length === 0) {
      return res.status(404).json({ message: "Client not found" });
    }

    // Toggle verification
    const newVerification = clients[0].is_verified ? 0 : 1;
    await connection.execute(
      "UPDATE clients SET is_verified = ? WHERE id = ?",
      [newVerification, id]
    );

    return res.status(200).json({
      message: `Client ${newVerification ? 'verified' : 'unverified'} successfully`,
      is_verified: Boolean(newVerification)
    });
  } catch (error) {
    console.error("❌ Toggle client verification error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

// ==================== DELIVERY MEN MANAGEMENT ====================

export const getAllDeliveryMen = async (req, res) => {
  let connection;
  try {
    // 1. Removed: 'page' and 'limit' from req.query destructuring
    const { search, is_active, sort_by } = req.query;
    connection = await pool.getConnection();

    let query = `
      SELECT dm.*,
            (SELECT COUNT(*) FROM orders WHERE delivery_man_id = dm.id) as total_orders,
            (SELECT COUNT(*) FROM orders WHERE delivery_man_id = dm.id AND status = 'Delivered') as completed_orders,
            (SELECT COUNT(*) FROM orders WHERE delivery_man_id = dm.id AND status = 'Delivered') as deliveries_count,
            (SELECT COALESCE(SUM(delivery_fee), 0) FROM orders WHERE delivery_man_id = dm.id AND status = 'Delivered') as total_fees,
            (SELECT AVG(TIMESTAMPDIFF(SECOND, out_for_delivery_at, delivered_at)) 
             FROM orders 
             WHERE delivery_man_id = dm.id 
               AND status = 'Delivered' 
               AND out_for_delivery_at IS NOT NULL 
               AND delivered_at IS NOT NULL) as avg_delivery_seconds
      FROM delivery_men dm
    `;

    const params = [];
    const conditions = [];
    if (search) {
      conditions.push("(dm.name LIKE ? OR dm.email LIKE ? OR dm.phone LIKE ?)");
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    if (is_active !== undefined) {
      conditions.push("dm.is_active = ?");
      // Safety check to ensure a 1 or 0 is passed to the database
      params.push(is_active === 'true' || is_active === '1' ? 1 : 0);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    // Add sorting
    let orderBy = "dm.created_at DESC";
    if (sort_by === 'avg_delivery_time') {
      orderBy = "avg_delivery_seconds ASC";
    } else if (sort_by === 'total_fees') {
      orderBy = "total_fees DESC";
    } else if (sort_by === 'deliveries_count') {
      orderBy = "deliveries_count DESC";
    } else if (sort_by === 'name') {
      orderBy = "dm.name ASC";
    }
    query += ` ORDER BY ${orderBy}`;

    // 2. Removed: LIMIT ? OFFSET ? logic
    const [deliveryMen] = await connection.execute(query, params);

    // Format delivery times and ensure last_login is included (this is fine)
    const formattedDeliveryMen = deliveryMen.map(dm => {
      let avgDeliveryTime = null;
      if (dm.avg_delivery_seconds) {
        const seconds = Math.round(dm.avg_delivery_seconds);
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (hours > 0) {
          // Changed seconds/minutes to use the full integer, not the parsed values
          avgDeliveryTime = `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        } else {
          avgDeliveryTime = `${minutes}:${String(secs).padStart(2, '0')}`;
        }
      }
      return {
        ...dm,
        avg_delivery_time: avgDeliveryTime,
        avg_delivery_seconds: dm.avg_delivery_seconds || null,
        total_fees: parseFloat(dm.total_fees || 0),
        deliveries_count: parseInt(dm.deliveries_count || 0),
        last_login: dm.last_login || null,
      };
    });

    // 3. Removed: The entire separate COUNT(*) query logic

    return res.status(200).json({
      deliveryMen: formattedDeliveryMen,
      // 4. Removed: The entire pagination object from the response
    });
  } catch (error) {
    console.error("❌ Get all delivery men error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

export const getDeliveryManDetails = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    connection = await pool.getConnection();

    const [deliveryMen] = await connection.execute(
      "SELECT * FROM delivery_men WHERE id = ?",
      [id]
    );

    if (deliveryMen.length === 0) {
      return res.status(404).json({ message: "Delivery man not found" });
    }

    // Get assigned orders
    const [orders] = await connection.execute(
      `SELECT o.*, c.name as customer_name, c.phone as customer_phone
       FROM orders o
       LEFT JOIN clients c ON o.user_id = c.id
       WHERE o.delivery_man_id = ?
       ORDER BY o.created_at DESC`,
      [id]
    );

    return res.status(200).json({
      deliveryMan: deliveryMen[0],
      orders,
    });
  } catch (error) {
    console.error("❌ Get delivery man details error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

export const createDeliveryMan = async (req, res) => {
  let connection;
  try {
    const { name, email, password, phone, vehicle_type, license_number } = req.body;

    if (!name || !email || !password || !phone) {
      return res.status(400).json({ message: "Name, email, password, and phone are required" });
    }

    connection = await pool.getConnection();

    // Check if email exists
    const [existing] = await connection.execute(
      "SELECT * FROM delivery_men WHERE email = ?",
      [email]
    );

    if (existing.length > 0) {
      return res.status(409).json({ message: "Email already registered" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert delivery man
    const [result] = await connection.execute(
      `INSERT INTO delivery_men (name, email, password, phone, vehicle_type, license_number, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [name, email, hashedPassword, phone, vehicle_type || 'Motorcycle', license_number || null]
    );

    return res.status(201).json({
      message: "Delivery man created successfully",
      id: result.insertId,
    });
  } catch (error) {
    console.error("❌ Create delivery man error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

export const updateDeliveryMan = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const { name, email, phone, vehicle_type, license_number, is_active } = req.body;

    connection = await pool.getConnection();

    await connection.execute(
      `UPDATE delivery_men 
       SET name = ?, email = ?, phone = ?, vehicle_type = ?, license_number = ?, is_active = ?
       WHERE id = ?`,
      [name, email, phone, vehicle_type, license_number || null, is_active !== undefined ? is_active : 1, id]
    );

    return res.status(200).json({ message: "Delivery man updated successfully" });
  } catch (error) {
    console.error("❌ Update delivery man error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

// Get delivery man performance
export const getDeliveryManPerformance = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    connection = await pool.getConnection();

    // Total orders
    const [totalOrders] = await connection.execute(
      "SELECT COUNT(*) as count FROM orders WHERE delivery_man_id = ?",
      [id]
    );

    // Completed orders
    const [completedOrders] = await connection.execute(
      "SELECT COUNT(*) as count FROM orders WHERE delivery_man_id = ? AND status = 'Delivered'",
      [id]
    );

    // Completion rate
    const completionRate = totalOrders[0].count > 0
      ? (completedOrders[0].count / totalOrders[0].count) * 100
      : 0;

    // Average delivery time (simplified - time from OutForDelivery to Delivered)
    const [avgTime] = await connection.execute(
      `SELECT 
        AVG(TIMESTAMPDIFF(MINUTE, 
          (SELECT MIN(updated_at) FROM orders o2 WHERE o2.id = o.id AND o2.status = 'OutForDelivery'),
          (SELECT MAX(updated_at) FROM orders o2 WHERE o2.id = o.id AND o2.status = 'Delivered')
        )) as avgDeliveryTimeMinutes
      FROM orders o
      WHERE o.delivery_man_id = ? AND o.status = 'Delivered'`,
      [id]
    );

    // Total revenue
    const [revenue] = await connection.execute(
      "SELECT COALESCE(SUM(final_price), 0) as total FROM orders WHERE delivery_man_id = ? AND status = 'Delivered'",
      [id]
    );

    connection.release();
    return res.status(200).json({
      totalOrders: totalOrders[0].count,
      completedOrders: completedOrders[0].count,
      completionRate: completionRate,
      avgDeliveryTimeMinutes: avgTime[0].avgDeliveryTimeMinutes || 0,
      totalRevenue: parseFloat(revenue[0].total || 0),
    });
  } catch (error) {
    console.error("❌ Get delivery man performance error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

// Get delivery man earnings
export const getDeliveryManEarnings = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    connection = await pool.getConnection();

    // Daily earnings for last 30 days
    const [dailyEarnings] = await connection.execute(
      `SELECT 
        DATE(updated_at) as date,
        COUNT(*) as order_count,
        COALESCE(SUM(final_price), 0) as total_revenue
      FROM orders
      WHERE delivery_man_id = ? 
        AND status = 'Delivered'
        AND updated_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY DATE(updated_at)
      ORDER BY date ASC`,
      [id]
    );

    // Summary
    const [summary] = await connection.execute(
      `SELECT 
        COUNT(*) as totalOrders,
        COALESCE(SUM(final_price), 0) as totalRevenue
      FROM orders
      WHERE delivery_man_id = ? AND status = 'Delivered'`,
      [id]
    );

    const totalOrders = summary[0].totalOrders || 0;
    const totalRevenue = parseFloat(summary[0].totalRevenue || 0);
    const averagePerOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    connection.release();
    return res.status(200).json({
      earnings: dailyEarnings,
      summary: {
        totalOrders: totalOrders,
        totalRevenue: totalRevenue,
        averagePerOrder: averagePerOrder,
      },
    });
  } catch (error) {
    console.error("❌ Get delivery man earnings error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

export const getDeliveryManLocationHistory = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;
    connection = await pool.getConnection();

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Check if delivery man exists and get their details
    const [deliveryMan] = await connection.execute(
      `SELECT 
        dm.id,
        dm.name,
        dm.email,
        dm.password,
        dm.phone,
        dm.vehicle_type,
        dm.license_number,
        dm.is_active,
        dm.current_latitude,
        dm.current_longitude,
        dm.last_location_update,
        dm.created_at,
        dm.updated_at,
        dm.image,
        dm.last_login
       FROM delivery_men dm
       WHERE dm.id = ?`,
      [id]
    );

    if (deliveryMan.length === 0) {
      return res.status(404).json({ message: "Delivery man not found" });
    }

    // Create location history from delivery man's current location
    const locations = [];
    if (deliveryMan[0].current_latitude && deliveryMan[0].current_longitude) {
      locations.push({
        id: deliveryMan[0].id,
        latitude: deliveryMan[0].current_latitude,
        longitude: deliveryMan[0].current_longitude,
        accuracy: null,
        speed: null,
        heading: null,
        created_at: deliveryMan[0].last_location_update || deliveryMan[0].updated_at,
        order_number: null,
        order_status: null
      });
    }

    // Get orders assigned to this delivery man as additional location points
    const [orderLocations] = await connection.execute(
      `SELECT 
        o.id,
        o.delivery_latitude as latitude,
        o.delivery_longitude as longitude,
        o.order_number,
        o.status as order_status,
        o.updated_at as created_at,
        null as accuracy,
        null as speed,
        null as heading
       FROM orders o
       WHERE o.delivery_man_id = ? 
         AND o.delivery_latitude IS NOT NULL 
         AND o.delivery_longitude IS NOT NULL
       ORDER BY o.updated_at DESC
       LIMIT ? OFFSET ?`,
      [id, parseInt(limit), offset]
    );

    locations.push(...orderLocations);

    connection.release();
    return res.status(200).json({
      delivery_man: deliveryMan[0],
      locations,
      pagination: {
        total: locations.length,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(locations.length / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("❌ Get delivery man location history error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};



export const updateDeliveryManImage = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }

    connection = await pool.getConnection();

    // Get old image path
    const [deliveryMen] = await connection.execute(
      "SELECT image FROM delivery_men WHERE id = ?",
      [id]
    );

    // Delete old image if exists
    if (deliveryMen[0].image && fs.existsSync(deliveryMen[0].image)) {
      fs.unlinkSync(deliveryMen[0].image);
    }

    // Update with new image
    await connection.execute(
      "UPDATE delivery_men SET image = ? WHERE id = ?",
      [req.file.path, id]
    );

    return res.status(200).json({
      message: "Image updated successfully",
      image: req.file.path,
    });
  } catch (error) {
    console.error("❌ Update delivery man image error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

// ==================== CATEGORIES MANAGEMENT ====================

export const getAllCategories = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    // 1. Get the restaurant_id of the authenticated admin using the ID from the middleware
    const [adminRows] = await connection.execute(
      'SELECT restaurant_id FROM admins WHERE id = ?',
      [req.adminId]
    );

    if (adminRows.length === 0) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    const restaurantId = adminRows[0].restaurant_id;

    // 2. Build the query to fetch all categories for that specific restaurant
    // Also includes the count of products belonging to each category
    const query = `
      SELECT c.*, 
             (SELECT COUNT(*) FROM products WHERE category_id = c.id) as product_count
      FROM categories c
      WHERE c.restaurant_id = ?
      ORDER BY c.created_at DESC
    `;

    const [categories] = await connection.execute(query, [restaurantId]);

    // 3. Return the categories
    return res.status(200).json({ categories });
  } catch (error) {
    console.error("❌ Get all categories error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

export const createCategory = async (req, res) => {
  let connection;
  try {
    const { name, description, active } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Category name is required" });
    }

    connection = await pool.getConnection();

    // Check if category exists
    const [existing] = await connection.execute(
      "SELECT * FROM categories WHERE name = ?",
      [name]
    );

    if (existing.length > 0) {
      return res.status(409).json({ message: "Category already exists" });
    }

    const imagePath = req.file ? req.file.path : null;

    const [result] = await connection.execute(
      `INSERT INTO categories (name, description, image, active)
       VALUES (?, ?, ?, ?)`,
      [name, description || null, imagePath, active !== undefined ? active : true]
    );

    return res.status(201).json({
      message: "Category created successfully",
      id: result.insertId,
    });
  } catch (error) {
    console.error("❌ Create category error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};
// update category


export const updateCategory = async (req, res) => {
  console.log("see what happen: ", req.body);
  let connection;
  try {
    const { id } = req.params;
    const { name, description, active } = req.body;

    connection = await pool.getConnection();

    // Get old image if updating
    let imagePath = null;

    if (req.file) {
      // Get current category to find old image path
      const [categories] = await connection.execute(
        "SELECT image FROM categories WHERE id = ?",
        [id]
      );

      if (categories.length > 0) {
        const oldImagePath = categories[0].image;

        // Delete old image file if it exists and is not a placeholder/default
        if (oldImagePath &&
          oldImagePath !== 'uploads/default-category.png' &&
          oldImagePath !== 'default-category.png' &&
          fs.existsSync(oldImagePath)) {

          try {
            fs.unlinkSync(oldImagePath);
            console.log("Deleted old image:", oldImagePath);
          } catch (err) {
            console.warn("Could not delete old image:", err.message);
            // Don't fail the whole request if image deletion fails
          }
        } else {
          console.log("Old image not found or is default:", oldImagePath);
        }
      }

      // Use req.file.path for the new image
      imagePath = req.file.path;
      console.log("New image path:", imagePath);
    }

    const updateFields = [];
    const params = [];

    if (name) {
      updateFields.push("name = ?");
      params.push(name);
    }
    if (description !== undefined) {
      updateFields.push("description = ?");
      params.push(description);
    }
    if (imagePath) {
      updateFields.push("image = ?");
      params.push(imagePath);
    }
    if (active !== undefined) {
      updateFields.push("active = ?");
      const activeValue = active === true || active === 'true' || active === 1 || active === '1' ? 1 : 0;
      params.push(activeValue);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    params.push(id);

    await connection.execute(
      `UPDATE categories SET ${updateFields.join(", ")} WHERE id = ?`,
      params
    );

    // Return the updated category data
    const [updatedCategories] = await connection.execute(
      "SELECT * FROM categories WHERE id = ?",
      [id]
    );

    return res.status(200).json({
      message: "Category updated successfully",
      category: updatedCategories[0]
    });
  } catch (error) {
    console.error("❌ Update category error:", error.message);
    console.error("Stack trace:", error.stack);
    return res.status(500).json({
      message: "Server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (connection) connection.release();
  }
};;
//
export const deleteCategory = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    connection = await pool.getConnection();

    // Check if category has products
    const [products] = await connection.execute(
      "SELECT COUNT(*) as count FROM products WHERE category_id = ?",
      [id]
    );

    if (products[0].count > 0) {
      return res.status(400).json({
        message: "Cannot delete category with existing products",
      });
    }

    // Get image path before deletion
    const [categories] = await connection.execute(
      "SELECT image FROM categories WHERE id = ?",
      [id]
    );

    await connection.execute("DELETE FROM categories WHERE id = ?", [id]);

    // Delete image file
    if (categories[0].image && fs.existsSync(categories[0].image)) {
      fs.unlinkSync(categories[0].image);
    }

    return res.status(200).json({ message: "Category deleted successfully" });
  } catch (error) {
    console.error("❌ Delete category error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};


// ==================== PRODUCTS MANAGEMENT ====================

export const getAllProducts = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    // 1. Get the restaurant_id of the authenticated admin
    const [adminRows] = await connection.execute(
      'SELECT restaurant_id FROM admins WHERE id = ?',
      [req.adminId]
    );

    if (adminRows.length === 0) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    const restaurantId = adminRows[0].restaurant_id;

    // 2. Build the query to fetch all products for that restaurant
    const query = `
      SELECT p.*, c.name as category_name
      FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE p.restaurant_id = ?
      ORDER BY p.created_at DESC
    `;

    const [products] = await connection.execute(query, [restaurantId]);

    // 3. Return the products (no pagination metadata)
    return res.status(200).json({ products });
  } catch (error) {
    console.error('❌ Get all products error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  } finally {
    if (connection) connection.release();
  }
};

export const getProductDetails = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    connection = await pool.getConnection();

    const [products] = await connection.execute(
      `SELECT p.*, c.name as category_name
       FROM products p
       JOIN categories c ON p.category_id = c.id
       WHERE p.id = ?`,
      [id]
    );

    if (products.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    return res.status(200).json({ product: products[0] });
  } catch (error) {
    console.error("❌ Get product details error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

export const createProduct = async (req, res) => {
  let connection;
  try {
    const { name, description, price, rating, category_id, delivery, promo, promoValue, badge, is_popular, best_for, active, for_cart } = req.body;

    if (!name || !price || !category_id) {
      return res.status(400).json({ message: "Name, price, and category are required" });
    }

    connection = await pool.getConnection();

    const imagePath = req.file ? req.file.path : null;

    const activeValue = active === undefined || active === true || active === 'true' || active === 1 || active === '1' ? 1 : 0;

    const [result] = await connection.execute(
      `INSERT INTO products (name, description, price, rating, image, category_id, delivery, promo, promoValue, badge, is_popular, best_for, active, for_cart)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        description || null,
        parseFloat(price),
        rating ? parseFloat(rating) : 0,
        imagePath,
        parseInt(category_id),
        delivery || null,
        promo === true || promo === 'true' ? 1 : 0,
        promoValue ? parseInt(promoValue) : 0,
        badge || null,
        is_popular === true || is_popular === 'true' ? 1 : 0,
        best_for || null,
        activeValue,
        for_cart === true || for_cart === 'true' ? 1 : 0,
      ]
    );

    return res.status(201).json({
      message: "Product created successfully",
      id: result.insertId,
    });
  } catch (error) {
    console.error("❌ Create product error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

export const updateProduct = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const { name, description, price, rating, category_id, delivery, promo, promoValue, badge, is_popular, best_for, active,for_cart } = req.body;

    connection = await pool.getConnection();

    // Get old image if updating
    let imagePath = null;
    if (req.file) {
      const [products] = await connection.execute(
        "SELECT image FROM products WHERE id = ?",
        [id]
      );
      if (products[0].image && fs.existsSync(products[0].image)) {
        fs.unlinkSync(products[0].image);
      }
      imagePath = req.file.path;
    }

    const updateFields = [];
    const params = [];

    if (name) {
      updateFields.push("name = ?");
      params.push(name);
    }
    if (description !== undefined) {
      updateFields.push("description = ?");
      params.push(description);
    }
    if (price !== undefined) {
      updateFields.push("price = ?");
      params.push(parseFloat(price));
    }
    if (rating !== undefined) {
      updateFields.push("rating = ?");
      params.push(parseFloat(rating));
    }
    if (category_id) {
      updateFields.push("category_id = ?");
      params.push(parseInt(category_id));
    }
    if (delivery !== undefined) {
      updateFields.push("delivery = ?");
      params.push(delivery);
    }
    if (promo !== undefined) {
      updateFields.push("promo = ?");
      params.push(promo === true || promo === 'true' ? 1 : 0);
    }
    if (promoValue !== undefined) {
      updateFields.push("promoValue = ?");
      params.push(parseInt(promoValue));
    }
    if (badge !== undefined) {
      updateFields.push("badge = ?");
      params.push(badge);
    }
    if (is_popular !== undefined) {
      updateFields.push("is_popular = ?");
      params.push(is_popular === true || is_popular === 'true' ? 1 : 0);
    }
    if (best_for !== undefined) {
      updateFields.push("best_for = ?");
      params.push(best_for);
    }
    if (active !== undefined) {
      updateFields.push("active = ?");
      // Handle FormData boolean strings
      const activeValue = active === true || active === 'true' || active === 1 || active === '1' ? 1 : 0;
      params.push(activeValue);
    }
    if(for_cart !== undefined) {
      updateFields.push("for_cart = ?");
      params.push(for_cart === true || for_cart === 'true' ? 1 : 0);
    }
    if (imagePath) {
      updateFields.push("image = ?");
      params.push(imagePath);
    }

    params.push(id);

    await connection.execute(
      `UPDATE products SET ${updateFields.join(", ")} WHERE id = ?`,
      params
    );

    return res.status(200).json({ message: "Product updated successfully" });
  } catch (error) {
    console.error("❌ Update product error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

export const deleteProduct = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    connection = await pool.getConnection();

    // Get image path before deletion
    const [products] = await connection.execute(
      "SELECT image FROM products WHERE id = ?",
      [id]
    );

    await connection.execute("DELETE FROM products WHERE id = ?", [id]);

    // Delete image file
    if (products[0].image && fs.existsSync(products[0].image)) {
      fs.unlinkSync(products[0].image);
    }

    return res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("❌ Delete product error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

// Bulk update products
export const bulkUpdateProducts = async (req, res) => {
  let connection;
  try {
    const { product_ids, updates } = req.body;

    if (!product_ids || !Array.isArray(product_ids) || product_ids.length === 0) {
      return res.status(400).json({ message: "Product IDs array is required" });
    }

    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "Updates object is required" });
    }

    connection = await pool.getConnection();

    const updateFields = [];
    const params = [];

    if (updates.active !== undefined) {
      const activeValue = updates.active === true || updates.active === 'true' || updates.active === 1 || updates.active === '1' ? 1 : 0;
      updateFields.push("active = ?");
      params.push(activeValue);
    }
    if (updates.category_id !== undefined) {
      updateFields.push("category_id = ?");
      params.push(parseInt(updates.category_id));
    }

    if (updateFields.length === 0) {
      connection.release();
      return res.status(400).json({ message: "No valid fields to update" });
    }

    const placeholders = product_ids.map(() => '?').join(',');
    params.push(...product_ids);

    await connection.execute(
      `UPDATE products SET ${updateFields.join(", ")} WHERE id IN (${placeholders})`,
      params
    );

    connection.release();
    return res.status(200).json({
      message: `${product_ids.length} product(s) updated successfully`,
      updated_count: product_ids.length
    });
  } catch (error) {
    console.error("❌ Bulk update products error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

export const toggleProductAvailability = async (req, res) => {
  let connection;
  try {
    const productId = req.params.id;
    const { active } = req.body;

    connection = await pool.getConnection();

    await connection.execute(
      'UPDATE products SET active = ? WHERE id = ?',
      [active, productId]
    );

    res.json({
      success: true,
      message: `Product ${active ? 'activated' : 'deactivated'} successfully`
    });

  } catch (error) {
    console.error('Toggle availability error:', error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    if (connection) connection.release();
  }
};


// ==================== PROMO CODES MANAGEMENT ====================

// Get all promo codes with usage stats
export const getAllPromoCodes = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    const [promoCodes] = await connection.execute(
      `SELECT 
        pc.*,
        COUNT(opc.id) as actual_usage_count,
        COALESCE(SUM(opc.discount_amount), 0) as total_revenue_impact,
        COUNT(DISTINCT opc.order_id) as unique_orders_count
       FROM promo_codes pc
       LEFT JOIN order_promo_codes opc ON pc.id = opc.promo_code_id
       GROUP BY pc.id
       ORDER BY pc.created_at DESC`
    );

    // Get example orders for each promo code
    const promoCodesWithOrders = await Promise.all(
      promoCodes.map(async (code) => {
        const [orders] = await connection.execute(
          `SELECT o.id, o.order_number, o.final_price, o.created_at, c.name as customer_name
           FROM orders o
           INNER JOIN order_promo_codes opc ON o.id = opc.order_id
           INNER JOIN clients c ON o.user_id = c.id
           WHERE opc.promo_code_id = ?
           ORDER BY o.created_at DESC
           LIMIT 5`,
          [code.id]
        );
        return {
          ...code,
          example_orders: orders || [],
          actual_usage_count: parseInt(code.actual_usage_count || 0),
          total_revenue_impact: parseFloat(code.total_revenue_impact || 0),
          unique_orders_count: parseInt(code.unique_orders_count || 0),
        };
      })
    );

    connection.release();
    return res.status(200).json({ promoCodes: promoCodesWithOrders });
  } catch (error) {
    console.error("❌ Get all promo codes error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

// Get promo code details
export const getPromoCodeDetails = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    connection = await pool.getConnection();

    const [codes] = await connection.execute(
      `SELECT 
        pc.*,
        COUNT(opc.id) as actual_usage_count,
        COALESCE(SUM(opc.discount_amount), 0) as total_revenue_impact
       FROM promo_codes pc
       LEFT JOIN order_promo_codes opc ON pc.id = opc.promo_code_id
       WHERE pc.id = ?
       GROUP BY pc.id`,
      [id]
    );

    if (codes.length === 0) {
      connection.release();
      return res.status(404).json({ message: "Promo code not found" });
    }

    // Get all orders that used this code
    const [orders] = await connection.execute(
      `SELECT o.*, c.name as customer_name, opc.discount_amount
       FROM orders o
       INNER JOIN order_promo_codes opc ON o.id = opc.order_id
       INNER JOIN clients c ON o.user_id = c.id
       WHERE opc.promo_code_id = ?
       ORDER BY o.created_at DESC`,
      [id]
    );

    connection.release();
    return res.status(200).json({
      promoCode: {
        ...codes[0],
        actual_usage_count: parseInt(codes[0].actual_usage_count || 0),
        total_revenue_impact: parseFloat(codes[0].total_revenue_impact || 0),
      },
      orders: orders || [],
    });
  } catch (error) {
    console.error("❌ Get promo code details error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

// Create promo code
export const createPromoCode = async (req, res) => {
  let connection;
  try {
    const {
      code,
      title,
      description,
      discount_type,
      discount_value,
      min_order_amount,
      max_discount,
      valid_from,
      valid_until,
      usage_limit,
      is_active,
      badge,
      color,
    } = req.body;

    if (!code || !title || !discount_type || !discount_value || !valid_from || !valid_until) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Check for duplicate code
    const [existing] = await connection.execute(
      "SELECT id FROM promo_codes WHERE code = ?",
      [code.toUpperCase()]
    );

    if (existing.length > 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ message: "Promo code already exists" });
    }

    // Check for overlapping date ranges
    const [overlapping] = await connection.execute(
      `SELECT id, code FROM promo_codes 
       WHERE code = ? 
       AND (
         (valid_from <= ? AND valid_until >= ?) OR
         (valid_from <= ? AND valid_until >= ?) OR
         (valid_from >= ? AND valid_until <= ?)
       )`,
      [code.toUpperCase(), valid_from, valid_from, valid_until, valid_until, valid_from, valid_until]
    );

    if (overlapping.length > 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        message: `Overlapping date range with existing code: ${overlapping[0].code}`
      });
    }

    const [result] = await connection.execute(
      `INSERT INTO promo_codes 
       (code, title, description, discount_type, discount_value, min_order_amount, 
        max_discount, valid_from, valid_until, usage_limit, is_active, badge, color)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        code.toUpperCase(),
        title,
        description || null,
        discount_type,
        parseFloat(discount_value),
        min_order_amount ? parseFloat(min_order_amount) : 0,
        max_discount ? parseFloat(max_discount) : null,
        valid_from,
        valid_until,
        usage_limit ? parseInt(usage_limit) : null,
        is_active !== undefined ? (is_active === true || is_active === 'true' ? 1 : 0) : 1,
        badge || null,
        color || '#FF6B35',
      ]
    );

    const promoId = result.insertId;

    // ✅ SEND NOTIFICATION TO ALL CLIENTS ABOUT THE NEW PROMO CODE
    try {
      // Calculate availability in days
      const validFromDate = new Date(valid_from);
      const validUntilDate = new Date(valid_until);
      const timeDiff = validUntilDate.getTime() - validFromDate.getTime();
      const daysAvailable = Math.ceil(timeDiff / (1000 * 3600 * 24));

      // Create notification message with promo details
      const discountDisplay = discount_type === 'percentage'
        ? `${discount_value}% OFF`
        : `${discount_value} MAD OFF`;

      const availabilityMessage = daysAvailable > 1
        ? `Available for ${daysAvailable} days`
        : `Available today only`;

      const minOrderMessage = min_order_amount > 0
        ? `Min order: ${min_order_amount} MAD`
        : 'No minimum order';

      const notificationMessage = `${title} - ${discountDisplay}! ${availabilityMessage}. ${minOrderMessage}`;

      const notificationResult = await sendBulkNotificationClients({
        toUserType: "client",
        title: "🎉 New Promo Code Available!",
        message: notificationMessage,
        data: {
          type: "new_promo_code",
          promo_id: String(promoId),
          promo_title: title,
          promo_code: code.toUpperCase(),
          discount_value: String(discount_value),
          discount_type: discount_type,
          days_available: String(daysAvailable),
          valid_until: valid_until,
          min_order_amount: min_order_amount ? String(min_order_amount) : "0",
          screen: "promo_codes"
        },
        sendPush: true,
        sendWebSocket: true
      });

      console.log(`✅ Promo code notification sent to ${notificationResult.totalSent} clients`);

      await connection.commit();

      return res.status(201).json({
        message: "Promo code created successfully",
        id: promoId,
        notification_sent: true,
        notification_details: {
          total_sent: notificationResult.totalSent,
          message: notificationMessage
        }
      });

    } catch (notificationError) {
      console.error('⚠️ Failed to send notification (promo code still created):', notificationError.message);

      // Still commit the transaction even if notification fails
      await connection.commit();

      return res.status(201).json({
        message: "Promo code created successfully (notification failed)",
        id: promoId,
        notification_sent: false,
        warning: "Promo code was created but notification could not be sent"
      });
    }

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error("❌ Create promo code error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// Update promo code
export const updatePromoCode = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const {
      code,
      title,
      description,
      discount_type,
      discount_value,
      min_order_amount,
      max_discount,
      valid_from,
      valid_until,
      usage_limit,
      is_active,
      badge,
      color,
    } = req.body;

    connection = await pool.getConnection();

    // Check if promo code exists
    const [existing] = await connection.execute(
      "SELECT code FROM promo_codes WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      connection.release();
      return res.status(404).json({ message: "Promo code not found" });
    }

    // Check for duplicate code (if code is being changed)
    if (code && code.toUpperCase() !== existing[0].code) {
      const [duplicate] = await connection.execute(
        "SELECT id FROM promo_codes WHERE code = ? AND id != ?",
        [code.toUpperCase(), id]
      );

      if (duplicate.length > 0) {
        connection.release();
        return res.status(400).json({ message: "Promo code already exists" });
      }
    }

    const updateFields = [];
    const params = [];

    if (code) {
      updateFields.push("code = ?");
      params.push(code.toUpperCase());
    }
    if (title) {
      updateFields.push("title = ?");
      params.push(title);
    }
    if (description !== undefined) {
      updateFields.push("description = ?");
      params.push(description);
    }
    if (discount_type) {
      updateFields.push("discount_type = ?");
      params.push(discount_type);
    }
    if (discount_value !== undefined) {
      updateFields.push("discount_value = ?");
      params.push(parseFloat(discount_value));
    }
    if (min_order_amount !== undefined) {
      updateFields.push("min_order_amount = ?");
      params.push(parseFloat(min_order_amount));
    }
    if (max_discount !== undefined) {
      updateFields.push("max_discount = ?");
      params.push(max_discount ? parseFloat(max_discount) : null);
    }
    if (valid_from) {
      updateFields.push("valid_from = ?");
      params.push(valid_from);
    }
    if (valid_until) {
      updateFields.push("valid_until = ?");
      params.push(valid_until);
    }
    if (usage_limit !== undefined) {
      updateFields.push("usage_limit = ?");
      params.push(usage_limit ? parseInt(usage_limit) : null);
    }
    if (is_active !== undefined) {
      updateFields.push("is_active = ?");
      params.push(is_active === true || is_active === 'true' ? 1 : 0);
    }
    if (badge !== undefined) {
      updateFields.push("badge = ?");
      params.push(badge);
    }
    if (color) {
      updateFields.push("color = ?");
      params.push(color);
    }

    if (updateFields.length === 0) {
      connection.release();
      return res.status(400).json({ message: "No fields to update" });
    }

    params.push(id);

    await connection.execute(
      `UPDATE promo_codes SET ${updateFields.join(", ")} WHERE id = ?`,
      params
    );

    connection.release();
    return res.status(200).json({ message: "Promo code updated successfully" });
  } catch (error) {
    console.error("❌ Update promo code error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

// Delete promo code
export const deletePromoCode = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    connection = await pool.getConnection();

    // Check if code has been used
    const [usage] = await connection.execute(
      "SELECT COUNT(*) as count FROM order_promo_codes WHERE promo_code_id = ?",
      [id]
    );

    if (usage[0].count > 0) {
      connection.release();
      return res.status(400).json({
        message: "Cannot delete promo code that has been used. Deactivate it instead.",
      });
    }

    await connection.execute("DELETE FROM promo_codes WHERE id = ?", [id]);

    connection.release();
    return res.status(200).json({ message: "Promo code deleted successfully" });
  } catch (error) {
    console.error("❌ Delete promo code error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

// Bulk expire/revoke promo codes
export const bulkUpdatePromoCodes = async (req, res) => {
  let connection;
  try {
    const { promo_code_ids, action } = req.body;

    if (!promo_code_ids || !Array.isArray(promo_code_ids) || promo_code_ids.length === 0) {
      return res.status(400).json({ message: "Promo code IDs array is required" });
    }

    if (!action || !['expire', 'revoke', 'activate', 'deactivate'].includes(action)) {
      return res.status(400).json({ message: "Invalid action" });
    }

    connection = await pool.getConnection();

    let updateQuery = "";
    const params = [];

    if (action === 'expire') {
      updateQuery = "UPDATE promo_codes SET valid_until = NOW(), is_active = 0 WHERE id IN (";
    } else if (action === 'revoke') {
      updateQuery = "UPDATE promo_codes SET is_active = 0 WHERE id IN (";
    } else if (action === 'activate') {
      updateQuery = "UPDATE promo_codes SET is_active = 1 WHERE id IN (";
    } else if (action === 'deactivate') {
      updateQuery = "UPDATE promo_codes SET is_active = 0 WHERE id IN (";
    }

    const placeholders = promo_code_ids.map(() => '?').join(',');
    params.push(...promo_code_ids);

    await connection.execute(updateQuery + placeholders + ")", params);

    connection.release();
    return res.status(200).json({
      message: `${promo_code_ids.length} promo code(s) ${action}d successfully`,
      updated_count: promo_code_ids.length,
    });
  } catch (error) {
    console.error("❌ Bulk update promo codes error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

// Recalculate usage counts from order_promo_codes
export const recalculatePromoUsage = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    await connection.execute(
      `UPDATE promo_codes pc
       SET used_count = (
         SELECT COUNT(*) 
         FROM order_promo_codes opc 
         WHERE opc.promo_code_id = pc.id
       )`
    );

    connection.release();
    return res.status(200).json({ message: "Usage counts recalculated successfully" });
  } catch (error) {
    console.error("❌ Recalculate promo usage error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

// ==================== RESTAURANT SETTINGS ====================

// Helper function to geocode address
const geocodeAddress = async (address) => {
  try {
    const encodedAddress = encodeURIComponent(address);
    const response = await axios.get(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`,
      {
        headers: {
          'User-Agent': 'DeliveryApp/1.0'
        }
      }
    );

    if (response.data && response.data.length > 0) {
      return {
        lat: parseFloat(response.data[0].lat),
        lon: parseFloat(response.data[0].lon)
      };
    }
    return null;
  } catch (error) {
    console.error("Geocoding error:", error.message);
    return null;
  }
};

// Get restaurant settings
export const getRestaurantSettings = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    // 1. Fetch admin details and join with their specific restaurant
    // Selecting only the requested columns: name, email (admin) and name, address, phone, email, is_open (restaurant)
    const query = `
      SELECT 
        a.name AS admin_name, 
        a.email AS admin_email,
        r.id AS restaurant_id,
        r.name AS restaurant_name,
        r.address AS restaurant_address,
        r.phone AS restaurant_phone,
        r.email AS restaurant_email,
        r.is_open
      FROM admins a
      JOIN restaurants r ON a.restaurant_id = r.id
      WHERE a.id = ?
    `;

    const [rows] = await connection.execute(query, [req.adminId]);

    // 2. Check if the admin/restaurant exists
    if (rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Admin or associated restaurant not found" 
      });
    }

    const data = rows[0];

    // 3. Return the combined data
    return res.status(200).json({
      success: true,
      admin: {
        name: data.admin_name,
        email: data.admin_email
      },
      restaurant: {
        id: data.restaurant_id,
        name: data.restaurant_name,
        address: data.restaurant_address,
        phone: data.restaurant_phone,
        email: data.restaurant_email,
        is_open: Boolean(data.is_open)
      }
    });

  } catch (error) {
    console.error("❌ Error fetching restaurant profile:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

// Update restaurant settings
export const updateRestaurantSettings = async (req, res) => {
  let connection;
  try {
    const {
      restaurant_name,
      restaurant_address,
      phone,
      restaurant_email,
      restaurant_latitude,
      restaurant_longitude,
      base_delivery_fee,
      per_km_fee,
      max_delivery_distance_km,
      min_delivery_fee,
      max_delivery_fee,
      is_open,
      restaurant_logo,
      restaurant_home_screen_icon,
    } = req.body;

    connection = await pool.getConnection();

    // If address is provided but not coordinates, geocode it
    let lat = restaurant_latitude ? parseFloat(restaurant_latitude) : null;
    let lon = restaurant_longitude ? parseFloat(restaurant_longitude) : null;

    if (restaurant_address && (!lat || !lon)) {
      const coordinates = await geocodeAddress(restaurant_address);
      if (coordinates) {
        lat = coordinates.lat;
        lon = coordinates.lon;
      }
    }

    // Build update query
    const updates = [];
    const values = [];

    if (restaurant_name !== undefined) {
      updates.push("restaurant_name = ?");
      values.push(restaurant_name);
    }
    if (phone !== undefined) {
      updates.push("phone = ?");
      values.push(phone);
    }
    if (restaurant_address !== undefined) {
      updates.push("restaurant_address = ?");
      values.push(restaurant_address);
    }
    if (lat !== null) {
      updates.push("restaurant_latitude = ?");
      values.push(lat);
    }
    if (lon !== null) {
      updates.push("restaurant_longitude = ?");
      values.push(lon);
    }
    if (base_delivery_fee !== undefined) {
      updates.push("base_delivery_fee = ?");
      values.push(parseFloat(base_delivery_fee));
    }
    if (per_km_fee !== undefined) {
      updates.push("per_km_fee = ?");
      values.push(parseFloat(per_km_fee));
    }
    if (max_delivery_distance_km !== undefined) {
      updates.push("max_delivery_distance_km = ?");
      values.push(parseFloat(max_delivery_distance_km));
    }
    if (min_delivery_fee !== undefined) {
      updates.push("min_delivery_fee = ?");
      values.push(parseFloat(min_delivery_fee));
    }
    if (max_delivery_fee !== undefined) {
      updates.push("max_delivery_fee = ?");
      values.push(parseFloat(max_delivery_fee));
    }
    if (is_open !== undefined) {
      updates.push("is_open = ?");
      values.push(is_open === true || is_open === 'true' ? 1 : 0);
    }
    if (restaurant_email !== undefined) {
      updates.push("restaurant_email = ?");
      values.push(restaurant_email);
    }
    if (restaurant_logo !== undefined) {
      updates.push("restaurant_logo = ?");
      values.push(restaurant_logo);
    }
    if (restaurant_home_screen_icon !== undefined) {
      updates.push("restaurant_home_screen_icon = ?");
      values.push(restaurant_home_screen_icon);
    }

    if (updates.length === 0) {
      connection.release();
      return res.status(400).json({ message: "No fields to update" });
    }

    // Check if settings exist
    const [existing] = await connection.execute(
      `SELECT id FROM restaurant_settings LIMIT 1`
    );

    if (existing.length === 0) {
      // Insert new settings
      await connection.execute(
        `INSERT INTO restaurant_settings (
          restaurant_name,
          phone,
          restaurant_address,
          restaurant_latitude,
          restaurant_longitude,
          base_delivery_fee,
          per_km_fee,
          max_delivery_distance_km,
          min_delivery_fee,
          max_delivery_fee,
          is_open,
          restaurant_email,
          restaurant_logo,
          restaurant_home_screen_icon
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          restaurant_name || 'Restaurant',
          phone || '',
          restaurant_address || '',
          lat || 33.5731,
          lon || -7.5898,
          parseFloat(base_delivery_fee) || 10.00,
          parseFloat(per_km_fee) || 2.00,
          parseFloat(max_delivery_distance_km) || 20.00,
          parseFloat(min_delivery_fee) || 5.00,
          parseFloat(max_delivery_fee) || 50.00,
          is_open === true || is_open === 'true' ? 1 : 0,
          restaurant_email || '',
          restaurant_logo || '',
          restaurant_home_screen_icon || '',
        ]
      );
    } else {
      // Update existing settings
      const sql = `UPDATE restaurant_settings SET ${updates.join(", ")} WHERE id = ?`;
      values.push(existing[0].id);
      await connection.execute(sql, values);
    }

    // Fetch updated settings
    const [updated] = await connection.execute(
      `SELECT 
        id,
        restaurant_name,
        phone,
        restaurant_email,
        restaurant_address,
        restaurant_latitude,
        restaurant_longitude,
        base_delivery_fee,
        per_km_fee,
        max_delivery_distance_km,
        min_delivery_fee,
        max_delivery_fee,
        is_open,
        restaurant_logo,
        restaurant_home_screen_icon,
        updated_at
      FROM restaurant_settings 
      LIMIT 1`
    );

    connection.release();
    res.json({
      success: true,
      message: "Restaurant settings updated successfully",
      settings: {
        ...updated[0],
        restaurant_latitude: parseFloat(updated[0].restaurant_latitude),
        restaurant_longitude: parseFloat(updated[0].restaurant_longitude),
        base_delivery_fee: parseFloat(updated[0].base_delivery_fee),
        per_km_fee: parseFloat(updated[0].per_km_fee),
        max_delivery_distance_km: parseFloat(updated[0].max_delivery_distance_km),
        min_delivery_fee: parseFloat(updated[0].min_delivery_fee),
        max_delivery_fee: parseFloat(updated[0].max_delivery_fee),
        is_open: Boolean(updated[0].is_open),
      }
    });
  } catch (error) {
    console.error("Error updating restaurant settings:", error);
    if (connection) connection.release();
    res.status(500).json({ message: "Server error" });
  }
};

// Test email configuration
export const testEmailConfiguration = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email address is required" });
    }

    // Import the test function locally to avoid circular dependency
    const { testEmailConfiguration: testEmailFunc } = await import("../utils/emailService.js");
    const result = await testEmailFunc(email);

    if (result.success) {
      res.json({ message: "Test email sent successfully" });
    } else {
      res.status(500).json({ message: result.message });
    }
  } catch (error) {
    console.error("Error testing email configuration:", error);
    res.status(500).json({ message: "Failed to send test email" });
  }
};

// Upload restaurant logo
export const uploadRestaurantLogoHandler = async (req, res) => {
  let connection;
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No logo file uploaded" });
    }

    const logoPath = req.file.path;
    connection = await pool.getConnection();

    // Update restaurant settings with new logo
    await connection.execute(
      `UPDATE restaurant_settings SET restaurant_logo = ? WHERE id = (SELECT id FROM (SELECT id FROM restaurant_settings LIMIT 1) AS temp)`,
      [logoPath]
    );

    connection.release();
    res.json({
      success: true,
      message: "Restaurant logo uploaded successfully",
      logo_path: logoPath
    });
  } catch (error) {
    console.error("Error uploading restaurant logo:", error);
    if (connection) connection.release();

    // Delete uploaded file if error occurred
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({ message: "Server error" });
  }
};

// Upload restaurant home screen icon
export const uploadRestaurantIconHandler = async (req, res) => {
  let connection;
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No icon file uploaded" });
    }

    const iconPath = req.file.path;
    connection = await pool.getConnection();

    // Update restaurant settings with new icon
    await connection.execute(
      `UPDATE restaurant_settings SET restaurant_home_screen_icon = ? WHERE id = (SELECT id FROM (SELECT id FROM restaurant_settings LIMIT 1) AS temp)`,
      [iconPath]
    );

    connection.release();
    res.json({
      success: true,
      message: "Restaurant home screen icon uploaded successfully",
      icon_path: iconPath
    });
  } catch (error) {
    console.error("Error uploading restaurant icon:", error);
    if (connection) connection.release();

    // Delete uploaded file if error occurred
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({ message: "Server error" });
  }
};

export const uploadRestaurantLogoWithSharp = (req, res, next) => {
  const multerMiddleware = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadPath = 'uploads/restaurantLogo';
        if (!fs.existsSync(uploadPath)) {
          fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `restaurant_logo_${uniqueSuffix}${ext}`);
      }
    }),
    fileFilter: (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|gif|webp/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);

      if (mimetype && extname) {
        cb(null, true);
      } else {
        cb(new Error('Only image files (jpeg, jpg, png, gif, webp) are allowed!'));
      }
    },
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
  }).single("logo");

  multerMiddleware(req, res, async (err) => {
    if (err) {
      // Handle multer errors
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          message: 'Logo file size too large. Maximum size is 5MB.'
        });
      }
      return res.status(400).json({ message: err.message });
    }

    // If a file was uploaded, process it with Sharp
    if (req.file) {
      try {
        // Process logo with Sharp - logos usually need transparent background
        const processedFile = await processImageWithSharp(req.file, {
          width: 512,
          height: 512,
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }, // Transparent background
          quality: 90,
          format: 'png', // PNG for logos to preserve transparency
          outputDir: 'uploads/restaurantLogo'
        });

        // Check if processedFile is the original file (error case)
        if (processedFile && processedFile.path !== req.file.path) {
          // Update file info with processed version
          req.file = {
            ...req.file,
            path: processedFile.path,
            filename: processedFile.filename,
            mimetype: processedFile.mimetype,
            size: processedFile.size,
            originalname: processedFile.originalname || req.file.originalname,
            destination: processedFile.destination || req.file.destination
          };
          console.log(`✅ Restaurant logo processed: ${processedFile.filename} (${Math.round(processedFile.size / 1024)}KB)`);
        } else {
          // Sharp processing failed, keep original file
          console.warn('⚠️ Sharp processing failed for restaurant logo, keeping original file:', req.file.filename);
        }

      } catch (sharpError) {
        console.error('❌ Restaurant logo Sharp processing error:', sharpError.message);
        // Keep original file if Sharp fails - don't break the request
        console.log('Keeping original restaurant logo due to Sharp error');
      }
    }

    next();
  });
};

// Multer configuration for restaurant icon
export const uploadRestaurantIconWithSharp = (req, res, next) => {
  const multerMiddleware = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadPath = 'uploads/restaurantIcon';
        if (!fs.existsSync(uploadPath)) {
          fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `restaurant_icon_${uniqueSuffix}${ext}`);
      }
    }),
    fileFilter: (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|gif|webp|ico/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype) || file.mimetype === 'image/x-icon';

      if (mimetype && extname) {
        cb(null, true);
      } else {
        cb(new Error('Only image files (jpeg, jpg, png, gif, webp, ico) are allowed!'));
      }
    },
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
  }).single("icon");

  multerMiddleware(req, res, async (err) => {
    if (err) {
      // Handle multer errors
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          message: 'Icon file size too large. Maximum size is 5MB.'
        });
      }
      return res.status(400).json({ message: err.message });
    }

    // If a file was uploaded, process it
    if (req.file) {
      // Check if it's an .ico file
      const isIcoFile = req.file.mimetype === 'image/x-icon' ||
        path.extname(req.file.originalname).toLowerCase() === '.ico' ||
        path.extname(req.file.originalname).toLowerCase() === '.icon';

      if (!isIcoFile) {
        // Process non-.ico files with Sharp
        try {
          const processedFile = await processImageWithSharp(req.file, {
            width: 192,
            height: 192,
            fit: 'contain',
            background: { r: 255, g: 255, b: 255, alpha: 0 }, // Transparent background
            quality: 90,
            format: 'png', // PNG for icons to preserve transparency
            outputDir: 'uploads/restaurantIcon'
          });

          // Check if processedFile is the original file (error case)
          if (processedFile && processedFile.path !== req.file.path) {
            // Update file info with processed version
            req.file = {
              ...req.file,
              path: processedFile.path,
              filename: processedFile.filename,
              mimetype: processedFile.mimetype,
              size: processedFile.size,
              originalname: processedFile.originalname || req.file.originalname,
              destination: processedFile.destination || req.file.destination
            };
            console.log(`✅ Restaurant icon processed: ${processedFile.filename} (${Math.round(processedFile.size / 1024)}KB)`);
          } else {
            // Sharp processing failed, keep original file
            console.warn('⚠️ Sharp processing failed for restaurant icon, keeping original file:', req.file.filename);
          }

        } catch (sharpError) {
          console.error('❌ Restaurant icon Sharp processing error:', sharpError.message);
          console.log('Keeping original restaurant icon due to Sharp error');
        }
      } else {
        // For .ico files, just use as-is (Sharp doesn't support .ico)
        console.log('📁 .ico/.icon file detected for restaurant icon, skipping Sharp processing');
      }
    }

    next();
  });
};

// create offer
export const uploadOfferImageWithSharp = (req, res, next) => {
  const multerMiddleware = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadPath = 'uploads/offersImages';
        if (!fs.existsSync(uploadPath)) {
          fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `offer_${uniqueSuffix}${ext}`);
      }
    }),
    fileFilter: (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|gif|webp/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);

      if (mimetype && extname) {
        cb(null, true);
      } else {
        cb(new Error('Only image files (jpeg, jpg, png, gif, webp) are allowed!'));
      }
    },
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
  }).single("image");

  multerMiddleware(req, res, async (err) => {
    if (err) {
      // Handle multer errors
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          message: 'File size too large. Maximum size is 5MB.'
        });
      }
      return res.status(400).json({ message: err.message });
    }

    // If a file was uploaded, process it with Sharp
    if (req.file) {
      try {
        // Process image with Sharp
        const processedFile = await processImageWithSharp(req.file, {
          width: 800,
          height: 600,
          fit: 'cover',
          quality: 80,
          format: 'webp',
          outputDir: 'uploads/offersImages'
        });

        // Check if processedFile is the original file (error case)
        if (processedFile && processedFile.path !== req.file.path) {
          // Update file info with processed version
          req.file = {
            ...req.file,
            path: processedFile.path,
            filename: processedFile.filename,
            mimetype: processedFile.mimetype,
            size: processedFile.size,
            originalname: processedFile.originalname || req.file.originalname,
            destination: processedFile.destination || req.file.destination
          };
          console.log(`✅ Offer image processed: ${processedFile.filename} (${Math.round(processedFile.size / 1024)}KB)`);
        } else {
          // Sharp processing failed, keep original file
          console.warn('⚠️ Sharp processing failed for offer image, keeping original file:', req.file.filename);
        }

      } catch (sharpError) {
        console.error('❌ Offer image Sharp processing error:', sharpError.message);
        // Keep original file if Sharp fails - don't break the request
        console.log('Keeping original offer file due to Sharp error');
      }
    }

    next();
  });
};

export const createOffer = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    console.log('backend is here');

    // Extract form data
    if (!req.body || Object.keys(req.body).length === 0) {
      throw new Error('Request body is empty or undefined');
    }

    console.log('Request body received:', req.body);
    console.log('Uploaded file:', req.file);

    // Access form fields
    const name = req.body.name;
    const discount_type = req.body.discount_type;
    const discount = req.body.discount;
    const description = req.body.description;
    const start_at = req.body.start_at;
    const end_at = req.body.end_at;
    const is_active = req.body.is_active;
    const offer_products = req.body.offer_products;

    console.log('Parsed fields:', {
      name, discount_type, discount, description, start_at, end_at, is_active
    });

    // Validate required fields
    if (!name || !discount_type || discount_type === '' || !discount) {
      return res.status(400).json({
        success: false,
        message: `Missing required field: ${!name ? 'name' : (!discount_type || discount_type === '') ? 'discount_type' : 'discount'}`
      });
    }
    if (!start_at) {
      console.log('Missing start_at');
      throw new Error('Missing required field: start_at');
    }
    if (!end_at) {
      console.log('Missing end_at');
      throw new Error('Missing required field: end_at');
    }

    // Parse offer_products
    let parsedOfferProducts = [];
    if (offer_products) {
      try {
        parsedOfferProducts = typeof offer_products === 'string'
          ? JSON.parse(offer_products)
          : offer_products;
        console.log('Parsed offer products:', parsedOfferProducts);
      } catch (parseError) {
        console.error('Error parsing offer_products:', parseError);
        console.log('Raw offer_products value:', offer_products);
        throw new Error('Invalid offer_products format');
      }
    }

    // Get image path
    const imagePath = req.file ? req.file.path : '';

    // Insert the main offer
    const [offerResult] = await connection.query(`
      INSERT INTO offers (
        name, discount_type, discount, image, description, 
        start_at, end_at, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [name, discount_type, discount, imagePath, description, start_at, end_at, is_active]);

    const offerId = offerResult.insertId;
    console.log('Offer created with ID:', offerId);

    // Insert offer products if any
    if (parsedOfferProducts && parsedOfferProducts.length > 0) {
      const productValues = parsedOfferProducts.map(product => [
        offerId,
        product.id,
        product.limited_use,
        0 // times_used starts at 0
      ]);

      console.log('Inserting offer products:', productValues);

      await connection.query(`
        INSERT INTO offer_products (offer_id, product_id, limited_use, times_used)
        VALUES ?
      `, [productValues]);

      console.log('Offer products inserted successfully');
    }

    // ✅ SEND NOTIFICATION TO ALL CLIENTS ABOUT THE NEW OFFER
    try {
      const notificationResult = await sendBulkNotificationClients({
        toUserType: "client",
        title: "🎉 New Offer Available!",
        message: `${name} - ${discount}${discount_type === 'percentage' ? '%' : 'MAD'} off! ${description ? description.substring(0, 50) + '...' : 'Check it out now!'}`,
        data: {
          type: "new_offer",
          offer_id: String(offerId),
          offer_name: name,
          discount: String(discount),
          discount_type: discount_type,
          screen: "offers"
        },
        sendPush: true,
        sendWebSocket: true
      });

      console.log(`✅ Notification sent to ${notificationResult.totalSent} clients`);
    } catch (notificationError) {
      console.error('⚠️ Failed to send notification (offer still created):', notificationError.message);
    }

    await connection.commit(); // Only commit once here

    // Send response
    res.status(201).json({
      success: true,
      offer: {
        id: offerId,
        name,
        discount_type,
        discount: parseFloat(discount),
        image: imagePath,
        description,
        start_at,
        end_at,
        is_active: Boolean(is_active),
        offer_products: parsedOfferProducts || []
      },
      notification_sent: true
    });

  } catch (error) {
    await connection.rollback();

    // Delete uploaded file if transaction failed
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
      console.log('Deleted uploaded file due to error:', req.file.path);
    }

    console.error('Error creating offer:', error);
    res.status(500).json({
      success: false,
      message: `Failed to create offer: ${error.message}`
    });
  } finally {
    connection.release();
  }
};

// Update an existing offer
export const updateOffer = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const { id } = req.params;
    const {
      name,
      discount_type,
      discount,
      description,
      start_at,
      end_at,
      is_active,
      products
    } = req.body;

    // Check if offer exists
    const [existingOffer] = await connection.execute(
      'SELECT * FROM offers WHERE id = ?',
      [id]
    );

    if (existingOffer.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ message: "Offer not found" });
    }

    // Get image path from uploaded file or keep existing
    const imagePath = req.file ? req.file.path : existingOffer[0].image;

    // Update offer
    await connection.execute(
      `UPDATE offers SET 
        name = ?, 
        discount_type = ?, 
        discount = ?, 
        image = ?, 
        description = ?, 
        start_at = ?, 
        end_at = ?, 
        is_active = ?, 
        updated_at = NOW()
       WHERE id = ?`,
      [name, discount_type, discount, imagePath, description, start_at, end_at, is_active, id]
    );

    // Update offer products if provided
    if (products) {
      // Remove existing products
      await connection.execute(
        'DELETE FROM offer_products WHERE offer_id = ?',
        [id]
      );

      // Add new products if any
      if (products.length > 0) {
        const productValues = products.map(product => [
          id,
          product.id,
          product.limited_use || null,
          0 // times_used starts at 0
        ]);

        await connection.execute(
          `INSERT INTO offer_products (offer_id, product_id, limited_use, times_used)
           VALUES ?`,
          [productValues]
        );
      }
    }

    await connection.commit();
    connection.release();

    return res.status(200).json({
      message: "Offer updated successfully",
      offer: {
        id,
        name,
        discount_type,
        discount,
        image: imagePath,
        description,
        start_at,
        end_at,
        is_active,
        products: products || []
      }
    });

  } catch (error) {
    await connection.rollback();
    console.error("❌ Update offer error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

// Delete an offer
export const deleteOffer = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const { id } = req.params;

    // Check if offer exists
    const [existingOffer] = await connection.execute(
      'SELECT * FROM offers WHERE id = ?',
      [id]
    );

    if (existingOffer.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ message: "Offer not found" });
    }

    // Delete offer products
    await connection.execute(
      'DELETE FROM offer_products WHERE offer_id = ?',
      [id]
    );

    // Delete offer usage records
    await connection.execute(
      'DELETE FROM offer_usages WHERE offer_id = ?',
      [id]
    );

    // Delete offer image if exists
    if (existingOffer[0].image && fs.existsSync(existingOffer[0].image)) {
      fs.unlinkSync(existingOffer[0].image);
    }

    // Delete offer
    await connection.execute(
      'DELETE FROM offers WHERE id = ?',
      [id]
    );

    await connection.commit();
    connection.release();

    return res.status(200).json({
      message: "Offer deleted successfully"
    });

  } catch (error) {
    await connection.rollback();
    console.error("❌ Delete offer error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};


// ==================== NOTIFICATIONS To All Clients ====================
export const sendToAllClients = async (req, res) => {
  try {
    const { title, message } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Title and message are required'
      });
    }

    // Get all active clients
    const [clients] = await executeQuery("SELECT id FROM clients");
    const clientIds = clients.map(client => client.id);

    if (clientIds.length === 0) {
      return res.json({
        success: false,
        message: 'No clients found'
      });
    }

    console.log(`📢 Sending to ${clientIds.length} clients: ${title}`);

    const results = [];

    for (const clientId of clientIds) {
      const result = await sendNotification({
        toUserType: "client",
        toUserId: clientId,
        title,
        message,
        data: { type: "admin_notification" },
        sendPush: true,
        sendWebSocket: true
      });

      results.push({
        clientId,
        success: result.success
      });
    }

    const successful = results.filter(r => r.success).length;

    console.log(`✅ Sent to ${successful}/${clientIds.length} clients`);

    return res.json({
      success: true,
      message: `Sent to ${successful} clients`,
      sent: successful,
      total: clientIds.length,
      results
    });

  } catch (error) {
    console.error('❌ Error sending to all clients:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send notifications',
      error: error.message
    });
  }
};


export const sendToAllDeliveryMen = async (req, res) => {
  try {
    const { title, message } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Title and message are required'
      });
    }

    // Get all active delivery men
    const [deliveryMen] = await executeQuery("SELECT id FROM delivery_men WHERE is_active = 1");
    const deliveryManIds = deliveryMen.map(dm => dm.id);

    if (deliveryManIds.length === 0) {
      return res.json({
        success: false,
        message: 'No active delivery men found'
      });
    }

    console.log(`📢 Sending to ${deliveryManIds.length} delivery men: ${title}`);

    const results = [];

    for (const deliveryManId of deliveryManIds) {
      const result = await sendNotification({
        toUserType: "delivery_man",
        toUserId: deliveryManId,
        title,
        message,
        data: { type: "admin_notification" },
        sendPush: true,
        sendWebSocket: true
      });

      results.push({
        deliveryManId,
        success: result.success
      });
    }

    const successful = results.filter(r => r.success).length;

    console.log(`✅ Sent to ${successful}/${deliveryManIds.length} delivery men`);

    return res.json({
      success: true,
      message: `Sent to ${successful} delivery men`,
      sent: successful,
      total: deliveryManIds.length,
      results
    });

  } catch (error) {
    console.error('❌ Error sending to all delivery men:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send notifications',
      error: error.message
    });
  }
};

// ==================== RESTAURANT OPERATING HOURS ====================


// 1. Get all operating hours for a SPECIFIC restaurant
export const getOperatingHours = async (req, res) => {
  let connection;
  try {
    // 1. Get admin ID from token
    const adminId = req.adminId;
    if (!adminId) {
      return res.status(401).json({ message: 'Unauthorized: Admin not authenticated' });
    }

    connection = await pool.getConnection();

    // 2. Fetch restaurant_id from admins table
    const [adminRows] = await connection.execute(
      'SELECT restaurant_id FROM admins WHERE id = ?',
      [adminId]
    );

    if (adminRows.length === 0) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    const restaurant_id = adminRows[0].restaurant_id;
    if (!restaurant_id) {
      return res.status(404).json({ message: 'No restaurant associated with this admin' });
    }

    // 3. Get the current master status from the 'restaurants' table
    const [[restaurant]] = await connection.execute(
      'SELECT is_open FROM restaurants WHERE id = ?',
      [restaurant_id]
    );

    // 4. Get the 7-day schedule for this restaurant
    const [hours] = await connection.execute(`
      SELECT 
        id, day_of_week, is_closed,
        TIME_FORMAT(open_time, '%H:%i') as open_time,
        TIME_FORMAT(close_time, '%H:%i') as close_time
      FROM restaurant_operating_hours
      WHERE restaurant_id = ?
      ORDER BY day_of_week
    `, [restaurant_id]);

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const formattedHours = hours.map(h => ({
      ...h,
      day_name: dayNames[h.day_of_week],
      is_closed: Boolean(h.is_closed)
    }));

    // Return both the schedule and the live master status
    res.json({
      success: true,
      is_open: Boolean(restaurant?.is_open), // This reflects manual toggle + schedule updates
      operatingHours: formattedHours
    });

  } catch (error) {
    console.error('Error fetching operating hours:', error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    if (connection) connection.release();
  }
};

// 2. Update operating hours for a specific day
export const updateOperatingHours = async (req, res) => {
  let connection;

  try {
    // 1. Get admin ID from the token (set by verifyAdminToken middleware)
    const adminId = req.adminId; // or req.admin.id, based on your middleware
    if (!adminId) {
      return res.status(401).json({ message: 'Unauthorized: Admin not authenticated' });
    }

    connection = await pool.getConnection();

    // 2. Fetch the restaurant_id associated with this admin from admins table
    const [adminRows] = await connection.execute(
      'SELECT restaurant_id FROM admins WHERE id = ?',
      [adminId]
    );

    if (adminRows.length === 0) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    const restaurant_id = adminRows[0].restaurant_id;
    if (!restaurant_id) {
      return res.status(404).json({ message: 'No restaurant associated with this admin' });
    }

    // 3. Get the rest of the request body
    const { day_of_week, is_closed, open_time, close_time } = req.body;

    if (!day_of_week) {
      return res.status(400).json({ message: 'day_of_week is required' });
    }

    // 4. Build dynamic update query
    const updates = [];
    const values = [];

    if (is_closed !== undefined) {
      updates.push('is_closed = ?');
      values.push(is_closed ? 1 : 0);
    }
    if (open_time) {
      updates.push('open_time = ?');
      values.push(open_time);
    }
    if (close_time) {
      updates.push('close_time = ?');
      values.push(close_time);
    }

    if (updates.length > 0) {
      values.push(restaurant_id, day_of_week);
      await connection.execute(
        `UPDATE restaurant_operating_hours 
         SET ${updates.join(', ')} 
         WHERE restaurant_id = ? AND day_of_week = ?`,
        values
      );
    }

    // 5. Refresh the restaurant's overall is_open status
    await checkAndUpdateIsOpen(connection, restaurant_id);

    res.json({ success: true, message: 'Updated successfully' });
  } catch (error) {
    console.error('Error updating operating hours:', error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    if (connection) connection.release();
  }
};

// 3. Bulk update
export const bulkUpdateOperatingHours = async (req, res) => {
  let connection;
  try {
    const { restaurant_id, hours } = req.body;
    if (!restaurant_id || !Array.isArray(hours)) {
      return res.status(400).json({ message: 'restaurant_id and hours array required' });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const values = hours.map(h => [
      restaurant_id, 
      h.day_of_week, 
      h.is_closed ? 1 : 0, 
      h.open_time || '09:00', 
      h.close_time || '22:00'
    ]);

    if (values.length > 0) {
      await connection.query(`
        INSERT INTO restaurant_operating_hours 
          (restaurant_id, day_of_week, is_closed, open_time, close_time)
        VALUES ? 
        ON DUPLICATE KEY UPDATE
          is_closed = VALUES(is_closed),
          open_time = VALUES(open_time),
          close_time = VALUES(close_time)
      `, [values]); 
    }

    // ✅ FIXED: Helper now updates 'restaurants' table
    await checkAndUpdateIsOpen(connection, restaurant_id);
    await connection.commit();
    
    res.json({ success: true, message: 'Bulk update successful' });
  } catch (error) {
    if (connection) await connection.rollback();
    res.status(500).json({ message: 'Server error' });
  } finally {
    if (connection) connection.release();
  }
};

// 4. HELPER: Updated to target the 'restaurants' table
export const checkAndUpdateIsOpen = async (existingConnection = null, restaurant_id) => {
  if (!restaurant_id) return null;
  let connection = existingConnection;
  let shouldRelease = false;

  try {
    if (!connection) {
      connection = await pool.getConnection();
      shouldRelease = true;
    }

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

    let shouldBeOpen = false;

    const getShiftDate = (refDate, timeStr, dayOffset = 0) => {
      const d = new Date(refDate);
      d.setDate(d.getDate() + dayOffset);
      const [h, m] = timeStr.split(':');
      d.setHours(parseInt(h), parseInt(m), 0, 0);
      return d;
    };

    if (todayHours && !todayHours.is_closed) {
      const openToday = getShiftDate(moroccoTime, todayHours.open_time);
      let closeToday = getShiftDate(moroccoTime, todayHours.close_time);
      if (closeToday <= openToday) closeToday.setDate(closeToday.getDate() + 1);
      if (moroccoTime >= openToday && moroccoTime < closeToday) shouldBeOpen = true;
    }

    if (!shouldBeOpen && yesterdayHours && !yesterdayHours.is_closed) {
      const openYesterday = getShiftDate(moroccoTime, yesterdayHours.open_time, -1);
      let closeYesterday = getShiftDate(moroccoTime, yesterdayHours.close_time, -1);
      if (closeYesterday <= openYesterday) {
        closeYesterday.setDate(closeYesterday.getDate() + 1);
        if (moroccoTime >= openYesterday && moroccoTime < closeYesterday) shouldBeOpen = true;
      }
    }

    // ✅ FIXED: Targets 'restaurants' table now
    await connection.execute(
      `UPDATE restaurants SET is_open = ? WHERE id = ?`,
      [shouldBeOpen ? 1 : 0, restaurant_id]
    );

    return shouldBeOpen;
  } catch (error) {
    console.error('Error in checkAndUpdateIsOpen:', error);
    return null;
  } finally {
    if (shouldRelease && connection) connection.release();
  }
};

// 5. Get Status for a specific restaurant
export const getOpenStatus = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    // Get restaurant_id from admin
    const [adminRows] = await connection.execute(
      'SELECT restaurant_id FROM admins WHERE id = ?',
      [req.adminId]
    );

    if (adminRows.length === 0) {
      return res.status(404).json({ message: 'Admin or associated restaurant not found' });
    }

    const restaurantId = adminRows[0].restaurant_id;

    // Just read the current value - no updates!
    const [[restaurant]] = await connection.execute(
      'SELECT is_open FROM restaurants WHERE id = ?',
      [restaurantId]
    );

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const now = new Date();
    const currentDay = now.getDay();

    let nextOpenTime = null;
    
    if (!restaurant?.is_open) {
      for (let i = 0; i <= 7; i++) {
        const checkDay = (currentDay + i) % 7;
        const [next] = await connection.execute(`
          SELECT TIME_FORMAT(open_time, '%H:%i') as open_time
          FROM restaurant_operating_hours
          WHERE restaurant_id = ? AND day_of_week = ? AND is_closed = 0
          LIMIT 1
        `, [restaurantId, checkDay]);

        if (next.length > 0) {
          nextOpenTime = { 
            day_name: dayNames[checkDay], 
            time: next[0].open_time, 
            is_today: i === 0 
          };
          break;
        }
      }
    }

    return res.json({ 
      success: true, 
      is_open: Boolean(restaurant?.is_open),
      next_open: nextOpenTime 
    });

  } catch (error) {
    console.error("❌ Get open status error:", error.message);
    return res.status(500).json({ message: 'Server error' });
  } finally {
    if (connection) connection.release();
  }
};

const getNextOpeningTime = async (connection, restaurant_id) => {
  try {
    // Get current time in restaurant's timezone (Morocco)
    const now = new Date();
    const moroccoTimeStr = now.toLocaleString("en-US", { timeZone: "Africa/Casablanca" });
    const nowMorocco = new Date(moroccoTimeStr);

    const currentDay = nowMorocco.getDay();
    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

    // Look ahead up to 7 days (including today)
    for (let i = 0; i <= 7; i++) {
      const checkDay = (currentDay + i) % 7;
      const [rows] = await connection.execute(`
        SELECT open_time, is_closed
        FROM restaurant_operating_hours
        WHERE restaurant_id = ? AND day_of_week = ?
      `, [restaurant_id, checkDay]);

      if (rows.length > 0 && !rows[0].is_closed) {
        const openTimeStr = rows[0].open_time; // e.g., '09:00'
        const [hour, minute] = openTimeStr.split(':').map(Number);

        // Build the opening datetime for this day
        const openingDate = new Date(nowMorocco);
        openingDate.setDate(nowMorocco.getDate() + i);
        openingDate.setHours(hour, minute, 0, 0);

        // If it's today, ensure opening is still in the future
        if (i === 0 && openingDate <= nowMorocco) {
          console.log(`[getNextOpeningTime] Today's opening (${openingDate}) already passed, checking next day`);
          continue; // today's opening already passed, look at next day
        }

        console.log(`[getNextOpeningTime] Next opening: ${dayNames[checkDay]} at ${openTimeStr} -> ${openingDate}`);
        return openingDate;
      }
    }

    // No open day found in next 7 days – fallback to end of today
    const endOfToday = new Date(nowMorocco);
    endOfToday.setHours(23, 59, 59, 999);
    console.log(`[getNextOpeningTime] No future opening found, fallback to end of today: ${endOfToday}`);
    return endOfToday;
  } catch (error) {
    console.error('[getNextOpeningTime] Error:', error);
    throw error;
  }
};

const getNextClosingTime = async (connection, restaurant_id) => {
  try {
    const now = new Date();
    const moroccoTimeStr = now.toLocaleString("en-US", { timeZone: "Africa/Casablanca" });
    const nowMorocco = new Date(moroccoTimeStr);
    const currentDay = nowMorocco.getDay();

    // Look ahead up to 7 days (including today)
    for (let i = 0; i <= 7; i++) {
      const checkDay = (currentDay + i) % 7;
      const [rows] = await connection.execute(`
        SELECT close_time, open_time, is_closed
        FROM restaurant_operating_hours
        WHERE restaurant_id = ? AND day_of_week = ?
      `, [restaurant_id, checkDay]);

      if (rows.length > 0 && !rows[0].is_closed) {
        const closeTimeStr = rows[0].close_time; // e.g., '22:00'
        const openTimeStr = rows[0].open_time;   // for detecting overnight
        const [closeHour, closeMinute] = closeTimeStr.split(':').map(Number);

        // Build the closing datetime for this day
        const closingDate = new Date(nowMorocco);
        closingDate.setDate(nowMorocco.getDate() + i);
        closingDate.setHours(closeHour, closeMinute, 0, 0);

        // If close time is <= open time, it's an overnight closing (belongs to the next day)
        // In that case, the actual closing datetime is on the next day
        if (closeTimeStr <= openTimeStr) {
          // This closing actually happens on the next day
          closingDate.setDate(closingDate.getDate() + 1);
        }

        // If this closing time is still in the future (including today's closing), return it
        if (closingDate > nowMorocco) {
          console.log(`[getNextClosingTime] Next closing: ${closingDate}`);
          return closingDate;
        }
      }
    }

    // No future closing found – fallback to end of today
    const endOfToday = new Date(nowMorocco);
    endOfToday.setHours(23, 59, 59, 999);
    console.log(`[getNextClosingTime] Fallback to end of today: ${endOfToday}`);
    return endOfToday;
  } catch (error) {
    console.error('[getNextClosingTime] Error:', error);
    throw error;
  }
};

// 6. Manual override with automatic expiration
export const toggleRestaurantOpen = async (req, res) => {
  let connection;
  try {
    const adminId = req.adminId;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });

    connection = await pool.getConnection();

    const [adminRows] = await connection.execute(
      'SELECT restaurant_id FROM admins WHERE id = ?',
      [adminId]
    );
    if (adminRows.length === 0) return res.status(404).json({ message: 'Admin not found' });

    const restaurant_id = adminRows[0].restaurant_id;
    if (!restaurant_id) return res.status(404).json({ message: 'No restaurant associated' });

    const { is_open } = req.body;
    if (is_open === undefined) return res.status(400).json({ message: 'is_open required' });

    let expiration = null;
    try {
      if (is_open) {
        // Manually opening – expire at next closing time
        console.log('⏰ Getting next closing time...');
        expiration = await getNextClosingTime(connection, restaurant_id);
      } else {
        // Manually closing – expire at next opening time
        console.log('⏰ Getting next opening time...');
        expiration = await getNextOpeningTime(connection, restaurant_id);
      }
      console.log(`⏰ Expiration set to: ${expiration}`);
    } catch (err) {
      console.warn('⚠️ Could not calculate expiration, using end of day', err);
    }

    // Fallback if no expiration could be determined
    if (!expiration) {
      const now = new Date();
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
      expiration = endOfDay;
    }

    await connection.execute(
      'UPDATE restaurants SET is_open = ?, manual_override = ?, manual_override_expires_at = ? WHERE id = ?',
      [is_open ? 1 : 0, true, expiration, restaurant_id]
    );

    res.json({ success: true, is_open });
  } catch (error) {
    console.error('❌ Error toggling restaurant open status:', error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    if (connection) connection.release();
  }
};


// restaurant ratings section
// Get all reviews for the authenticated restaurant owner's restaurant (no pagination)
export const getRestaurantReviews = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    // 1. Get restaurant_id from admin token
    const [adminRows] = await connection.execute(
      'SELECT restaurant_id FROM admins WHERE id = ?',
      [req.adminId]
    );

    if (adminRows.length === 0) {
      return res.status(403).json({ message: 'Admin not found' });
    }
    const restaurantId = adminRows[0].restaurant_id;

    // 2. Fetch only food quality, client name, comment, and date
    const [reviews] = await connection.execute(
      `SELECT 
          c.name as user_name,
          r.food_quality,
          r.comment,
          r.created_at
       FROM order_ratings r
       JOIN orders o ON r.order_id = o.id
       LEFT JOIN clients c ON r.user_id = c.id
       WHERE o.restaurant_id = ?
       ORDER BY r.created_at DESC`,
      [restaurantId]
    );

    // 3. Return only the reviews array
    return res.status(200).json({
      success: true,
      reviews,
    });

  } catch (error) {
    console.error("❌ Get restaurant reviews error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};


// orders history
export const getOrdersHistory = async (req, res) => {
  let connection;
  try {
    const adminId = req.adminId;

    if (!adminId) {
      return res.status(401).json({ message: "Unauthorized: No admin ID found" });
    }

    connection = await pool.getConnection();

    // 1. Fetch the restaurant_id
    const [adminData] = await connection.execute(
      "SELECT restaurant_id FROM admins WHERE id = ?",
      [adminId]
    );

    if (adminData.length === 0 || !adminData[0].restaurant_id) {
      return res.status(403).json({ message: "Access denied: Admin has no assigned restaurant" });
    }

    const restaurantId = adminData[0].restaurant_id;

    // 2. Base Query: Filter specifically for 'delivered' and 'canceled'
    // We removed the CURDATE() filter to show all historical data
    let query = `
      SELECT o.*, 
             c.name as customer_name, c.phone as customer_phone, c.email as customer_email,
             dm.name as delivery_man_name, dm.phone as delivery_man_phone
      FROM orders o
      LEFT JOIN clients c ON o.user_id = c.id
      LEFT JOIN delivery_men dm ON o.delivery_man_id = dm.id
      WHERE o.restaurant_id = ? 
      AND o.status IN ('delivered', 'cancelled')
    `;

    const params = [restaurantId];
    const { search } = req.query;

    // 3. Optional Search (Order number or Customer details)
    if (search) {
      query += " AND (o.order_number LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)";
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // 4. Sort by newest first
    query += " ORDER BY o.created_at DESC";

    const [orders] = await connection.execute(query, params);

    return res.status(200).json({ 
      success: true,
      count: orders.length,
      orders 
    });

  } catch (error) {
    console.error("❌ Get order history error:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};