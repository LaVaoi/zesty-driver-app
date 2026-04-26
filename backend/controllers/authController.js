import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { default as db, default as pool } from "../config/db.js"; // adjust to your DB connection file
import { sendVerificationSMS } from '../utils/smsService.js'; // Add .js extension

export const register = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    // 🧩 1. Cleanup: Treat empty strings/whitespace as real NULL
    const cleanEmail = (email && email.trim() !== "") ? email.trim() : null;

    // 🧩 2. Validation
    if (!name || !password || !password.trim() || !phone) {
      return res.status(400).json({ message: "Name, password, and phone are required" });
    }

    // 🧩 3. Check for existing account
    if (cleanEmail) {
      const [existingEmail] = await db.execute("SELECT * FROM clients WHERE email = ?", [cleanEmail]);
      if (existingEmail.length > 0) {
        return res.status(409).json({ message: "Email already registered" });
      }
    }

    const [existingPhone] = await db.execute("SELECT * FROM clients WHERE phone = ?", [phone]);
    if (existingPhone.length > 0) {
      return res.status(409).json({ message: "Phone number already registered" });
    }

    // 🧩 4. Hash password and Insert
    const hashedPassword = await bcrypt.hash(password.trim(), 10);
    
    const [result] = await db.execute(
      "INSERT INTO clients (name, email, password, phone, is_verified) VALUES (?, ?, ?, ?, ?)",
      [name, cleanEmail, hashedPassword, phone, 1]
    );

    const newClientId = result.insertId;

    // 🧩 5. Auto-Login: Generate JWT (Matches your login logic)
    const token = jwt.sign(
      { id: newClientId, email: cleanEmail, name: name },
      process.env.JWT_SECRET,
      { expiresIn: "36500d" } // Permanent login
    );

    // 🧩 6. Final Response (Matches login response structure)
    res.status(201).json({
      message: "Registration successful",
      client: {
        id: newClientId,
        name: name,
        email: cleanEmail,
        phone: phone,
        gender: null,
        bio: null,
        image: null,
        isPhoneVerified: 0,
        lat: null, 
        lon: null,
        full_address: null,
      },
      token,
    });

  } catch (error) {
    console.error("❌ Register error:", error);
    res.status(500).json({ message: "Server error" });
  }
};


export const verifyEmail = async (req, res) => {
  let connection;
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ message: "Email and code are required" });
    }

    // Get a connection from the pool
    connection = await pool.getConnection();

    // Check if user exists
    const [user] = await connection.execute(
      "SELECT * FROM clients WHERE email = ?",
      [email]
    );

    if (user.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const client = user[0];

    // Compare codes
    if (client.verification_code !== String(code)) {
      return res.status(400).json({ message: "Invalid verification code" });
    }

    // Mark email as verified
    await connection.execute(
      "UPDATE clients SET is_verified = ?, verification_code = NULL WHERE email = ?",
      [1, email]
    );

    res.status(200).json({ message: "Email verified successfully" });
  } catch (error) {
    console.error("Error verifying email:", error);
    res.status(500).json({ message: "Server error verifying email" });
  } finally {
    if (connection) connection.release(); // always release the connection
  }
};

