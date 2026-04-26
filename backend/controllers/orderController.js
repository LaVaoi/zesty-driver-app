import db from "../config/db.js";
import { v4 as uuidv4 } from "uuid";
import pool from "../config/db.js";
import { executeQuery } from "../config/db.js";
import { sendFCMNotification } from "../utils/fcmService.js";
import { calculateDeliveryFee } from "../services/deliveryFeeService.js";
import nodemailer from "nodemailer";
import { removeDeviceToken } from "../utils/notificationService.js";

// Estimate delivery fee (for frontend preview)
export const estimateDeliveryFee = async (req, res) => {
  try {
    const { lat, lon, restaurant_id } = req.body;

    // Validate inputs
    if (!lat || !lon || !restaurant_id) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing latitude, longitude, or restaurant ID" 
      });
    }

    const feeResult = await calculateDeliveryFee(lat, lon, restaurant_id);

    if (feeResult.error && feeResult.fee === null) {
      return res.status(400).json({
        success: false,
        message: feeResult.error,
        distance: feeResult.distance
      });
    }

    return res.json({
      success: true,
      delivery_fee: feeResult.fee,
      distance: feeResult.distance,
      message: "Fee calculated successfully"
    });

  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: "Internal server error during fee calculation" 
    });
  }
};

export const createOrder = async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();

    // ==================== START TRANSACTION ====================
    await connection.beginTransaction();
    const user_id = req.clientId || req.userId; // Use the value set by verifyToken middleware
    const {
      items,
      delivery_address,
      total_price,
      final_price_before_zesty,
      delivery_fee,
      discount = 0,
      final_price,
      paymentMethod,
      promoCode,
      restaurant_id, // ADD THIS LINE
      special_instructions, // ADD THIS LINE
      lat,
      lon,
    } = req.body;


    // ==================== 1. VALIDATION ====================
    if (
      !user_id ||
      !Array.isArray(items) ||
      items.length === 0 ||
      !restaurant_id || 
      lat === undefined || // Changed from !lat
      lon === undefined || // Changed from !lon
      total_price === undefined ||
      final_price === undefined ||
      delivery_fee === undefined || // Changed from !delivery_fee
      !paymentMethod ||
      !delivery_address || 
      delivery_address.trim() === ''
    ) {
      await connection.rollback();
      return res.status(400).json({ message: "Invalid or incomplete order data" });
    }

    const payment_status = paymentMethod === "card" ? "Paid" : "Unpaid";
    const order_number = `ORD-${uuidv4().slice(0, 8).toUpperCase()}`;

    // ==================== CHECK RESTAURANT HOURS & SETTINGS ====================
    const serverTime = new Date();
    const moroccoTimeStr = serverTime.toLocaleString("en-US", { timeZone: "Africa/Casablanca" });
    const moroccoTime = new Date(moroccoTimeStr);
    const currentDay = moroccoTime.getDay();
    const yesterday = (currentDay + 6) % 7;

    // Fetch schedule AND the new master status from 'restaurants' table
    const [[operatingHoursRows], [restaurantRows]] = await Promise.all([
      connection.execute(
        `SELECT day_of_week, is_closed, open_time, close_time 
        FROM restaurant_operating_hours 
        WHERE restaurant_id = ? AND day_of_week IN (?, ?)`,
        [restaurant_id, currentDay, yesterday]
      ),
      connection.execute(
        `SELECT is_open FROM restaurants WHERE id = ?`, 
        [restaurant_id]
      )
    ]);

    // 1. Check the Manual Master Toggle (The is_open column you just moved)
    const manualIsOpen = restaurantRows[0]?.is_open;
    if (!manualIsOpen) {
      if (connection) await connection.rollback();
      return res.status(400).json({ message: "The restaurant is currently not accepting orders (Manual Closure)." });
    }

    // Helper to validate shift logic (handles overnight shifts)
    const isShiftActive = (daySchedule, refDate, dayOffset = 0) => {
      if (!daySchedule || daySchedule.is_closed) return false;
      
      const openTime = new Date(refDate);
      openTime.setDate(openTime.getDate() + dayOffset);
      const [oH, oM] = daySchedule.open_time.split(':');
      openTime.setHours(parseInt(oH), parseInt(oM), 0, 0);

      let closeTime = new Date(refDate);
      closeTime.setDate(closeTime.getDate() + dayOffset);
      const [cH, cM] = daySchedule.close_time.split(':');
      closeTime.setHours(parseInt(cH), parseInt(cM), 0, 0);

      // If closing time is earlier than opening time, it's an overnight shift (e.g., 6 PM - 2 AM)
      if (closeTime <= openTime) closeTime.setDate(closeTime.getDate() + 1);
      
      return refDate >= openTime && refDate < closeTime;
    };

    const todayHours = operatingHoursRows.find(h => h.day_of_week === currentDay);
    const yesterdayHours = operatingHoursRows.find(h => h.day_of_week === yesterday);

    // 2. Check the Actual Operating Hours Schedule
    const isScheduledOpen = isShiftActive(todayHours, moroccoTime, 0) || 
                            isShiftActive(yesterdayHours, moroccoTime, -1);

    if (!isScheduledOpen) {
      if (connection) await connection.rollback();
      return res.status(400).json({ message: "The restaurant is currently closed. Please check our operating hours." });
    }



    // ==================== 2. PARALLEL DATA FETCH (OPTIMIZED) ====================
    const itemIds = items.map(item => item.product_id);
    const offerIds = items
      .filter(item => item.discount_applied && item.offer_info && item.offer_info.offer_id)
      .map(item => item.offer_info.offer_id);


    // 1. Adjusted the fallback to [[], []] to match the database result format [rows, fields]
    const offersPromise = offerIds.length > 0 ? connection.execute(
      `SELECT o.id as offer_id, o.discount_type, o.discount as discount_value, o.is_active, op.id as offer_product_id, op.product_id, op.limited_use, op.times_used 
       FROM offers o 
       INNER JOIN offer_products op ON o.id = op.offer_id 
       WHERE o.id IN (${offerIds.map(() => '?').join(',')}) 
       AND op.product_id IN (${itemIds.map(() => '?').join(',')}) 
       AND o.is_active = TRUE AND NOW() BETWEEN o.start_at AND o.end_at`,
      [...offerIds, ...itemIds]
    ) : Promise.resolve([[], []]); 

    // 2. Fixed the destructuring. Since Promise.all only has ONE promise, 
    // we take the first item of the result array, which contains [rows, fields].
    const [offersResult] = await Promise.all([offersPromise]);
    const offersRows = offersResult[0] || [];

    // 3. Safe mapping
    const offersMap = new Map();
    offersRows.forEach(row => {
      if (row && row.offer_id) {
        offersMap.set(`${row.offer_id}-${row.product_id}`, row);
      }
    });

    // ==================== 3. CALCULATE DELIVERY FEE ====================
    let calculatedDeliveryFee = parseFloat(delivery_fee) || 0;

    if (lat && lon && restaurant_id) { // Ensure restaurant_id is included here
      // PASS ALL THREE: lat, lon, and restaurant_id
      const feeResult = await calculateDeliveryFee(lat, lon, restaurant_id); 
      
      if (feeResult.error && feeResult.fee === null) {
        await connection.rollback();
        return res.status(400).json({ message: feeResult.error });
      }
      
      // Use the fee from our new 1.3x buffer + rounding logic
      calculatedDeliveryFee = parseFloat(feeResult.fee);
    } else {
      calculatedDeliveryFee = parseFloat(delivery_fee) || 15.00;
    }

    // FIX THE STRING CONCATENATION HERE TOO:
    const cleanTotalPrice = parseFloat(total_price) || 0;
    const cleanDiscount = parseFloat(discount) || 0;

    const actualFinalPrice = cleanTotalPrice + calculatedDeliveryFee - cleanDiscount;

    // ==================== 4. ENRICH ITEMS & VALIDATE LIMITS (UPDATED) ====================
    const enrichedItems = items.map(item => {
      const { product_id, discount_applied, offer_info, quantity } = item;
      let offerData = null;

      if (discount_applied && offer_info && offer_info.offer_id) {
        const offer_id = offer_info.offer_id;
        const key = `${offer_id}-${product_id}`;
        offerData = offersMap.get(key);
      }

      // Check global offer_product limit
      if (offerData && offerData.limited_use !== null) {
        if ((offerData.times_used + quantity) > offerData.limited_use) {
          throw new Error(`OFFER_LIMIT_REACHED|Offer limit reached for this product. Only ${offerData.limited_use - offerData.times_used} more uses available.`);
        }
      }

      return { ...item, offerData };
    });

    // ==================== 5. CREATE ORDER ====================
    const zesty_discount = 5;
    const [orderResult] = await connection.execute(
      `INSERT INTO orders (user_id, restaurant_id, order_number, status, payment_status, delivery_address, total_price, delivery_fee, discount, zesty_discount, final_price_before_zesty, final_price, lat, lon, special_instructions)
      VALUES (?, ?, ?, 'Pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, // Added one '?'
      [
        user_id, 
        restaurant_id, 
        order_number, 
        payment_status, 
        delivery_address, 
        total_price, 
        calculatedDeliveryFee, 
        discount, 
        zesty_discount, // Added zesty_discount
        final_price_before_zesty,
        actualFinalPrice, 
        lat, 
        lon, 
        special_instructions || null // Added this line
      ]
    );
    const order_id = orderResult.insertId;

    // ==================== 6. BATCH INSERT ORDER ITEMS (FIXED) ====================
    const productIds = items.map(i => i.product_id);

    // Fetch official prices from products table for history/reference
    const [products] = await connection.query(
      "SELECT id, price FROM products WHERE id IN (?)",
      [productIds]
    );

    const priceMap = {};
    products.forEach(p => {
      priceMap[p.id] = p.price;
    });

    const itemInsertValues = [];
    const offersToUpdate = [];

    for (const item of enrichedItems) {
      const { product_id, quantity, offerData } = item;

      // 1. Get official price from database for the reference column
      const dbPrice = parseFloat(priceMap[product_id] || 0);
      
      // 2. RESTORED: Use the price from the item object (original behavior)
      let finalUnitPrice = item.price; 
      let appliedOfferId = null;
      let appliedOfferProductId = null;
      let discountType = null;
      let discountValue = 0;
      let discountAmount = 0;

      // 3. Process Offer Logic
      if (offerData) {
        const { offer_id, offer_product_id, discount_type, discount_value } = offerData;
        const parsedValue = parseFloat(discount_value);

        appliedOfferId = offer_id;
        appliedOfferProductId = offer_product_id;
        discountType = discount_type;
        discountValue = parsedValue;

        if (discountType === 'percentage') {
          discountAmount = parseFloat((dbPrice * (parsedValue / 100)).toFixed(2));
          finalUnitPrice = parseFloat((dbPrice - discountAmount).toFixed(2));
        } else if (discountType === 'fixed') {
          discountAmount = parseFloat(parsedValue.toFixed(2));
          finalUnitPrice = parseFloat((dbPrice - discountAmount).toFixed(2));
        }

        offersToUpdate.push({ offer_product_id, quantity });
      }

      // 4. Batch Insert using your original structure
      itemInsertValues.push([
        order_id,               // order_id
        product_id,             // product_id
        quantity,               // quantity
        item.price,             // price_per_unit (REVERTED TO YOUR ORIGINAL VALUE)
        dbPrice,                // original_unit_price (VERIFIED FROM DB TABLE)
        appliedOfferId,         // applied_offer_id
        appliedOfferProductId,  // applied_offer_product_id
        discountType,           // discount_type
        discountValue,          // discount_value
        discountAmount,         // discount_amount
        finalUnitPrice          // final_unit_price (Calculated result)
      ]);
    }

    if (itemInsertValues.length > 0) {
      await connection.query(
        `INSERT INTO order_items (
          order_id, product_id, quantity, price_per_unit, original_unit_price, 
          applied_offer_id, applied_offer_product_id, discount_type, 
          discount_value, discount_amount, final_unit_price
        ) VALUES ?`,
        [itemInsertValues]
      );
    }
    // ==================== 7. UPDATE OFFERS ====================
    if (offersToUpdate.length > 0) {
      const updatePromises = offersToUpdate.map(({ offer_product_id, quantity }) =>
        connection.execute(
          `UPDATE offer_products SET times_used = times_used + ?, updated_at = NOW() WHERE id = ? AND (limited_use IS NULL OR times_used + ? <= limited_use)`,
          [quantity, offer_product_id, quantity]
        )
      );
      const updateResults = await Promise.all(updatePromises);
      updateResults.forEach((result) => {
        if (result[0].affectedRows === 0) {
          throw new Error(`OFFER_LIMIT_REACHED|Offer limit reached for product. Race condition detected.`);
        }
      });
      console.log(`✅ UPDATED ${offersToUpdate.length} offer_products usage counts.`);
    }

    // ==================== 9. DEACTIVATE OFFERS (FIXED LOGIC) ====================
    if (offerIds.length > 0) {
      // Find offers where ALL associated offer_products have reached their limit
      const [offersToDeactivateRows] = await connection.execute(
        `SELECT
                    o.id AS offer_id
                 FROM offers o
                 INNER JOIN offer_products op ON o.id = op.offer_id
                 WHERE o.id IN (${offerIds.map(() => '?').join(',')})
                 GROUP BY o.id
                 HAVING SUM(CASE WHEN op.limited_use IS NOT NULL AND op.times_used < op.limited_use THEN 1 ELSE 0 END) = 0`,
        offerIds
      );

      const finalOffersToDeactivate = offersToDeactivateRows.map(row => row.offer_id);

      if (finalOffersToDeactivate.length > 0) {
        // FIX: Corrected SQL syntax and logic to deactivate
        await connection.execute(
          `UPDATE offers SET is_active = FALSE, updated_at = NOW()
WHERE id IN (${finalOffersToDeactivate.map(() => '?').join(',')})`,
          finalOffersToDeactivate
        );
        console.log(`🔴 Deactivated offers that reached their TOTAL product limit: ${finalOffersToDeactivate.join(', ')}`);
      } else {
        console.log('✅ No offers reached their total product limit.');
      }
    }

    // ==================== 10. TRACK PROMO CODE USAGE ====================
    if (promoCode) {
      const [promoRows] = await connection.execute(
        `SELECT id FROM promo_codes WHERE code = ? AND is_active = TRUE`, [promoCode.toUpperCase()]
      );
      if (promoRows.length > 0) {
        const promoCodeId = promoRows[0].id;
        await Promise.all([
          connection.execute(`UPDATE promo_codes SET used_count = used_count + 1 WHERE id = ?`, [promoCodeId]),
          connection.execute(`INSERT INTO order_promo_codes (order_id, promo_code_id, discount_amount) VALUES (?, ?, ?)`, [order_id, promoCodeId, discount])
        ]);
        console.log(`✅ Tracked promo code ${promoCodeId} usage.`);
      }
    }

    // ==================== COMMIT TRANSACTION ====================
    await connection.commit();

    // ==================== 11. POST-COMMIT ACTIONS (Outside Transaction) ====================
    const [clientDetailsRows, adminSettingsRows] = await Promise.all([
      db.execute(`SELECT name, email, phone FROM clients WHERE id = ?`, [user_id]),
      db.execute(`SELECT restaurant_email, restaurant_name FROM restaurant_settings LIMIT 1`)
    ]);

    const clientDetails = clientDetailsRows[0][0];
    const settings = adminSettingsRows[0][0] || {};
    const restaurantEmail = settings.restaurant_email;
    const restaurantName = settings.restaurant_name || "Restaurant";

    // ==================== 12. SEND ADMIN NOTIFICATION (NEW) ====================
    try {
      // Get admin user(s) - assuming there's an admins table
      const [adminRows] = await connection.execute(
        `SELECT id, fcm_token FROM admins WHERE is_active = 1`
      );

      console.log(`📊 Found ${adminRows.length} active admin(s)`);

      if (adminRows.length === 0) {
        console.log('⚠️ No active admins found, skipping notification');
      } else {
        // Create notification data for admin
        const orderItemsText = items.map(item =>
          `${item.name || 'Product'} (${item.quantity} × ${item.price} MAD)`
        ).join(', ');

        const notificationData = {
          order_id: order_id,
          order_number: order_number,
          total_amount: actualFinalPrice,
          customer_name: clientDetails?.name || 'Unknown Customer',
          customer_phone: clientDetails?.phone || 'N/A',
          delivery_address: delivery_address,
          items_count: items.length,
          items_preview: orderItemsText,
          type: 'new_order',
          sound_required: true,
          repeat_until_status: 'preparing'
        };

        // --- PASTE THE BLOCK HERE ---
        const adminFCMTokens = adminRows.map(a => a.fcm_token).filter(t => t);

        if (adminFCMTokens.length > 0) {
          await sendFCMNotification(
            adminFCMTokens, 
            "🎉 New Order Received!", 
            `Order #${order_number} - ${actualFinalPrice} MAD`, 
            {
              ...notificationData,
              order_id: String(order_id),
              type: 'new_order'
            }
          );
          console.log(`🚀 Alarm signal sent to ${adminFCMTokens.length} devices`);
        }
        // --- END OF BLOCK ---


        console.log('📝 Notification data:', notificationData);

        // Send notification to each admin
        for (const admin of adminRows) {
          try {
            console.log(`📤 Processing notification for admin ${admin.id}`);

            // FIRST: Save notification to database for persistence
            const [notificationInsertResult] = await connection.execute(
              `INSERT INTO notifications (user_type, user_id, title, message, is_read, data) 
           VALUES ('admin', ?, ?, ?, 0, ?)`,
              [
                admin.id,
                '🎉 New Order #' + order_number,
                `New order received from ${clientDetails?.name || 'customer'}. Total: ${actualFinalPrice} MAD`,
                JSON.stringify(notificationData)
              ]
            );

            const notificationId = notificationInsertResult.insertId;
            console.log(`✅ Notification #${notificationId} saved to database for admin ${admin.id}`);

            // SECOND: Add to notification queue for offline admins
            try {
              await connection.execute(
                `INSERT INTO notification_queue (notification_id, user_id, user_type, data, attempts) 
             VALUES (?, ?, 'admin', ?, 0)`,
                [notificationId, admin.id, JSON.stringify(notificationData)]
              );
              console.log(`📝 Notification #${notificationId} added to queue for admin ${admin.id}`);
            } catch (queueError) {
              console.log('⚠️ Could not add admin notification to queue:', queueError.message);
            }

            // THIRD: Send via WebSocket (real-time)
            if (typeof sendNotificationToUser === 'function') {
              console.log(`📡 Attempting WebSocket notification to admin ${admin.id}`);

              const wsNotification = {
                id: notificationId,
                title: '🎉 New Order Received!',
                message: `Order #${order_number} - ${actualFinalPrice} MAD`,
                is_read: false,
                created_at: new Date().toISOString(),
                data: notificationData
              };

              const wsSent = sendNotificationToUser(
                admin.id.toString(),
                'admin',
                wsNotification
              );

              if (wsSent) {
                console.log(`📢 WebSocket notification sent to admin ${admin.id}`);

                // Send unread count update IMMEDIATELY
                // Get current unread count for this admin
                const [unreadResult] = await connection.execute(
                  "SELECT COUNT(*) as count FROM notifications WHERE user_type = 'admin' AND user_id = ? AND is_read = 0",
                  [admin.id]
                );

                // Broadcast unread count update
                if (typeof broadcastToUserType === 'function') {
                  broadcastToUserType('admin', {
                    type: 'unread_count_update',
                    count: unreadResult[0]?.count || 0
                  });
                  console.log(`📊 Broadcast unread count: ${unreadResult[0]?.count || 0}`);
                }
              } else {
                console.log(`⚠️ Admin ${admin.id} not connected via WebSocket`);
              }
            } else {
              console.log('❌ sendNotificationToUser function not available');
            }

            // FOURTH: Send broadcast to all connected admins
            if (typeof broadcastToUserType === 'function') {
              broadcastToUserType('admin', {
                type: 'new_notification',
                data: {
                  id: notificationId,
                  title: '🎉 New Order Received!',
                  message: `Order #${order_number} - ${actualFinalPrice} MAD`,
                  is_read: false,
                  created_at: new Date().toISOString(),
                  data: notificationData
                }
              });
              console.log(`📢 Broadcasted to all connected admins`);
            }

          } catch (adminError) {
            console.error(`❌ Error sending notification to admin ${admin.id}:`, adminError);
          }
        }
      }

    } catch (notificationError) {
      console.error('❌ Error in admin notification system:', notificationError);
      // Don't fail the order if notification fails
    }

    // SEND EMAIL TO RESTAURANT ADMIN (Restored and Corrected)
    if (restaurantEmail) {
      try {
        // ... (email transporter and mail options logic is unchanged)
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });

        const orderItemsListText = items.map((item, index) =>
          `${index + 1}. ${item.name || 'Product'} - ${item.quantity} x ${item.price} MAD = ${(item.quantity * item.price).toFixed(2)} MAD`
        ).join('\n');

        const orderItemsListHTML = items.map(item => `
                    <tr>
                        <td>${item.name || 'Product'}</td>
                        <td>${item.quantity}</td>
                        <td>${item.price} MAD</td>
                        <td>${(item.quantity * item.price).toFixed(2)} MAD</td>
                    </tr>
                `).join('');

        const mailOptions = {
          from: `"Order System" <${process.env.EMAIL_USER}>`,
          to: restaurantEmail,
          subject: `📦 New Order Received: ${order_number}`,
          text: `
NEW ORDER RECEIVED

Order Details:
---------------
Order Number: ${order_number}
Order ID: ${order_id}
Date: ${new Date().toLocaleString()}
Status: Pending
Payment: ${payment_status}

Customer Details:
-----------------
Name: ${clientDetails?.name || 'N/A'}
Email: ${clientDetails?.email || 'N/A'}
Phone: ${clientDetails?.phone || 'N/A'}

Delivery Address:
-----------------
${delivery_address}

Order Summary:
--------------
${orderItemsListText}  <-- USING THE CORRECT TEXT VARIABLE

Totals:
-------
Subtotal: ${total_price} MAD
Delivery Fee: ${calculatedDeliveryFee} MAD
Discount: ${discount} MAD
Total: ${actualFinalPrice} MAD

Payment Method: ${paymentMethod}

Please log in to your admin panel to process this order.
`,
          html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
        .order-info { background-color: white; padding: 15px; margin: 10px 0; border-left: 4px solid #4CAF50; }
        .customer-info { background-color: white; padding: 15px; margin: 10px 0; border-left: 4px solid #2196F3; }
        .items-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        .items-table th { background-color: #f5f5f5; padding: 10px; text-align: left; }
        .items-table td { padding: 10px; border-bottom: 1px solid #ddd; }
        .total-box { background-color: #e8f5e9; padding: 15px; margin: 15px 0; border-radius: 5px; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        .button { display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📦 New Order Received</h1>
            <p>Order Number: ${order_number}</p>
        </div>

        <div class="content">
            <div class="order-info">
                <h3>Order Details</h3>
                <p><strong>Order ID:</strong> ${order_id}</p>
                <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
                <p><strong>Status:</strong> <span style="color: #ff9800; font-weight: bold;">Pending</span></p>
                <p><strong>Payment:</strong> ${payment_status}</p>
            </div>

            <div class="customer-info">
                <h3>Customer Information</h3>
                <p><strong>Name:</strong> ${clientDetails?.name || 'N/A'}</p>
                <p><strong>Email:</strong> ${clientDetails?.email || 'N/A'}</p>
                <p><strong>Phone:</strong> ${clientDetails?.phone || 'N/A'}</p>
            </div>

            <div>
                <h3>Delivery Address</h3>
                <p style="background-color: #f5f5f5; padding: 10px; border-radius: 3px;">${delivery_address}</p>
            </div>

            <h3>Order Items</h3>
            <table class="items-table">
                <thead>
                    <tr>
                        <th>Item</th>
                        <th>Qty</th>
                        <th>Price</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${orderItemsListHTML}  <-- USING THE CORRECT HTML VARIABLE
                </tbody>
            </table>

            <div class="total-box">
                <h3>Order Summary</h3>
                <p><strong>Subtotal:</strong> ${total_price} MAD</p>
                <p><strong>Delivery Fee:</strong> ${calculatedDeliveryFee} MAD</p>
                <p><strong>Discount:</strong> ${discount} MAD</p>
                <p><strong style="font-size: 18px;">Total Amount:</strong> ${actualFinalPrice} MAD</p>
                <p><strong>Payment Method:</strong> ${paymentMethod}</p>
            </div>

            <div style="text-align: center; margin: 25px 0;">
                <a href="${process.env.ADMIN_URL || '#'}" class="button">View Order in Admin Panel</a>
            </div>
        </div>

        <div class="footer">
            <p>This is an automated notification from ${restaurantName} Order System.</p>
            <p>Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>
`
        };

        transporter.sendMail(mailOptions)
          .then(() => console.log(`✅ Order notification email sent to ${restaurantEmail}`))
          .catch(emailError => console.error('❌ Failed to send order email:', emailError));

      } catch (emailError) {
        console.error('❌ Error preparing order email:', emailError);
      }
    } else {
      console.log('⚠️ No restaurant email configured. Skipping email notification.');
    }

    // SEND DELIVERY NOTIFICATIONS (Fire and forget, no await)
    notifyAllDeliveryMen(order_id, order_number, actualFinalPrice, delivery_address).catch(err => {
      console.error("Background notification error:", err);
    });

    res.status(201).json({
      message: "✅ Order created successfully",
      order_id,
      order_number,
      payment_status,
      total_price,
      delivery_fee: calculatedDeliveryFee,
      final_price: actualFinalPrice,
      email_sent: !!restaurantEmail,
      admin_notification_sent: true
    });

  } catch (err) {
    // Check for custom offer limit error for clean 400 response
    if (err.message && err.message.startsWith('OFFER_LIMIT_REACHED')) {
      await connection.rollback();
      const errorMessage = err.message.split('|')[1] || "Offer limit reached. Unable to process order.";
      return res.status(400).json({ message: errorMessage });
    }

    console.error("❌ Error creating order:", err);

    // ==================== ROLLBACK ON GENERAL ERROR ====================
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Error during rollback:', rollbackError);
      }
    }

    res.status(500).json({ message: "Failed to create order" });
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('Error releasing connection:', releaseError);
      }
    }
  }
};

// 🔔 Function to notify all delivery men
export async function notifyAllDeliveryMen(orderId, orderNumber, finalPrice, address) {
  try {
    console.log("🚚 Notifying all delivery men...");

    // 1️⃣ Get all active delivery men
    const [deliveryMen] = await executeQuery(
      "SELECT id FROM delivery_men WHERE is_active = 1"
    );

    if (deliveryMen.length === 0) {
      console.log("⚠️ No active delivery men found");
      return { success: false, message: "No active delivery men" };
    }

    // 2️⃣ Insert notification rows for each delivery man
    for (const man of deliveryMen) {
      await executeQuery(
        "INSERT INTO notifications (user_type, user_id, title, message) VALUES (?, ?, ?, ?)",
        ["delivery_man", man.id, "New Delivery Order", `Order #${orderNumber}`]
      );
    }

    console.log(`📝 Inserted notifications for ${deliveryMen.length} delivery men`);

    // 3️⃣ Fetch device tokens for delivery men
    const [tokensRows] = await executeQuery(
      "SELECT fcm_token FROM device_tokens WHERE user_type='delivery_man'"
    );

    const tokens = tokensRows
      .map((row) => row.fcm_token)
      .filter((t) => t && t.trim().length > 0);

    if (tokens.length === 0) {
      console.log("⚠️ No delivery men have device tokens");
      return { success: true, message: "Notifications saved but no FCM tokens found" };
    }

    // 4️⃣ Prepare FCM payload
    const title = "New Delivery Order";
    const body = `Order #${orderNumber} - Total: ${finalPrice} MAD`;

    const data = {
      order_id: String(orderId),
      order_number: String(orderNumber),
      final_price: String(finalPrice),
      address: address || "",
      type: "new_order",
      click_action: "OPEN_ORDER_DETAILS",
    };

    // 5️⃣ Send the push notifications using your FCM wrapper
    const fcmResult = await sendFCMNotification(tokens, title, body, data);

    console.log("📤 FCM Result:", fcmResult);

    // 6️⃣ Clean invalid tokens
    if (fcmResult?.results) {
      const invalidTokens = [];

      fcmResult.results.forEach((res, index) => {
        if (!res || !res.responses) return;

        res.responses.forEach((entry, i) => {
          if (!entry.success) {
            const token = tokens[index * 500 + i]; // correct mapping for batch sizes
            if (
              entry.error?.code === "messaging/invalid-registration-token" ||
              entry.error?.code === "messaging/registration-token-not-registered"
            ) {
              invalidTokens.push(token);
            }
          }
        });
      });

      if (invalidTokens.length > 0) {
        console.log("🧹 Removing invalid FCM tokens...");

        for (const token of invalidTokens) {
          await removeDeviceToken(token);
        }

        console.log("🧽 Invalid tokens removed:", invalidTokens);
      }
    }

    return {
      success: true,
      totalNotifications: deliveryMen.length,
      tokensSent: tokens.length,
      fcmResult,
    };
  } catch (error) {
    console.error("❌ notifyAllDeliveryMen error:", error);
    return { success: false, error: error.message };
  }
}


// Get delivery man location for an order
export const getDeliveryManLocation = async (req, res) => {
  try {
    const { order_id } = req.query;

    if (!order_id) {
      return res.status(400).json({ message: "Order ID is required" });
    }

    const connection = await pool.getConnection();

    // Get order with delivery man location
    const [orders] = await connection.execute(
      `SELECT o.id, o.delivery_man_id,
              dm.current_latitude, dm.current_longitude, dm.last_location_update
       FROM orders o
       LEFT JOIN delivery_men dm ON o.delivery_man_id = dm.id
       WHERE o.id = ?`,
      [order_id]
    );

    connection.release();

    if (orders.length === 0) {
      return res.status(404).json({ message: "Order not found" });
    }

    const order = orders[0];

    if (!order.delivery_man_id) {
      return res.json({
        hasLocation: false,
        message: "No delivery man assigned to this order"
      });
    }

    if (!order.current_latitude || !order.current_longitude) {
      return res.json({
        hasLocation: false,
        message: "Delivery man location not available"
      });
    }

    res.json({
      hasLocation: true,
      location: {
        latitude: parseFloat(order.current_latitude),
        longitude: parseFloat(order.current_longitude),
        lastUpdate: order.last_location_update
      }
    });
  } catch (error) {
    console.error("Error fetching delivery man location:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getOrders = async (req, res) => {
  try {
    const user_id = req.clientId || req.userId;
    if (!user_id) return res.status(400).json({ message: "User ID is required" });

    // 1. Fetch orders JOINED with restaurant details and delivery man details
    // We remove the separate settingsPromise since data is now per-restaurant
    const [ordersResult] = await db.execute(`
      SELECT 
        o.*, 
        dm.id as dm_id, dm.name as dm_name, dm.phone as dm_phone, dm.image as dm_image,
        dm.vehicle_type, dm.current_latitude, dm.current_longitude, dm.last_location_update,
        r.name as restaurant_name, r.phone as restaurant_phone, r.logo as restaurant_logo
      FROM orders o
      LEFT JOIN delivery_men dm ON o.delivery_man_id = dm.id
      LEFT JOIN restaurants r ON o.restaurant_id = r.id
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC`, [user_id]);

    const rawOrders = ordersResult;

    if (rawOrders.length === 0) {
      return res.status(200).json({ orders: [] });
    }

    const orderIds = rawOrders.map(o => o.id);

    // 2. Fetch Items and Ratings in parallel
    const [itemsResult, ratingsResult] = await Promise.all([
    db.execute(`
      SELECT 
        oi.order_id, 
        oi.product_id, 
        oi.quantity, 
        oi.price_per_unit, 
        p.name as product_name, 
        p.image as product_image,
        p.description as product_description  -- <--- ADD THIS LINE
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id IN (${orderIds.map(() => '?').join(',')})`, orderIds),
      db.execute(`
        SELECT order_id, food_quality, delivery_service, comment 
        FROM order_ratings 
        WHERE order_id IN (${orderIds.map(() => '?').join(',')})`, orderIds)
    ]);

    const rawItems = itemsResult[0];
    const rawRatings = ratingsResult[0];

    // 3. Mapping data for O(1) lookups
    const itemsByOrder = {};
    rawItems.forEach(item => {
      if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
      itemsByOrder[item.order_id].push({
        product_id: item.product_id,
        product_name: item.product_name || `Product #${item.product_id}`,
        product_image: item.product_image,
        product_description: item.product_description, // <--- ADD THIS LINE
        quantity: item.quantity,
        price: item.price_per_unit
      });
    });

    const ratingsByOrder = {};
    rawRatings.forEach(r => {
      ratingsByOrder[r.order_id] = {
        food_quality: r.food_quality,
        delivery_service: r.delivery_service,
        comment: r.comment
      };
    });

    // 4. Final Construction
    const ordersWithDetails = rawOrders.map(order => ({
      id: order.id,
      order_number: order.order_number,
      status: order.status,
      payment_status: order.payment_status,
      delivery_address: order.delivery_address,
      total_price: order.total_price,
      delivery_fee: order.delivery_fee,
      discount: order.discount,
      final_price: order.final_price,
      created_at: order.created_at,
      updated_at: order.updated_at,
      lat: order.lat,
      lon: order.lon,
      set_prepared_at: order.set_prepared_at,
      estimated_preparing_time: order.estimated_preparing_time,
      
      // Restaurant Details (Now dynamic per order)
      restaurant_name: order.restaurant_name || "Unknown Restaurant",
      restaurant_phone: order.restaurant_phone || "N/A",
      restaurant_logo: order.restaurant_logo || null, // <--- ADD THIS LINE
      restaurant_id: order.restaurant_id,
      delivery_man: order.dm_id ? {
        id: order.dm_id,
        name: order.dm_name,
        phone: order.dm_phone,
        vehicle_type: order.vehicle_type,
        image: order.dm_image,
        current_latitude: order.current_latitude,
        current_longitude: order.current_longitude,
        last_location_update: order.last_location_update,
      } : null,
      order_items: itemsByOrder[order.id] || [],
      rating: ratingsByOrder[order.id] || null
    }));

    res.status(200).json({
      orders: ordersWithDetails
    });

  } catch (err) {
    console.error("❌ Error fetching orders:", err);
    res.status(500).json({ message: "Failed to fetch orders" });
  }
};


// get order by id
export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.clientId || req.userId;

    if (!id) return res.status(400).json({ message: "Order ID is required" });

    // 1. Updated SQL to include r.logo as restaurant_logo
    const [orderResult] = await db.execute(`
      SELECT 
        o.*, 
        dm.id as dm_id, dm.name as dm_name, dm.phone as dm_phone, dm.image as dm_image,
        dm.vehicle_type, dm.current_latitude, dm.current_longitude, dm.last_location_update,
        r.name as restaurant_name, r.phone as restaurant_phone, r.logo as restaurant_logo
      FROM orders o
      LEFT JOIN delivery_men dm ON o.delivery_man_id = dm.id
      LEFT JOIN restaurants r ON o.restaurant_id = r.id
      WHERE o.id = ? AND o.user_id = ?
      LIMIT 1`, [id, user_id]);

    if (orderResult.length === 0) {
      return res.status(404).json({ message: "Order not found or unauthorized" });
    }

    const order = orderResult[0];

    // 2. Fetch Items and Ratings in parallel
    const [itemsResult, ratingsResult] = await Promise.all([
      db.execute(`
        SELECT oi.product_id, oi.quantity, oi.price_per_unit, 
               p.name as product_name, p.image as product_image
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?`, [id]),
      db.execute(`
        SELECT food_quality, delivery_service, comment 
        FROM order_ratings 
        WHERE order_id = ?`, [id])
    ]);

    // 3. Construct the response object
    const fullOrder = {
      ...order,
      restaurant_name: order.restaurant_name || "Unknown Restaurant",
      restaurant_phone: order.restaurant_phone || "N/A",
      restaurant_logo: order.restaurant_logo || null, // Included the logo here
      delivery_man: order.dm_id ? {
        id: order.dm_id,
        name: order.dm_name,
        phone: order.dm_phone,
        vehicle_type: order.vehicle_type,
        image: order.dm_image,
        current_latitude: order.current_latitude,
        current_longitude: order.current_longitude,
        last_location_update: order.last_location_update,
      } : null,
      order_items: itemsResult[0].map(item => ({
        product_id: item.product_id,
        product_name: item.product_name || `Product #${item.product_id}`,
        product_image: item.product_image,
        quantity: item.quantity,
        price: item.price_per_unit
      })),
      rating: ratingsResult[0][0] || null
    };

    // Clean up temporary join aliases
    delete fullOrder.dm_id;
    delete fullOrder.dm_name;
    delete fullOrder.dm_phone;
    delete fullOrder.dm_image;

    res.status(200).json(fullOrder);

  } catch (err) {
    console.error("❌ Error fetching order details:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};
// get order by id end
// track order check existence
export const checkOrderExists = async (req, res) => {
  try {
    const { order_number, user_id } = req.body;

    // Validate required fields
    if (!order_number || !user_id) {
      return res.status(400).json({
        success: false,
        message: "Order number and user ID are required"
      });
    }

    // Trim and validate order number
    const trimmedOrderNumber = order_number.toString().trim();
    if (trimmedOrderNumber.length < 3) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid order number"
      });
    }

    console.log(`🔍 Checking order existence for user ${user_id}, order: ${trimmedOrderNumber}`);

    // Check if order exists for this user with the provided order number
    const [orders] = await db.execute(
      `SELECT o.id 
       FROM orders o
       WHERE o.user_id = ? AND o.order_number = ?`,
      [user_id, trimmedOrderNumber]
    );

    if (orders.length === 0) {
      console.log(`❌ Order not found for user ${user_id}, order: ${trimmedOrderNumber}`);
      return res.status(401).json({
        success: false,
        message: "Order not found. Please check your order number and try again."
      });
    }

    const order = orders[0];
    console.log(`✅ Order found: ${trimmedOrderNumber} with ID: ${order.id}`);

    // Order exists - return only the order ID
    res.status(200).json({
      success: true,
      message: "Order found successfully",
      order_id: order.id
    });

  } catch (err) {
    console.error("❌ Error checking order existence:", err);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later."
    });
  }
};

