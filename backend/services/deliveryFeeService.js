import pool from "../config/db.js";
import { calculateDistance } from "../utils/distanceCalculator.js";

/**
 * Calculate delivery fee based on distance between restaurant and client
 * @param {number} clientLat - Client latitude
 * @param {number} clientLon - Client longitude
 * @returns {Promise<{fee: number, distance: number, error: string|null}>}
 */

export const calculateDeliveryFee = async (clientLat, clientLon, restaurantId) => {
  let connection;
  try {
    if (!restaurantId) return { fee: "15.00", distance: null, error: "No Restaurant ID" };

    connection = await pool.getConnection();

    // 1. Fetch restaurant settings from your updated table
    const [rows] = await connection.execute(
      `SELECT 
        lat, lon, 
        base_delivery_fee, 
        per_km_fee, 
        max_delivery_distance_km, 
        min_delivery_fee, 
        max_delivery_fee 
       FROM restaurants 
       WHERE id = ? LIMIT 1`,
      [restaurantId]
    );

    if (rows.length === 0) {
      return { fee: "15.00", distance: null, error: "Restaurant not found" };
    }

    const res = rows[0];

    // 2. Calculate "Air Distance" and apply the 1.3x Road Buffer
    const straightLine = calculateDistance(
      parseFloat(res.lat),
      parseFloat(res.lon),
      parseFloat(clientLat),
      parseFloat(clientLon)
    );
    
    // This matches the ~1.5km you see on your homepage
    const roadDistance = straightLine * 1.3;

    // 3. Distance Limit Check
    const maxDist = parseFloat(res.max_delivery_distance_km || 20);
    if (roadDistance > maxDist) {
      return {
        fee: null,
        distance: Math.round(roadDistance * 100) / 100,
        error: `Out of delivery range (${roadDistance.toFixed(1)}km)`
      };
    }

    // 4. Calculate Fee: Base + (Dist * Rate)
    // Example: 7 + (1.508 * 2) = 10.016
    const base = parseFloat(res.base_delivery_fee || 0);
    const rate = parseFloat(res.per_km_fee || 0);
    let totalFee = base + (roadDistance * rate);

    // 5. Apply your Rounding Logic
    // .5 and up -> next whole number
    // .49 and down -> floor whole number
    totalFee = Math.round(totalFee);

    // 6. Final constraints (Min/Max)
    const minF = parseFloat(res.min_delivery_fee || 0);
    const maxF = parseFloat(res.max_delivery_fee || 999);

    if (totalFee < minF) totalFee = minF;
    if (totalFee > maxF) totalFee = maxF;

    return {
      fee: totalFee.toFixed(2), // Returns "10.00" or "11.00"
      distance: Math.round(roadDistance * 100) / 100,
      error: null,
    };

  } catch (error) {
    console.error("Delivery Calculation Error:", error.message);
    return { fee: "15.00", distance: null, error: error.message };
  } finally {
    if (connection) connection.release();
  }
};

/**
 * Get restaurant location
 * @returns {Promise<{lat: number, lon: number, address: string}|null>}
 */
export const getRestaurantLocation = async () => {
  try {
    const connection = await pool.getConnection();
    const [settings] = await connection.execute(
      `SELECT 
        restaurant_latitude, 
        restaurant_longitude,
        restaurant_address
      FROM restaurant_settings 
      LIMIT 1`
    );
    connection.release();

    if (settings.length === 0) {
      return null;
    }

    return {
      lat: parseFloat(settings[0].restaurant_latitude),
      lon: parseFloat(settings[0].restaurant_longitude),
      address: settings[0].restaurant_address || "",
    };
  } catch (error) {
    console.error("Error getting restaurant location:", error);
    return null;
  }
};