export const login = async (req, res) => {
  let connection;
  try {
    const { email, password } = req.body;

    // 🧩 1. Validate input
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    connection = await pool.getConnection();

    // 🧩 2. Check if it's an admin login
    const [adminRows] = await connection.execute(
      "SELECT * FROM admins WHERE email = ? AND is_active = 1",
      [email]
    );

    if (adminRows.length > 0) {
      const admin = adminRows[0];
      const isMatch = await bcrypt.compare(password, admin.password);
      if (!isMatch) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const token = jwt.sign(
        { id: admin.id, email: admin.email, name: admin.name, role: admin.role || 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: "36500d" }
      );

      const tokenExpiresAt = new Date();
      tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 7);

      await connection.execute(
        `UPDATE admins SET last_login = NOW(), api_token = ?, token_expires_at = ? WHERE id = ?`,
        [token, tokenExpiresAt, admin.id]
      );

      return res.status(200).json({
        message: "Admin login successful",
        admin: { email: admin.email, id: admin.id },
        token,
      });
    }

    // 🧩 3. Client Login: Query basic info JOINED with default address
    const [rows] = await connection.execute(
      `SELECT 
        c.id, c.name, c.email, c.phone, c.password, 
        c.gender, c.bio, c.image, c.isPhoneVerified,
        a.lat as addr_lat, 
        a.lon as addr_lon, 
        a.full_address 
       FROM clients c
       LEFT JOIN addresses a ON c.id = a.user_id AND a.is_default = 1
       WHERE c.email = ?`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "No account found with this email" });
    }

    const client = rows[0];

    // 🧩 4. Compare passwords
    const isMatch = await bcrypt.compare(password, client.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // 🧩 5. Generate JWT
    const token = jwt.sign(
      { id: client.id, email: client.email, name: client.name },
      process.env.JWT_SECRET,
      { expiresIn: "36500d" }
    );

    // 🧩 6. Final Response
    return res.status(200).json({
      message: "Login successful",
      client: {
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        gender: client.gender,
        bio: client.bio,
        image: client.image,
        isPhoneVerified: client.isPhoneVerified,
        // Location data from the joined addresses table
        lat: client.addr_lat || null, 
        lon: client.addr_lon || null,
        full_address: client.full_address || null,
      },
      token,
    });

  } catch (error) {
    console.error("❌ Login error:", error.message);
    return res.status(500).json({ message: "Server error during login" });
  } finally {
    if (connection) connection.release();
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    // Check if client exists
    const [rows] = await pool.query("SELECT * FROM clients WHERE email = ?", [email]);
    if (rows.length === 0) {
      return res.status(404).json({ message: "No user found with this email." });
    }

    const client = rows[0];

    // Check if a reset code is already active and not expired
    if (client.resetPasswordExpire && new Date(client.resetPasswordExpire) > new Date()) {
      return res.status(200).json({
        message: "A reset code has already been sent. Please check your email.",
        success: true,
        resetOnProcess: true, // ✅ flag to indicate an active reset
        email: client.email,   // you can pass the email to redirect
      });
    }

    // Generate a 6-digit numeric code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString(); // e.g., "654321"
    const resetCodeExpire = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now

    // Save code and expiry in DB
    await pool.query(
      "UPDATE clients SET resetPasswordCode = ?, resetPasswordExpire = ? WHERE id = ?",
      [resetCode, resetCodeExpire, client.id]
    );

    // Send email using Nodemailer
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"Your App Name" <${process.env.EMAIL_USER}>`,
      to: client.email,
      subject: "Password Reset Code",
      text: `Your password reset code is: ${resetCode}. It is valid for 15 minutes.`,
      html: `<p>Your password reset code is:</p>
             <h2>${resetCode}</h2>
             <p>This code is valid for 15 minutes.</p>`,
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({
      message: "Password reset code sent to your email.",
      success: true,
      resetOnProcess: false, // ✅ new request sent
      email: client.email,
    });

  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({ message: "Server error." });
  }
};

export const resetPassword = async (req, res) => {
  let connection;
  try {
    const { email, code, password } = req.body;
    if (!email || !code || !password) {
      return res.status(400).json({ message: "Email, code, and new password are required." });
    }

    connection = await pool.getConnection();

    // 🧩 1. Query: Get client basic info, reset fields, AND JOIN with default address
    const [rows] = await connection.execute(
      `SELECT 
        c.id, c.name, c.email, c.phone, c.password, 
        c.gender, c.bio, c.image, c.isPhoneVerified,
        c.resetPasswordCode, c.resetPasswordExpire,
        a.lat as addr_lat, 
        a.lon as addr_lon, 
        a.full_address 
       FROM clients c
       LEFT JOIN addresses a ON c.id = a.user_id AND a.is_default = 1
       WHERE c.email = ?`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "No user found with this email." });
    }

    const client = rows[0];

    // 🧩 2. Check if code matches and is not expired
    if (
      !client.resetPasswordCode ||
      client.resetPasswordCode !== code ||
      !client.resetPasswordExpire ||
      new Date(client.resetPasswordExpire) < new Date()
    ) {
      return res.status(400).json({ message: "Invalid or expired reset code." });
    }

    // 🧩 3. Hash the new password
    const hashedPassword = await bcrypt.hash(password.trim(), 10);

    // 🧩 4. Update password and clear reset fields
    await connection.execute(
      "UPDATE clients SET password = ?, resetPasswordCode = NULL, resetPasswordExpire = NULL WHERE id = ?",
      [hashedPassword, client.id]
    );

    // 🧩 5. Generate JWT token
    const token = jwt.sign(
      { id: client.id, email: client.email, name: client.name },
      process.env.JWT_SECRET,
      { expiresIn: "36500d" }
    );

    // 🧩 6. Final Response (Same structure as login)
    return res.status(200).json({
      success: true,
      message: "Password has been reset successfully and you are logged in.",
      client: {
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        gender: client.gender,
        bio: client.bio,
        image: client.image,
        isPhoneVerified: client.isPhoneVerified,
        // Location data from addresses table
        lat: client.addr_lat || null,
        lon: client.addr_lon || null,
        full_address: client.full_address || null,
      },
      token,
    });
  } catch (error) {
    console.error("❌ Reset password error:", error.message);
    return res.status(500).json({ message: "Server error." });
  } finally {
    if (connection) connection.release();
  }
};

export const getCategories = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, name, image, description, created_at FROM categories ORDER BY created_at DESC"
    );
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching categories:", error.message);
    res.status(500).json({ message: "Failed to fetch categories" });
  }
};

export const getProducts = async (req, res) => {
  try {
    const connection = await pool.getConnection();

    const [rows] = await connection.query(`
      SELECT 
        p.id, 
        p.name, 
        p.description, 
        p.price, 
        p.rating, 
        p.image, 
        p.delivery,
        p.promo, 
        p.promoValue,
        p.badge,
        p.is_popular,
        p.created_at,
        c.name AS category_name
      FROM products p
      JOIN categories c ON p.category_id = c.id
      ORDER BY p.created_at DESC
    `);

    connection.release();

    // ✅ SANITIZE + NORMALIZE OUTPUT
    const safeProducts = rows.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description || "",
      price: Number(p.price) || 0,
      rating: Number(p.rating) || 0,
      image: p.image || "",
      delivery: p.delivery || "",
      promo: p.promo === 1 || p.promo === true,  // force boolean
      promoValue: Number(p.promoValue) || 0,
      badge: p.badge || "",
      is_popular: p.is_popular === 1 || p.is_popular === true,  // force boolean
      created_at: p.created_at,
      category_name: p.category_name || "",
    }));
    
    const [results] = await db.execute(
      `SELECT restaurant_name from restaurant_settings`,
    );

    const restaurant_name = results[0]?.restaurant_name || 'Restaurant';

    res.json({safeProducts: safeProducts, restaurant_name: restaurant_name});

  } catch (error) {
    console.error("❌ Error fetching products:", error.message);
    res.status(500).json({ message: "Server error while fetching products" });
  }
};


export const deliveryManLogin = async (req, res) => {
  let connection;
  try {
    const { email, password } = req.body;
    // 🧩 1. Validate input
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }
    // 🧩 2. Get a connection
    connection = await pool.getConnection();
    // 🧩 3. Check if delivery man exists
    const [rows] = await connection.execute(
      "SELECT * FROM delivery_men WHERE email = ?",
      [email]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "No account found with this email" });
    }
    const deliveryMan = rows[0];
    // 🧩 4. Check if account is active
    if (!deliveryMan.is_active) {
      return res.status(403).json({
        message: "Your account has been deactivated. Please contact support.",
      });
    }
    // 🧩 5. Compare passwords securely
    const isMatch = await bcrypt.compare(password, deliveryMan.password);
    if (!isMatch) {
      connection.release();
      return res.status(401).json({ message: "Invalid email or password" });
    }
    
    // 🧩 5.5. Update last_login
    await connection.execute(
      "UPDATE delivery_men SET last_login = NOW() WHERE id = ?",
      [deliveryMan.id]
    );
    
    // 🧩 6. Generate JWT token
    const token = jwt.sign(
      {
        id: deliveryMan.id,
        email: deliveryMan.email,
        name: deliveryMan.name,
      },
      process.env.JWT_SECRET,
      { expiresIn: "36500d" } // you can adjust expiration
    );
    // 🧩 7. Send response
    return res.status(200).json({
      message: "Login successful",
      deliveryMan: {
        id: deliveryMan.id,
        name: deliveryMan.name,
        email: deliveryMan.email,
        phone: deliveryMan.phone,
        vehicle_type: deliveryMan.vehicle_type,
        license_number: deliveryMan.license_number,
        is_active: deliveryMan.is_active,
        current_latitude: deliveryMan.current_latitude,
        current_longitude: deliveryMan.current_longitude,
      },
      token,
    });
  } catch (error) {
    console.error("❌ Login error:", error.message);
    return res.status(500).json({ message: "Server error during login" });
  } finally {
    if (connection) connection.release();
  }
};


export const loginWithPhone = async (req, res) => {
  let connection;
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ message: "Phone number and password are required" });
    }

    connection = await pool.getConnection();

    // 🧩 3. Query: Get client basic info and JOIN with default address
    // Note: We explicitly alias a.lat and a.lon to ensure they come from 'addresses'
    const [rows] = await connection.execute(
      `SELECT 
        c.id, c.name, c.email, c.phone, c.password, 
        c.gender, c.bio, c.image, c.isPhoneVerified,
        a.lat as addr_lat, 
        a.lon as addr_lon, 
        a.full_address 
       FROM clients c
       LEFT JOIN addresses a ON c.id = a.user_id AND a.is_default = 1
       WHERE c.phone = ?`,
      [phone]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "No account found with this phone number" });
    }
    
    const client = rows[0];
    
    // 🧩 5. Compare passwords
    const isMatch = await bcrypt.compare(password, client.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid phone number or password" });
    }

    // 🧩 6. Generate JWT
    const token = jwt.sign(
      { id: client.id, email: client.email, name: client.name },
      process.env.JWT_SECRET,
      { expiresIn: "36500d" }
    );

    // 🧩 7. Final Response (Location data strictly from addresses table)
    return res.status(200).json({
      message: "Login successful",
      client: {
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        gender: client.gender,
        bio: client.bio,
        image: client.image,
        isPhoneVerified: client.isPhoneVerified,
        // These fields now only populate if a default address exists in the 'addresses' table
        lat: client.addr_lat || null, 
        lon: client.addr_lon || null,
        full_address: client.full_address || null,
      },
      token,
    });
  } catch (error) {
    console.error("❌ Login error:", error.message);
    return res.status(500).json({ message: "Server error during login" });
  } finally {
    if (connection) connection.release();
  }
};

// products with offers

export const getAllProductsWithOffers = async (req, res) => {
  let connection;
  try {
    const { page = 1, limit = 20, category_id, search, userId } = req.query;
    connection = await pool.getConnection();

    console.log('🔍 Fetching products. UserId:', userId);

    // Base query for products
    let baseQuery = `
      SELECT DISTINCT
        p.*, 
        c.name as category_name,
        c.image as category_image
      FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE p.active = TRUE AND c.active = TRUE
    `;

    const baseParams = [];
    
    if (category_id) {
      baseQuery += " AND p.category_id = ?";
      baseParams.push(category_id);
    }
    if (search) {
      baseQuery += " AND (p.name LIKE ? OR p.description LIKE ? OR c.name LIKE ?)";
      const searchTerm = `%${search}%`;
      baseParams.push(searchTerm, searchTerm, searchTerm);
    }

    baseQuery += " ORDER BY p.is_popular DESC, p.created_at DESC";

    const offset = (parseInt(page) - 1) * parseInt(limit);
    baseQuery += ` LIMIT ? OFFSET ?`;
    baseParams.push(parseInt(limit), offset);

    const [baseProducts] = await connection.execute(baseQuery, baseParams);
    console.log('✅ Total products fetched:', baseProducts.length);

    // STEP 1: If no userId, return all products normally
    if (!userId) {
      console.log('ℹ️ No userId - returning products normally');
      const simpleProducts = baseProducts.map(p => ({
        ...p,
        price: parseFloat(p.price),
        rating: parseFloat(p.rating) || 0,
        promo: Boolean(p.promo),
        is_popular: Boolean(p.is_popular),
        active: Boolean(p.active),
        has_offer: false,
        discount_applied: false,
        offer_info: null
      }));

      const [countResult] = await connection.execute(
        `SELECT COUNT(*) as total FROM products p 
         JOIN categories c ON p.category_id = c.id 
         WHERE p.active = TRUE AND c.active = TRUE`
      );

      return res.status(200).json({
        success: true,
        products: simpleProducts,
        pagination: {
          total: countResult[0].total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(countResult[0].total / parseInt(limit)),
        },
        user_context: {
          user_id: null,
          has_active_offer: false
        }
      });
    }

    // STEP 2: Check if user has an active applied offer
    console.log(`\n🔍 STEP 2: Checking if user ${userId} has an active applied offer...`);
    
    const userOfferQuery = `
      SELECT * FROM offers 
      WHERE is_active = TRUE 
        AND start_at <= NOW() 
        AND end_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `;
    
    const [userOffers] = await connection.execute(userOfferQuery, [userId]);

    // STEP 3: If no active applied offer, return products normally
    if (userOffers.length === 0) {
      console.log(`ℹ️ User ${userId} has NO active applied offers - returning products normally`);
      
      const simpleProducts = baseProducts.map(p => ({
        ...p,
        price: parseFloat(p.price),
        rating: parseFloat(p.rating) || 0,
        promo: Boolean(p.promo),
        is_popular: Boolean(p.is_popular),
        active: Boolean(p.active),
        has_offer: false,
        discount_applied: false,
        offer_info: null
      }));

      const [countResult] = await connection.execute(
        `SELECT COUNT(*) as total FROM products p 
         JOIN categories c ON p.category_id = c.id 
         WHERE p.active = TRUE AND c.active = TRUE`
      );

      return res.status(200).json({
        success: true,
        products: simpleProducts,
        pagination: {
          total: countResult[0].total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(countResult[0].total / parseInt(limit)),
        },
        user_context: {
          user_id: userId,
          has_active_offer: false
        }
      });
    }

    const appliedOffer = userOffers[0];
    
    // FIX: Use the correct column name 'discount' instead of 'discount_value'
    console.log('🔍 CORRECTED OFFER DATA:');
    console.log('Offer ID:', appliedOffer.id);
    console.log('Offer Name:', appliedOffer.name);
    console.log('Discount Type:', appliedOffer.discount_type);
    console.log('Discount Value (from "discount" column):', appliedOffer.discount);
    console.log('Discount Value Type:', typeof appliedOffer.discount);
    
    // STEP 4: Get all products included in this offer WITH their times_used
    console.log(`\n🔍 STEP 4: Getting products included in offer ${appliedOffer.id}...`);
    
    const offerProductsQuery = `
      SELECT op.product_id, op.limited_use, op.times_used
      FROM offer_products op
      JOIN products p ON op.product_id = p.id
      WHERE op.offer_id = ? AND p.active = TRUE
    `;
    const [offerProducts] = await connection.execute(offerProductsQuery, [appliedOffer.id]);
    const offerProductIds = offerProducts.map(p => p.product_id);
    
    console.log(`✅ Offer contains ${offerProductIds.length} products`);

    // STEP 6: Process all products with BOTH conditions - USING CORRECT COLUMN NAME
    console.log(`\n🔍 STEP 6: Processing products with offer logic...`);
    
    // FIX: Use the correct column name 'discount'
    let discountValue;
    if (appliedOffer.discount === null || appliedOffer.discount === undefined) {
      console.error('❌ CRITICAL: discount is NULL or UNDEFINED in database!');
      console.error('   Please check the offers table for offer ID:', appliedOffer.id);
      
      // Return products without offers due to invalid data
      console.log('⚠️ Returning products without offer due to invalid discount data');
      
      const simpleProducts = baseProducts.map(p => ({
        ...p,
        price: parseFloat(p.price),
        rating: parseFloat(p.rating) || 0,
        promo: Boolean(p.promo),
        is_popular: Boolean(p.is_popular),
        active: Boolean(p.active),
        has_offer: false,
        discount_applied: false,
        offer_info: null
      }));

      const [countResult] = await connection.execute(
        `SELECT COUNT(*) as total FROM products p 
         JOIN categories c ON p.category_id = c.id 
         WHERE p.active = TRUE AND c.active = TRUE`
      );

      return res.status(200).json({
        success: true,
        products: simpleProducts,
        pagination: {
          total: countResult[0].total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(countResult[0].total / parseInt(limit)),
        },
        user_context: {
          user_id: userId,
          has_active_offer: false,
          error: 'Invalid offer data - discount value missing'
        }
      });
    } else {
      // Parse the discount value from the correct column 'discount'
      discountValue = parseFloat(appliedOffer.discount);
      if (isNaN(discountValue)) {
        console.error('❌ CRITICAL: discount is not a valid number:', appliedOffer.discount);
        
        // Return products without offers due to invalid data
        console.log('⚠️ Returning products without offer due to invalid discount value');
        
        const simpleProducts = baseProducts.map(p => ({
          ...p,
          price: parseFloat(p.price),
          rating: parseFloat(p.rating) || 0,
          promo: Boolean(p.promo),
          is_popular: Boolean(p.is_popular),
          active: Boolean(p.active),
          has_offer: false,
          discount_applied: false,
          offer_info: null
        }));

        const [countResult] = await connection.execute(
          `SELECT COUNT(*) as total FROM products p 
           JOIN categories c ON p.category_id = c.id 
           WHERE p.active = TRUE AND c.active = TRUE`
        );

        return res.status(200).json({
          success: true,
          products: simpleProducts,
          pagination: {
            total: countResult[0].total,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(countResult[0].total / parseInt(limit)),
          },
          user_context: {
            user_id: userId,
            has_active_offer: false,
            error: 'Invalid discount value in offer'
          }
        });
      }
    }
    
    console.log(`✅ Using discount value: ${discountValue} (${appliedOffer.discount_type})`);

    const processedProducts = baseProducts.map(product => {
      const originalPrice = parseFloat(product.price);
      const isInOffer = offerProductIds.includes(product.id);
      
      // If product is NOT in offer, return it normally
      if (!isInOffer) {
        return {
          ...product, // FIX: Changed from 'p' to 'product'
          price: originalPrice,
          rating: parseFloat(product.rating) || 0,
          promo: Boolean(product.promo),
          is_popular: Boolean(product.is_popular),
          active: Boolean(product.active),
          has_offer: false,
          discount_applied: false,
          offer_info: null
        };
      }

      // Product IS in offer - check BOTH conditions
      const offerProduct = offerProducts.find(op => op.product_id === product.id);
      const maxUses = offerProduct.limited_use;
      const timesUsed = offerProduct.times_used || 0;
      
      console.log(`📍 Product ${product.id}: maxUses=${maxUses}, timesUsed=${timesUsed}, userUsageCount=${userUsageCount}`);
      
      // Check BOTH conditions:
      const globalLimitNotReached = maxUses === null || timesUsed < maxUses;
      
      const canUseOffer = globalLimitNotReached;
      
      let finalPrice = originalPrice;
      let offerInfo = null;

      // Calculate discounted price
      let calculatedDiscountedPrice = originalPrice;
      if (appliedOffer.discount_type === 'percentage') {
        calculatedDiscountedPrice = originalPrice * (1 - discountValue / 100);
      } else if (appliedOffer.discount_type === 'fixed') {
        calculatedDiscountedPrice = Math.max(0.01, originalPrice - discountValue);
      }
      calculatedDiscountedPrice = parseFloat(calculatedDiscountedPrice.toFixed(2));

      if (canUseOffer) {
        // User CAN use the offer - apply the discount
        finalPrice = calculatedDiscountedPrice;
        
        offerInfo = {
          offer_id: appliedOffer.id,
          offer_name: appliedOffer.name,
          discount_type: appliedOffer.discount_type,
          discount_value: discountValue,
          original_price: originalPrice,
          discounted_price: calculatedDiscountedPrice,
          can_use_offer: true,
          times_used: timesUsed,
          max_uses: maxUses,
          remaining_uses: maxUses ? maxUses - timesUsed : null,
          user_has_used: userUsageCount >= 1,
          user_usage_count: userUsageCount,
          valid_until: appliedOffer.end_at,
          description: appliedOffer.description
        };

        console.log(`   ✅ Discount applied: ${originalPrice} -> ${finalPrice}, discount: ${discountValue}${appliedOffer.discount_type === 'percentage' ? '%' : 'MAD'}`);
      } else {
        // User CANNOT use the offer - but still include offer info for frontend display
        finalPrice = originalPrice;
        
        let reason = '';
        if (!globalLimitNotReached) {
          reason = 'Global limit reached';
        }

        offerInfo = {
          offer_id: appliedOffer.id,
          offer_name: appliedOffer.name,
          discount_type: appliedOffer.discount_type,
          discount_value: discountValue,
          original_price: originalPrice,
          discounted_price: calculatedDiscountedPrice,
          can_use_offer: false,
          times_used: timesUsed,
          max_uses: maxUses,
          remaining_uses: maxUses ? maxUses - timesUsed : null,
          user_has_used: userUsageCount >= 1,
          user_usage_count: userUsageCount,
          valid_until: appliedOffer.end_at,
          description: appliedOffer.description,
          reason: reason
        };

        console.log(`   ❌ ${reason} (Global: ${timesUsed}/${maxUses}, User: ${userUsageCount}/1) - Showing original price: ${originalPrice}, would be: ${calculatedDiscountedPrice}`);
      }

      return {
        ...product,
        price: originalPrice,
        original_price: originalPrice,
        final_price: finalPrice,
        rating: parseFloat(product.rating) || 0,
        promo: Boolean(product.promo),
        is_popular: Boolean(product.is_popular),
        active: Boolean(product.active),
        has_offer: isInOffer,
        discount_applied: canUseOffer,
        offer_info: offerInfo
      };
    });

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM products p 
      JOIN categories c ON p.category_id = c.id 
      WHERE p.active = TRUE AND c.active = TRUE
    `;
    const countParams = [];
    
    if (category_id) {
      countQuery += " AND p.category_id = ?";
      countParams.push(category_id);
    }
    if (search) {
      countQuery += " AND (p.name LIKE ? OR p.description LIKE ? OR c.name LIKE ?)";
      const searchTerm = `%${search}%`;
      countParams.push(searchTerm, searchTerm, searchTerm);
    }

    const [countResult] = await connection.execute(countQuery, countParams);

    // Count products with active discounts
    const productsWithActiveDiscounts = processedProducts.filter(p => p.discount_applied).length;
    const productsInOfferButNoDiscount = processedProducts.filter(p => p.has_offer && !p.discount_applied).length;

    const [results] = await db.execute(
      `SELECT restaurant_name from restaurant_settings`,
    );

    const restaurant_name = results[0]?.restaurant_name || 'Restaurant';

    return res.status(200).json({
      success: true,
      products: processedProducts,
      pagination: {
        total: countResult[0].total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(countResult[0].total / parseInt(limit)),
      },
      user_context: {
        user_id: userId,
        has_active_offer: true,
        offer_details: {
          id: appliedOffer.id,
          name: appliedOffer.name,
          discount_type: appliedOffer.discount_type,
          discount_value: discountValue,
          valid_until: appliedOffer.end_at,
          total_products_in_offer: offerProductIds.length,
          available_products: productsWithActiveDiscounts,
          unavailable_products: productsInOfferButNoDiscount
        }
      },
      restaurant_name: restaurant_name
    });

  } catch (error) {
    console.error("❌ Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  } finally {
    if (connection) connection.release();
  }
};

