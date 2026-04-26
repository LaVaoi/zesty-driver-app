-- SQL script to create a test delivery man account
-- Run this in your MySQL database

-- First, you need to hash the password "Delivery123!" using bcrypt
-- For testing, you can use this pre-hashed password (for "Delivery123!"):
-- $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy

INSERT INTO delivery_men (name, email, password, phone, vehicle_type, license_number, is_active)
VALUES (
  'Test Delivery Man',
  'delivery@test.com',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', -- Password: Delivery123!
  '+212600000000',
  'Motorcycle',
  'DL123456',
  1
);

-- Login credentials:
-- Email: delivery@test.com
-- Password: Delivery123!

