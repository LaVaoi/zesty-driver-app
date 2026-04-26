import pool from "../config/db.js";

// Get all active promo codes
export const getPromoCodes = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const now = new Date();
    
    // No need for restaurant_id validation - return all active promo codes
    let query = `
      SELECT 
        pc.id, pc.code, pc.title, pc.description, pc.discount_type, 
        pc.discount_value, pc.min_order_amount, pc.max_discount, 
        pc.valid_from, pc.valid_until, pc.usage_limit, pc.used_count, 
        pc.is_active, pc.badge, pc.color, pc.restaurant_id,
        r.name as restaurant_name
      FROM promo_codes pc
      INNER JOIN restaurants r ON pc.restaurant_id = r.id
      WHERE pc.is_active = TRUE
        AND pc.valid_from <= ?
        AND pc.valid_until >= ?
      ORDER BY pc.created_at DESC
    `;

    const queryParams = [now, now];

    const [promoCodes] = await connection.execute(query, queryParams);

    console.log('Fetched promo codes:', promoCodes); // Debug log
    connection.release();

    // Format the response
    const formattedCodes = promoCodes.map((code) => ({
      id: code.id.toString(),
      code: code.code,
      title: code.title,
      description: code.description,
      badge: code.badge || (code.discount_type === 'percentage' 
        ? `${code.discount_value}%` 
        : code.discount_type === 'free_delivery'
        ? 'Free Delivery'
        : `${code.discount_value} MAD`),
      color: code.color,
      minOrder: parseFloat(code.min_order_amount),
      validUntil: new Date(code.valid_until).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      discountType: code.discount_type,
      discountValue: parseFloat(code.discount_value),
      maxDiscount: code.max_discount ? parseFloat(code.max_discount) : null,
      usageLimit: code.usage_limit,
      usedCount: code.used_count,
      restaurantId: code.restaurant_id,
      restaurantName: code.restaurant_name,
    }));

    res.json({ 
      success: true, 
      promoCodes: formattedCodes,
      count: formattedCodes.length
    });

  } catch (error) {
    console.error("Error fetching promo codes:", error);
    if (connection) connection.release();
    res.status(500).json({ 
      success: false, 
      message: "Server error" 
    });
  }
};

