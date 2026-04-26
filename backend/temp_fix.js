// Temporary file to hold the corrected function

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
    if (restaurant_email !== undefined) {
      updates.push("restaurant_email = ?");
      values.push(restaurant_email);
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

    let result;
    if (existing.length === 0) {
      // Insert new settings
      await connection.execute(
        `INSERT INTO restaurant_settings 
         (restaurant_name, phone, restaurant_email, restaurant_address, restaurant_latitude, restaurant_longitude,
          base_delivery_fee, per_km_fee, max_delivery_distance_km, min_delivery_fee, max_delivery_fee, is_open, restaurant_logo, restaurant_home_screen_icon)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          restaurant_name || 'Restaurant',
          phone || '',
          restaurant_email || '',
          restaurant_address || '',
          lat || 33.5731,
          lon || -7.5898,
          parseFloat(base_delivery_fee) || 10.00,
          parseFloat(per_km_fee) || 2.00,
          parseFloat(max_delivery_distance_km) || 20.00,
          parseFloat(min_delivery_fee) || 5.00,
          parseFloat(max_delivery_fee) || 50.00,
          is_open === true || is_open === 'true' ? 1 : 0,
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
