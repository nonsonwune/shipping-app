// Script to create a direct admin user with password
// Run with: node create-direct-admin.js

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL in .env.local');
  process.exit(1);
}

// Try to use service key, fall back to anon key if needed
const supabaseKey = supabaseServiceKey || supabaseAnonKey;
if (!supabaseKey) {
  console.error('Missing Supabase key in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const ADMIN_EMAIL = 'chuqunonso@gmail.com';
const ADMIN_PASSWORD = 'Admin123!'; // Simple password for testing

async function createAdminAccount() {
  try {
    console.log(`Setting up admin account for ${ADMIN_EMAIL} with password: ${ADMIN_PASSWORD}`);
    
    // First check if user exists
    const { data: existingUsers, error: userError } = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    
    if (!userError && existingUsers) {
      console.log('Admin user already exists and password is correct');
      return;
    }
    
    // Try to sign up the user
    const { data, error } = await supabase.auth.signUp({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      options: {
        data: {
          is_admin: true
        }
      }
    });
    
    if (error) {
      if (error.message.includes('already registered')) {
        console.log('User already exists, attempting to reset password...');
        
        // Try to sign in with OTP
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email: ADMIN_EMAIL
        });
        
        if (otpError) {
          console.error('Error sending OTP:', otpError.message);
        } else {
          console.log('OTP email sent! Use this to login, then use the Admin123! password');
        }
      } else {
        console.error('Signup error:', error.message);
      }
      return;
    }
    
    console.log('User created successfully!');
    console.log(`\nAdmin login credentials:\nEmail: ${ADMIN_EMAIL}\nPassword: ${ADMIN_PASSWORD}`);
    console.log('\nLogin at: http://localhost:3000/admin/login');
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

createAdminAccount();
