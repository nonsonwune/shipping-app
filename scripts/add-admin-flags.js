require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or service role key is missing in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function addAdminFlags() {
  try {
    // First check if the columns already exist
    const { data: columns, error: columnsError } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);
    
    if (columnsError) {
      console.error('Error checking profile columns:', columnsError.message);
      return;
    }
    
    // Check if the columns need to be added
    const firstProfile = columns[0];
    const needsIsAdmin = !('is_admin' in firstProfile);
    const needsIsStaff = !('is_staff' in firstProfile);
    
    if (!needsIsAdmin && !needsIsStaff) {
      console.log('Columns is_admin and is_staff already exist in profiles table');
    } else {
      console.log('Adding missing admin flag columns to profiles table...');
      
      // Use raw SQL for ALTER TABLE to add columns if they don't exist
      // This is safer than dropping and recreating the table
      let addColumnsSQL = 'ALTER TABLE profiles';
      
      if (needsIsAdmin) {
        addColumnsSQL += ' ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE';
      }
      
      if (needsIsStaff) {
        if (needsIsAdmin) addColumnsSQL += ',';
        addColumnsSQL += ' ADD COLUMN IF NOT EXISTS is_staff BOOLEAN DEFAULT FALSE';
      }
      
      const { error: alterError } = await supabase.rpc('exec_sql', { 
        query: addColumnsSQL 
      });
      
      if (alterError) {
        console.error('Error adding columns to profiles table:', alterError.message);
        console.log('Trying alternative approach...');
        
        // If RPC fails, we'll try individual update queries
        if (needsIsAdmin) {
          await supabase.rpc('exec_sql', { 
            query: 'ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE'
          });
        }
        
        if (needsIsStaff) {
          await supabase.rpc('exec_sql', { 
            query: 'ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_staff BOOLEAN DEFAULT FALSE'
          });
        }
      } else {
        console.log('Successfully added admin flag columns to profiles table');
      }
    }
    
    // Find the admin user by email
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.error('Error listing users:', usersError.message);
      return;
    }
    
    const adminUser = users.users.find(user => user.email === 'admin@yourcompany.com');
    
    if (!adminUser) {
      console.log('Admin user not found');
      return;
    }
    
    console.log('Setting admin flag for user:', adminUser.email);
    
    // Update the admin user's profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ is_admin: true })
      .eq('id', adminUser.id);
      
    if (updateError) {
      console.error('Error updating admin profile:', updateError.message);
    } else {
      console.log('Successfully set admin flag for user:', adminUser.email);
    }
    
    // Verify the update worked
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin, is_staff')
      .eq('id', adminUser.id)
      .single();
      
    if (profileError) {
      console.error('Error verifying profile update:', profileError.message);
    } else {
      console.log('Profile flags:', profile);
    }
      
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

addAdminFlags();