// Validate and apply promo code
export const validatePromoCode = async (req, res) => {
  let connection;
  try {
    const { code, subtotal, restaurantId } = req.body;

    if (!code) {
      return res.status(400).json({ 
        success: false, 
        message: "Promo code is required" 
      });
    }

    if (!subtotal || subtotal <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid subtotal amount" 
      });
    }

    if (!restaurantId) {
      return res.status(400).json({ 
        success: false, 
        message: "Restaurant ID is required" 
      });
    }

    connection = await pool.getConnection();
    const now = new Date();

    // Find the promo code with restaurant join
    const [codes] = await connection.execute(
      `SELECT 
        pc.id, pc.code, pc.title, pc.discount_type, pc.discount_value,
        pc.min_order_amount, pc.max_discount, pc.valid_from, pc.valid_until,
        pc.usage_limit, pc.used_count, pc.is_active, pc.restaurant_id,
        r.name as restaurant_name
      FROM promo_codes pc
      INNER JOIN restaurants r ON pc.restaurant_id = r.id
      WHERE pc.code = ? AND pc.is_active = TRUE`,
      [code.toUpperCase()]
    );

    if (codes.length === 0) {
      connection.release();
      return res.status(404).json({ 
        success: false, 
        message: "Invalid promo code" 
      });
    }

    const promoCode = codes[0];

    // Check if the promo code belongs to the restaurant using ID
    if (parseInt(promoCode.restaurant_id) !== parseInt(restaurantId)) {
      connection.release();
      return res.status(400).json({ 
        success: false, 
        message: `This promo code is only valid at ${promoCode.restaurant_name}`,
        restaurantId: promoCode.restaurant_id,
      });
    }

    // Check if code is valid (date range)
    if (new Date(promoCode.valid_from) > now || new Date(promoCode.valid_until) < now) {
      connection.release();
      return res.status(400).json({ 
        success: false, 
        message: "This promo code has expired" 
      });
    }

    // Check usage limit
    if (promoCode.usage_limit && promoCode.used_count >= promoCode.usage_limit) {
      connection.release();
      return res.status(400).json({ 
        success: false, 
        message: "This promo code has reached its usage limit" 
      });
    }

    // Check minimum order amount
    if (parseFloat(promoCode.min_order_amount) > subtotal) {
      connection.release();
      return res.status(400).json({ 
        success: false, 
        message: `Minimum order amount is ${promoCode.min_order_amount} MAD` 
      });
    }

    // Calculate discount
    let discountAmount = 0;
    if (promoCode.discount_type === 'percentage') {
      discountAmount = (subtotal * parseFloat(promoCode.discount_value)) / 100;
      if (promoCode.max_discount && discountAmount > parseFloat(promoCode.max_discount)) {
        discountAmount = parseFloat(promoCode.max_discount);
      }
    } else if (promoCode.discount_type === 'fixed') {
      discountAmount = parseFloat(promoCode.discount_value);
      if (discountAmount > subtotal) {
        discountAmount = subtotal;
      }
    } else if (promoCode.discount_type === 'free_delivery') {
      // This will be handled on the frontend (delivery fee = 0)
      discountAmount = 0;
    }

    // Increment usage count
    await connection.execute(
      `UPDATE promo_codes SET used_count = used_count + 1 WHERE id = ?`,
      [promoCode.id]
    );

    connection.release();

    res.json({
      success: true,
      promoCode: {
        id: promoCode.id,
        code: promoCode.code,
        title: promoCode.title,
        discountType: promoCode.discount_type,
        discountValue: parseFloat(promoCode.discount_value),
        discountAmount: discountAmount,
        maxDiscount: promoCode.max_discount ? parseFloat(promoCode.max_discount) : null,
        restaurantId: promoCode.restaurant_id,
        restaurantName: promoCode.restaurant_name,
      },
    });

  } catch (error) {
    console.error("Error validating promo code:", error);
    if (connection) {
      connection.release();
    }
    res.status(500).json({ 
      success: false, 
      message: "Server error" 
    });
  }
};

export const getAllOffers = async (req, res) => {
  try {
    // Get user ID from query parameters (sent from frontend)
    const userId = req.query.userId;
    console.log('🔍 User ID in getAllOffers:', userId); // Debug log

    const query = `
      SELECT 
        o.*,
        op.product_id,
        op.limited_use,
        op.times_used,
        p.name as product_name,
        p.price as product_price,
        p.image as product_image,
        c.name as product_category,
        p.description as product_description,
        ${userId ? `EXISTS(
          SELECT 1 FROM offer_usages ou 
          WHERE ou.offer_id = o.id AND ou.user_id = ?
        ) as is_applied_by_user` : 'FALSE as is_applied_by_user'}
      FROM offers o
      LEFT JOIN offer_products op ON o.id = op.offer_id
      LEFT JOIN products p ON op.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      -- START OF ADDED CONDITION TO EXCLUDE INACTIVE/EXPIRED OFFERS
      WHERE o.is_active = TRUE
        AND o.start_at <= NOW() 
        AND o.end_at > NOW()
      -- END OF ADDED CONDITION
      ORDER BY o.created_at DESC
    `;

    // Use userId in query parameters if it exists
    const [results] = userId 
      ? await pool.query(query, [userId])
      : await pool.query(query);

    // Group products by offer
    const offersMap = new Map();

    results.forEach(row => {
      const offerId = row.id;
      
      if (!offersMap.has(offerId)) {
        offersMap.set(offerId, {
          id: row.id,
          name: row.name,
          discount_type: row.discount_type,
          discount: parseFloat(row.discount),
          image: row.image,
          description: row.description,
          start_at: row.start_at,
          end_at: row.end_at,
          is_active: Boolean(row.is_active),
          is_applied_by_user: Boolean(row.is_applied_by_user), // Track if user applied this offer
          created_at: row.created_at,
          updated_at: row.updated_at,
          products: []
        });
      }

      // Add product if it exists
      if (row.product_id) {
        const offer = offersMap.get(offerId);
        offer.products.push({
          product_id: row.product_id,
          product_name: row.product_name,
          product_price: parseFloat(row.product_price),
          product_image: row.product_image,
          product_category: row.product_category,
          product_description: row.product_description,
          limited_use: row.limited_use,
          times_used: row.times_used,
          remaining_uses: row.limited_use ? row.limited_use - row.times_used : null,
          is_available: row.limited_use ? row.times_used < row.limited_use : true
        });
      }
    });

    const offers = Array.from(offersMap.values());

    res.json({
      success: true,
      offers: offers,
      total: offers.length,
      user_authenticated: !!userId // Debug info
    });

  } catch (error) {
    console.error('Error fetching offers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch offers'
    });
  }
};

