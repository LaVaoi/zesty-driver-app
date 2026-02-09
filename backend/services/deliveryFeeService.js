import pool from "../config/db.js";
import { calculateDistance } from "../utils/distanceCalculator.js";

/**
 * Calculate delivery fee based on distance between restaurant and client
 * @param {number} clientLat - Client latitude
 * @param {number} clientLon - Client longitude
 * @returns {Promise<{fee: number, distance: number, error: string|null}>}
 */
export const calculateDeliveryFee = async (clientLat, clientLon) => {
  try {
    // Get restaurant settings
    const connection = await pool.getConnection();
    const [settings] = await connection.execute(
      `SELECT 
        restaurant_latitude, 
        restaurant_longitude,
        base_delivery_fee,
        per_km_fee,
        max_delivery_distance_km,
        min_delivery_fee,
        max_delivery_fee
      FROM restaurant_settings 
      LIMIT 1`
    );
    connection.release();

    if (settings.length === 0) {
      return {
        fee: 15.00, // Default fallback
        distance: null,
        error: "Restaurant settings not found, using default fee",
      };
    }

    const restaurantSettings = settings[0];

    // Check if client coordinates are available
    if (!clientLat || !clientLon) {
      return {
        fee: parseFloat(restaurantSettings.base_delivery_fee),
        distance: null,
        error: "Client location not available, using base fee",
      };
    }

    // Calculate distance
    const distance = calculateDistance(
      parseFloat(restaurantSettings.restaurant_latitude),
      parseFloat(restaurantSettings.restaurant_longitude),
      parseFloat(clientLat),
      parseFloat(clientLon)
    );

    if (distance === null) {
      return {
        fee: parseFloat(restaurantSettings.base_delivery_fee),
        distance: null,
        error: "Could not calculate distance, using base fee",
      };
    }

    // Check if distance exceeds maximum
    if (distance > parseFloat(restaurantSettings.max_delivery_distance_km)) {
      return {
        fee: null,
        distance: distance,
        error: `Delivery distance (${distance} km) exceeds maximum allowed distance (${restaurantSettings.max_delivery_distance_km} km)`,
      };
    }

    // Calculate fee: base fee + (distance * per_km_fee)
    let calculatedFee =
      parseFloat(restaurantSettings.base_delivery_fee) +
      distance * parseFloat(restaurantSettings.per_km_fee);

    // Apply min/max constraints
    const minFee = parseFloat(restaurantSettings.min_delivery_fee);
    const maxFee = parseFloat(restaurantSettings.max_delivery_fee);

    if (calculatedFee < minFee) {
      calculatedFee = minFee;
    } else if (calculatedFee > maxFee) {
      calculatedFee = maxFee;
    }

    return {
      fee: Math.round(calculatedFee * 100) / 100, // Round to 2 decimal places
      distance: distance,
      error: null,
    };
  } catch (error) {
    console.error("Error calculating delivery fee:", error);
    return {
      fee: 15.00, // Default fallback
      distance: null,
      error: "Error calculating delivery fee, using default",
    };
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



