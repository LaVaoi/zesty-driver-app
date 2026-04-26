import db from "../config/db.js";
import pool from "../config/db.js";

// 💖 Add a product to favorites
export const addFavorite = async (req, res) => {
  try {
    const { product_id } = req.body;
    const client_id = req.clientId; // From verifyToken middleware

    if (!product_id) {
      return res.status(400).json({ message: "Missing product_id" });
    }

    // 1️⃣ Check if already in favorites
    const [existing] = await pool.execute(
      "SELECT id FROM favorites WHERE client_id = ? AND product_id = ?",
      [client_id, product_id]
    );

    if (existing.length > 0) {
      return res.status(400).json({ message: "Already in favorites" });
    }

    // 2️⃣ Add to favorites
    await pool.execute(
      "INSERT INTO favorites (client_id, product_id) VALUES (?, ?)",
      [client_id, product_id]
    );

    res.status(201).json({ message: "Product added to favorites successfully" });
  } catch (err) {
    console.error("❌ Error adding favorite:", err);
    res.status(500).json({ message: "Failed to add favorite" });
  }
};

// 💔 Remove from favorites
export const removeFavorite = async (req, res) => {
  try {
    const { product_id } = req.body;
    const client_id = req.clientId; // From verifyToken middleware

    if (!product_id) {
      return res.status(400).json({ message: "Missing product_id" });
    }

    const [result] = await pool.execute(
      "DELETE FROM favorites WHERE client_id = ? AND product_id = ?",
      [client_id, product_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Favorite not found" });
    }

    res.json({ message: "Product removed from favorites" });
  } catch (err) {
    console.error("❌ Error removing favorite:", err);
    res.status(500).json({ message: "Failed to remove favorite" });
  }
};

// 📋 Get all favorites for a client
export const getFavorites = async (req, res) => {
  let connection;
  try {
    const client_id = req.clientId; // From verifyToken middleware

    connection = await pool.getConnection();

    // 1️⃣ Get favorite products joined with their specific restaurant
    const [favorites] = await connection.execute(
      `
      SELECT 
        p.*, 
        r.name AS restaurant_name
      FROM favorites f
      JOIN products p ON f.product_id = p.id
      JOIN restaurants r ON p.restaurant_id = r.id
      WHERE f.client_id = ? AND p.active = TRUE
      ORDER BY f.created_at DESC
      `,
      [client_id]
    );

    // 2️⃣ Format data types for the frontend
    const formattedFavorites = favorites.map(product => ({
      ...product,
      price: parseFloat(product.price),
      rating: parseFloat(product.rating) || 0,
      promo: Boolean(product.promo),
      is_popular: Boolean(product.is_popular),
      active: Boolean(product.active)
    }));

    // 3️⃣ Return clean response
    return res.json({
      success: true,
      favorites: formattedFavorites,
      user_id: client_id
    });

  } catch (err) {
    console.error("❌ Error fetching favorites:", err);
    return res.status(500).json({ 
      success: false, 
      message: "Failed to fetch favorites" 
    });
  } finally {
    if (connection) connection.release();
  }
};


// restaurants favorites system

// 💖 Add a restaurant to favorites
export const addFavoriteRestaurant = async (req, res) => {
  try {
    const { restaurant_id } = req.body;
    const client_id = req.clientId;

    if (!restaurant_id) {
      return res.status(400).json({ message: "Missing restaurant_id" });
    }

    // 1️⃣ Check if already in favorites
    const [existing] = await pool.execute(
      "SELECT id FROM restaurant_favorites WHERE client_id = ? AND restaurant_id = ?",
      [client_id, restaurant_id]
    );

    if (existing.length > 0) {
      return res.status(400).json({ message: "Restaurant already in favorites" });
    }

    // 2️⃣ Add to favorites
    await pool.execute(
      "INSERT INTO restaurant_favorites (client_id, restaurant_id) VALUES (?, ?)",
      [client_id, restaurant_id]
    );

    res.status(201).json({ success: true, message: "Restaurant added to favorites" });
  } catch (err) {
    console.error("❌ Error adding favorite restaurant:", err);
    res.status(500).json({ success: false, message: "Failed to add favorite restaurant" });
  }
};

// 💔 Remove a restaurant from favorites
export const removeFavoriteRestaurant = async (req, res) => {
  try {
    const { restaurant_id } = req.body;
    const client_id = req.clientId;

    if (!restaurant_id) {
      return res.status(400).json({ message: "Missing restaurant_id" });
    }

    const [result] = await pool.execute(
      "DELETE FROM restaurant_favorites WHERE client_id = ? AND restaurant_id = ?",
      [client_id, restaurant_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Favorite restaurant not found" });
    }

    res.json({ success: true, message: "Restaurant removed from favorites" });
  } catch (err) {
    console.error("❌ Error removing favorite restaurant:", err);
    res.status(500).json({ success: false, message: "Failed to remove favorite" });
  }
};

// 📋 Get all favorite restaurants for a client
export const getFavoriteRestaurants = async (req, res) => {
  let connection;
  try {
    const client_id = req.clientId;
    connection = await pool.getConnection();

    const [favorites] = await connection.execute(
      `
      SELECT 
        r.*
      FROM restaurant_favorites fr
      JOIN restaurants r ON fr.restaurant_id = r.id
      WHERE fr.client_id = ?
      ORDER BY fr.created_at DESCa
      `,
      [client_id]
    );

    // Format decimals and booleans to match your schema logic
    const formattedRestaurants = favorites.map(res => ({
      ...res,
      rating: parseFloat(res.rating) || 0,
      lat: parseFloat(res.lat),
      lon: parseFloat(res.lon),
      delivery_fees: parseFloat(res.delivery_fees),
      min_order: parseFloat(res.min_order),
      is_open: Boolean(res.is_open),
      is_popular: Boolean(res.is_popular)
    }));

    return res.json({
      success: true,
      favorites: formattedRestaurants,
      user_id: client_id
    });

  } catch (err) {
    console.error("❌ Error fetching favorite restaurants:", err);
    return res.status(500).json({ 
      success: false, 
      message: "Failed to fetch favorite restaurants" 
    });
  } finally {
    if (connection) connection.release();
  }
};