// Get loyalty rewards for a user
export const getLoyaltyRewards = async (req, res) => {
  try {
    const user_id = req.query.user_id;
    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Get all delivered orders for the user
    const [orders] = await db.execute(
      `SELECT o.id, o.final_price, o.created_at
       FROM orders o
       WHERE o.user_id = ? AND o.status = 'Delivered'
       ORDER BY o.created_at DESC`,
      [user_id]
    );

    // Get all unique products ordered by the user
    const [uniqueProducts] = await db.execute(
      `SELECT DISTINCT oi.product_id
       FROM order_items oi
       INNER JOIN orders o ON oi.order_id = o.id
       WHERE o.user_id = ? AND o.status = 'Delivered'`,
      [user_id]
    );

    // Calculate metrics
    const totalOrders = orders.length;
    const totalSpend = orders.reduce((sum, order) => sum + parseFloat(order.final_price || 0), 0);
    const uniqueItemsTried = uniqueProducts.length;

    // Calculate lunch and dinner orders
    let lunchOrders = 0;
    let dinnerOrders = 0;

    orders.forEach((order) => {
      const orderDate = new Date(order.created_at);
      const hour = orderDate.getHours();

      // Lunch: 11 AM - 3 PM (11-15)
      if (hour >= 11 && hour < 15) {
        lunchOrders++;
      }
      // Dinner: 6 PM - 10 PM (18-22)
      else if (hour >= 18 && hour < 22) {
        dinnerOrders++;
      }
    });

    // Calculate loyalty points
    // Base points: 10 points per order
    const orderPoints = totalOrders * 10;

    // Spend points: 1 point per 10 MAD spent
    const spendPoints = Math.floor(totalSpend / 10);

    // Unique items points: 5 points per unique item
    const uniqueItemsPoints = uniqueItemsTried * 5;

    // Timing bonus: 2 points per lunch/dinner order
    const timingBonus = (lunchOrders + dinnerOrders) * 2;

    // Total points
    const totalPoints = orderPoints + spendPoints + uniqueItemsPoints + timingBonus;

    // Calculate tier/level
    let tier = 'Bronze';
    let nextTier = 'Silver';
    let pointsToNextTier = 500 - totalPoints;

    if (totalPoints >= 1000) {
      tier = 'Gold';
      nextTier = 'Platinum';
      pointsToNextTier = 2000 - totalPoints;
    } else if (totalPoints >= 500) {
      tier = 'Silver';
      nextTier = 'Gold';
      pointsToNextTier = 1000 - totalPoints;
    }

    // Calculate progress percentage to next tier
    let progressPercentage = 0;
    if (tier === 'Bronze') {
      progressPercentage = (totalPoints / 500) * 100;
    } else if (tier === 'Silver') {
      progressPercentage = ((totalPoints - 500) / 500) * 100;
    } else if (tier === 'Gold') {
      progressPercentage = ((totalPoints - 1000) / 1000) * 100;
    } else {
      progressPercentage = 100;
    }

    res.status(200).json({
      success: true,
      loyalty: {
        totalPoints,
        tier,
        nextTier,
        pointsToNextTier: pointsToNextTier > 0 ? pointsToNextTier : 0,
        progressPercentage: Math.min(progressPercentage, 100),
        stats: {
          totalOrders,
          totalSpend: totalSpend.toFixed(2),
          uniqueItemsTried,
          lunchOrders,
          dinnerOrders,
        },
        breakdown: {
          orderPoints,
          spendPoints,
          uniqueItemsPoints,
          timingBonus,
        },
      },
    });
  } catch (err) {
    console.error("❌ Error fetching loyalty rewards:", err);
    res.status(500).json({ message: "Failed to fetch loyalty rewards" });
  }
};

