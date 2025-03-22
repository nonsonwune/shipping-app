-- Create wallets and transactions tables for the shipping app

-- Create wallets table
CREATE TABLE IF NOT EXISTS public.wallets (
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

-- Create transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
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

-- Create a function to update wallet balance when a transaction is completed
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

-- Create trigger for transactions
DROP TRIGGER IF EXISTS trigger_update_wallet_on_transaction ON public.transactions;
CREATE TRIGGER trigger_update_wallet_on_transaction
AFTER INSERT OR UPDATE OF status
ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION update_wallet_on_transaction();

-- Create a function to record transaction history
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

-- Create transaction history table
CREATE TABLE IF NOT EXISTS public.transaction_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add RLS policies for transaction history
ALTER TABLE public.transaction_history ENABLE ROW LEVEL SECURITY;

-- Users can view only their own transaction history
CREATE POLICY transaction_history_select_policy ON public.transaction_history
    FOR SELECT 
    USING (auth.uid() = user_id);

-- Create trigger for transaction history
DROP TRIGGER IF EXISTS trigger_record_transaction_history ON public.transactions;
CREATE TRIGGER trigger_record_transaction_history
AFTER INSERT OR UPDATE OF status
ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION record_transaction_history();

-- Create a view to make it easier to fetch wallet balance and transaction history
CREATE OR REPLACE VIEW public.user_financial_summary AS
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

-- Add RLS policy for the view (creating a policy instead of using SECURITY INVOKER)
CREATE POLICY user_financial_summary_policy 
ON public.user_financial_summary
FOR SELECT
USING (auth.uid() = user_id);
