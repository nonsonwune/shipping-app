-- 1. Improve the shipment audit logging to properly capture the acting user
CREATE OR REPLACE FUNCTION log_shipment_changes()
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
    -- For system actions, use the user_id from the shipment record as admin_id
    -- This ensures booking users show up in audit logs as the actor
    COALESCE(auth.uid(), NEW.user_id),
    CASE 
      WHEN TG_OP = 'INSERT' THEN 'create_shipment' 
      WHEN TG_OP = 'UPDATE' THEN 
        CASE 
          WHEN OLD.status != NEW.status THEN 'update_shipment_status'
          ELSE 'update_shipment'
        END
      WHEN TG_OP = 'DELETE' THEN 'delete_shipment' 
    END,
    'shipment',
    NEW.id::text,
    NEW.user_id,
    jsonb_build_object(
      'old_data', CASE WHEN TG_OP != 'INSERT' THEN to_jsonb(OLD) ELSE NULL END,
      'new_data', to_jsonb(NEW),
      'source', CASE WHEN auth.uid() IS NULL THEN 'system_action' ELSE 'user_action' END
    ),
    CASE 
      WHEN TG_OP = 'DELETE' THEN 'alert'
      ELSE 'info'
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Improve the wallet audit logging to properly capture the acting user
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
    -- For system actions, use the user_id from the wallet record as admin_id
    -- This ensures wallet owners show up in audit logs for their wallet changes
    COALESCE(auth.uid(), NEW.user_id),
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
      'source', CASE WHEN auth.uid() IS NULL THEN 'system_action' ELSE 'user_action' END
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

-- Make sure triggers exist
DROP TRIGGER IF EXISTS shipment_audit_log_trigger ON shipments;
CREATE TRIGGER shipment_audit_log_trigger
AFTER INSERT OR UPDATE OR DELETE ON shipments
FOR EACH ROW EXECUTE FUNCTION log_shipment_changes();

DROP TRIGGER IF EXISTS wallet_audit_log_trigger ON wallets;
CREATE TRIGGER wallet_audit_log_trigger
AFTER INSERT OR UPDATE OR DELETE ON wallets
FOR EACH ROW EXECUTE FUNCTION log_wallet_changes();

-- Refresh schema cache
SELECT pg_notify('pgrst', 'reload schema'); 