// end products with offers

// verify client phone

const sendVerificationCode = async (req, res) => {
  const { phone } = req.body;

  console.log('📱 Controller - Phone from body:', phone);

  if (!phone) {
    return res.status(400).json({
      success: false,
      message: 'Phone number is required'
    });
  }

  try {
    const [clients] = await db.query(
      'SELECT * FROM clients WHERE phone = ?',
      [phone]
    );

    if (clients.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    const client = clients[0];
    
    console.log('🔍 Client verification status:');
    console.log('   - is_verified (email):', client.is_verified);
    console.log('   - isPhoneVerified (phone):', client.isPhoneVerified);

    if (client.isPhoneVerified) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is already verified'
      });
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    console.log('🔢 Controller - Generated code:', verificationCode);

    await db.query(
      `UPDATE clients 
       SET phoneVerificationCode = ?, 
           phoneVerificationCodeExpire = DATE_ADD(NOW(), INTERVAL 10 MINUTE)
       WHERE phone = ?`,
      [verificationCode, phone]
    );

    console.log('🚀 About to call SMS function with:');
    console.log('   - Phone:', phone);
    console.log('   - Code:', verificationCode);

    const smsSent = await sendVerificationSMS(phone, verificationCode);


    if (smsSent) {
      // FIX: Return success: true explicitly
      return res.json({
        success: true,  // ← THIS WAS MISSING
        message: 'Verification code sent successfully'
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Failed to send SMS to this carrier'
      });
    }

  } catch (error) {
    console.error('Send verification code error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send verification code'
    });
  }
};