// Submit order rating
export const submitOrderRating = async (req, res) => {
  try {
    // 1. Get user_id from the token (attached by verifyToken middleware)
    const user_id = req.userId; 
    
    // 2. Get the rest from req.body (removed user_id from here)
    const { order_id, food_quality, delivery_service, comment } = req.body;

    // Validation (Updated to check user_id from token)
    if (!order_id || !user_id || !food_quality || !delivery_service) {
      return res.status(400).json({
        success: false,
        message: "Order ID, Food Quality, and Delivery Service are required"
      });
    }

    // Validate ratings are between 1 and 5
    if (food_quality < 1 || food_quality > 5 || delivery_service < 1 || delivery_service > 5) {
      return res.status(400).json({
        success: false,
        message: "Ratings must be between 1 and 5"
      });
    }

    // Verify order belongs to the user from the token and is delivered
    const [orders] = await db.execute(
      `SELECT id, status FROM orders WHERE id = ? AND user_id = ?`,
      [order_id, user_id]
    );

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Order not found or you are not authorized to rate this order"
      });
    }

    if (orders[0].status !== 'Delivered') {
      return res.status(400).json({
        success: false,
        message: "You can only rate delivered orders"
      });
    }

    // Check if rating already exists
    const [existingRatings] = await db.execute(
      `SELECT id FROM order_ratings WHERE order_id = ?`,
      [order_id]
    );

    if (existingRatings.length > 0) {
      // Update existing rating
      await db.execute(
        `UPDATE order_ratings 
         SET food_quality = ?, delivery_service = ?, comment = ?, updated_at = CURRENT_TIMESTAMP
         WHERE order_id = ?`,
        [food_quality, delivery_service, comment || null, order_id]
      );

      res.status(200).json({
        success: true,
        message: "Rating updated successfully",
      });
    } else {
      // Insert new rating
      await db.execute(
        `INSERT INTO order_ratings (order_id, user_id, food_quality, delivery_service, comment)
         VALUES (?, ?, ?, ?, ?)`,
        [order_id, user_id, food_quality, delivery_service, comment || null]
      );

      res.status(201).json({
        success: true,
        message: "Rating submitted successfully",
      });
    }
  } catch (err) {
    console.error("❌ Error submitting rating:", err);
    res.status(500).json({
      success: false,
      message: "Failed to submit rating"
    });
  }
};

