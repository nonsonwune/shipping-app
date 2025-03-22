// Script to set up admin profile in the database
// Run with: node setup-admin-profile.js

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with service role key for admin access
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Admin email to set up
const ADMIN_EMAIL = 'chuqunonso@gmail.com';

async function setupAdminProfile() {
  try {
    console.log(`Setting up admin profile for ${ADMIN_EMAIL}...`);
    
    // First, find the user in auth.users
    const { data: authUser, error: authError } = await supabase
      .from('auth.users')
      .select('id')
      .eq('email', ADMIN_EMAIL)
      .single();
      
    if (authError) {
      // Try alternative approach to get user ID
      const { data, error } = await supabase.auth.admin.listUsers();
      
      if (error) {
        console.error('Error listing users:', error.message);
        return;
      }
      
      const user = data.users.find(u => u.email === ADMIN_EMAIL);
      if (!user) {
        console.error(`User with email ${ADMIN_EMAIL} not found in auth.users`);
        
        // Try to get the user ID from profiles table
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', ADMIN_EMAIL)
          .single();
          
        if (profileError || !profileData) {
          console.error('User not found in profiles table either');
          return;
        }
        
        const userId = profileData.id;
        console.log(`Found user ID from profiles: ${userId}`);
        
        // Update the profile to have admin role
        await updateProfile(userId);
        return;
      }
      
      const userId = user.id;
      console.log(`Found user ID: ${userId}`);
      
      // Update the profile
      await updateProfile(userId);
      return;
    }
    
    const userId = authUser.id;
    console.log(`Found user ID: ${userId}`);
    
    // Update the profile
    await updateProfile(userId);
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

async function updateProfile(userId) {
  try {
    // Check if profile exists
    const { data: existingProfile, error: checkError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
      
    if (checkError && !checkError.message.includes('No rows found')) {
      console.error('Error checking profile:', checkError.message);
      return;
    }
    
    if (existingProfile) {
      // Update existing profile
      console.log('Updating existing profile...');
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          account_type: 'admin'
        })
        .eq('id', userId);
        
      if (updateError) {
        console.error('Error updating profile:', updateError.message);
        return;
      }
      
      console.log('Profile updated successfully with admin privileges!');
    } else {
      // Create new profile
      console.log('Creating new admin profile...');
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
      
      console.log('Admin profile created successfully!');
    }
    
    console.log(`\nYou can now access the admin panel at:`);
    console.log(`http://localhost:3000/admin/dashboard`);
    console.log(`\nMake sure you're logged in with ${ADMIN_EMAIL} before accessing.`);
    
  } catch (error) {
    console.error('Error updating profile:', error);
  }
}

setupAdminProfile();
