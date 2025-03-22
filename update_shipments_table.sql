-- Add missing columns to the shipments table or create it if it doesn't exist
CREATE TABLE IF NOT EXISTS "public"."shipments" (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "user_id" uuid REFERENCES auth.users NOT NULL,
    "service_type" text NOT NULL,
    "origin" text NOT NULL,
    "destination" text NOT NULL,
    "weight" numeric NOT NULL,
    "dimensions" text,
    "description" text,
    "recipient_name" text NOT NULL,
    "recipient_phone" text NOT NULL,
    "delivery_address" text NOT NULL,
    "delivery_instructions" text,
    "status" text DEFAULT 'pending' NOT NULL,
    "payment_method" text NOT NULL,
    "amount" numeric DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- If the table already exists but is missing the amount column, add it
ALTER TABLE IF EXISTS "public"."shipments" 
ADD COLUMN IF NOT EXISTS "amount" numeric DEFAULT 0 NOT NULL;

-- Set up RLS policies for shipments table
ALTER TABLE IF EXISTS "public"."shipments" ENABLE ROW LEVEL SECURITY;

-- Policy for users to select their own shipments
DROP POLICY IF EXISTS "Users can view their own shipments" ON "public"."shipments";
CREATE POLICY "Users can view their own shipments" ON "public"."shipments"
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy for users to insert their own shipments
DROP POLICY IF EXISTS "Users can insert their own shipments" ON "public"."shipments";
CREATE POLICY "Users can insert their own shipments" ON "public"."shipments" 
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy for users to update their own shipments
DROP POLICY IF EXISTS "Users can update their own shipments" ON "public"."shipments";
CREATE POLICY "Users can update their own shipments" ON "public"."shipments"
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);
