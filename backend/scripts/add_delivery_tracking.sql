-- Migration: Add delivery tracking columns and delivery performance table
-- Run this migration to add delivery time tracking and performance metrics

-- Add delivery time tracking columns to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS out_for_delivery_at DATETIME NULL,
ADD COLUMN IF NOT EXISTS delivered_at DATETIME NULL;

-- Create delivery_performance table for tracking delivery man statistics
CREATE TABLE IF NOT EXISTS delivery_performance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  delivery_man_id INT NOT NULL,
  order_id INT NOT NULL,
  delivery_fee DECIMAL(10,2) DEFAULT 0,
  delivery_time_minutes INT NULL, -- Time from OutForDelivery to Delivered (in minutes)
  rating DECIMAL(2,1) NULL, -- Rating from order_ratings.delivery_service
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (delivery_man_id) REFERENCES delivery_men(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  INDEX idx_delivery_man (delivery_man_id),
  INDEX idx_order (order_id),
  INDEX idx_created_at (created_at)
);

-- Create index on orders for faster queries
CREATE INDEX IF NOT EXISTS idx_orders_delivery_man_status ON orders(delivery_man_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

