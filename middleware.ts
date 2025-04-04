import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
// import { cookies } from 'next/headers'
import { roleMiddleware } from "./utils/auth/role-middleware";
import { type User } from '@supabase/supabase-js'

// Suppress the cookie parsing errors in the console
const originalConsoleError = console.error;
console.error = function(...args) {
  // Filter out the specific error message about cookie parsing
  if (args[0] && typeof args[0] === 'string' && args[0].includes('Failed to parse cookie string')) {
    return;
  }
  originalConsoleError.apply(console, args);
};

// Constants
const PUBLIC_PATHS = [
  '/auth/sign-in',
  '/auth/sign-up',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify',
  '/admin/login'
];

// Admin paths (these require role-based permissions)
const ADMIN_PATHS = [
  '/admin',
  '/admin/dashboard',
  '/admin/users',
  '/admin/shipments',
  '/admin/settings',
  '/admin/analytics',
  '/admin/staff',
  '/admin/support'
];

// Static assets and API routes that should be excluded from auth checks
const EXCLUDED_PATHS = [
  '/_next',
  '/favicon.ico',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.css',
  '.js'
];

// Payment verification routes that should be exempt from auth checks
const PAYMENT_API_ROUTES = [
  '/api/payment/verify',
  '/api/auth/session-recovery'
];

// Helper function to debug JWT tokens
function debugJwtToken(token: string) {
  try {
    if (!token) {
      console.log("JWT_DEBUG - Token is empty");
      return;
    }
    
    // Split the token into its 3 parts
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.log(`JWT_DEBUG - Invalid token format, has ${parts.length} parts instead of 3`);
      return;
    }
    
    // Decode header
    try {
      const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
      console.log("JWT_DEBUG - Header:", header);
    } catch (e) {
      console.log("JWT_DEBUG - Could not decode header:", e);
    }
    
    // Decode payload
    try {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      console.log("JWT_DEBUG - Payload:", {
        ...payload,
        // Remove sensitive parts from logging
        sub: payload.sub ? "PRESENT" : "MISSING",
        email: payload.email ? "PRESENT" : "MISSING", 
        exp: payload.exp,
        iat: payload.iat,
        // Check if token is expired
        isExpired: payload.exp ? (payload.exp * 1000 < Date.now()) : "No expiry"
      });
      
      // Explicitly check expiration
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        console.log(`JWT_DEBUG - TOKEN EXPIRED at ${new Date(payload.exp * 1000).toISOString()}, current time is ${new Date().toISOString()}`);
      }
    } catch (e) {
      console.log("JWT_DEBUG - Could not decode payload:", e);
    }
  } catch (error) {
    console.error("JWT_DEBUG - Error inspecting token:", error);
  }
}

/**
 * Main middleware function to handle authentication and routing
 */
