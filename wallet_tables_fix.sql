-- This script will safely check and update the schema for wallet functionality

-- Check and update transactions table
DO $$
BEGIN
    -- Check if transactions table exists but status column doesn't
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'transactions'
    ) AND NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'status'
    ) THEN
        -- Add the missing status column
        ALTER TABLE public.transactions 
        ADD COLUMN status TEXT NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'completed', 'failed', 'refunded'));
        
        RAISE NOTICE 'Added status column to existing transactions table';
    END IF;
    
    -- Check if transactions table exists but transaction_type column doesn't
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'transactions'
    ) AND NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'transaction_type'
    ) THEN
        -- Add the missing transaction_type column
        ALTER TABLE public.transactions 
        ADD COLUMN transaction_type TEXT NOT NULL DEFAULT 'wallet_funding'
        CHECK (transaction_type IN ('wallet_funding', 'payment', 'refund', 'transfer'));
        
        RAISE NOTICE 'Added transaction_type column to existing transactions table';
    END IF;
    
    -- Check if transactions table exists but metadata column doesn't
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'transactions'
    ) AND NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'metadata'
    ) THEN
        -- Add the missing metadata column
        ALTER TABLE public.transactions 
        ADD COLUMN metadata JSONB;
        
        RAISE NOTICE 'Added metadata column to existing transactions table';
    END IF;
    
    -- Check if wallets table exists but balance column doesn't
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'wallets'
    ) AND NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'wallets' AND column_name = 'balance'
    ) THEN
        -- Add the missing balance column
        ALTER TABLE public.wallets 
        ADD COLUMN balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00;
        
        RAISE NOTICE 'Added balance column to existing wallets table';
    END IF;
    
    -- Check if wallets table exists but currency column doesn't
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'wallets'
    ) AND NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'wallets' AND column_name = 'currency'
    ) THEN
        -- Add the missing currency column
        ALTER TABLE public.wallets 
        ADD COLUMN currency TEXT NOT NULL DEFAULT 'NGN';
        
        RAISE NOTICE 'Added currency column to existing wallets table';
    END IF;
    
    -- Check if wallets table exists but last_updated column doesn't
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'wallets'
    ) AND NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'wallets' AND column_name = 'last_updated'
    ) THEN
        -- Add the missing last_updated column
        ALTER TABLE public.wallets 
        ADD COLUMN last_updated TIMESTAMP WITH TIME ZONE DEFAULT now();
        
        RAISE NOTICE 'Added last_updated column to existing wallets table';
    END IF;
END$$;

-- Create transactions table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reference TEXT NOT NULL UNIQUE,
    amount DECIMAL(12, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    payment_gateway TEXT NOT NULL DEFAULT 'paystack',
    payment_gateway_reference TEXT,
    transaction_type TEXT NOT NULL DEFAULT 'wallet_funding' CHECK (transaction_type IN ('wallet_funding', 'payment', 'refund', 'transfer')),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create wallets table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'NGN',
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT unique_user_wallet UNIQUE (user_id)
);

-- Create transaction history table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.transaction_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_history ENABLE ROW LEVEL SECURITY;

-- Create or replace RLS policies
-- Wallets policies
DROP POLICY IF EXISTS wallets_select_policy ON public.wallets;
CREATE POLICY wallets_select_policy ON public.wallets
    FOR SELECT 
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS wallets_update_policy ON public.wallets;
CREATE POLICY wallets_update_policy ON public.wallets
    FOR UPDATE 
    USING (auth.uid() = user_id);

-- Transactions policies
DROP POLICY IF EXISTS transactions_select_policy ON public.transactions;
CREATE POLICY transactions_select_policy ON public.transactions
    FOR SELECT 
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS transactions_insert_policy ON public.transactions;
CREATE POLICY transactions_insert_policy ON public.transactions
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Transaction history policies
DROP POLICY IF EXISTS transaction_history_select_policy ON public.transaction_history;
CREATE POLICY transaction_history_select_policy ON public.transaction_history
    FOR SELECT 
    USING (auth.uid() = user_id);

