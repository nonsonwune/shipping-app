require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or service role key is missing in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAdminUser() {
  try {
    // First try to check if the user exists
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();
    
    if (userError) {
      console.error('Error listing users:', userError.message);
      return;
    }
    
    const adminUser = users.users.find(user => user.email === 'admin@yourcompany.com');
    
    if (adminUser) {
      console.log('Admin user exists with ID:', adminUser.id);
      
      // Check if user has admin role
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('roles:role_id(name)')
        .eq('user_id', adminUser.id);
        
      if (rolesError) {
        console.error('Error fetching roles:', rolesError.message);
        return;
      }
      
      const isAdmin = userRoles?.some(role => 
        role.roles && 
        typeof role.roles === 'object' && 
        'name' in role.roles && 
        role.roles.name === 'admin'
      );
      
      if (isAdmin) {
        console.log('User has admin role assigned');
      } else {
        console.log('User does NOT have admin role assigned');
        
        // Get the admin role ID
        const { data: adminRole, error: adminRoleError } = await supabase
          .from('roles')
          .select('id')
          .eq('name', 'admin')
          .single();
          
        if (adminRoleError) {
          console.error('Error fetching admin role:', adminRoleError.message);
          return;
        }
        
        if (adminRole) {
          // Assign admin role to user
          const { error: assignRoleError } = await supabase
            .from('user_roles')
            .insert({
              user_id: adminUser.id,
              role_id: adminRole.id
            });
            
          if (assignRoleError) {
            console.error('Error assigning admin role:', assignRoleError.message);
          } else {
            console.log('Successfully assigned admin role to user');
          }
        }
      }
      
    } else {
      console.log('Admin user does not exist with email admin@yourcompany.com');
      console.log('Creating admin user...');
      
      // Create the admin user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: 'admin@yourcompany.com',
        password: 'SecurePassword123',
        email_confirm: true
      });
      
      if (createError) {
        console.error('Error creating admin user:', createError.message);
        return;
      }
      
      console.log('Created admin user with ID:', newUser.user.id);
      
      // Get the admin role ID
      const { data: adminRole, error: adminRoleError } = await supabase
        .from('roles')
        .select('id')
        .eq('name', 'admin')
        .single();
        
      if (adminRoleError) {
        console.error('Error fetching admin role:', adminRoleError.message);
        return;
      }
      
      if (adminRole) {
        // Assign admin role to user
        const { error: assignRoleError } = await supabase
          .from('user_roles')
          .insert({
            user_id: newUser.user.id,
            role_id: adminRole.id
          });
          
        if (assignRoleError) {
          console.error('Error assigning admin role:', assignRoleError.message);
        } else {
          console.log('Successfully assigned admin role to user');
        }
      }
    }
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkAdminUser();
