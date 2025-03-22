-- This script will safely check and fix the transactions table

-- Create extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Check and update transactions table
DO $$
BEGIN
    -- Check if transactions table exists
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'transactions') THEN
        -- Check if payment_gateway column exists
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                     WHERE table_schema = 'public' 
                     AND table_name = 'transactions' 
                     AND column_name = 'payment_gateway') THEN
            -- Add payment_gateway column if it doesn't exist
            ALTER TABLE public.transactions 
            ADD COLUMN payment_gateway TEXT NOT NULL DEFAULT 'paystack';
            
            RAISE NOTICE 'Added payment_gateway column to transactions table';
        ELSE
            RAISE NOTICE 'payment_gateway column already exists in transactions table';
        END IF;
        
        -- Check if payment_gateway_reference column exists
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                     WHERE table_schema = 'public' 
                     AND table_name = 'transactions' 
                     AND column_name = 'payment_gateway_reference') THEN
            -- Add payment_gateway_reference column if it doesn't exist
            ALTER TABLE public.transactions 
            ADD COLUMN payment_gateway_reference TEXT;
            
            RAISE NOTICE 'Added payment_gateway_reference column to transactions table';
        ELSE
            RAISE NOTICE 'payment_gateway_reference column already exists in transactions table';
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
            metadata JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
        );
        
        -- Add RLS policies for transactions
        ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

        -- Users can view only their own transactions
        CREATE POLICY transactions_select_policy ON public.transactions
            FOR SELECT 
            USING (auth.uid() = user_id);

        -- Users can insert their own transactions (this would typically be restricted in production)
        CREATE POLICY transactions_insert_policy ON public.transactions
            FOR INSERT 
            WITH CHECK (auth.uid() = user_id);
            
        RAISE NOTICE 'Created transactions table with all required columns';
    END IF;

    -- Check if wallets table exists and create if not
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

        -- Add RLS policies for wallets
        ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

        -- Users can view only their own wallet
        CREATE POLICY wallets_select_policy ON public.wallets
            FOR SELECT 
            USING (auth.uid() = user_id);

        -- Users can update only their own wallet (this would typically be restricted in production)
        CREATE POLICY wallets_update_policy ON public.wallets
            FOR UPDATE 
            USING (auth.uid() = user_id);
            
        RAISE NOTICE 'Created wallets table';
    ELSE
        RAISE NOTICE 'Wallets table already exists';
    END IF;
    
    -- Check if the wallet update trigger exists
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_wallet_on_transaction_trigger') THEN
        -- Create the trigger function if it doesn't exist
        CREATE OR REPLACE FUNCTION update_wallet_on_transaction()
        RETURNS TRIGGER AS $$
        BEGIN
            -- Only proceed if transaction status is 'completed'
            IF NEW.status = 'completed' THEN
                -- For wallet funding
                IF NEW.transaction_type = 'wallet_funding' THEN
                    -- Check if wallet exists
                    IF EXISTS (SELECT 1 FROM public.wallets WHERE user_id = NEW.user_id) THEN
                        -- Update existing wallet
                        UPDATE public.wallets
                        SET balance = balance + NEW.amount,
                            last_updated = now()
                        WHERE user_id = NEW.user_id;
                    ELSE
                        -- Create new wallet
                        INSERT INTO public.wallets (user_id, balance, currency)
                        VALUES (NEW.user_id, NEW.amount, 'NGN');
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

        -- Create the trigger
        CREATE TRIGGER update_wallet_on_transaction_trigger
        AFTER INSERT OR UPDATE OF status
        ON public.transactions
        FOR EACH ROW
        EXECUTE FUNCTION update_wallet_on_transaction();
        
        RAISE NOTICE 'Created wallet update trigger';
    ELSE
        RAISE NOTICE 'Wallet update trigger already exists';
    END IF;

END$$;
