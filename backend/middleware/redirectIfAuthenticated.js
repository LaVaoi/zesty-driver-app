import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

export const redirectIfAuthenticated = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    // No token, allow access
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // User is logged in → block access to login
    return res.status(400).json({ message: "You are already logged in." });
  } catch (error) {
    // Invalid or expired token → allow access
    next();
  }
};
