-- Correct Row Level Security policies for the shipments table
-- This script ensures users can only access their own shipments

-- Make sure RLS is enabled
ALTER TABLE IF EXISTS "public"."shipments" ENABLE ROW LEVEL SECURITY;

-- Policy for users to select their own shipments only
DROP POLICY IF EXISTS "Authenticated users can view shipments" ON "public"."shipments";
DROP POLICY IF EXISTS "Users can view their own shipments" ON "public"."shipments";
CREATE POLICY "Users can view their own shipments" ON "public"."shipments"
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy for users to insert their own shipments only
DROP POLICY IF EXISTS "Authenticated users can insert shipments" ON "public"."shipments";
DROP POLICY IF EXISTS "Users can insert their own shipments" ON "public"."shipments";
CREATE POLICY "Users can insert their own shipments" ON "public"."shipments" 
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy for users to update their own shipments only
DROP POLICY IF EXISTS "Authenticated users can update shipments" ON "public"."shipments";
DROP POLICY IF EXISTS "Users can update their own shipments" ON "public"."shipments";
CREATE POLICY "Users can update their own shipments" ON "public"."shipments"
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Add a policy for admins to view all shipments (if admin role exists)
DO $$
BEGIN
    -- Check if there's an admin role in the system
    IF EXISTS (
        SELECT 1 FROM pg_roles WHERE rolname = 'admin'
    ) THEN
        DROP POLICY IF EXISTS "Admins can view all shipments" ON "public"."shipments";
        CREATE POLICY "Admins can view all shipments" ON "public"."shipments"
        FOR SELECT
        TO admin
        USING (true);
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Skipping admin policy creation: %', SQLERRM;
END
$$;
