# Database Schema Update: Customer Count → Customer Name

## 🚨 Important: Database Schema Update Required

The application has been updated to use `customer_name` instead of `customer_count`, but the database schema needs to be updated to match.

## 📋 Steps to Update Database Schema

### Option 1: Using Supabase Dashboard (Recommended)

1. **Go to your Supabase Dashboard**
2. **Navigate to SQL Editor**
3. **Run the following SQL commands:**

```sql
-- Step 1: Add the new customer_name column
ALTER TABLE orders 
ADD COLUMN customer_name TEXT;

-- Step 2: Copy existing customer_count data to customer_name (optional)
UPDATE orders 
SET customer_name = CASE 
  WHEN customer_count IS NOT NULL THEN 'Customer ' || customer_count::TEXT
  ELSE NULL 
END;

-- Step 3: Drop the old customer_count column
ALTER TABLE orders 
DROP COLUMN customer_count;
```

### Option 2: Using the SQL File

1. **Open the file `update-orders-schema.sql`**
2. **Copy the contents**
3. **Paste into Supabase SQL Editor**
4. **Execute the script**

## 🔄 Temporary Workaround

The application has been updated with a fallback mechanism that will:

1. **Try to use `customer_name`** (new schema)
2. **Fall back to `customer_count`** (old schema) if needed
3. **Log the transition** in the console

This allows the application to work during the schema transition.

## ✅ Verification

After running the SQL commands, verify the changes:

```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'orders' 
AND column_name IN ('customer_name', 'customer_count');
```

You should see:
- ✅ `customer_name` column exists
- ❌ `customer_count` column does not exist

## 🚀 After Schema Update

Once the database schema is updated:

1. **The application will work normally**
2. **Customer names will be stored properly**
3. **Orders will display customer names**
4. **The fallback mechanism will no longer be needed**

## ⚠️ Important Notes

- **Backup your data** before making schema changes
- **Test in a development environment** first if possible
- **Update any RLS policies** that reference `customer_count`
- **The application will work during transition** thanks to the fallback mechanism

## 🆘 If You Need Help

If you encounter any issues:

1. **Check the Supabase logs** for detailed error messages
2. **Verify the schema** using the verification query above
3. **Check RLS policies** for any references to the old column
4. **Contact support** if the issue persists
