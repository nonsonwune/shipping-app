import { createClient } from "@supabase/supabase-js"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import type { Database } from "@/types/supabase"

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string

// Define custom user metadata type
export type UserMetadata = {
  name?: string
  avatar_url?: string
  created_at: string
  phone?: string
  account_type?: string
}

// Define UserProfile type
export type UserProfile = {
  id: string
  first_name?: string
  last_name?: string
  avatar_url?: string
  created_at: string
  phone?: string
  account_type?: string
  email?: string
}

// Create a client for browser-side usage with auth helpers
export const supabase = createClientComponentClient<Database>()

// Create a direct client for server-side usage
export const createServerClient = () => {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  })
}

// Function to check if there's an active session
export const getActiveSession = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error("Error getting session:", error.message);
      return null;
    }
    return data.session;
  } catch (error) {
    console.error("Unexpected error getting session:", error);
    return null;
  }
}

// Helper function to manually set the auth cookie
export const setAuthCookie = (token: string, expiresIn = 60 * 60 * 24 * 7) => {
  const expires = new Date(Date.now() + expiresIn * 1000);
  document.cookie = `sb-auth-token=${token};path=/;expires=${expires.toUTCString()};SameSite=Lax`;
  return true;
}

// Helper function to properly store session data
export const storeSessionData = (session: any) => {
  if (!session) return false;
  
  try {
    // Store access token in cookie for server-side access
    setAuthCookie(session.access_token);
    
    // Store the session ID in localStorage for better tracking
    localStorage.setItem('sb-session-id', session.user?.id || '');
    
    return true;
  } catch (error) {
    console.error('Error storing session data:', error);
    return false;
  }
}

// Function to create a test user for development purposes
export const createTestUser = async () => {
  if (process.env.NODE_ENV !== 'development') {
    console.error('Test user creation only available in development mode');
    return null;
  }
  
  try {
    // Create a test admin user (will only work with "DISABLE_SIGNUP=false" in Supabase)
    // Use a more unique email that's less likely to be blocked
    const testEmail = `admin_test_${Date.now()}@example.com`;
    const testPassword = 'Admin123!';
    
    // First try to use an existing test admin account if available
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: 'admin@example.com', 
      password: 'Admin123!'
    });
    
    if (!signInError && signInData.user) {
      console.log('Existing test admin user found, signed in');
      return signInData;
    }
    
    // If user doesn't exist or can't sign in, try to create new one
    console.log('Attempting to create new test admin user...');
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          first_name: 'Admin',
          last_name: 'User',
          role: 'admin'
        }
      }
    });
    
    if (error) {
      console.error('Error creating test admin user:', error.message);
      
      // Provide a fallback for development - direct login without signup
      if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        console.log('Attempting direct auth using anon key (dev only)...');
        
        // This is a development-only approach
        const directAuth = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL || '',
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
        );
        
        // Try to authenticate with default admin credentials
        const { data: devData } = await directAuth.auth.signInWithPassword({
          email: 'admin@example.com',
          password: 'Admin123!'
        });
        
        if (devData?.user) {
          console.log('Development fallback: Signed in with default credentials');
          return devData;
        }
      }
      
      return null;
    }
    
    console.log('Created new test admin user');
    
    // Insert the admin role for this user
    if (data.user) {
      try {
        // First, check if the roles table exists and get the admin role
        const { data: rolesExist } = await supabase
          .from('roles')
          .select('*')
          .limit(1);
          
        if (rolesExist && rolesExist.length > 0) {
          // Get the admin role_id if roles table exists
          const { data: roleData, error: roleError } = await supabase
            .from('roles')
            .select('id')
            .eq('name', 'admin')
            .maybeSingle();
            
          if (roleData && !roleError) {
            // Check if user_roles table exists
            const { data: userRolesExist } = await supabase
              .from('user_roles')
              .select('*')
              .limit(1);
              
            if (userRolesExist) {
              try {
                // Assign the admin role to the user using proper types
                const { error: insertError } = await supabase
                  .from('user_roles')
                  .insert({
                    user_id: data.user.id,
                    role_id: roleData.id
                  });
                  
                if (!insertError) {
                  console.log('Admin role assigned to test user');
                } else {
                  console.error('Error inserting user role:', insertError);
                }
              } catch (err) {
                console.error('Error in user_roles insert operation:', err);
              }
            } else {
              console.log('user_roles table does not exist, skipping role assignment');
            }
          } else {
            console.log('Admin role not found:', roleError);
          }
        } else {
          console.log('Roles table does not exist, skipping role assignment');
        }
      } catch (roleError) {
        console.error('Error assigning admin role:', roleError);
      }
    }
    
    return data;
  } catch (error) {
    console.error('Unexpected error creating test admin:', error);
    return null;
  }
}

// Type for Shipment data
export type Shipment = {
  id: string
  origin: string
  destination: string
  status: string
  tracking_number: string
  user_id: string
  estimated_delivery?: string
  weight?: number
  dimensions?: string
  carrier?: string
  created_at: string
  updated_at?: string
}
