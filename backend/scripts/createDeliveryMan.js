/**
 * Helper script to create a delivery man account
 * Run with: node backend/scripts/createDeliveryMan.js
 */

import bcrypt from "bcryptjs";
import pool from "../config/db.js";
import dotenv from "dotenv";

dotenv.config();

const createDeliveryMan = async () => {
  try {
    const connection = await pool.getConnection();

    // Default test delivery man
    const name = "Test Delivery Man";
    const email = "delivery@test.com";
    const password = "Delivery123!";
    const phone = "+212600000000";
    const vehicle_type = "Motorcycle";
    const license_number = "DL123456";

    // Check if delivery man already exists
    const [existing] = await connection.execute(
      "SELECT * FROM delivery_men WHERE email = ?",
      [email]
    );

    if (existing.length > 0) {
      console.log("❌ Delivery man with this email already exists");
      connection.release();
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert delivery man
    await connection.execute(
      `INSERT INTO delivery_men 
      (name, email, password, phone, vehicle_type, license_number, is_active) 
      VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [name, email, hashedPassword, phone, vehicle_type, license_number]
    );

    console.log("✅ Delivery man created successfully!");
    console.log("\n📧 Login credentials:");
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log("\n🚀 You can now login at: /delivery/login");

    connection.release();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating delivery man:", error.message);
    process.exit(1);
  }
};

createDeliveryMan();

