// models/Product.js
import db from "../config/db.js";

const Product = {
  // ✅ Create a new product
  create: (name, description, price, rating, image, category_id, delivery, promo, promoValue, badge, callback) => {
    const sql = `
      INSERT INTO products 
      (name, description, price, rating, image, category_id, delivery, promo, promoValue, badge)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    db.query(sql, [name, description, price, rating, image, category_id, delivery, promo, promoValue, badge], callback);
  },

  // ✅ Find a product by ID
  findById: (id, callback) => {
    const sql = "SELECT * FROM products WHERE id = ?";
    db.query(sql, [id], callback);
  },

  // ✅ Get all products
  findAll: (callback) => {
    const sql = `
      SELECT p.*, c.name AS category_name 
      FROM products p 
      JOIN categories c ON p.category_id = c.id
    `;
    db.query(sql, callback);
  },

  // ✅ Get all products by category
  findByCategory: (category_id, callback) => {
    const sql = `
      SELECT p.*, c.name AS category_name 
      FROM products p 
      JOIN categories c ON p.category_id = c.id
      WHERE p.category_id = ?
    `;
    db.query(sql, [category_id], callback);
  },

  // ✅ Update a product
  update: (id, name, description, price, rating, image, category_id, delivery, promo, promoValue, badge, callback) => {
    const sql = `
      UPDATE products 
      SET name = ?, description = ?, price = ?, rating = ?, image = ?, 
          category_id = ?, delivery = ?, promo = ?, promoValue = ?, badge = ?
      WHERE id = ?
    `;
    db.query(sql, [name, description, price, rating, image, category_id, delivery, promo, promoValue, badge, id], callback);
  },

  // ✅ Delete a product
  delete: (id, callback) => {
    const sql = "DELETE FROM products WHERE id = ?";
    db.query(sql, [id], callback);
  },
};

export default Product;