export { sendVerificationCode };

// update the phone status for clients
export const verifyPhoneCode = async (req, res) => {
  const { clientId, code } = req.body;

  console.log("📩 Phone Verification Request:", { clientId, code });

  if (!clientId || !code) {
    return res.status(400).json({
      success: false,
      message: "Client ID and verification code are required",
    });
  }

  try {
    // Use MySQL to validate expiration, no JS date parsing
    const [clients] = await db.query(
      `SELECT 
          id, 
          phoneVerificationCode,
          phoneVerificationCodeExpire,
          isPhoneVerified,
          (phoneVerificationCodeExpire > NOW()) AS isValid
       FROM clients
       WHERE id = ?`,
      [clientId]
    );

    if (clients.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    const client = clients[0];

    // Already verified
    if (client.isPhoneVerified) {
      return res.status(400).json({
        success: false,
        message: "Phone number already verified",
      });
    }

    // Code does not match
    if (client.phoneVerificationCode !== code) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification code",
      });
    }

    // Code expired — MySQL checks it, not JS
    if (client.isValid === 0) {
      return res.status(400).json({
        success: false,
        message: "Verification code has expired",
      });
    }

    // Mark phone as verified
    await db.query(
      `UPDATE clients 
       SET isPhoneVerified = 1,
           phoneVerificationCode = NULL,
           phoneVerificationCodeExpire = NULL
       WHERE id = ?`,
      [clientId]
    );

    console.log("📱 Phone Verified Successfully for ID:", clientId);

    return res.json({
      success: true,
      message: "Phone number verified successfully",
    });

  } catch (error) {
    console.error("❌ Error verifying phone:", error);
    return res.status(500).json({
      success: false,
      message: "Server error verifying phone number",
    });
  }
};

