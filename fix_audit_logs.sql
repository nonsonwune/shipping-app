-- 1. Allow NULL values in admin_id column (crucial fix)
ALTER TABLE admin_audit_logs ALTER COLUMN admin_id DROP NOT NULL;

-- 2. Update the log_shipment_changes function to handle NULL admin_id
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
    auth.uid(), -- This can now be NULL
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

-- Make sure trigger exists on shipments table
DROP TRIGGER IF EXISTS shipment_audit_log_trigger ON shipments;
CREATE TRIGGER shipment_audit_log_trigger
AFTER INSERT OR UPDATE OR DELETE ON shipments
FOR EACH ROW EXECUTE FUNCTION log_shipment_changes();

-- Similarly update other trigger functions if needed
-- For example, if there's a profile_changes function, it would need similar updates

-- 3. Refresh schema cache to apply changes
SELECT pg_notify('pgrst', 'reload schema');
