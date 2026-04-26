import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Access denied. No token provided." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.clientId = decoded.id; // attach id to request object
    req.userId = decoded.id; // Also set userId for compatibility
    next();
  } catch (error) {
    console.error("❌ Token verification error:", error.message);
    console.error("   Token preview:", token.substring(0, 20) + '...');
    return res.status(403).json({ message: "Invalid or expired token." });
  }
};




// 🔍 NEW: Optional identification middleware
export const identifyClient = (req, res, next) => {
  const authHeader = req.headers.authorization;

  // If there's no token, just move to the controller as a guest
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    req.clientId = null; 
    return next();
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.clientId = decoded.id;
    next();
  } catch (error) {
    // If the token is invalid/expired, we still let them through, 
    // but as a guest (clientId = null)
    req.clientId = null;
    next();
  }
};