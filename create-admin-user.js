// Script to create an admin user in Supabase with a default password
// Run with: node create-admin-user.js

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with service role key (required for admin operations)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Admin user details
const ADMIN_EMAIL = 'chuqunonso@gmail.com';
const DEFAULT_PASSWORD = 'Admin123!'; // Default password that should be changed after first login

async function createAdminUser() {
  try {
    console.log(`Creating/updating admin user with email: ${ADMIN_EMAIL}`);
    
    // Check if the user already exists by trying to sign in
    // (This is a workaround since we don't have direct getUserByEmail with this client)
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: DEFAULT_PASSWORD,
    });
    
    let userId;
    
    if (!signInError && signInData?.user) {
      // User exists and password is already DEFAULT_PASSWORD
      console.log('User already exists and password is correct.');
      userId = signInData.user.id;
    } else {
      // Either user doesn't exist or has a different password
      console.log('Creating or updating user...');
      
      // Using createUser which works with service role key
      const { data: userData, error: createError } = await supabase.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: DEFAULT_PASSWORD,
        email_confirm: true
      });
      
      if (createError) {
        // If error is about duplicate user, try to update password
        if (createError.message.includes('already exists')) {
          console.log('User exists but has different password. Attempting to update...');
          
          // First, retrieve the user's existing UUID if possible
          const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
          
          if (listError) {
            console.error('Error listing users:', listError.message);
            return;
          }
          
          const existingUser = users.find(u => u.email === ADMIN_EMAIL);
          
          if (!existingUser) {
            console.error('Could not find user to update password');
            return;
          }
          
          // Update password
          const { error: updateError } = await supabase.auth.admin.updateUserById(
            existingUser.id,
            { password: DEFAULT_PASSWORD }
          );
          
          if (updateError) {
            console.error('Error updating password:', updateError.message);
            return;
          }
          
          userId = existingUser.id;
          console.log('Password updated successfully');
        } else {
          console.error('Error creating user:', createError.message);
          return;
        }
      } else {
        console.log('User created successfully');
        userId = userData.user.id;
      }
    }
    
    // Now update or create the profile to include admin privileges
    console.log(`Setting up admin profile for user ID: ${userId}`);
    
    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (!existingProfile) {
      console.log('Creating new admin profile...');
      
      // Create a new profile
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: ADMIN_EMAIL,
          first_name: 'Admin',
          last_name: 'User',
          account_type: 'admin',
          created_at: new Date().toISOString()
        });
      
      if (insertError) {
        console.error('Error creating profile:', insertError.message);
        return;
      }
    } else {
      console.log('Updating existing profile to admin...');
      
      // Update existing profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ account_type: 'admin' })
        .eq('id', userId);
      
      if (updateError) {
        console.error('Error updating profile:', updateError.message);
        return;
      }
    }
    
    console.log('\n✅ Admin user setup complete!');
    console.log('\nLogin Information:');
    console.log(`Email: ${ADMIN_EMAIL}`);
    console.log(`Password: ${DEFAULT_PASSWORD}`);
    console.log('\nIMPORTANT: Change your password after first login for security reasons.');
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

createAdminUser();
