import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

// Define all allowed admin paths
const ADMIN_PATHS = [
  '/admin',
  '/admin/dashboard',
  '/admin/users',
  '/admin/shipments',
  '/admin/settings',
  '/admin/analytics',
  '/admin/staff',
  '/admin/support',
];

// Define paths for staff members
const STAFF_PATHS = [
  '/admin/dashboard',
  '/admin/shipments',
  '/admin/support',
];

// Paths that don't require authentication
const PUBLIC_ADMIN_PATHS = [
  '/admin/login',
];

// Hard-coded admin emails for secure comparison
// In production, this would ideally be stored in environment variables
const ADMIN_EMAILS = [
  'admin@yourcompany.com',
  'chuqunonso@gmail.com',
  '7umunri@gmail.com'
];

/**
 * Middleware to check if the user has the required role to access a specific route
 */
export async function roleMiddleware(req: NextRequest) {
  // Get the path being requested
  const { pathname } = req.nextUrl;
  
  // Skip check for non-admin routes
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next();
  }
  
  // Allow access to public admin paths without authentication
  if (PUBLIC_ADMIN_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }
  
  console.log('====== ROLE MIDDLEWARE LOG ======');
  console.log(`Path: ${pathname}`);
  
  // Extract project ref for Supabase
  let currentProjectRef = '';
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    currentProjectRef = new URL(supabaseUrl).hostname.split('.')[0];
  } catch (error) {
    console.error("Role Middleware: Error extracting project ref:", error);
  }
  
  // Create a response object with request headers for cookie manipulation
  let response = NextResponse.next({
    request: {
      headers: new Headers(req.headers),
    },
  });
  
  // Try direct validation first - this is more reliable
  let isAuthenticated = false;
  let userEmail = null;

  const authCookie = req.cookies.get(`sb-${currentProjectRef}-auth-token`);
  if (authCookie?.value) {
    try {
      // Create a direct client with the token to validate using the service role key
      const directClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );
      
      // Set the session manually
      const { error: setSessionError } = await directClient.auth.setSession({
        access_token: authCookie.value,
        refresh_token: req.cookies.get(`sb-${currentProjectRef}-auth-token-refresh`)?.value || '',
      });
      
      if (!setSessionError) {
        // Get user to validate token
        const { data: userData, error: userError } = await directClient.auth.getUser();
        
        if (!userError && userData.user) {
          console.log("ROLE_MIDDLEWARE - Direct token validation successful");
          isAuthenticated = true;
          userEmail = userData.user.email;
        }
      }
    } catch (error) {
      console.error("ROLE_MIDDLEWARE - Error with direct validation:", error);
    }
  }
  
  // If direct validation successful, check admin status
  if (isAuthenticated && userEmail) {
    console.log(`Role Middleware: User email: ${userEmail}`);
    
    // Check if user is admin
    const isAdmin = ADMIN_EMAILS.includes(userEmail);
    console.log(`Role Middleware: Is admin: ${isAdmin}`);
    
    if (isAdmin) {
      console.log('Role Middleware: Admin user, allowing access');
      return response;
    } else {
      console.log('Role Middleware: Not admin, redirecting to dashboard');
      return NextResponse.redirect(new URL('/', req.url));
    }
  }
  
  // Fall back to standard Supabase client if direct validation failed
  console.log("ROLE_MIDDLEWARE - Using standard session check as fallback");
  
  // Use normal createServerClient as fallback
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: 'pkce'
      },
      cookies: {
        // Use req.cookies directly
        async get(name: string) {
          try {
            const value = req.cookies.get(name)?.value;
            
            // Debug line - log cookie retrieval for critical auth cookies
            if (name.includes('auth-token')) {
              console.log(`ROLE_MIDDLEWARE - Reading auth cookie: ${name}, exists: ${!!value}`);
            }
            
            if (!value) return undefined;
            
            // Handle JSON-formatted cookies (when token is stored as a JSON array)
            if (value.startsWith('[') && value.endsWith(']')) {
              try {
                console.log(`ROLE_MIDDLEWARE - Detected JSON array format in cookie ${name}, parsing...`);
                const parsed = JSON.parse(value);
                // Return the first item if it's an array
                if (Array.isArray(parsed) && parsed.length > 0) {
                  console.log(`ROLE_MIDDLEWARE - Successfully parsed ${name} as array with ${parsed.length} items`);
                  return parsed[0];
                } else {
                  console.log(`ROLE_MIDDLEWARE - Parsed ${name} but not a valid array, returning raw value`);
                  return value;
                }
              } catch (parseError) {
                console.error("RoleMiddleware: Error parsing cookie JSON:", parseError);
                return value; // Return the raw value as fallback
              }
            }
            
            return value;
          } catch (error) {
            console.error("RoleMiddleware: Error getting cookie:", name, error);
            return undefined;
          }
        },
        async set(name: string, value: string, options: CookieOptions) {
          try {
            await response.cookies.set({ name, value, ...options });
          } catch (error) {
            console.error("RoleMiddleware: Error setting cookie:", name, error);
          }
        },
        async remove(name: string, options: CookieOptions) {
          try {
            await response.cookies.set({ name, value: '', ...options });
          } catch (error) {
            console.error("RoleMiddleware: Error removing cookie:", name, error);
          }
        },
      },
    }
  );
  
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    // Log session status
    console.log(`ROLE_MIDDLEWARE - Session exists: ${!!session}`);
    if (error) {
      console.error("ROLE_MIDDLEWARE - Error getting session:", error.message);
    }
    console.log('=================================');
    
    // Verify session and user
    if (!session || !session.user || !session.access_token) {
      console.log("ROLE_MIDDLEWARE - No valid session, redirecting to login");
      const redirectUrl = new URL('/auth/sign-in', req.url);
      redirectUrl.searchParams.set('redirectTo', req.nextUrl.pathname);
      return NextResponse.redirect(redirectUrl);
    }

    const userEmail = session.user.email;
    
    if (!userEmail) {
      console.log('Role Middleware: No email associated with this session');
      const noEmailUrl = new URL('/admin/login?error=invalid_user', req.url);
      return NextResponse.redirect(noEmailUrl);
    }
    
    console.log(`Role Middleware User email: ${userEmail}`);
    
    const isAdmin = ADMIN_EMAILS.includes(userEmail.toLowerCase());
    
    if (isAdmin) {
      console.log('Role Middleware: User has admin email, access granted');
      // Return the response object potentially modified by getSession
      return response;
    }
    
    // TODO: Implement staff role check if needed
    // const isStaff = STAFF_PATHS.includes(pathname); // Example check
    // const userRole = session.user.app_metadata?.role; // Assuming role is stored
    // if (isStaff && userRole === 'staff') { ... return response; }

    console.log('Role Middleware: User does not have required role for this admin route');
    const permissionsUrl = new URL('/admin/login?error=insufficient_permissions', req.url);
    return NextResponse.redirect(permissionsUrl);
  } catch (error) {
    console.error('Role middleware error:', error);
    const serverErrorUrl = new URL('/admin/login?error=server', req.url);
    return NextResponse.redirect(serverErrorUrl);
  }
}
