// Script to reset admin password in Supabase
// Run with: node create-admin-user.js

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const ADMIN_EMAIL = 'admin@yourcompany.com';

async function resetAdminPassword() {
  try {
    console.log(`Sending password reset email to ${ADMIN_EMAIL}...`);
    
    // Send password reset email
    const { error } = await supabase.auth.resetPasswordForEmail(ADMIN_EMAIL);
    
    if (error) {
      console.error('Error sending password reset email:', error.message);
      return;
    }
    
    console.log('Password reset email sent successfully!');
    console.log('\nInstructions:');
    console.log('1. Check the email inbox for admin@yourcompany.com');
    console.log('2. Click the password reset link in the email');
    console.log('3. Set your new password to: SecurePassword123!');
    console.log('\nNote: If you don\'t receive the email, check your spam folder.');
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

resetAdminPassword();