// offers
export const applyOfferToAllProducts = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { offerId, userId } = req.body;

    // 1. Validate offer exists and is active
    const [offers] = await connection.execute(`
      SELECT o.* FROM offers o
      WHERE o.id = ? 
      AND o.is_active = TRUE 
      AND o.start_at <= NOW() 
      AND o.end_at > NOW()
    `, [offerId]);

    if (offers.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Offer not found or expired'
      });
    }

    const offer = offers[0];

    // 2. Get all products in this offer
    const [offerProducts] = await connection.execute(`
      SELECT op.*, p.name as product_name, p.price, p.image, c.name as category_name
      FROM offer_products op
      JOIN products p ON op.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE op.offer_id = ? AND p.active = TRUE
    `, [offerId]);

    if (offerProducts.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'No products available in this offer'
      });
    }

    const appliedProducts = [];
    const failedProducts = [];

    // 3. Apply offer to each available product
    for (const offerProduct of offerProducts) {
      // Check usage limit
      if (offerProduct.limited_use && offerProduct.times_used >= offerProduct.limited_use) {
        failedProducts.push({
          product_id: offerProduct.product_id,
          product_name: offerProduct.product_name,
          reason: 'Usage limit reached'
        });
        continue;
      }

      // Check if user already applied this offer to this product
      const [existingUsage] = await connection.execute(`
        SELECT * FROM offer_usages 
        WHERE user_id = ? AND offer_id = ? AND product_id = ?
      `, [userId, offerId, offerProduct.product_id]);

      if (existingUsage.length > 0) {
        failedProducts.push({
          product_id: offerProduct.product_id,
          product_name: offerProduct.product_name,
          reason: 'Already applied'
        });
        continue;
      }

      // Apply offer to this product
      await connection.execute(`
        INSERT INTO offer_usages (user_id, offer_id, product_id) 
        VALUES (?, ?, ?)
      `, [userId, offerId, offerProduct.product_id]);

      const discountedPrice = calculateDiscountedPrice(parseFloat(offerProduct.price), offer);

      appliedProducts.push({
        product_id: offerProduct.product_id,
        product_name: offerProduct.product_name,
        product_image: offerProduct.image,
        product_category: offerProduct.category_name,
        original_price: parseFloat(offerProduct.price),
        final_price: discountedPrice,
        discount_amount: parseFloat(offerProduct.price) - discountedPrice
      });
    }

    // If no products could be applied
    if (appliedProducts.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Could not apply offer to any products. All products may have reached their usage limits or you have already applied them.',
        data: {
          failed_products: failedProducts
        }
      });
    }

    await connection.commit();

    res.json({
      success: true,
      message: `🎉 Offer applied successfully! You can now enjoy discounts on ${appliedProducts.length} products.`,
      data: {
        offer: {
          id: offer.id,
          name: offer.name,
          discount_type: offer.discount_type,
          discount: parseFloat(offer.discount)
        },
        applied_products: appliedProducts,
        failed_products: failedProducts,
        total_applied: appliedProducts.length,
        total_failed: failedProducts.length
      }
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error applying offer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to apply offer. Please try again.'
    });
  } finally {
    connection.release();
  }
};

// Helper function to calculate discounted price
const calculateDiscountedPrice = (originalPrice, offer) => {
  switch (offer.discount_type) {
    case 'percentage':
      return originalPrice * (1 - parseFloat(offer.discount) / 100);
    case 'fixed':
      return Math.max(0, originalPrice - parseFloat(offer.discount));
    case 'free_delivery':
      return originalPrice;
    default:
      return originalPrice;
  }
};
