// Script to add username column to profiles table
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Must use service key for schema modifications
if (!supabaseServiceKey) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY is required');
  process.exit(1);
}

// Since we can't directly execute ALTER TABLE commands through the JS client,
// let's generate the SQL that needs to be run in the Supabase SQL editor
console.log('====================================================');
console.log('SQL COMMANDS TO ADD USERNAME COLUMN TO PROFILES TABLE');
console.log('====================================================');
console.log('Copy and run these commands in the Supabase SQL Editor:');
console.log('\n');
console.log(`-- Check if username column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'profiles'
    AND column_name = 'username'
  ) THEN
    -- Add the username column if it doesn't exist
    ALTER TABLE public.profiles ADD COLUMN username TEXT;
    RAISE NOTICE 'Username column added successfully';
  ELSE
    RAISE NOTICE 'Username column already exists';
  END IF;
END
$$;`);

console.log('\n');
console.log('-- Optionally, update existing profiles to have username equal to email');
console.log('UPDATE public.profiles SET username = email WHERE username IS NULL;');
console.log('\n');
console.log('====================================================');

// Now, let's attempt to update existing profile records to fix any existing username issues
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function updateExistingProfiles() {
  console.log('Attempting to update existing profiles...');

  try {
    // Get all profiles
    const { data: profiles, error: fetchError } = await supabase
      .from('profiles')
      .select('id, email');

    if (fetchError) {
      console.error('Error fetching profiles:', fetchError);
      return;
    }

    if (!profiles || profiles.length === 0) {
      console.log('No profiles found to update');
      return;
    }

    console.log(`Found ${profiles.length} profiles to update`);

    // Update profiles one by one to avoid SQL errors if the column doesn't exist yet
    for (const profile of profiles) {
      try {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ username: profile.email })
          .eq('id', profile.id);

        if (updateError) {
          // If we get a column doesn't exist error, that's expected
          if (updateError.message.includes('column "username" does not exist')) {
            console.log('Username column does not exist yet. Please run the SQL commands above.');
            break;
          } else {
            console.error(`Error updating profile ${profile.id}:`, updateError);
          }
        }
      } catch (err) {
        console.error(`Error updating profile ${profile.id}:`, err);
      }
    }

    console.log('Profile update attempts completed');
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the update function
updateExistingProfiles().catch(err => {
  console.error('Top-level error:', err);
});
