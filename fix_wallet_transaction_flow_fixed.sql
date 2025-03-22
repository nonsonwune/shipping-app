-- This script fixes wallet funding issues by ensuring proper table structure and triggers

-- Create extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- TRANSACTIONS TABLE
-- Check if transactions table exists and create or modify it
DO $$
BEGIN
    -- Check if transactions table exists
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'transactions') THEN
        -- Check if all required columns exist and add them if not
        
        -- Check reference column - add it as nullable first, then update existing rows, then make it NOT NULL
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                     WHERE table_schema = 'public' 
                     AND table_name = 'transactions' 
                     AND column_name = 'reference') THEN
            -- Add as nullable first
            ALTER TABLE public.transactions ADD COLUMN reference TEXT;
            
            -- Update existing records with a generated reference
            UPDATE public.transactions 
            SET reference = 'MIGRATED-' || id::text 
            WHERE reference IS NULL;
            
            -- Now make it NOT NULL and UNIQUE
            ALTER TABLE public.transactions ALTER COLUMN reference SET NOT NULL;
            ALTER TABLE public.transactions ADD CONSTRAINT transactions_reference_unique UNIQUE (reference);
            
            RAISE NOTICE 'Added reference column to transactions table';
        END IF;
        
        -- Check type column (appears to exist in the database but wasn't in our script)
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                     WHERE table_schema = 'public' 
                     AND table_name = 'transactions' 
                     AND column_name = 'type') THEN
            -- Add as nullable first
            ALTER TABLE public.transactions ADD COLUMN type TEXT;
            
            -- Update existing records with default value
            UPDATE public.transactions 
            SET type = 'payment' 
            WHERE type IS NULL;
            
            -- Now make it NOT NULL
            ALTER TABLE public.transactions ALTER COLUMN type SET NOT NULL;
            
            RAISE NOTICE 'Added type column to transactions table';
        END IF;
        
        -- Check payment_gateway column
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                     WHERE table_schema = 'public' 
                     AND table_name = 'transactions' 
                     AND column_name = 'payment_gateway') THEN
            -- Add as nullable first
            ALTER TABLE public.transactions ADD COLUMN payment_gateway TEXT;
            
            -- Update existing records with default value
            UPDATE public.transactions 
            SET payment_gateway = 'paystack' 
            WHERE payment_gateway IS NULL;
            
            -- Now make it NOT NULL
            ALTER TABLE public.transactions ALTER COLUMN payment_gateway SET NOT NULL;
            
            RAISE NOTICE 'Added payment_gateway column to transactions table';
        END IF;
        
        -- Check payment_gateway_reference column
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                     WHERE table_schema = 'public' 
                     AND table_name = 'transactions' 
                     AND column_name = 'payment_gateway_reference') THEN
            ALTER TABLE public.transactions ADD COLUMN payment_gateway_reference TEXT;
            RAISE NOTICE 'Added payment_gateway_reference column to transactions table';
        END IF;
        
        -- Check transaction_type column
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                     WHERE table_schema = 'public' 
                     AND table_name = 'transactions' 
                     AND column_name = 'transaction_type') THEN
            -- Add as nullable first
            ALTER TABLE public.transactions ADD COLUMN transaction_type TEXT;
            
            -- Update existing records with default value
            UPDATE public.transactions 
            SET transaction_type = 'wallet_funding' 
            WHERE transaction_type IS NULL;
            
            -- Now make it NOT NULL and add the check constraint
            ALTER TABLE public.transactions ALTER COLUMN transaction_type SET NOT NULL;
            ALTER TABLE public.transactions ADD CONSTRAINT transaction_type_check 
                CHECK (transaction_type IN ('wallet_funding', 'payment', 'refund', 'transfer'));
            
            RAISE NOTICE 'Added transaction_type column to transactions table';
        END IF;
        
    ELSE
        -- Create transactions table if it doesn't exist
        CREATE TABLE public.transactions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            reference TEXT NOT NULL UNIQUE,
            amount DECIMAL(12, 2) NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
            payment_gateway TEXT NOT NULL DEFAULT 'paystack',
            payment_gateway_reference TEXT,
            transaction_type TEXT NOT NULL CHECK (transaction_type IN ('wallet_funding', 'payment', 'refund', 'transfer')),
            type TEXT NOT NULL DEFAULT 'payment',
            metadata JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
        );
        
        RAISE NOTICE 'Created transactions table with all required columns';
    END IF;

    -- Make sure RLS is enabled for transactions
    ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
    
    -- Check if policies exist and create them if not
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'transactions' AND policyname = 'transactions_select_policy') THEN
        CREATE POLICY transactions_select_policy ON public.transactions
            FOR SELECT 
            USING (auth.uid() = user_id);
        RAISE NOTICE 'Created transactions select policy';
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'transactions' AND policyname = 'transactions_insert_policy') THEN
        CREATE POLICY transactions_insert_policy ON public.transactions
            FOR INSERT 
            WITH CHECK (auth.uid() = user_id);
        RAISE NOTICE 'Created transactions insert policy';
    END IF;
    
    -- Add a special admin insert policy for service role
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'transactions' AND policyname = 'transactions_service_insert_policy') THEN
        DROP POLICY IF EXISTS transactions_service_insert_policy ON public.transactions;
        CREATE POLICY transactions_service_insert_policy ON public.transactions
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
        RAISE NOTICE 'Created transactions service policy with full permissions';
    END IF;
END$$;

