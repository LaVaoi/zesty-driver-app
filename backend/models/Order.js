// models/Order.js
import db from "../config/db.js";

const Order = {
  // ✅ Create a new order
  create: (
    user_id,
    order_number,
    status = "Pending",
    payment_status = "Unpaid",
    delivery_address_id = null,
    total_price = 0,
    delivery_fee = 0,
    discount = 0,
    final_price = 0,
    callback
  ) => {
    const sql = `
      INSERT INTO orders (
        user_id, order_number, status, payment_status,
        delivery_address_id, total_price, delivery_fee, discount, final_price
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    db.query(
      sql,
      [
        user_id,
        order_number,
        status,
        payment_status,
        delivery_address_id,
        total_price,
        delivery_fee,
        discount,
        final_price,
      ],
      callback
    );
  },

  // ✅ Get all orders
  findAll: (callback) => {
    const sql = "SELECT * FROM orders ORDER BY created_at DESC";
    db.query(sql, callback);
  },

  // ✅ Find order by ID
  findById: (id, callback) => {
    const sql = "SELECT * FROM orders WHERE id = ?";
    db.query(sql, [id], callback);
  },

  // ✅ Find orders by user
  findByUserId: (user_id, callback) => {
    const sql = "SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC";
    db.query(sql, [user_id], callback);
  },

  // ✅ Update order status or payment status
  updateStatus: (id, status, payment_status, callback) => {
    const sql = "UPDATE orders SET status = ?, payment_status = ? WHERE id = ?";
    db.query(sql, [status, payment_status, id], callback);
  },

  // ✅ Delete an order
  delete: (id, callback) => {
    const sql = "DELETE FROM orders WHERE id = ?";
    db.query(sql, [id], callback);
  },
};

export default Order;
