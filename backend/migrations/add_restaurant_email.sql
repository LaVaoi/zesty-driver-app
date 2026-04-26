-- Add restaurant_email column to restaurant_settings table
ALTER TABLE restaurant_settings 
ADD COLUMN restaurant_email VARCHAR(255) NULL 
AFTER phone;

-- Add index for better performance if needed
CREATE INDEX idx_restaurant_email ON restaurant_settings(restaurant_email);
