require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or service role key is missing in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetAdminPassword() {
  try {
    // First list users to find the admin user
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();
    
    if (userError) {
      console.error('Error listing users:', userError.message);
      return;
    }
    
    const adminUser = users.users.find(user => user.email === 'admin@yourcompany.com');
    
    if (adminUser) {
      console.log('Found admin user with ID:', adminUser.id);
      
      // Update the admin user's password
      const { data, error } = await supabase.auth.admin.updateUserById(
        adminUser.id,
        { password: 'SecurePassword123' }
      );
      
      if (error) {
        console.error('Error updating password:', error.message);
      } else {
        console.log('Successfully reset admin password!');
        console.log('Email: admin@yourcompany.com');
        console.log('Password: SecurePassword123');
      }
    } else {
      console.error('Admin user not found with email admin@yourcompany.com');
    }
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

resetAdminPassword();
