-- This script fixes the RLS policies for the profiles table and creates a notifications table with proper RLS policies

-- Step 1: Fix the profiles table RLS policies
DO $$
DECLARE
    table_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles'
    ) INTO table_exists;

    IF table_exists THEN
        -- Check if INSERT policy already exists
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'public' 
            AND tablename = 'profiles' 
            AND operation = 'INSERT'
        ) THEN
            -- Add INSERT policy for profiles table
            CREATE POLICY profiles_insert_policy
            ON public.profiles
            FOR INSERT
            WITH CHECK (auth.uid() = id);
            
            RAISE NOTICE 'Created INSERT policy for profiles table';
        ELSE
            RAISE NOTICE 'INSERT policy already exists for profiles table';
        END IF;
    ELSE
        -- Create profiles table if it doesn't exist
        CREATE TABLE public.profiles (
            id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
            first_name TEXT,
            last_name TEXT,
            email TEXT,
            phone TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            username TEXT,
            full_name TEXT,
            avatar_url TEXT,
            wallet_balance DECIMAL DEFAULT 0
        );

        -- Enable Row Level Security
        ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

        -- Create RLS policies
        CREATE POLICY profiles_select_policy
        ON public.profiles
        FOR SELECT
        USING (auth.uid() = id);

        CREATE POLICY profiles_insert_policy
        ON public.profiles
        FOR INSERT
        WITH CHECK (auth.uid() = id);

        CREATE POLICY profiles_update_policy
        ON public.profiles
        FOR UPDATE
        USING (auth.uid() = id);
        
        RAISE NOTICE 'Created profiles table with RLS policies';
    END IF;
END $$;

-- Step 2: Create notifications table
DO $$
DECLARE
    table_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'notifications'
    ) INTO table_exists;

    IF NOT table_exists THEN
        -- Create notifications table
        CREATE TABLE public.notifications (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            is_read BOOLEAN DEFAULT false,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            metadata JSONB,
            CONSTRAINT valid_notification_type CHECK (type IN ('shipment', 'payment', 'system', 'success', 'warning'))
        );

        -- Create index for faster querying
        CREATE INDEX notifications_user_id_idx ON public.notifications(user_id);
        CREATE INDEX notifications_created_at_idx ON public.notifications(created_at);
        CREATE INDEX notifications_is_read_idx ON public.notifications(is_read);
        
        -- Enable Row Level Security
        ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

        -- Create RLS policies
        CREATE POLICY notifications_select_policy
        ON public.notifications
        FOR SELECT
        USING (auth.uid() = user_id);

        CREATE POLICY notifications_update_policy
        ON public.notifications
        FOR UPDATE
        USING (auth.uid() = user_id);

        CREATE POLICY notifications_insert_policy
        ON public.notifications
        FOR INSERT
        WITH CHECK (true);
        
        RAISE NOTICE 'Created notifications table with RLS policies';
    ELSE
        RAISE NOTICE 'Notifications table already exists';
        
        -- Check RLS policies
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'public' 
            AND tablename = 'notifications' 
            AND operation = 'SELECT'
        ) THEN
            -- Add SELECT policy
            CREATE POLICY notifications_select_policy
            ON public.notifications
            FOR SELECT
            USING (auth.uid() = user_id);
            
            RAISE NOTICE 'Created SELECT policy for notifications table';
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'public' 
            AND tablename = 'notifications' 
            AND operation = 'UPDATE'
        ) THEN
            -- Add UPDATE policy
            CREATE POLICY notifications_update_policy
            ON public.notifications
            FOR UPDATE
            USING (auth.uid() = user_id);
            
            RAISE NOTICE 'Created UPDATE policy for notifications table';
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'public' 
            AND tablename = 'notifications' 
            AND operation = 'INSERT'
        ) THEN
            -- Add INSERT policy
            CREATE POLICY notifications_insert_policy
            ON public.notifications
            FOR INSERT
            WITH CHECK (true);
            
            RAISE NOTICE 'Created INSERT policy for notifications table';
        END IF;
    END IF;
END $$;

-- Create function for shipment status change notification
CREATE OR REPLACE FUNCTION public.notify_shipment_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.status <> OLD.status THEN
        INSERT INTO public.notifications (
            user_id, 
            type, 
            title, 
            message, 
            metadata
        )
        VALUES (
            NEW.user_id, 
            'shipment', 
            'Shipment Status Updated', 
            'Your shipment ' || COALESCE(NEW.tracking_number, '') || ' status has been updated to ' || NEW.status, 
            jsonb_build_object(
                'shipment_id', NEW.id,
                'tracking_number', NEW.tracking_number,
                'old_status', OLD.status,
                'new_status', NEW.status
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Check if shipments table exists before creating trigger
DO $$
DECLARE
    shipments_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'shipments'
    ) INTO shipments_exists;
    
    IF shipments_exists THEN
        -- Drop the trigger first if it exists to avoid errors
        DROP TRIGGER IF EXISTS shipment_status_change_trigger ON public.shipments;
        
        -- Create the trigger
        CREATE TRIGGER shipment_status_change_trigger
        AFTER UPDATE ON public.shipments
        FOR EACH ROW
        EXECUTE FUNCTION public.notify_shipment_change();
        
        RAISE NOTICE 'Created shipment status change trigger';
    ELSE
        RAISE NOTICE 'Shipments table does not exist, skipping trigger creation';
    END IF;
END $$;

-- Add some test notifications for the currently logged-in user
INSERT INTO public.notifications (user_id, type, title, message)
SELECT 
    auth.uid(),
    'system',
    'Welcome to the Shipping App',
    'Thank you for joining our platform. Start shipping packages today!'
WHERE EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid());

INSERT INTO public.notifications (user_id, type, title, message)
SELECT 
    auth.uid(),
    'shipment',
    'Ready to Ship?',
    'Book your first shipment and get delivery updates here.'
WHERE EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid());

INSERT INTO public.notifications (user_id, type, title, message)
SELECT 
    auth.uid(),
    'payment',
    'Fund your wallet',
    'Add funds to your wallet for a seamless shipping experience.'
WHERE EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid());

-- Test the policies
SELECT 'RLS policies for profiles and notifications have been updated successfully!' AS result;
