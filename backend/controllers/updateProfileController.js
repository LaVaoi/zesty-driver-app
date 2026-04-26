import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";
import fs from "fs";
import pool from "../config/db.js";
import axios from "axios";

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = "uploads/profileImages";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `profile_${Date.now()}${ext}`);
  },
});

export const uploadProfileImage = multer({ storage }).single("image"); // "image" is the field name

// Helper function to geocode address and get lat/lon
const geocodeAddress = async (address) => {
  try {
    const encodedAddress = encodeURIComponent(address);
    const response = await axios.get(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`,
      {
        headers: {
          'User-Agent': 'DeliveryApp/1.0'
        }
      }
    );
    
    if (response.data && response.data.length > 0) {
      return {
        lat: parseFloat(response.data[0].lat),
        lon: parseFloat(response.data[0].lon)
      };
    }
    return null;
  } catch (error) {
    console.error("Geocoding error:", error.message);
    return null;
  }
};

// Updated updateProfile function
export const updateProfile = async (req, res) => {
  let connection;
  try {
    // 1️⃣ Verify token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const clientId = decoded.id;

    // 2️⃣ Get fields safely from req.body
    const name = req.body.name || null;
    const email = req.body.email || null;
    const phone = req.body.phone || null;
    const gender = req.body.gender || null;
    const bio = req.body.bio || null;
    let imagePath = null; // to update in DB

    // 3️⃣ Handle uploaded image
    connection = await pool.getConnection();

    // Get old image from DB
    const [oldRows] = await connection.execute(
      "SELECT image FROM clients WHERE id = ?",
      [clientId]
    );
    const oldImage = oldRows[0]?.image;

    if (req.file) {
      // User uploaded a new image
      imagePath = req.file.filename;

      // Delete old image if exists
      if (oldImage) {
        const oldPath = path.join("uploads/profileImages", oldImage);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
    } else if (req.body.image === "") {
      // User wants to remove current image
      imagePath = ""; // will clear DB

      if (oldImage) {
        const oldPath = path.join("uploads/profileImages", oldImage);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
    }

    connection.release();

    // 4️⃣ Make sure at least one field exists
    if (!name && !email && !phone && !gender && !bio && imagePath === null) {
      return res.status(400).json({ message: "No data provided to update" });
    }

    // 5️⃣ Build dynamic SQL
    const fields = [];
    const values = [];


    if (name) { fields.push("name = ?"); values.push(name); }
    if (email) { fields.push("email = ?"); values.push(email); }
    if (phone) { fields.push("phone = ?"); values.push(phone); }
    if (gender) { fields.push("gender = ?"); values.push(gender); }
    if (bio) { fields.push("bio = ?"); values.push(bio); }
    if (imagePath !== null) { fields.push("image = ?"); values.push(imagePath); }

    values.push(clientId);
    const sql = `UPDATE clients SET ${fields.join(", ")} WHERE id = ?`;


    // 6️⃣ Execute update
    connection = await pool.getConnection();
    const [result] = await connection.execute(sql, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Client not found" });
    }

    // 7️⃣ Fetch updated client
    const [rows] = await connection.execute(
      "SELECT id, name, email, phone, gender, bio, image FROM clients WHERE id = ?",
      [clientId]
    );

    return res.status(200).json({
      message: "Profile updated successfully",
      client: rows[0],
    });
  } catch (error) {
    console.error("❌ Error updating profile:", error.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};