// Get public restaurant settings
export const getRestaurantSettingsPublic = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [settings] = await connection.execute(
      `SELECT 
        id,
        restaurant_name,
        restaurant_address,
        restaurant_latitude,
        restaurant_longitude,
        phone,
        restaurant_email,
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

    if (settings.length === 0) {
      connection.release();
      return res.json({ 
        success: true,
        settings: {
          is_open: true, // Default to open if no settings exist
          restaurant_logo: '',
          restaurant_home_screen_icon: ''
        }
      });
    }

    connection.release();
    res.json({ 
      success: true,
      settings: {
        ...settings[0],
        restaurant_latitude: parseFloat(settings[0].restaurant_latitude),
        restaurant_longitude: parseFloat(settings[0].restaurant_longitude),
        base_delivery_fee: parseFloat(settings[0].base_delivery_fee),
        per_km_fee: parseFloat(settings[0].per_km_fee),
        max_delivery_distance_km: parseFloat(settings[0].max_delivery_distance_km),
        min_delivery_fee: parseFloat(settings[0].min_delivery_fee),
        max_delivery_fee: parseFloat(settings[0].max_delivery_fee),
        is_open: Boolean(settings[0].is_open),
      }
    });
  } catch (error) {
    console.error("Error fetching public restaurant settings:", error);
    if (connection) connection.release();
    res.status(500).json({ message: "Server error" });
  }
};


// homepage all data
export const getHomePageData = async (req, res) => {
    let connection;
    try {
        const { 
            category_id, 
            search, 
            userId 
        } = req.query;

        const authenticatedUser = !!userId;
        connection = await pool.getConnection();

        const productBaseParams = [];
        let productWhereClause = "WHERE p.active = TRUE AND c.active = TRUE";
        
        if (category_id) {
            productWhereClause += " AND p.category_id = ?";
            productBaseParams.push(category_id);
        }
        if (search) {
            productWhereClause += " AND (p.name LIKE ? OR p.description LIKE ? OR c.name LIKE ?)";
            const searchTerm = `%${search}%`;
            productBaseParams.push(searchTerm, searchTerm, searchTerm);
        }

        // ==================== 2. DATA FETCH ====================
        
        const productDataQuery = `
            SELECT DISTINCT
                p.*, 
                c.name as category_name,
                c.image as category_image
            FROM products p
            JOIN categories c ON p.category_id = c.id
            ${productWhereClause}
            ORDER BY p.is_popular DESC, p.created_at DESC
        `;

        const categoriesQuery = `
            SELECT id, name, image, description, created_at 
            FROM categories 
            WHERE active = TRUE
            ORDER BY created_at DESC
        `;
        
        // Using your original table 'offer_usages' with an EXISTS check
        // This is exactly how the frontend knows if the connected user applied the offer
        const offersQuery = `
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
              EXISTS(SELECT 1 FROM offer_usages ou WHERE ou.offer_id = o.id AND ou.user_id = ?) as is_applied_by_user
          FROM offers o
          LEFT JOIN offer_products op ON o.id = op.offer_id
          LEFT JOIN products p ON op.product_id = p.id
          LEFT JOIN categories c ON p.category_id = c.id
          WHERE o.is_active = TRUE
              AND o.start_at <= NOW() 
              AND o.end_at > NOW()
          ORDER BY o.created_at DESC
        `;

        const settingsQuery = `SELECT restaurant_name FROM restaurant_settings LIMIT 1`;

        const [[baseProducts], [categories], [offersResults], [settingsResults]] = await Promise.all([
            connection.execute(productDataQuery, productBaseParams),
            connection.execute(categoriesQuery),
            connection.execute(offersQuery, [userId || null]),
            connection.execute(settingsQuery)
        ]);

        const restaurantName = settingsResults[0]?.restaurant_name || 'Restaurant';

        // ==================== 3. PROCESS OFFERS MAP ====================

        const processedOffersMap = new Map();
        offersResults.forEach(row => {
            const offerId = row.id;
            
            if (!processedOffersMap.has(offerId)) {
                processedOffersMap.set(offerId, {
                    id: row.id,
                    name: row.name,
                    discount_type: row.discount_type,
                    discount: parseFloat(row.discount),
                    image: row.image,
                    description: row.description,
                    start_at: row.start_at,
                    end_at: row.end_at,
                    is_active: Boolean(row.is_active),
                    // This tells the frontend to show the "Applied" state
                    is_applied_by_user: Boolean(row.is_applied_by_user), 
                    products: []
                });
            }

            if (row.product_id) {
                const offer = processedOffersMap.get(offerId);
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
        const processedOffers = Array.from(processedOffersMap.values());

        // ==================== 4. PROCESS PRODUCTS ====================
        
        const globalOfferMap = new Map();
        offersResults.forEach(row => {
            if (row.product_id && !globalOfferMap.has(row.product_id)) {
                globalOfferMap.set(row.product_id, row);
            }
        });

        let productsWithActiveDiscounts = 0;

        let processedProducts = baseProducts.map(p => {
            const product = {
                ...p,
                price: parseFloat(p.price),
                rating: parseFloat(p.rating) || 0,
                promo: Boolean(p.promo),
                is_popular: Boolean(p.is_popular),
                active: Boolean(p.active),
                has_offer: false,
                discount_applied: false,
                offer_info: null
            };

            const offerData = globalOfferMap.get(product.id);
            if (!offerData) return product;

            const userHasApplied = Boolean(offerData.is_applied_by_user);
            const originalPrice = product.price;
            const discountValue = parseFloat(offerData.discount);
            const maxUses = offerData.limited_use;
            const timesUsed = offerData.times_used || 0;

            let calculatedPrice = originalPrice;
            if (offerData.discount_type === 'percentage') {
                calculatedPrice = originalPrice * (1 - discountValue / 100);
            } else {
                calculatedPrice = Math.max(0.01, originalPrice - discountValue);
            }
            calculatedPrice = parseFloat(calculatedPrice.toFixed(2));

            const globalLimitNotReached = maxUses === null || timesUsed < maxUses;
            
            // The price changes only if applied and the restaurant still has stock
            const canUseOffer = userHasApplied && globalLimitNotReached;

            if (canUseOffer) {
                productsWithActiveDiscounts++;
            }

            return {
                ...product,
                original_price: originalPrice,
                final_price: canUseOffer ? calculatedPrice : originalPrice,
                has_offer: true,
                discount_applied: canUseOffer,
                offer_info: {
                    offer_id: offerData.id,
                    offer_name: offerData.name,
                    discount_type: offerData.discount_type,
                    discount_value: discountValue,
                    original_price: originalPrice,
                    discounted_price: calculatedPrice,
                    can_use_offer: canUseOffer,
                    user_has_applied: userHasApplied, 
                    remaining_uses: maxUses ? maxUses - timesUsed : null,
                    valid_until: offerData.end_at,
                    reason: !userHasApplied ? 'Offer not applied' : (globalLimitNotReached ? null : 'Restaurant limit reached')
                }
            };
        });
        
        let userContext = { 
            user_id: userId, 
            has_active_offer: productsWithActiveDiscounts > 0,
            available_discounts_count: productsWithActiveDiscounts 
        };

        // ==================== 5. FINAL RESPONSE ====================
        
        res.status(200).json({
            success: true,
            restaurant_name: restaurantName,
            offers: processedOffers,
            categories: categories,
            products: processedProducts, 
            user_context: userContext
        });

    } catch (error) {
        console.error("❌ Error fetching home page data:", error);
        res.status(500).json({ success: false, message: "Failed to load home page data", error: error.message });
    } finally {
        if (connection) connection.release();
    }
};


// login with google
export const loginWithGoogle = async (req, res) => {
  let connection;
  try {
    const { idToken, email, name, photo } = req.body;

    // 🧩 1. Validate input
    if (!idToken || !email) {
      return res.status(400).json({ 
        message: "ID token and email are required" 
      });
    }

    // 🧩 2. Verify Google ID token
    const { OAuth2Client } = await import('google-auth-library');
    const client = new OAuth2Client();
    
    let ticket;
    try {
      ticket = await client.verifyIdToken({
      idToken: idToken,
      audience: [
          // CRITICAL: The NEW Web Client ID (Type 3)
          '925005686846-t5dj1p024m13u8lqvvbtadlema5slpjo.apps.googleusercontent.com',
          // The NEW Android Client ID (Type 1)
            '925005686846-c9lonjd1uq7qvi95228hdt1s6ppdlbg9.apps.googleusercontent.com', 
          // The NEW iOS Client ID (Type 2)
          '925005686846-l7g7sb6eojdcmp793mb55fbpo7l188qt.apps.googleusercontent.com' 
      ]
      });
    } catch (googleError) {
      console.error('❌ Google token verification failed:', googleError);
      return res.status(401).json({ 
        message: "Invalid Google token" 
      });
    }

    const payload = ticket.getPayload();
    
    // Verify email matches
    if (payload.email !== email) {
      return res.status(401).json({ 
        message: "Email does not match Google account" 
      });
    }

    // 🧩 3. Get database connection
    connection = await pool.getConnection();

    // 🧩 4. Check if client exists
    const [rows] = await connection.execute(
      "SELECT * FROM clients WHERE email = ?",
      [email]
    );

    let clientData;
    
    if (rows.length === 0) {
      // 🧩 5. Create new user if doesn't exist
      const generatedPassword = await bcrypt.hash(
        `google_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, 
        10
      );
      
      const [result] = await connection.execute(
        `INSERT INTO clients 
         (email, password, name, image, is_verified, google_id, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [
          email,
          generatedPassword,
          name || payload.name || email.split('@')[0],
          photo || payload.picture,
          1, // Auto-verify Google users (using your existing is_verified)
          payload.sub, // Google user ID
        ]
      );

      clientData = {
        id: result.insertId,
        email: email,
        name: name || payload.name || email.split('@')[0],
        phone: null,
        gender: null,
        bio: null,
        image: photo || payload.picture,
        isPhoneVerified: 0,
        is_verified: 1,
      };
    } else {
      // 🧩 6. User exists - update Google ID if needed
      clientData = rows[0];
      
      // Update Google ID if not set
      if (!clientData.google_id) {
        await connection.execute(
          "UPDATE clients SET google_id = ? WHERE id = ?",
          [payload.sub, clientData.id]
        );
      }
      
      // Update is_verified to 1 for Google users
      if (clientData.is_verified !== 1) {
        await connection.execute(
          "UPDATE clients SET is_verified = 1 WHERE id = ?",
          [clientData.id]
        );
        clientData.is_verified = 1;
      }
      
      // Update profile image if empty
      if (!clientData.image && (photo || payload.picture)) {
        await connection.execute(
          "UPDATE clients SET image = ? WHERE id = ?",
          [photo || payload.picture, clientData.id]
        );
        clientData.image = photo || payload.picture;
      }
    }

    // 🧩 7. Generate JWT token
    const token = jwt.sign(
      {
        id: clientData.id,
        email: clientData.email,
        name: clientData.name,
      },
      process.env.JWT_SECRET,
      { expiresIn: "36500d" }
    );

    // 🧩 8. Send response
    return res.status(200).json({
      message: "Google login successful",
      client: {
        id: clientData.id,
        name: clientData.name,
        email: clientData.email,
        phone: clientData.phone,
        gender: clientData.gender,
        bio: clientData.bio,
        image: clientData.image,
        isPhoneVerified: clientData.isPhoneVerified,
      },
      token,
      success: true
    });

  } catch (error) {
    console.error("❌ Google login error:", error.message);
    return res.status(500).json({ 
      message: "Server error during Google login",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (connection) connection.release();
  }
};

// Public endpoint for restaurant open status and operating hours
export const getRestaurantOpenStatus = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    const serverTime = new Date();
    const moroccoTimeStr = serverTime.toLocaleString("en-US", {timeZone: "Africa/Casablanca"});
    const moroccoTime = new Date(moroccoTimeStr);
    
    const currentDay = moroccoTime.getDay();
    const yesterday = (currentDay + 6) % 7;
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    // Get all operating hours
    const [allHours] = await connection.execute(`
      SELECT 
        day_of_week,
        is_closed,
        TIME_FORMAT(open_time, '%H:%i') as open_time,
        TIME_FORMAT(close_time, '%H:%i') as close_time
      FROM restaurant_operating_hours
      ORDER BY day_of_week
    `);
    
    // Get current is_open manual toggle from settings
    const [settings] = await connection.execute(`
      SELECT is_open, restaurant_name FROM restaurant_settings LIMIT 1
    `);
    
    const manualIsOpen = settings.length > 0 ? Boolean(settings[0].is_open) : true;
    const restaurantName = settings.length > 0 ? settings[0].restaurant_name : 'Restaurant';

    // --- LOGIC TO HANDLE OVERNIGHT SHIFTS ---
    let isCurrentlyOpen = false;
    let activeSchedule = null;

    // Helper to check if a specific day's shift covers "now"
    const isShiftActive = (daySchedule, referenceDate, dayOffset = 0) => {
      if (!daySchedule || daySchedule.is_closed) return false;

      const openTime = new Date(referenceDate);
      openTime.setDate(openTime.getDate() + dayOffset);
      const [oH, oM] = daySchedule.open_time.split(':');
      openTime.setHours(oH, oM, 0, 0);

      let closeTime = new Date(referenceDate);
      closeTime.setDate(closeTime.getDate() + dayOffset);
      const [cH, cM] = daySchedule.close_time.split(':');
      closeTime.setHours(cH, cM, 0, 0);

      // If close time is before or equal to open time, it crosses midnight
      if (closeTime <= openTime) {
        closeTime.setDate(closeTime.getDate() + 1);
      }

      return referenceDate >= openTime && referenceDate < closeTime;
    };

    const todayHours = allHours.find(h => h.day_of_week === currentDay);
    const yesterdayHours = allHours.find(h => h.day_of_week === yesterday);

    // 1. Check Today's Shift
    if (isShiftActive(todayHours, moroccoTime, 0)) {
      isCurrentlyOpen = true;
      activeSchedule = todayHours;
    } 
    // 2. Check Yesterday's Shift (for midnight carry-over)
    else if (isShiftActive(yesterdayHours, moroccoTime, -1)) {
      isCurrentlyOpen = true;
      activeSchedule = yesterdayHours;
    }

    // Final open status depends on both schedule AND manual toggle
    const finalIsOpen = isCurrentlyOpen && manualIsOpen;

    // --- FIND NEXT OPEN TIME ---
    let nextOpenTime = null;
    if (!finalIsOpen) {
      // Check if it opens later today (only if manual toggle is on)
      if (manualIsOpen && todayHours && !todayHours.is_closed) {
        const openToday = new Date(moroccoTime);
        const [h, m] = todayHours.open_time.split(':');
        openToday.setHours(h, m, 0, 0);
        
        if (moroccoTime < openToday) {
          nextOpenTime = {
            day_name: dayNames[currentDay],
            time: todayHours.open_time,
            is_today: true
          };
        }
      }

      // If not opening today, look ahead through the week
      if (!nextOpenTime) {
        for (let i = 1; i <= 7; i++) {
          const checkDay = (currentDay + i) % 7;
          const nextDayHours = allHours.find(h => h.day_of_week === checkDay);
          if (nextDayHours && !nextDayHours.is_closed) {
            nextOpenTime = {
              day_name: dayNames[checkDay],
              time: nextDayHours.open_time,
              is_today: false
            };
            break;
          }
        }
      }
    }

    const operatingHours = allHours.map(h => ({
      day_of_week: h.day_of_week,
      day_name: dayNames[h.day_of_week],
      is_closed: Boolean(h.is_closed),
      open_time: h.open_time,
      close_time: h.close_time
    }));

    connection.release();
    res.json({
      success: true,
      restaurant_name: restaurantName,
      is_open: finalIsOpen,
      manual_toggle: manualIsOpen,
      current_time: moroccoTime.toTimeString().slice(0, 5),
      current_day: dayNames[currentDay],
      current_day_index: currentDay,
      today_schedule: activeSchedule ? {
        day_name: dayNames[activeSchedule.day_of_week],
        is_closed: false,
        open_time: activeSchedule.open_time,
        close_time: activeSchedule.close_time
      } : (todayHours ? {
        day_name: dayNames[currentDay],
        is_closed: Boolean(todayHours.is_closed),
        open_time: todayHours.open_time,
        close_time: todayHours.close_time
      } : null),
      next_open: nextOpenTime,
      operating_hours: operatingHours
    });
  } catch (error) {
    console.error('Error getting public open status:', error);
    if (connection) connection.release();
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      is_open: true 
    });
  }
};

// set clients interface language
export const setClientLanguage = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const { clientId, currentLang } = req.body;

    // 1. Validate input
    if (!clientId || !currentLang) {
      return res.status(400).json({ 
        success: false, 
        message: 'clientId and currentLang are required' 
      });
    }

    // 2. Execute the update query
    const [result] = await connection.execute(
      'UPDATE clients SET current_language = ? WHERE id = ?',
      [currentLang, clientId]
    );

    // 3. Check if a row was actually updated
    if (result.affectedRows === 0) {
      connection.release();
      return res.status(404).json({ 
        success: false, 
        message: 'Client not found' 
      });
    }

    connection.release();
    
    // 4. Send success response
    res.json({
      success: true,
      message: 'Language updated successfully',
      clientId,
      currentLang
    });

  } catch (error) {
    console.error('Error updating client language:', error);
    if (connection) connection.release();
    
    res.status(500).json({ 
      success: false,
      message: 'Server error while updating language'
    });
  }
};



// in cart products
export const getInCartProducts = async (req, res) => {
  let connection;
  try {
    const { restaurant_id } = req.query;
    if (!restaurant_id) {
      return res.status(400).json({
        success: false,
        message: 'restaurant_id is required'
      });
    }

    connection = await pool.getConnection();

    // Simplified query focusing only on the specific restaurant and cart status
    const [products] = await connection.execute(`
      SELECT 
        p.*,
        c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.for_cart = TRUE 
        AND p.active = TRUE
        AND p.restaurant_id = ?
      ORDER BY p.created_at DESC
    `, [restaurant_id]);

    // Map through products to ensure price is a number (SQL often returns strings for Decimals)
    const processedProducts = products.map(p => ({
      ...p,
      price: parseFloat(p.price)
    }));

    res.json({
      success: true,
      count: processedProducts.length,
      products: processedProducts
    });

  } catch (error) {
    console.error('Error fetching cart products:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching cart products',
      error: error.message
    });
  } finally {
    if (connection) connection.release();
  }
};


// check reorder products with offers
export const checkLiveStatus = async (req, res) => {
  let connection;
  try {
    const { productIds, userId } = req.body;
    connection = await pool.getConnection();

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ success: false, message: "No product IDs provided" });
    }

    const placeholders = productIds.map(() => '?').join(',');

    // Optimized Query: 
    // 1. Joins offers that are currently date-active.
    // 2. Joins offer_usages to ensure the specific user has applied/claimed this offer.
    const query = `
      SELECT 
        p.id as product_id,
        p.name,
        p.price as original_price,
        p.image,
        o.id as offer_id,
        o.name as offer_name,
        o.discount_type,
        o.discount as discount_value,
        o.end_at,
        op.limited_use,
        op.times_used,
        ou.usage_count as user_usage_count
      FROM products p
      INNER JOIN offer_products op ON p.id = op.product_id
      INNER JOIN offers o ON op.offer_id = o.id 
      INNER JOIN offer_usages ou ON o.id = ou.offer_id -- Ensures user has applied the offer
      WHERE p.id IN (${placeholders})
        AND ou.user_id = ?              -- Filter for this specific user
        AND o.is_active = TRUE 
        AND o.start_at <= NOW() 
        AND o.end_at > NOW()
      ORDER BY o.created_at DESC 
    `;

    // We pass productIds first for the IN clause, then userId for the ou.user_id filter
    const [rows] = await connection.execute(query, [...productIds, userId]);

    const validatedProducts = rows.map(row => {
      const originalPrice = parseFloat(row.original_price);
      let finalPrice = originalPrice;
      let hasOffer = true; // Since we used INNER JOIN, if a row exists, it has an offer
      let discountApplied = false;

      // Check Global Limit (times_used vs limited_use)
      const globalLimitNotReached = row.limited_use === null || row.times_used < row.limited_use;
      
      // Note: You can also add a check here for row.user_usage_count if there is a per-user limit
      
      if (globalLimitNotReached) {
        discountApplied = true;
        const discount = parseFloat(row.discount_value);
        if (row.discount_type === 'percentage') {
          finalPrice = originalPrice * (1 - discount / 100);
        } else {
          finalPrice = Math.max(0.01, originalPrice - discount);
        }
        finalPrice = parseFloat(finalPrice.toFixed(2));
      }

      return {
        id: row.product_id,
        name: row.name,
        image: row.image,
        price: originalPrice,
        final_price: finalPrice,
        has_offer: hasOffer,
        discount_applied: discountApplied,
        offer_info: {
          offer_id: row.offer_id,
          offer_name: row.offer_name,
          discount_type: row.discount_type,
          discount_value: row.discount_value,
          original_price: originalPrice,
          can_use_offer: discountApplied,
          times_used: row.times_used,
          max_uses: row.limited_use,
          valid_until: row.end_at
        },
        restaurant: 'Restaurant'
      };
    });

    // Handle products that weren't in any active/applied offer
    // We want to return them at normal price instead of excluding them
    const foundIds = validatedProducts.map(p => p.id);
    const missingIds = productIds.filter(id => !foundIds.includes(id));

    if (missingIds.length > 0) {
      const missingPlaceholders = missingIds.map(() => '?').join(',');
      const [normalProducts] = await connection.execute(
        `SELECT id, name, price, image FROM products WHERE id IN (${missingPlaceholders})`,
        missingIds
      );

      normalProducts.forEach(p => {
        validatedProducts.push({
          id: p.id,
          name: p.name,
          image: p.image,
          price: parseFloat(p.price),
          final_price: parseFloat(p.price),
          has_offer: false,
          discount_applied: false,
          offer_info: null,
          restaurant: 'Restaurant'
        });
      });
    }

    return res.status(200).json({ success: true, products: validatedProducts });

  } catch (error) {
    console.error("❌ Live Status Error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};



// Add new address for a client
export const addAddress = async (req, res) => {
  let connection;
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: "Authorization token required"
      });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify and decode token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token"
      });
    }

    // Extract client ID from token
    const clientId = decoded.clientId || decoded.id;
    if (!clientId) {
      return res.status(401).json({
        success: false,
        message: "Invalid token: No client ID found"
      });
    }

    const {
      title = 'New Address', // Default title
      full_address,
      lat,
      lon,
      is_default = false
    } = req.body;

    // Validate required fields
    if (!full_address) {
      return res.status(400).json({
        success: false,
        message: "Full address is required"
      });
    }

    // Validate coordinates if provided
    if (lat && (lat < -90 || lat > 90)) {
      return res.status(400).json({
        success: false,
        message: "Latitude must be between -90 and 90"
      });
    }
    
    if (lon && (lon < -180 || lon > 180)) {
      return res.status(400).json({
        success: false,
        message: "Longitude must be between -180 and 180"
      });
    }

    // Check if client exists
    connection = await pool.getConnection();
    
    const [clientRows] = await connection.execute(
      "SELECT id FROM clients WHERE id = ?",
      [clientId]
    );

    if (clientRows.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        message: "Client not found"
      });
    }

    // Check if address already exists for this client
    // Using LOWER() for case-insensitive comparison and trimming whitespace
    const [existingAddressRows] = await connection.execute(
      `SELECT id, full_address 
       FROM addresses 
       WHERE user_id = ? 
       AND LOWER(TRIM(full_address)) = LOWER(TRIM(?))`,
      [clientId, full_address]
    );

    if (existingAddressRows.length > 0) {
      connection.release();
      return res.status(409).json({
        success: false,
        message: "Address already exists",
        existingAddressId: existingAddressRows[0].id
      });
    }

    // If setting as default, unset all other default addresses for this client
    if (is_default) {
      await connection.execute(
        "UPDATE addresses SET is_default = FALSE WHERE user_id = ?",
        [clientId]
      );
    }

    // Insert new address
    const [result] = await connection.execute(
      `INSERT INTO addresses (
        user_id,
        title,
        full_address,
        lat,
        lon,
        is_default
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        clientId,
        title,
        full_address.trim(), // Trim whitespace before storing
        lat ? parseFloat(lat) : null,
        lon ? parseFloat(lon) : null,
        is_default
      ]
    );

    // If this is the first address and no default was set, make it default
    const [addressCount] = await connection.execute(
      "SELECT COUNT(*) as count FROM addresses WHERE user_id = ?",
      [clientId]
    );

    if (addressCount[0].count === 1 && !is_default) {
      await connection.execute(
        "UPDATE addresses SET is_default = TRUE WHERE id = ?",
        [result.insertId]
      );
    }

    // Get the newly created address with formatted dates
    const [newAddressRows] = await connection.execute(
      `SELECT 
        id,
        title,
        full_address,
        lat,
        lon,
        is_default,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as created_at,
        DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') as updated_at
      FROM addresses 
      WHERE id = ?`,
      [result.insertId]
    );

    connection.release();

    const newAddress = {
      ...newAddressRows[0],
      lat: newAddressRows[0].lat ? parseFloat(newAddressRows[0].lat) : null,
      lon: newAddressRows[0].lon ? parseFloat(newAddressRows[0].lon) : null,
      is_default: Boolean(newAddressRows[0].is_default)
    };

    res.status(201).json({
      success: true,
      message: "Address added successfully",
      address: newAddress
    });

  } catch (error) {
    console.error("❌ Error adding address:", error.message);
    if (connection) connection.release();
    
    // Check for foreign key constraint error
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({
        success: false,
        message: "Client does not exist"
      });
    }
    
    // Check for duplicate address error (if database constraint exists)
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: "Address already exists for this client"
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Server error adding address",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


