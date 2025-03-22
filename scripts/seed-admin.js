#!/usr/bin/env node

/**
 * Admin User Seeding Script
 * 
 * This script creates an admin user in Supabase and assigns the admin role.
 * For production use, run with:
 *   node scripts/seed-admin.js <email> <password>
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Get Supabase credentials from environment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('ERROR: Missing Supabase credentials in .env.local file');
  console.error('Make sure you have NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set');
  process.exit(1);
}

// Create Supabase client with service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createAdminUser() {
  try {
    // Get command line arguments
    const args = process.argv.slice(2);
    const email = args[0] || 'admin@yourcompany.com';
    const password = args[1] || 'StrongPassword123!';

    if (args.length < 2) {
      console.warn('\n⚠️  WARNING: Using default credentials, which is not recommended for production!');
      console.warn('   For production, use: node scripts/seed-admin.js <email> <password>\n');
    }

    console.log(`🔐 Creating admin user: ${email}`);
    
    // Step 1: Check if user exists first
    const { data: existingUser, error: lookupError } = await supabase
      .auth
      .admin
      .listUsers();

    if (lookupError) {
      console.error('❌ Failed to check existing users:', lookupError.message);
      process.exit(1);
    }

    const userExists = existingUser.users.some(user => user.email === email);
    let userId;

    if (userExists) {
      console.log('👤 User already exists, updating...');
      const user = existingUser.users.find(user => user.email === email);
      userId = user.id;
      
      // Update the user
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        userId,
        { 
          password,
          email_confirm: true,
          user_metadata: { full_name: 'Admin User' }
        }
      );
      
      if (updateError) {
        console.error('❌ Failed to update user:', updateError.message);
        process.exit(1);
      }
    } else {
      // Create new user
      const { data: userData, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: 'Admin User' }
      });

      if (createError) {
        console.error('❌ Failed to create user:', createError.message);
        process.exit(1);
      }

      userId = userData.user.id;
    }

    console.log(`✅ User ${userExists ? 'updated' : 'created'} successfully with ID: ${userId}`);

    // Step 2: Create roles table if it doesn't exist
    let roleId;
    try {
      // Check if roles table exists
      const { data: rolesCheck, error: rolesCheckError } = await supabase
        .from('roles')
        .select('id')
        .limit(1);
        
      if (rolesCheckError && rolesCheckError.code === '42P01') { // table doesn't exist error
        console.log('⚙️ Creating roles table...');
        
        // Create roles table
        await supabase.rpc('create_roles_table_if_not_exists').catch(() => {
          // If RPC doesn't exist, create table directly
          return supabase
            .query(`
              CREATE TABLE IF NOT EXISTS public.roles (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name TEXT NOT NULL UNIQUE,
                description TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
              );
              CREATE TABLE IF NOT EXISTS public.user_roles (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
                role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
                UNIQUE(user_id, role_id)
              );
            `);
        });
      }
      
      // Check if admin role exists
      const { data: roleData, error: roleError } = await supabase
        .from('roles')
        .select('id')
        .eq('name', 'admin')
        .single();

      if (roleError) {
        // Create admin role
        const { data: newRoleData, error: newRoleError } = await supabase
          .from('roles')
          .insert({ name: 'admin', description: 'Administrator with full access' })
          .select('id')
          .single();

        if (newRoleError) {
          console.error('❌ Failed to create admin role:', newRoleError.message);
          process.exit(1);
        }
        
        console.log(`✅ Admin role created with ID: ${newRoleData.id}`);
        roleId = newRoleData.id;
      } else {
        console.log(`✅ Admin role found with ID: ${roleData.id}`);
        roleId = roleData.id;
      }

      // Step 3: Assign admin role to the user
      const { error: assignError } = await supabase
        .from('user_roles')
        .upsert({
          user_id: userId,
          role_id: roleId
        });

      if (assignError) {
        console.error('❌ Failed to assign admin role:', assignError.message);
        process.exit(1);
      }

      console.log(`✅ Admin role assigned to user ${email}`);
      
      // Step 4: Create profile for the user
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          email: email,
          first_name: 'Admin',
          last_name: 'User',
          created_at: new Date().toISOString()
        });

      if (profileError) {
        console.error('❌ Failed to create profile:', profileError.message);
        // Not exiting here as this is not critical
      } else {
        console.log(`✅ Profile created for user ${email}`);
      }

      console.log('\n✨ Admin user setup complete! ✨');
      console.log(`\nYou can now log in with:`);
      console.log(`  📧 Email: ${email}`);
      console.log(`  🔑 Password: ${password}`);
      
      if (args.length < 2) {
        console.log('\n⚠️  IMPORTANT: Change this default password immediately after login!');
      }
    
    } catch (error) {
      console.error('❌ Error setting up roles:', error.message);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  }
}

createAdminUser();
