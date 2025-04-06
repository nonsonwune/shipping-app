-- 1. Drop existing incorrect foreign key on admin_id if it exists
DO $$ 
BEGIN
   IF EXISTS(SELECT 1 FROM pg_constraint WHERE conname = 'admin_audit_logs_admin_id_fkey') THEN
      ALTER TABLE admin_audit_logs DROP CONSTRAINT admin_audit_logs_admin_id_fkey;
   END IF;
END $$;

-- 2. Add the correct foreign key constraint for admin_id referencing profiles table
-- Make sure the target column (id) in profiles is UNIQUE or PRIMARY KEY
ALTER TABLE admin_audit_logs
ADD CONSTRAINT admin_audit_logs_admin_id_fkey
FOREIGN KEY (admin_id)
REFERENCES profiles(id)
ON DELETE SET NULL; -- Set admin_id to NULL if the profile is deleted

-- 3. Add the foreign key constraint for user_affected referencing profiles table
ALTER TABLE admin_audit_logs
ADD CONSTRAINT admin_audit_logs_user_affected_fkey
FOREIGN KEY (user_affected)
REFERENCES profiles(id)
ON DELETE SET NULL; -- Set user_affected to NULL if the profile is deleted

-- 4. Refresh the schema cache so PostgREST recognizes the new constraints
SELECT pg_notify('pgrst', 'reload schema');
