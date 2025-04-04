import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

// Define admin emails - Consider moving this to environment variables or a database config
const ADMIN_EMAILS = [
  'admin@yourcompany.com', 
  '7umunri@gmail.com',
  'chuqunonso@gmail.com'
];

export async function POST(request: Request) {
  const requestBody = await request.json();
  const { email, first_name, last_name, phone, account_type } = requestBody;

  // Important: Since Next.js 14.1, cookies() is now async in API routes
  const cookieStore = await cookies()

  // Create a Supabase client for server-side operations using the request cookies
  const supabaseUserClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          try {
            // Get cookie directly from the store (no await required here)
            const cookie = cookieStore.get(name);
            const value = cookie?.value;
            
            if (!value) return undefined;
            
            // Handle JSON-formatted cookies (when token is stored as a JSON array)
            if (value.startsWith('[') && value.endsWith(']')) {
              try {
                const parsed = JSON.parse(value);
                // Return the first item if it's an array
                return Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : value;
              } catch (parseError) {
                console.error("API Route: Error parsing cookie JSON:", parseError);
                return value; // Return the raw value as fallback
              }
            }
            
            return value;
          } catch (error) {
            console.error("API Route: Error getting cookie:", name, error);
            return undefined;
          }
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            // Set cookie directly (no await required here)
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            console.error("API Route: Error setting cookie:", name, error);
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            // Remove cookie directly (no await required here)
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
             console.error("API Route: Error removing cookie:", name, error);
          }
        },
      },
    }
  )

  // 1. Verify the user making the request is an admin
  const { data: { session }, error: sessionError } = await supabaseUserClient.auth.getSession();

  if (sessionError || !session) {
    console.error('Staff API: Error getting session or no session found:', sessionError || 'No session object'); 
    return NextResponse.json({ error: 'Authentication required. Unable to verify session.' }, { status: 401 });
  }

  const userEmail = session.user.email?.toLowerCase();
  if (!userEmail || !ADMIN_EMAILS.includes(userEmail)) {
      console.warn(`Staff API: Non-admin user attempt. User: ${userEmail}`);
      return NextResponse.json({ error: 'Forbidden: Admin privileges required.' }, { status: 403 });
  }

  // Input validation (basic)
  if (!email || !first_name || !last_name || !account_type) {
    return NextResponse.json({ error: 'Missing required fields: email, first_name, last_name, account_type' }, { status: 400 });
  }

  // Create a Supabase client with SERVICE_ROLE privileges
  // Ensure SUPABASE_SERVICE_ROLE_KEY is set in your environment variables
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // Use the service role key!
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    // 2. Check if email already exists using the admin client
     const { data: existingUserData, error: existingUserError } = await supabaseAdmin
       .from('profiles') 
       .select('id')
       .eq('email', email)
       .maybeSingle();

     if (existingUserError && existingUserError.code !== 'PGRST116') { 
         console.error('Staff API: Error checking existing profile:', existingUserError);
         throw new Error(`Error checking profile existence: ${existingUserError.message}`);
     }

    if (existingUserData) {
      return NextResponse.json({ error: 'A user with this email already exists in profiles.' }, { status: 409 });
    }
    
    // Consider checking auth users as well for robustness if profile sync isn't guaranteed
    // const { data: { users }, error: listUserError } = await supabaseAdmin.auth.admin.listUsers({ email });
    // if (listUserError) { ... }
    // if (users && users.length > 0) { return NextResponse.json({ error: 'A user with this email already exists in authentication.' }, { status: 409 }); }

    // 3. Create the user in auth using admin client
    const tempPassword = Math.random().toString(36).slice(-8);
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { 
          first_name: first_name,
          last_name: last_name,
      } 
    });

    if (authError) {
      console.error('Staff API: Error creating auth user:', authError);
      if (authError.message.includes('duplicate key value violates unique constraint')) {
           return NextResponse.json({ error: 'A user with this email already exists.' }, { status: 409 });
      }
      throw new Error(`Auth user creation failed: ${authError.message}`);
    }

    if (!authData || !authData.user) {
        throw new Error('Auth user creation did not return expected data.');
    }
    const userId = authData.user.id;

    // 4. Create the user profile using admin client
    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: userId,
      email: email,
      first_name: first_name,
      last_name: last_name,
      phone: phone || null,
      account_type: account_type,
    });

    if (profileError) {
      console.error('Staff API: Error creating profile:', profileError);
      console.warn(`Staff API: Profile creation failed for user ${userId}. Attempting to delete auth user.`);
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (deleteError) {
          console.error(`Staff API: CRITICAL - Failed to delete auth user ${userId} after profile creation failure:`, deleteError);
      }
      throw new Error(`Profile creation failed: ${profileError.message}`);
    }

    // TODO: Optionally, send a welcome email or password reset link here
    // Since we generated a random password, the user needs a way to set their own.
    // You could use supabaseAdmin.auth.resetPasswordForEmail(email)

    return NextResponse.json({ message: 'Staff member added successfully', userId: userId }, { status: 201 });

  } catch (error: any) {
    console.error('Staff API: Unhandled error during staff creation:', error);
    return NextResponse.json({ error: error.message || 'An unexpected error occurred.' }, { status: 500 });
  }
}

// Add a basic GET handler or other methods if needed later
// export async function GET(request: Request) { ... } 