export const updateOrderRating = async (req, res) => {
  try {
    const user_id = req.userId; // From verifyToken
    const { order_id, food_quality, delivery_service, comment } = req.body;

    // 1. Validation
    if (!order_id) {
      return res.status(400).json({ success: false, message: "Order ID is required" });
    }

    // 2. Verify that this rating actually exists and belongs to this user
    // We join with the orders table to ensure the user owns the rating they are trying to edit
    const [existing] = await db.execute(
      `SELECT r.id FROM order_ratings r
       JOIN orders o ON r.order_id = o.id
       WHERE r.order_id = ? AND o.user_id = ?`,
      [order_id, user_id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Rating not found or you don't have permission to edit it"
      });
    }

    // 3. Execute Update
    // We use COALESCE to keep old values if new ones aren't provided in the request
    await db.execute(
      `UPDATE order_ratings 
       SET food_quality = COALESCE(?, food_quality), 
           delivery_service = COALESCE(?, delivery_service), 
           comment = ?, 
           updated_at = CURRENT_TIMESTAMP
       WHERE order_id = ?`,
      [food_quality || null, delivery_service || null, comment || null, order_id]
    );

    res.status(200).json({
      success: true,
      message: "Rating updated successfully"
    });

  } catch (err) {
    console.error("❌ Error updating rating:", err);
    res.status(500).json({ success: false, message: "Server error during update" });
  }
};

