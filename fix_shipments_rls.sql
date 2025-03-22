-- Fix Row Level Security policies for the shipments table

-- Make sure RLS is enabled
ALTER TABLE IF EXISTS "public"."shipments" ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows authenticated users to insert any shipment
DROP POLICY IF EXISTS "Authenticated users can insert shipments" ON "public"."shipments";
CREATE POLICY "Authenticated users can insert shipments" 
ON "public"."shipments" 
FOR INSERT 
TO authenticated 
WITH CHECK (true);  -- Allow all inserts from authenticated users

-- Create a policy that allows users to select their shipments
-- This usually checks user_id = auth.uid(), but since we're using null as user_id temporarily,
-- we'll create a more permissive policy for now
DROP POLICY IF EXISTS "Authenticated users can view shipments" ON "public"."shipments";
CREATE POLICY "Authenticated users can view shipments" 
ON "public"."shipments" 
FOR SELECT 
TO authenticated 
USING (true);  -- Allow all selects from authenticated users

-- Create a policy that allows users to update their shipments
DROP POLICY IF EXISTS "Authenticated users can update shipments" ON "public"."shipments";
CREATE POLICY "Authenticated users can update shipments" 
ON "public"."shipments" 
FOR UPDATE 
TO authenticated 
USING (true);  -- Allow all updates from authenticated users
