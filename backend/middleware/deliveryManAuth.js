import jwt from "jsonwebtoken";
import pool from "../config/db.js";

export const verifyDeliveryManToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verify delivery man exists and is active
    const connection = await pool.getConnection();
    const [rows] = await connection.execute(
      "SELECT * FROM delivery_men WHERE id = ? AND is_active = 1",
      [decoded.id]
    );
    connection.release();

    if (rows.length === 0) {
      return res.status(401).json({ message: "Invalid or inactive account" });
    }

    req.deliveryManId = decoded.id;
    req.deliveryMan = rows[0];
    next();
  } catch (error) {
    console.error("Token verification error:", error);
    return res.status(401).json({ message: "Invalid token" });
  }
};

