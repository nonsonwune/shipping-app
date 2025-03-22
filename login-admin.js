// Admin login script
// Run with: node login-admin.js

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

// Using your real email that can receive the magic link
const ADMIN_EMAIL = 'chuqunonso@gmail.com';

async function sendMagicLink() {
  try {
    console.log(`Sending magic link to ${ADMIN_EMAIL}...`);
    
    // Sign up this email if it doesn't exist yet
    const { data: userData, error: userError } = await supabase.auth.signUp({
      email: ADMIN_EMAIL,
      password: 'SecurePassword123!', // We'll use magic link anyway
    });
    
    if (userError && !userError.message.includes('already registered')) {
      console.error('Error creating user:', userError.message);
    } else {
      console.log('User exists or was created successfully.');
    }
    
    // Send magic link for passwordless login
    const { error } = await supabase.auth.signInWithOtp({
      email: ADMIN_EMAIL,
    });
    
    if (error) {
      console.error('Magic link error:', error.message);
      return;
    }
    
    console.log('\nMagic link sent successfully!');
    console.log(`Check the email inbox for ${ADMIN_EMAIL} and click the login link.`);
    console.log('\nAfter clicking the link:');
    console.log('1. You will be logged in automatically');
    console.log('2. Navigate to /admin/dashboard to access the admin panel');
    console.log('3. Your email is now authorized as an admin');
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

sendMagicLink();