export async function middleware(req: NextRequest) {
  console.log("====== MAIN MIDDLEWARE LOG ======");
  console.log(`Path: ${req.nextUrl.pathname}`);
  
  // Debug Supabase URL and expected cookie prefixes
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'undefined';
  console.log(`SUPABASE_DEBUG - URL: ${supabaseUrl}`);
  
  // Extract current project ref from URL
  let currentProjectRef = '';
  try {
    currentProjectRef = new URL(supabaseUrl).hostname.split('.')[0];
    console.log(`SUPABASE_DEBUG - Expected project ref: ${currentProjectRef}`);
    console.log(`SUPABASE_DEBUG - Expected auth cookie prefix: sb-${currentProjectRef}-auth-token`);
  } catch (error) {
    console.error("SUPABASE_DEBUG - Error extracting project ref:", error);
  }
  
  // Create a response object with the request headers
  let response = NextResponse.next({
    request: {
      headers: new Headers(req.headers),
    },
  });
  
  // Check for and clear stale Supabase cookies from other projects
  if (currentProjectRef) {
    const authCookies = req.cookies.getAll().filter(c => c.name.includes('-auth-token'));
    for (const cookie of authCookies) {
      // Extract the project ref from cookie name - format is sb-{projectRef}-auth-token
      const cookieParts = cookie.name.split('-');
      if (cookieParts.length >= 3) {
        const cookieProjectRef = cookieParts[1];
        if (cookieProjectRef !== currentProjectRef) {
          console.log(`SUPABASE_DEBUG - Found stale cookie from different project: ${cookie.name}`);
          // Clear the stale cookie by setting it to empty with expire
          response.cookies.set({
            name: cookie.name,
            value: '',
            maxAge: 0,
            path: '/',
          });
          console.log(`SUPABASE_DEBUG - Cleared stale cookie: ${cookie.name}`);
        }
      }
    }
  }
  
  // --- MOVED: Initialize Supabase client earlier --- 
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
        async get(name: string) {
          try {
            const value = req.cookies.get(name)?.value;
            console.log(`COOKIE_DEBUG - Reading cookie: ${name}, Raw value exists: ${!!value}`);
            if (!value) return undefined;

            // --- START FIX for base64 prefix & DECODING ---
            let processedValue = value;
            if (processedValue.startsWith('base64-')) {
              console.log(`COOKIE_DEBUG (Middleware) - Found base64 prefix for cookie: ${name}`);
              const base64Part = processedValue.substring(7); // Get the part after 'base64-'
              try {
                // Attempt to decode the base64 part
                processedValue = Buffer.from(base64Part, 'base64').toString('utf-8');
                console.log(`COOKIE_DEBUG (Middleware) - Successfully decoded base64 for cookie: ${name}`);
              } catch (decodeError) {
                console.error(`COOKIE_DEBUG (Middleware) - Failed to decode base64 for cookie ${name}:`, decodeError);
                // If decoding fails, maybe return undefined or the raw value? Let's return undefined for now.
                // Alternatively, could return the original value without prefix? processedValue = value.substring(7);
                return undefined; 
              }
            }
            // --- END FIX --- 
            
            if (processedValue.length > 20) {
              console.log(`COOKIE_DEBUG - Processed value (truncated): ${processedValue.substring(0, 20)}...`);
            } else {
              console.log(`COOKIE_DEBUG - Processed value: ${processedValue}`);
            }

            // Handle JSON-formatted cookies (using potentially decoded processedValue)
            if (processedValue.startsWith('[') && processedValue.endsWith(']')) {
              try {
                console.log(`COOKIE_DEBUG - Detected JSON array format, attempting to parse processed value`);
                const parsed = JSON.parse(processedValue);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  console.log(`COOKIE_DEBUG - Successfully parsed as array with ${parsed.length} items`);
                  if (parsed[0] && typeof parsed[0] === 'string' && parsed[0].length > 20) {
                    console.log(`COOKIE_DEBUG - Using array item 0 (truncated): ${parsed[0].substring(0, 20)}...`);
                  }
                  return parsed[0];
                } else {
                  console.log(`COOKIE_DEBUG - Parsed but not a valid array, returning processed value`);
                  return processedValue;
                }
              } catch (parseError) {
                console.error("Middleware: Error parsing processed cookie JSON:", parseError);
                console.log(`COOKIE_DEBUG - Parse failed, returning processed value`);
                return processedValue; // Return the processed value as fallback
              }
            }

            console.log(`COOKIE_DEBUG - Not JSON format, returning processed value`);
            return processedValue; // Return the potentially decoded value
          } catch (error) {
            console.error("Middleware: Error getting cookie:", name, error);
            return undefined;
          }
        },
        async set(name: string, value: string, options: CookieOptions) {
          try {
            await response.cookies.set({ name, value, ...options });
          } catch (error) {
            console.error("Middleware: Error setting cookie:", name, error);
          }
        },
        async remove(name: string, options: CookieOptions) {
          try {
            await response.cookies.set({ name, value: '', ...options });
          } catch (error) {
            console.error("Middleware: Error removing cookie:", name, error);
          }
        },
      },
    }
  );
  // --- END MOVED --- 

  // Add Cookie Debugging
  try {
    console.log("COOKIE DEBUG: Auth cookies present:",
      req.cookies.getAll().filter(c => c.name.includes('-auth-token'))
        .map(c => `${c.name.substring(0, 30)}...=${c.value.substring(0, 10)}...`)
    );
    
    // Inspect JWT token
    const authCookie = req.cookies.get(`sb-${currentProjectRef}-auth-token`);
    if (authCookie?.value) {
      console.log("JWT_DEBUG - Inspecting auth token:");
      debugJwtToken(authCookie.value);
    } else {
      console.log("JWT_DEBUG - No auth token cookie found");
    }
  } catch (e) {
    console.error("COOKIE DEBUG: Error reading cookies", e);
  }
  
  // Get the path requested
  const { pathname } = req.nextUrl;
  
  // Skip middleware for most API routes
  if (pathname.startsWith('/api/')) {
      // Allow specific API routes needed pre-authentication
      const isAllowedApiRoute = PAYMENT_API_ROUTES.some(p => pathname.startsWith(p));
      if (!isAllowedApiRoute) {
          console.log("API route detected, skipping auth middleware");
          return NextResponse.next(); // Use fresh response for API routes not needing cookies
      }
      console.log(`Allowed API route ${pathname}, proceeding...`);
      // For allowed API routes like session recovery, let Supabase handle session/cookies below
  }
  
  // Skip middleware for static assets and specific file extensions
  // Updated to use endsWith for files and startsWith for /_next/
  const isExcludedPath = EXCLUDED_PATHS.some(path =>
    path.startsWith('/') ? pathname.startsWith(path) : pathname.endsWith(path)
  );
  if (isExcludedPath) {
    console.log("Excluded path detected, skipping auth middleware");
    return NextResponse.next(); // Use fresh response, no cookie handling needed
  }
  
  // Special handling for /wallet page during payment verification redirects
  const url = new URL(req.url);
  const hasPaymentParams = url.searchParams.has('status') ||
                         url.searchParams.has('session') ||
                         url.searchParams.has('reference') ||
                         url.searchParams.has('trxref');
  
  if (pathname === '/wallet' && hasPaymentParams) {
      console.log('Payment verification redirect detected for /wallet');
      // Check recovery cookies (keep existing logic)
      const authRecoveryCookie = req.cookies.get('auth_recovery');
      const paystackSessionCookie = req.cookies.get('paystack_session');
      const sessionTimestampCookie = req.cookies.get('session_timestamp');
      const isValidSession = sessionTimestampCookie &&
          (Date.now() - parseInt(sessionTimestampCookie.value)) < 60 * 60 * 1000;
  
      if ((authRecoveryCookie?.value === 'true' || paystackSessionCookie) && isValidSession) {
          console.log('Valid session recovery cookies detected, allowing request');
          // Allow potential refresh by calling getSession before returning res
          await supabase.auth.getSession();
          return response;
      }
  
      if (sessionTimestampCookie && !isValidSession) {
          console.log('Session expired, clearing recovery cookies on response');
          response.cookies.set({ name: 'auth_recovery', value: '', maxAge: 0, path: '/' });
          response.cookies.set({ name: 'recovery_user_id', value: '', maxAge: 0, path: '/' });
          response.cookies.set({ name: 'paystack_session', value: '', maxAge: 0, path: '/' });
          response.cookies.set({ name: 'session_timestamp', value: '', maxAge: 0, path: '/' });
          // Proceed to normal auth check below after clearing cookies
      }
      // If no valid recovery cookies or session expired, proceed to normal auth check below
  }
  
  // Check if the path is public - DECLARE ONLY ONCE
  const isPublicPath = PUBLIC_PATHS.some(path => pathname.startsWith(path));
  if (isPublicPath) {
    console.log("Public path detected, skipping auth check, running getSession for potential refresh.");
    
    // Add extra debugging for auth paths
    if (pathname.startsWith('/auth/sign-in')) {
      console.log("SUPABASE_DEBUG - Processing sign-in page");
      
      // Run getSession with more debugging
      console.log("SUPABASE_DEBUG - About to call getSession() on sign-in page");
      const signInSessionResult = await supabase.auth.getSession();
      console.log(`SUPABASE_DEBUG - sign-in getSession result: data=${!!signInSessionResult.data}, error=${!!signInSessionResult.error}`);
      if (signInSessionResult.error) {
        console.error("SUPABASE_DEBUG - Sign-in getSession error:", signInSessionResult.error);
      }
      
      // Check for cookies after getSession
      console.log("SUPABASE_DEBUG - Cookies after sign-in getSession:");
      try {
        const cookiesAfterGet = response.cookies.getAll();
        console.log("SUPABASE_DEBUG - Response cookies:", cookiesAfterGet.map(c => c.name));
      } catch (e) {
        console.error("SUPABASE_DEBUG - Error reading response cookies:", e);
      }
    }
    
    // Run getSession to let Supabase handle potential cookie updates via the 'set'/'remove' handlers
    await supabase.auth.getSession();
    return response; // Return the potentially modified response
  }
  
  // --- Post-Authentication Logic --- 
  
  // Get USER data. This verifies the session with the server.
  console.log("SUPABASE_DEBUG - About to call getUser() in middleware");
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  // --- ADDED DEBUGGING --- 
  console.log("SUPABASE_DEBUG - getUser() result in middleware:");
  console.log(`SUPABASE_DEBUG - User object:`, user ? { id: user.id, email: user.email, role: user.role } : null);
  console.log(`SUPABASE_DEBUG - getUser() error:`, userError ? { name: userError.name, message: userError.message, status: (userError as any).status } : null);
  // --- END ADDED DEBUGGING --- 

  if (userError) {
      // Log the specific error, but don't necessarily treat every error as fatal yet
      console.error("Middleware Supabase getUser Error Encountered:", userError.message);
  }
  
  // Log user status AFTER getUser call
  console.log(`Middleware check: User exists after getUser(): ${!!user}`);
  if (user) {
      console.log("SUPABASE_DEBUG - User details:", {
          id: user.id,
          email: user.email,
          role: user.role,
          // aud: user.aud, // Might not be needed
          // created_at: user.created_at // Might not be needed
      });
  }
  console.log("=================================");
  
  // If no user found via getUser, redirect to sign in
  if (!user) {
    console.log("Middleware redirect: No valid user found via getUser().");
    const redirectUrl = new URL('/auth/sign-in', req.url);
    redirectUrl.searchParams.set('redirectTo', req.nextUrl.pathname);
    console.log(`No user, redirecting to ${redirectUrl.pathname}`);
    return NextResponse.redirect(redirectUrl);
  }
  
  // Check role-based permissions for admin paths
  if (ADMIN_PATHS.some(path => pathname.startsWith(path))) {
    console.log("Admin path detected, invoking role middleware with user object");
    // Pass the validated user object to roleMiddleware
    return await roleMiddleware(req, response, user); // Pass user and response
  }
  
  // If session exists and it's not an admin path, allow access.
  console.log("Valid user, allowing access");
  return response;
}

export const config = {
  // Updated matcher to exclude more file extensions explicitly
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|.*\.css$|.*\.js$|.*\.png$|.*\.jpg$|.*\.jpeg$|.*\.gif$|.*\.svg$).*)",
  ],
}
