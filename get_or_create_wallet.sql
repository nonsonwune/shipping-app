-- Create a function to get or create a wallet for a user
CREATE OR REPLACE FUNCTION public.get_or_create_wallet(user_id_param UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  balance DECIMAL,
  currency TEXT,
  last_updated TIMESTAMPTZ,
  created_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  wallet_record RECORD;
BEGIN
  -- First try to get the existing wallet
  SELECT * INTO wallet_record FROM public.wallets WHERE user_id = user_id_param;

  -- If wallet doesn't exist, create a new one
  IF wallet_record IS NULL THEN
    INSERT INTO public.wallets (user_id, balance, currency)
    VALUES (user_id_param, 0.00, 'NGN')
    RETURNING * INTO wallet_record;
  END IF;
  -- Return the wallet record
  id := wallet_record.id;
  user_id := wallet_record.user_id;
  balance := wallet_record.balance;
  currency := wallet_record.currency;
  last_updated := wallet_record.last_updated;
  created_at := wallet_record.created_at;
  
  RETURN NEXT;
END;
$$;

-- Update RLS to allow access to the function
GRANT EXECUTE ON FUNCTION public.get_or_create_wallet TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_wallet TO anon;
