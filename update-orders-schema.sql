-- Update orders table to replace customer_count with customer_name
-- Run this script in your Supabase SQL editor

-- Step 1: Add the new customer_name column
ALTER TABLE orders 
ADD COLUMN customer_name TEXT;

-- Step 2: Copy existing customer_count data to customer_name (optional)
-- This will create generic names like "Customer 1", "Customer 2", etc.
UPDATE orders 
SET customer_name = CASE 
  WHEN customer_count IS NOT NULL THEN 'Customer ' || customer_count::TEXT
  ELSE NULL 
END;

-- Step 3: Drop the old customer_count column
ALTER TABLE orders 
DROP COLUMN customer_count;

-- Step 4: Update any existing RLS policies if they reference customer_count
-- (You may need to recreate your RLS policies after this change)

-- Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'orders' 
AND column_name IN ('customer_name', 'customer_count');
