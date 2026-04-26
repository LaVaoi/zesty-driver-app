import bcrypt from "bcryptjs";
import pool from "../config/db.js";
import dotenv from "dotenv";

dotenv.config();

const createAdmin = async () => {
  let connection;
  try {
    const args = process.argv.slice(2);
    
    // Default admin credentials (can be overridden via command line)
    const name = args[0] || "Admin";
    const email = args[1] || "admin@restaurant.com";
    const password = args[2] || "Admin123!";
    const role = args[3] || "super_admin";

    connection = await pool.getConnection();

    // Check if admin already exists
    const [existing] = await connection.execute(
      "SELECT * FROM admins WHERE email = ?",
      [email]
    );

    if (existing.length > 0) {
      console.log("❌ Admin with this email already exists");
      process.exit(1);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert admin
    await connection.execute(
      `INSERT INTO admins (name, email, password, role, is_active)
       VALUES (?, ?, ?, ?, 1)`,
      [name, email, hashedPassword, role]
    );

    console.log("✅ Admin created successfully!");
    console.log(`   Name: ${name}`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log(`   Role: ${role}`);
    console.log("\n⚠️  Please change the password after first login!");

    connection.release();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating admin:", error.message);
    if (connection) connection.release();
    process.exit(1);
  }
};

createAdmin();

