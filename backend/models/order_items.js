// models/OrderItem.js
import db from "../config/db.js";

const OrderItem = {
  // ✅ Create an order item (add product to an order)
  create: (order_id, product_id, quantity, price_per_unit, special_instructions, callback) => {
    const sql = `
      INSERT INTO order_items (order_id, product_id, quantity, price_per_unit, special_instructions)
      VALUES (?, ?, ?, ?, ?)
    `;
    db.query(sql, [order_id, product_id, quantity, price_per_unit, special_instructions], callback);
  },

  // ✅ Get all items of an order
  findByOrderId: (order_id, callback) => {
    const sql = `
      SELECT oi.*, p.name AS product_name, p.image AS product_image
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `;
    db.query(sql, [order_id], callback);
  },

  // ✅ Delete all items for an order (useful if order is cancelled)
  deleteByOrderId: (order_id, callback) => {
    const sql = "DELETE FROM order_items WHERE order_id = ?";
    db.query(sql, [order_id], callback);
  },

  // ✅ Delete a specific item
  delete: (id, callback) => {
    const sql = "DELETE FROM order_items WHERE id = ?";
    db.query(sql, [id], callback);
  },
};

export default OrderItem;