-- Create or replace functions for triggers
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
        -- For transfer
        ELSIF NEW.transaction_type = 'transfer' AND NEW.metadata->>'recipient_id' IS NOT NULL THEN
            -- Update sender's wallet
            UPDATE public.wallets
            SET balance = balance - NEW.amount,
                last_updated = now()
            WHERE user_id = NEW.user_id;
            
            -- Update recipient's wallet
            IF EXISTS (SELECT 1 FROM public.wallets WHERE user_id = (NEW.metadata->>'recipient_id')::uuid) THEN
                UPDATE public.wallets
                SET balance = balance + NEW.amount,
                    last_updated = now()
                WHERE user_id = (NEW.metadata->>'recipient_id')::uuid;
            ELSE
                INSERT INTO public.wallets (user_id, balance, currency)
                VALUES ((NEW.metadata->>'recipient_id')::uuid, NEW.amount, 'NGN');
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION record_transaction_history()
RETURNS TRIGGER AS $$
BEGIN
    -- Create a new transaction history record
    INSERT INTO public.transaction_history (
        transaction_id,
        user_id,
        previous_status,
        new_status,
        metadata
    ) VALUES (
        NEW.id,
        NEW.user_id,
        CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
        NEW.status,
        jsonb_build_object(
            'timestamp', now(),
            'transaction_type', NEW.transaction_type,
            'amount', NEW.amount,
            'reference', NEW.reference
        )
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_update_wallet_on_transaction ON public.transactions;
DROP TRIGGER IF EXISTS trigger_record_transaction_history ON public.transactions;

-- Create triggers
CREATE TRIGGER trigger_update_wallet_on_transaction
AFTER INSERT OR UPDATE OF status
ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION update_wallet_on_transaction();

CREATE TRIGGER trigger_record_transaction_history
AFTER INSERT OR UPDATE OF status
ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION record_transaction_history();

-- Create or replace the financial summary view
DROP VIEW IF EXISTS public.user_financial_summary;
CREATE VIEW public.user_financial_summary AS
SELECT 
    u.id AS user_id,
    u.email,
    COALESCE(w.balance, 0) AS wallet_balance,
    COALESCE(w.currency, 'NGN') AS currency,
    COUNT(t.id) AS total_transactions,
    SUM(CASE WHEN t.transaction_type = 'wallet_funding' AND t.status = 'completed' THEN t.amount ELSE 0 END) AS total_funded,
    SUM(CASE WHEN t.transaction_type = 'payment' AND t.status = 'completed' THEN t.amount ELSE 0 END) AS total_spent,
    COALESCE(w.last_updated, u.created_at) AS last_wallet_update
FROM 
    auth.users u
LEFT JOIN 
    public.wallets w ON u.id = w.user_id
LEFT JOIN 
    public.transactions t ON u.id = t.user_id
GROUP BY 
    u.id, u.email, w.balance, w.currency, w.last_updated;

-- Instead of RLS policy for the view (which is not supported),
-- create a secure view access function
CREATE OR REPLACE FUNCTION public.get_user_financial_summary()
RETURNS TABLE (
    user_id UUID,
    email TEXT,
    wallet_balance DECIMAL(12, 2),
    currency TEXT,
    total_transactions BIGINT,
    total_funded DECIMAL(12, 2),
    total_spent DECIMAL(12, 2),
    last_wallet_update TIMESTAMP WITH TIME ZONE
) 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fs.user_id,
        fs.email,
        fs.wallet_balance,
        fs.currency,
        fs.total_transactions,
        fs.total_funded,
        fs.total_spent,
        fs.last_wallet_update
    FROM 
        public.user_financial_summary fs
    WHERE 
        fs.user_id = auth.uid();
END;
$$ LANGUAGE plpgsql;