// Get all addresses for a client (using token instead of clientId in params)
export const getClientAddresses = async (req, res) => {
  let connection;
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: "Authorization token required"
      });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify and decode token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token"
      });
    }

    const clientId = decoded.id || decoded.userId;
    
    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: "Client ID not found in token"
      });
    }

    connection = await pool.getConnection();

    // Check if client exists
    const [clientRows] = await connection.execute(
      "SELECT id, name, email FROM clients WHERE id = ?",
      [clientId]
    );

    if (clientRows.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        message: "Client not found"
      });
    }

    // Get all addresses for this client
    const [addresses] = await connection.execute(
      `SELECT 
        id,
        title,
        full_address,
        lat,
        lon,
        is_default,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as created_at,
        DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') as updated_at
      FROM addresses 
      WHERE user_id = ?
      ORDER BY is_default DESC, created_at DESC`,
      [clientId]
    );

    connection.release();

    const formattedAddresses = addresses.map(addr => ({
      ...addr,
      lat: addr.lat ? parseFloat(addr.lat) : null,
      lon: addr.lon ? parseFloat(addr.lon) : null,
      is_default: Boolean(addr.is_default)
    }));

    res.json({
      success: true,
      client: {
        id: clientRows[0].id,
        name: clientRows[0].name,
        email: clientRows[0].email
      },
      addresses: formattedAddresses,
      count: addresses.length,
      has_default: addresses.some(addr => addr.is_default)
    });

  } catch (error) {
    console.error("❌ Error fetching client addresses:", error.message);
    if (connection) connection.release();
    
    res.status(500).json({
      success: false,
      message: "Server error fetching addresses",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update an address
export const updateAddress = async (req, res) => {
  let connection;
  try {
    const { clientId, addressId } = req.params;
    const {
      title,
      full_address,
      lat,
      lon,
      is_default = false
    } = req.body;

    // Validate required fields
    if (!title || !full_address) {
      return res.status(400).json({
        success: false,
        message: "Title and full address are required"
      });
    }

    // Validate coordinates if provided
    if (lat && (lat < -90 || lat > 90)) {
      return res.status(400).json({
        success: false,
        message: "Latitude must be between -90 and 90"
      });
    }
    
    if (lon && (lon < -180 || lon > 180)) {
      return res.status(400).json({
        success: false,
        message: "Longitude must be between -180 and 180"
      });
    }

    connection = await pool.getConnection();

    // Check if address exists and belongs to this client
    const [addressRows] = await connection.execute(
      "SELECT id, is_default FROM addresses WHERE id = ? AND user_id = ?",
      [addressId, clientId]
    );

    if (addressRows.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        message: "Address not found or doesn't belong to this client"
      });
    }

    const currentIsDefault = addressRows[0].is_default;

    // If setting as default and it wasn't already default, unset all other default addresses
    if (is_default && !currentIsDefault) {
      await connection.execute(
        "UPDATE addresses SET is_default = FALSE WHERE user_id = ? AND id != ?",
        [clientId, addressId]
      );
    }

    // Update the address
    await connection.execute(
      `UPDATE addresses SET
        title = ?,
        full_address = ?,
        lat = ?,
        lon = ?,
        is_default = ?
      WHERE id = ? AND user_id = ?`,
      [
        title,
        full_address,
        lat ? parseFloat(lat) : null,
        lon ? parseFloat(lon) : null,
        is_default,
        addressId,
        clientId
      ]
    );

    // Get the updated address
    const [updatedAddressRows] = await connection.execute(
      `SELECT 
        id,
        title,
        full_address,
        lat,
        lon,
        is_default,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as created_at,
        DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') as updated_at
      FROM addresses 
      WHERE id = ?`,
      [addressId]
    );

    connection.release();

    const updatedAddress = {
      ...updatedAddressRows[0],
      lat: updatedAddressRows[0].lat ? parseFloat(updatedAddressRows[0].lat) : null,
      lon: updatedAddressRows[0].lon ? parseFloat(updatedAddressRows[0].lon) : null,
      is_default: Boolean(updatedAddressRows[0].is_default)
    };

    res.json({
      success: true,
      message: "Address updated successfully",
      address: updatedAddress
    });

  } catch (error) {
    console.error("❌ Error updating address:", error.message);
    if (connection) connection.release();
    
    res.status(500).json({
      success: false,
      message: "Server error updating address",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Delete an address
export const deleteAddress = async (req, res) => {
  let connection;
  try {
    const { clientId, addressId } = req.params;

    connection = await pool.getConnection();

    // Check if address exists and belongs to this client
    const [addressRows] = await connection.execute(
      "SELECT id, is_default FROM addresses WHERE id = ? AND user_id = ?",
      [addressId, clientId]
    );

    if (addressRows.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        message: "Address not found or doesn't belong to this client"
      });
    }

    const isDefault = addressRows[0].is_default;

    // Delete the address
    await connection.execute(
      "DELETE FROM addresses WHERE id = ? AND user_id = ?",
      [addressId, clientId]
    );

    // If we deleted the default address, set a new default (the most recent one)
    if (isDefault) {
      const [remainingAddresses] = await connection.execute(
        "SELECT id FROM addresses WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
        [clientId]
      );

      if (remainingAddresses.length > 0) {
        await connection.execute(
          "UPDATE addresses SET is_default = TRUE WHERE id = ?",
          [remainingAddresses[0].id]
        );
      }
    }

    connection.release();

    res.json({
      success: true,
      message: "Address deleted successfully",
      deletedAddressId: addressId
    });

  } catch (error) {
    console.error("❌ Error deleting address:", error.message);
    if (connection) connection.release();
    
    res.status(500).json({
      success: false,
      message: "Server error deleting address",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Set default address
export const setDefaultAddress = async (req, res) => {
  let connection;
  try {
    const { clientId, addressId } = req.params;

    connection = await pool.getConnection();

    // Check if address exists and belongs to this client
    const [addressRows] = await connection.execute(
      "SELECT id, is_default FROM addresses WHERE id = ? AND user_id = ?",
      [addressId, clientId]
    );

    if (addressRows.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        message: "Address not found or doesn't belong to this client"
      });
    }

    const currentIsDefault = addressRows[0].is_default;

    // If already default, no need to do anything
    if (currentIsDefault) {
      connection.release();
      return res.json({
        success: true,
        message: "Address is already the default address"
      });
    }

    // Unset all other default addresses
    await connection.execute(
      "UPDATE addresses SET is_default = FALSE WHERE user_id = ?",
      [clientId]
    );

    // Set this address as default
    await connection.execute(
      "UPDATE addresses SET is_default = TRUE WHERE id = ? AND user_id = ?",
      [addressId, clientId]
    );

    // Get the updated default address
    const [defaultAddressRows] = await connection.execute(
      `SELECT 
        id,
        title,
        full_address,
        lat,
        lon,
        is_default,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as created_at,
        DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') as updated_at
      FROM addresses 
      WHERE id = ?`,
      [addressId]
    );

    connection.release();

    const defaultAddress = {
      ...defaultAddressRows[0],
      lat: defaultAddressRows[0].lat ? parseFloat(defaultAddressRows[0].lat) : null,
      lon: defaultAddressRows[0].lon ? parseFloat(defaultAddressRows[0].lon) : null,
      is_default: Boolean(defaultAddressRows[0].is_default)
    };

    res.json({
      success: true,
      message: "Default address updated successfully",
      address: defaultAddress
    });

  } catch (error) {
    console.error("❌ Error setting default address:", error.message);
    if (connection) connection.release();
    
    res.status(500).json({
      success: false,
      message: "Server error setting default address",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};