-- WALLETS TABLE
-- Check if wallets table exists and create it if not
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'wallets') THEN
        -- Create wallets table
        CREATE TABLE public.wallets (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
            currency TEXT NOT NULL DEFAULT 'NGN',
            last_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            CONSTRAINT unique_user_wallet UNIQUE (user_id)
        );

        RAISE NOTICE 'Created wallets table';
    END IF;
    
    -- Make sure RLS is enabled for wallets
    ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
    
    -- Check if policies exist and create them if not
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'wallets' AND policyname = 'wallets_select_policy') THEN
        CREATE POLICY wallets_select_policy ON public.wallets
            FOR SELECT 
            USING (auth.uid() = user_id);
        RAISE NOTICE 'Created wallets select policy';
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'wallets' AND policyname = 'wallets_update_policy') THEN
        CREATE POLICY wallets_update_policy ON public.wallets
            FOR UPDATE 
            USING (auth.uid() = user_id);
        RAISE NOTICE 'Created wallets update policy';
    END IF;
    
    -- Add a special service role policy for admin operations
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'wallets' AND policyname = 'wallets_service_policy') THEN
        CREATE POLICY wallets_service_policy ON public.wallets
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
        RAISE NOTICE 'Created wallets service policy';
    END IF;
    
    -- Special insert policy for authenticated users (to create their own wallet)
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'wallets' AND policyname = 'wallets_insert_policy') THEN
        CREATE POLICY wallets_insert_policy ON public.wallets
            FOR INSERT
            TO authenticated
            WITH CHECK (auth.uid() = user_id);
        RAISE NOTICE 'Created wallets insert policy';
    END IF;
END$$;

-- Create the wallet update trigger function
CREATE OR REPLACE FUNCTION update_wallet_on_transaction()
RETURNS TRIGGER AS $$
BEGIN
    -- Only proceed if transaction status changed to 'completed'
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        -- For wallet funding
        IF NEW.transaction_type = 'wallet_funding' THEN
            -- Check if wallet exists
            IF EXISTS (SELECT 1 FROM public.wallets WHERE user_id = NEW.user_id) THEN
                -- Update existing wallet
                UPDATE public.wallets
                SET balance = balance + NEW.amount,
                    last_updated = now()
                WHERE user_id = NEW.user_id;
                
                RAISE NOTICE 'Updated wallet balance for user %', NEW.user_id;
            ELSE
                -- Create new wallet
                INSERT INTO public.wallets (user_id, balance, currency)
                VALUES (NEW.user_id, NEW.amount, 'NGN');
                
                RAISE NOTICE 'Created new wallet for user %', NEW.user_id;
            END IF;
        -- For payment (deduction)
        ELSIF NEW.transaction_type = 'payment' THEN
            -- Update wallet balance (ensure sufficient funds check is done before)
            UPDATE public.wallets
            SET balance = balance - NEW.amount,
                last_updated = now()
            WHERE user_id = NEW.user_id;
        -- For refund
        ELSIF NEW.transaction_type = 'refund' THEN
            -- Update wallet balance
            UPDATE public.wallets
            SET balance = balance + NEW.amount,
                last_updated = now()
            WHERE user_id = NEW.user_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Check if the trigger exists and create it if not
DO $$
BEGIN
    -- Drop existing trigger if it exists (to update it)
    DROP TRIGGER IF EXISTS update_wallet_on_transaction_trigger ON public.transactions;
    
    -- Create the trigger
    CREATE TRIGGER update_wallet_on_transaction_trigger
    AFTER INSERT OR UPDATE OF status
    ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_wallet_on_transaction();
    
    RAISE NOTICE 'Created/updated wallet update trigger';
END$$;

-- Add a function to manually sync wallet balances based on completed transactions
CREATE OR REPLACE FUNCTION sync_wallet_balances()
RETURNS void AS $$
DECLARE
    user_rec RECORD;
    total_funding DECIMAL(12, 2);
    total_payments DECIMAL(12, 2);
    total_refunds DECIMAL(12, 2);
    new_balance DECIMAL(12, 2);
BEGIN
    -- For each user in the system
    FOR user_rec IN SELECT DISTINCT user_id FROM public.transactions WHERE status = 'completed'
    LOOP
        -- Calculate total wallet funding
        SELECT COALESCE(SUM(amount), 0) INTO total_funding
        FROM public.transactions
        WHERE user_id = user_rec.user_id
        AND status = 'completed'
        AND transaction_type = 'wallet_funding';
        
        -- Calculate total payments
        SELECT COALESCE(SUM(amount), 0) INTO total_payments
        FROM public.transactions
        WHERE user_id = user_rec.user_id
        AND status = 'completed'
        AND transaction_type = 'payment';
        
        -- Calculate total refunds
        SELECT COALESCE(SUM(amount), 0) INTO total_refunds
        FROM public.transactions
        WHERE user_id = user_rec.user_id
        AND status = 'completed'
        AND transaction_type = 'refund';
        
        -- Calculate new balance
        new_balance := total_funding - total_payments + total_refunds;
        
        -- Update or create wallet with calculated balance
        IF EXISTS (SELECT 1 FROM public.wallets WHERE user_id = user_rec.user_id) THEN
            UPDATE public.wallets
            SET balance = new_balance,
                last_updated = now()
            WHERE user_id = user_rec.user_id;
        ELSE
            INSERT INTO public.wallets (user_id, balance, currency)
            VALUES (user_rec.user_id, new_balance, 'NGN');
        END IF;
        
        RAISE NOTICE 'Synced wallet balance for user %, new balance: %', user_rec.user_id, new_balance;
    END LOOP;
    
    RAISE NOTICE 'Wallet balance sync completed';
END;
$$ LANGUAGE plpgsql;

-- You can call this function manually to sync all wallet balances:
-- SELECT sync_wallet_balances();
