-- Add role management to the shipping app

-- 1. Create a roles table to define available roles
CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "name" text UNIQUE NOT NULL,
    "description" text,
    "permissions" jsonb DEFAULT '{}',
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Insert default roles
INSERT INTO "public"."roles" ("name", "description", "permissions") 
VALUES 
    ('user', 'Regular user with standard permissions', '{"can_book_shipment": true, "can_track_shipment": true, "can_manage_profile": true}'),
    ('staff', 'Support staff with additional permissions', '{"can_book_shipment": true, "can_track_shipment": true, "can_manage_profile": true, "can_view_all_shipments": true, "can_update_shipment_status": true}'),
    ('admin', 'Administrator with full system access', '{"can_book_shipment": true, "can_track_shipment": true, "can_manage_profile": true, "can_view_all_shipments": true, "can_update_shipment_status": true, "can_manage_users": true, "can_manage_staff": true, "can_view_analytics": true}')
ON CONFLICT (name) DO NOTHING;

-- 2. Create a user_roles junction table to assign roles to users
CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "user_id" uuid REFERENCES auth.users NOT NULL,
    "role_id" uuid REFERENCES public.roles NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "created_by" uuid REFERENCES auth.users,
    UNIQUE(user_id, role_id)
);

-- 3. Modify the profiles table to add a default_role field
ALTER TABLE "public"."profiles" 
ADD COLUMN IF NOT EXISTS "default_role" uuid REFERENCES public.roles;

-- 4. Create a function to assign default role to new users
CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS TRIGGER AS $$
DECLARE
    user_role_id uuid;
BEGIN
    -- Get the user role ID
    SELECT id INTO user_role_id FROM public.roles WHERE name = 'user';
    
    -- Assign the user role to the new user
    INSERT INTO public.user_roles (user_id, role_id, created_by)
    VALUES (NEW.id, user_role_id, NEW.id);
    
    -- Update the default_role in profiles
    UPDATE public.profiles
    SET default_role = user_role_id
    WHERE id = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create a trigger to automatically assign the default role to new users
DROP TRIGGER IF EXISTS on_auth_user_created_assign_role ON auth.users;
CREATE TRIGGER on_auth_user_created_assign_role
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.assign_default_role();

-- 6. Update the handle_new_user function to include more user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (
        id, 
        email, 
        first_name, 
        last_name, 
        phone,
        account_type,
        created_at
    )
    VALUES (
        NEW.id, 
        NEW.email, 
        NEW.raw_user_meta_data->>'first_name', 
        NEW.raw_user_meta_data->>'last_name', 
        NEW.raw_user_meta_data->>'phone',
        NEW.raw_user_meta_data->>'account_type',
        NEW.created_at
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Set up RLS policies for the roles tables
ALTER TABLE IF EXISTS "public"."roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "public"."user_roles" ENABLE ROW LEVEL SECURITY;

-- Only admins can modify roles
CREATE POLICY "Admins can select roles" ON "public"."roles"
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    )
    OR 
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.name = 'staff'
    )
);

CREATE POLICY "Admins can insert roles" ON "public"."roles"
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    )
);

CREATE POLICY "Admins can update roles" ON "public"."roles"
FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    )
);

CREATE POLICY "Admins can delete roles" ON "public"."roles"
FOR DELETE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    )
);

-- Users can see their own roles, admins can see all
CREATE POLICY "Users can view their own roles" ON "public"."user_roles"
FOR SELECT TO authenticated
USING (
    user_id = auth.uid()
    OR 
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'staff')
    )
);

-- Only admins can modify user roles
CREATE POLICY "Admins can manage user roles" ON "public"."user_roles"
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    )
);

-- 8. Create helper functions to check user roles
CREATE OR REPLACE FUNCTION public.user_has_role(user_id uuid, role_name text)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = user_id AND r.name = role_name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_user_roles(user_id uuid)
RETURNS TABLE (role_name text, role_id uuid) AS $$
BEGIN
    RETURN QUERY
    SELECT r.name, r.id FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Create policies to allow admins to view all data
CREATE POLICY "Admins can view all profiles" ON "public"."profiles"
FOR SELECT TO authenticated
USING (
    auth.uid() = id 
    OR 
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'staff')
    )
);

CREATE POLICY "Admins can view all shipments" ON "public"."shipments"
FOR SELECT TO authenticated
USING (
    auth.uid() = user_id
    OR 
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'staff')
    )
);

-- 10. Create a wallets table if it doesn't exist
CREATE TABLE IF NOT EXISTS "public"."wallets" (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "user_id" uuid REFERENCES auth.users NOT NULL UNIQUE,
    "balance" numeric DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Set up RLS policies for wallets
ALTER TABLE IF EXISTS "public"."wallets" ENABLE ROW LEVEL SECURITY;

-- Users can see and update their own wallet, admins can see all
CREATE POLICY "Users can view their own wallet" ON "public"."wallets"
FOR SELECT TO authenticated
USING (
    user_id = auth.uid()
    OR 
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'staff')
    )
);

-- Only admins can update any wallet
CREATE POLICY "Admins can update any wallet" ON "public"."wallets"
FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    )
    OR user_id = auth.uid()
);