// cancel order
export const cancelOrderByClient = async (req, res) => {
    // Assuming the order ID comes from the URL parameters
    const { orderId } = req.params; 
    // clientId extracted from verifyToken middleware
    const clientId = req.clientId || req.userId; 

    try {
        // 1. Fetch only if the order belongs to this client
        const [rows] = await db.execute(
            'SELECT status, created_at FROM orders WHERE id = ? AND user_id = ?', 
            [orderId, clientId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: "Order not found or unauthorized." });
        }

        const order = rows[0];
        const THREE_MINUTES_IN_MS = 3 * 60 * 1000;
        const now = new Date();
        const createdAt = new Date(order.created_at);
        const timePassed = now - createdAt;

        // 2. Status Validation 
        // Logic: Cannot cancel if status is Preparing, OutForDelivery, or Delivered
        const restrictedStatuses = ['Preparing', 'OutForDelivery', 'Delivered', 'Cancelled'];
        
        if (restrictedStatuses.includes(order.status)) {
            return res.status(400).json({ 
                message: `Cannot cancel: Order is already ${order.status}.` 
            });
        }

        // 3. Time Validation (3-minute rule)
        if (timePassed > THREE_MINUTES_IN_MS) {
            return res.status(400).json({ 
                message: "The 3-minute cancellation window has passed." 
            });
        }

        // 4. Update Status to 'Cancelled'
        await db.execute(
            'UPDATE orders SET status = "Cancelled" WHERE id = ?', 
            [orderId]
        );

        return res.status(200).json({ 
            success: true, 
            message: "Your order has been cancelled." 
        });

    } catch (error) {
        console.error("Cancellation Error:", error);
        return res.status(500).json({ message: "Internal server error." });
    }
};


