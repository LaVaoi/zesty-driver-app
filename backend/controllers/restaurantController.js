import db from "../config/db.js";

export const getAllRestaurants = async (req, res) => {
  let connection;

  try {
    // req.clientId comes from identifyClient (could be null)
    const client_id = req.clientId || null; 
    
    connection = await db.getConnection();

    // We use CASE WHEN to return 1 or 0, then cast to Boolean in JS
    const [restaurants] = await connection.query(`
      SELECT 
        r.*, 
        CASE WHEN rf.id IS NOT NULL THEN 1 ELSE 0 END AS is_favorite
      FROM restaurants r
      LEFT JOIN restaurant_favorites rf ON r.id = rf.restaurant_id AND rf.client_id = ?
      ORDER BY r.created_at DESC
    `, [client_id]);

    const formattedData = restaurants.map(restaurant => ({
      ...restaurant,
      rating: parseFloat(restaurant.rating) || 0,
      delivery_fees: parseFloat(restaurant.delivery_fees) || 0,
      min_order: parseFloat(restaurant.min_order) || 0,
      lat: parseFloat(restaurant.lat),
      lon: parseFloat(restaurant.lon),
      is_open: Boolean(restaurant.is_open),
      is_popular: Boolean(restaurant.is_popular),
      // Explicitly convert to boolean (handles 1/0 or null)
      is_favorite: restaurant.is_favorite === 1 
    }));

    res.status(200).json({
      success: true,
      count: formattedData.length,
      data: formattedData
    });

  } catch (error) {
    console.error("❌ Error fetching restaurants:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch restaurants" });
  } finally {
    if (connection) await connection.release();
  }
};


export const getRestaurantById = async (req, res) => {
  let connection;

  try {
    const { id } = req.params;
    const client_id = req.clientId || null; // From identifyClient middleware

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ success: false, message: "Invalid restaurant ID" });
    }

    connection = await db.getConnection();

    // 1. Query restaurant details with favorite check
    const [restaurants] = await connection.query(
      `SELECT 
        r.*, 
        CASE WHEN rf.id IS NOT NULL THEN 1 ELSE 0 END AS is_favorite
       FROM restaurants r
       LEFT JOIN restaurant_favorites rf ON r.id = rf.restaurant_id AND rf.client_id = ?
       WHERE r.id = ?`,
      [client_id, id]
    );

    if (restaurants.length === 0) {
      return res.status(404).json({ success: false, message: "Restaurant not found" });
    }

    const restaurant = restaurants[0];

    // 2. Fetch Operating Hours
    const [hours] = await connection.query(
      `SELECT day_of_week, is_closed, open_time, close_time 
       FROM restaurant_operating_hours 
       WHERE restaurant_id = ? 
       ORDER BY day_of_week ASC`,
      [id]
    );

    // 3. Query products with favorite check for the client
    const [products] = await connection.query(
      `SELECT 
          p.*, 
          c.name AS category_name,
          CASE WHEN f.id IS NOT NULL THEN 1 ELSE 0 END AS is_favorite
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN favorites f ON f.product_id = p.id AND f.client_id = ?
       WHERE p.restaurant_id = ? AND p.active = TRUE
       ORDER BY p.created_at DESC`,
      [client_id, id]
    );

    const formattedProducts = products.map(product => ({
      ...product,
      price: parseFloat(product.price),
      rating: parseFloat(product.rating) || 0,
      promo: Boolean(product.promo),
      is_popular: Boolean(product.is_popular),
      active: Boolean(product.active),
      is_favorite: product.is_favorite === 1 // convert to boolean
    }));

    res.status(200).json({
      success: true,
      data: {
        restaurant: {
          ...restaurant,
          rating: parseFloat(restaurant.rating) || 0,
          lat: parseFloat(restaurant.lat),
          lon: parseFloat(restaurant.lon),
          delivery_fees: parseFloat(restaurant.delivery_fees) || 0,
          min_order: parseFloat(restaurant.min_order) || 0,
          is_open: Boolean(restaurant.is_open),
          is_popular: Boolean(restaurant.is_popular),
          is_favorite: restaurant.is_favorite === 1,
          operating_hours: hours 
        },
        products: formattedProducts,
        products_count: products.length
      }
    });

  } catch (error) {
    console.error("❌ Error fetching restaurant:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch restaurant" });
  } finally {
    if (connection) await connection.release();
  }
};

export const getPopularRestaurants = async (req, res) => {
  let connection;

  try {
    // 1. Get database connection from the pool
    connection = await db.getConnection();

    // 2. Corrected SQL syntax (single '=' and standard boolean)
    const [restaurants] = await connection.query(`
      SELECT * FROM restaurants 
      WHERE is_popular = 1
      ORDER BY created_at DESC
    `);

    // 3. Send successful response
    res.status(200).json({
      success: true,
      count: restaurants.length,
      data: restaurants
    });

  } catch (error) {
    console.error("❌ Error fetching popular restaurants:", error.message);
    
    res.status(500).json({
      success: false,
      message: "Failed to fetch popular restaurants",
      error: error.message
    });
  } finally {
    // 4. Always release the connection back to the pool
    if (connection) {
      connection.release(); 
    }
  }
};