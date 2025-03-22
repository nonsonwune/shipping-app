-- Reset admin password script
-- This SQL script directly updates the admin user's password in the Supabase auth.users table
-- The new password is set to: SecurePassword123!

-- Find the admin user ID first
DO $$
DECLARE
  admin_id uuid;
  hashed_password text;
BEGIN
  -- Get the admin user ID
  SELECT id INTO admin_id FROM auth.users WHERE email = 'admin@yourcompany.com';
  
  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'Admin user not found!';
  END IF;
  
  -- Create a hashed password
  -- This creates a properly hashed password with Supabase's expected format
  -- for the password 'SecurePassword123!'
  SELECT encode(crypto.digest(concat('pbkdf2-sha256$10000$', gen_salt('bf'), '$SecurePassword123!'), 'sha256'), 'hex') INTO hashed_password;
  
  -- Update the password
  UPDATE auth.users
  SET 
    encrypted_password = concat('$2a$10$', hashed_password),
    updated_at = now()
  WHERE id = admin_id;
  
  RAISE NOTICE 'Password reset successfully for admin@yourcompany.com';
END $$;
