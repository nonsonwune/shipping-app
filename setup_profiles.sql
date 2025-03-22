-- Create the profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS "public"."profiles" (
  "id" uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  "updated_at" timestamp with time zone DEFAULT now(),
  "first_name" text,
  "last_name" text, 
  "email" text,
  "phone" text,
  "avatar_url" text,
  "wallet_balance" numeric DEFAULT 0 NOT NULL
);

-- Add RLS to profiles table
ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for profiles
DROP POLICY IF EXISTS "Users can view own profile" ON "public"."profiles";
CREATE POLICY "Users can view own profile" ON "public"."profiles"
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON "public"."profiles";
CREATE POLICY "Users can update own profile" ON "public"."profiles"
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON "public"."profiles";
CREATE POLICY "Users can insert own profile" ON "public"."profiles"
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Function to handle new user signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger the function every time a user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert trigger for existing users if they don't have a profile
DO $$
BEGIN
  INSERT INTO public.profiles (id, email)
  SELECT id, email FROM auth.users
  WHERE NOT EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = users.id);
END;
$$;
