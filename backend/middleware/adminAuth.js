import { executeQuery } from "../config/db.js";

export const verifyAdminToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const [rows] = await executeQuery(
      `SELECT id, name, email, is_active 
       FROM admins 
       WHERE api_token = ? 
         AND token_expires_at IS NOT NULL 
         AND token_expires_at > NOW()`,
      [token]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: "Invalid or expired session" });
    }

    const admin = rows[0];

    if (!admin.is_active) {
      return res.status(403).json({ message: "Your admin account is inactive" });
    }

    req.adminId = admin.id;
    req.admin = admin;
    next();
  } catch (error) {
    console.error("Admin token verification error:", error);
    return res.status(401).json({ message: "Invalid token" });
  }
};

