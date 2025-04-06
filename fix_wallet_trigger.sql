-- 1. Fix log_wallet_changes function to not reference status field if it doesn't exist
CREATE OR REPLACE FUNCTION log_wallet_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO admin_audit_logs (
    admin_id, 
    action_type, 
    resource_type, 
    resource_id, 
    user_affected,
    details,
    severity
  ) VALUES (
    auth.uid(),
    CASE 
      WHEN TG_OP = 'INSERT' THEN 'create_wallet' 
      WHEN TG_OP = 'UPDATE' THEN 
        CASE 
          WHEN OLD.balance != NEW.balance THEN 'update_wallet_balance'
          ELSE 'update_wallet'
        END
      WHEN TG_OP = 'DELETE' THEN 'delete_wallet' 
    END,
    'wallet',
    NEW.id::text,
    NEW.user_id,
    jsonb_build_object(
      'old_data', CASE WHEN TG_OP != 'INSERT' THEN to_jsonb(OLD) ELSE NULL END,
      'new_data', to_jsonb(NEW),
      'balance_change', CASE WHEN TG_OP = 'UPDATE' THEN NEW.balance - OLD.balance ELSE NEW.balance END,
      'current_balance', NEW.balance,
      'source', CASE WHEN auth.uid() IS NULL THEN 'system_action' ELSE 'admin_action' END
    ),
    CASE 
      WHEN TG_OP = 'DELETE' THEN 'alert'
      WHEN TG_OP = 'UPDATE' AND OLD.balance != NEW.balance AND (NEW.balance - OLD.balance) > 50000 THEN 'warning'
      ELSE 'info'
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS wallet_audit_log_trigger ON wallets;
CREATE TRIGGER wallet_audit_log_trigger
AFTER INSERT OR UPDATE OR DELETE ON wallets
FOR EACH ROW EXECUTE FUNCTION log_wallet_changes();

-- Refresh schema cache
SELECT pg_notify('pgrst', 'reload schema');
