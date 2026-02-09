import db from "../config/db.js";

const DeliveryMan = {
  // Create a new delivery man
  create: (name, email, hashedPassword, phone, vehicle_type, license_number, callback) => {
    const sql = `
      INSERT INTO delivery_men 
      (name, email, password, phone, vehicle_type, license_number, is_active) 
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `;
    db.query(sql, [name, email, hashedPassword, phone, vehicle_type, license_number], callback);
  },

  // Find a delivery man by email
  findByEmail: (email, callback) => {
    const sql = "SELECT * FROM delivery_men WHERE email = ?";
    db.query(sql, [email], callback);
  },

  // Find a delivery man by ID
  findById: (id, callback) => {
    const sql = "SELECT * FROM delivery_men WHERE id = ?";
    db.query(sql, [id], callback);
  },

  // Get all delivery men
  getAll: (callback) => {
    const sql = "SELECT id, name, email, phone, vehicle_type, license_number, is_active, created_at FROM delivery_men";
    db.query(sql, callback);
  },

  // Update delivery man status
  updateStatus: (id, is_active, callback) => {
    const sql = "UPDATE delivery_men SET is_active = ? WHERE id = ?";
    db.query(sql, [is_active, id], callback);
  },

  // Update delivery man location
  updateLocation: (id, latitude, longitude, callback) => {
    const sql = "UPDATE delivery_men SET current_latitude = ?, current_longitude = ?, last_location_update = NOW() WHERE id = ?";
    db.query(sql, [latitude, longitude, id], callback);
  },
};

export default DeliveryMan;

