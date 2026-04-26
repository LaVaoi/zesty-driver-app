// models/Category.js
import db from "../config/db.js";

const Category = {
  // ✅ Create a new category
  create: (name, image, description, active = true, callback) => {
    const sql = "INSERT INTO categories (name, image, description, active) VALUES (?, ?, ?, ?)";
    db.query(sql, [name, image, description, active], callback);
  },

  // ✅ Find a category by ID
  findById: (id, callback) => {
    const sql = "SELECT * FROM categories WHERE id = ?";
    db.query(sql, [id], callback);
  },

  // ✅ Find a category by name
  findByName: (name, callback) => {
    const sql = "SELECT * FROM categories WHERE name = ?";
    db.query(sql, [name], callback);
  },

  // ✅ Get all categories
  findAll: (callback) => {
    const sql = "SELECT * FROM categories";
    db.query(sql, callback);
  },

  // ✅ Update a category
  update: (id, name, image, description, active, callback) => {
    const sql = "UPDATE categories SET name = ?, image = ?, description = ?, active = ? WHERE id = ?";
    db.query(sql, [name, image, description, active, id], callback);
  },

  // ✅ Delete a category
  delete: (id, callback) => {
    const sql = "DELETE FROM categories WHERE id = ?";
    db.query(sql, [id], callback);
  },
};

export default Category;
