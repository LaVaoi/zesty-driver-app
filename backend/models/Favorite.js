// models/Favorite.js
import db from "../config/db.js";

const Favorite = {
  // ✅ Add a product to client's favorites
  add: (client_id, product_id, callback) => {
    const sql = `
      INSERT INTO favorites (client_id, product_id)
      VALUES (?, ?)
    `;
    db.query(sql, [client_id, product_id], callback);
  },

  // ✅ Remove a product from favorites
  remove: (client_id, product_id, callback) => {
    const sql = `
      DELETE FROM favorites
      WHERE client_id = ? AND product_id = ?
    `;
    db.query(sql, [client_id, product_id], callback);
  },

  // ✅ Check if a product is already in favorites
  isFavorite: (client_id, product_id, callback) => {
    const sql = `
      SELECT * FROM favorites
      WHERE client_id = ? AND product_id = ?
    `;
    db.query(sql, [client_id, product_id], callback);
  },

  // ✅ Get all favorite products for a client (with product details)
  findByClient: (client_id, callback) => {
    const sql = `
      SELECT p.* 
      FROM favorites f
      JOIN products p ON f.product_id = p.id
      WHERE f.client_id = ?
    `;
    db.query(sql, [client_id], callback);
  },
};

export default Favorite;
