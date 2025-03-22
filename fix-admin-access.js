// Script to fix admin access
// Run with: node fix-admin-access.js

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Admin email
const ADMIN_EMAIL = 'chuqunonso@gmail.com';

async function fixAdminAccess() {
  try {
    console.log(`Checking current login status...`);
    
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Error getting session:', sessionError.message);
      return;
    }
    
    if (!session) {
      console.log('Not logged in. Please click the magic link in your email first.');
      console.log('After clicking the link, run this script again.');
      return;
    }
    
    console.log(`Logged in as: ${session.user.email}`);
    
    // Check the profile table structure
    const { data: profilesInfo, error: infoError } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);
      
    if (infoError) {
      console.error('Error checking profiles table:', infoError.message);
      return;
    }
    
    console.log('Profiles table exists. Checking account_type field...');
    
    // Check if account_type exists on a profile
    const hasAccountType = profilesInfo && profilesInfo.length > 0 && 
                           'account_type' in profilesInfo[0];
    
    // Update the user's profile with admin privileges
    const updateData = {};
    
    if (hasAccountType) {
      updateData.account_type = 'admin';
      console.log('Updating account_type to admin...');
    } else {
      console.log('account_type field not found in profiles table.');
    }
    
    // Always try to update something
    updateData.updated_at = new Date().toISOString();
    
    if (Object.keys(updateData).length > 1) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', session.user.id);
        
      if (updateError) {
        console.error('Error updating profile:', updateError.message);
      } else {
        console.log('Profile updated successfully!');
      }
    }
    
    console.log('\nTrying direct navigation to admin dashboard...');
    console.log('Please go to http://localhost:3000/admin/dashboard');
    console.log(`\nIf that doesn't work, try logging out completely and logging in again.`);
    console.log(`The admin email list in layout.tsx has been updated to include your email.`);
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

fixAdminAccess();