// get orders money saving
export const getMoneySavingStats = async (req, res) => {
  try {
    // Get user_id from the token (set by verifyToken middleware)
    const user_id = req.userId;
    
    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Query to fetch orders with restaurant names - MySQL uses ? instead of $1
    const query = `
      SELECT 
        o.order_number,
        o.final_price_before_zesty,
        o.final_price,
        o.created_at,
        r.name as restaurant_name
      FROM orders o
      INNER JOIN restaurants r ON o.restaurant_id = r.id
      WHERE o.user_id = ?
      AND o.status = 'Delivered'  -- Only consider delivered orders for savings stats
      ORDER BY o.created_at DESC
    `;

    const [rows] = await pool.query(query, [user_id]); // MySQL returns [rows, fields]

    // Calculate statistics
    const orders = rows;
    
    // Calculate total savings (sum of final_price_before_zesty - final_price)
    const totalSavings = orders.reduce((sum, order) => {
      const savings = parseFloat(order.final_price_before_zesty) - parseFloat(order.final_price);
      return sum + (savings > 0 ? savings : 0);
    }, 0);

    return res.status(200).json({
      success: true,
      data: {
        orders,
        summary: {
          totalOrders: orders.length,
          totalSavings: parseFloat(totalSavings.toFixed(2))
        }
      }
    });

  } catch (error) {
    console.error("Error fetching money saving stats:", error);
    return res.status(500).json({ 
      success: false,
      message: "Failed to fetch money saving statistics" 
    });
  }
};