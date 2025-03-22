-- Create admin_audit_logs table to track admin actions
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add comment to the table
COMMENT ON TABLE admin_audit_logs IS 'Tracks all actions performed by admin users for accountability and security auditing';

-- Add index for faster queries
CREATE INDEX admin_audit_logs_admin_id_idx ON admin_audit_logs(admin_id);
CREATE INDEX admin_audit_logs_action_type_idx ON admin_audit_logs(action_type);
CREATE INDEX admin_audit_logs_resource_type_idx ON admin_audit_logs(resource_type);
CREATE INDEX admin_audit_logs_created_at_idx ON admin_audit_logs(created_at);

-- Add RLS policies
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view logs
CREATE POLICY "Admins can view audit logs" 
  ON admin_audit_logs 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    )
  );

-- Only the system can insert logs (via functions)
CREATE POLICY "System can insert audit logs" 
  ON admin_audit_logs 
  FOR INSERT 
  WITH CHECK (true);  -- Controlled via function access

-- Function to create audit log entries
CREATE OR REPLACE FUNCTION log_admin_action(
  action_type TEXT,
  resource_type TEXT,
  resource_id TEXT,
  details JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  log_id UUID;
  current_user_id UUID;
  is_admin BOOLEAN;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- Check if user is admin
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = current_user_id AND r.name IN ('admin', 'staff')
  ) INTO is_admin;
  
  IF current_user_id IS NULL OR NOT is_admin THEN
    RAISE EXCEPTION 'Only admin users can create audit logs';
  END IF;
  
  -- Insert audit log
  INSERT INTO admin_audit_logs (
    admin_id,
    action_type,
    resource_type,
    resource_id,
    details,
    ip_address
  ) VALUES (
    current_user_id,
    action_type,
    resource_type,
    resource_id,
    details,
    current_setting('request.headers', true)::json->>'x-forwarded-for'
  )
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users (will still be checked inside function)
GRANT EXECUTE ON FUNCTION log_admin_action TO authenticated;

-- Add trigger for shipment status updates
CREATE OR REPLACE FUNCTION log_shipment_status_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if status changed
  IF OLD.status <> NEW.status THEN
    PERFORM log_admin_action(
      'update_status',
      'shipment',
      NEW.id::TEXT,
      jsonb_build_object(
        'previous_status', OLD.status,
        'new_status', NEW.status
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER shipment_status_update_audit
AFTER UPDATE OF status ON shipments
FOR EACH ROW
EXECUTE FUNCTION log_shipment_status_update();

-- Add trigger for system settings updates
CREATE OR REPLACE FUNCTION log_system_settings_update()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM log_admin_action(
    'update_setting',
    'system_setting',
    NEW.key,
    jsonb_build_object(
      'previous_value', OLD.value,
      'new_value', NEW.value
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER system_settings_update_audit
AFTER UPDATE ON system_settings
FOR EACH ROW
EXECUTE FUNCTION log_system_settings_update();

-- Add trigger for user role changes
CREATE OR REPLACE FUNCTION log_user_role_changes()
RETURNS TRIGGER AS $$
DECLARE
  action_name TEXT;
  role_name TEXT;
BEGIN
  -- Determine the action (insert, delete)
  IF TG_OP = 'INSERT' THEN
    action_name := 'assign_role';
    
    -- Get the role name
    SELECT name INTO role_name
    FROM roles
    WHERE id = NEW.role_id;
    
    PERFORM log_admin_action(
      action_name,
      'user_role',
      NEW.user_id::TEXT,
      jsonb_build_object(
        'role', role_name
      )
    );
  ELSIF TG_OP = 'DELETE' THEN
    action_name := 'remove_role';
    
    -- Get the role name
    SELECT name INTO role_name
    FROM roles
    WHERE id = OLD.role_id;
    
    PERFORM log_admin_action(
      action_name,
      'user_role',
      OLD.user_id::TEXT,
      jsonb_build_object(
        'role', role_name
      )
    );
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER user_role_changes_audit
AFTER INSERT OR DELETE ON user_roles
FOR EACH ROW
EXECUTE FUNCTION log_user_role_changes();
