import db from "../config/db.js";

const Client = {
  // ✅ Create a new client
  create: (name, email, hashedPassword, phone, birthDate, gender, bio, adresses, callback) => {
    const sql = `
      INSERT INTO clients 
      (name, email, password, phone, birthDate, gender, bio, adresses) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    db.query(sql, [name, email, hashedPassword, phone, birthDate, gender, bio, adresses], callback);
  },

  // ✅ Find a client by email
  findByEmail: (email, callback) => {
    const sql = "SELECT * FROM clients WHERE email = ?";
    db.query(sql, [email], callback);
  },

  // ✅ Find a client by ID
  findById: (id, callback) => {
    const sql = "SELECT * FROM clients WHERE id = ?";
    db.query(sql, [id], callback);
  },

  // ✅ Get all clients
  getAll: (callback) => {
    const sql = "SELECT * FROM clients";
    db.query(sql, callback);
  },

  // ✅ Update a client's info
  update: (id, name, email, phone, birthDate, gender, bio, adresses, callback) => {
    const sql = `
      UPDATE clients 
      SET name = ?, email = ?, phone = ?, birthDate = ?, gender = ?, bio = ?, adresses = ? 
      WHERE id = ?
    `;
    db.query(sql, [name, email, phone, birthDate, gender, bio, adresses, id], callback);
  },

  // ✅ Delete a client
  delete: (id, callback) => {
    const sql = "DELETE FROM clients WHERE id = ?";
    db.query(sql, [id], callback);
  }
};

export default Client;
