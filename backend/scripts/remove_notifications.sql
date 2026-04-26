-- Migration script to remove notification-related database structures
-- Run this script on your database to remove push_token columns and notifications table

-- Remove push_token column from clients table
ALTER TABLE clients DROP COLUMN IF EXISTS push_token;

-- Remove push_token column from delivery_men table
ALTER TABLE delivery_men DROP COLUMN IF EXISTS push_token;

-- Remove delivery_man_notifications table
DROP TABLE IF EXISTS delivery_man_notifications;

-- Note: This script uses IF EXISTS/IF NOT EXISTS syntax which may not work in all MySQL versions
-- If you get errors, remove the IF EXISTS/IF NOT EXISTS clauses

