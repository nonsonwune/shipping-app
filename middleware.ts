import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
// import { cookies } from 'next/headers'
import { roleMiddleware } from "./utils/auth/role-middleware";

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
  
  // Declare variable to hold direct validation result
  let directValidationSuccessful = false;
  let directValidationUser = null;
  
  // Create a direct Supabase client with the raw token for token validation
  const authCookie = req.cookies.get(`sb-${currentProjectRef}-auth-token`);
  if (authCookie?.value) {
    try {
      // --- ADDED: Handle potential JSON array cookie format --- 
      let tokenToValidate = authCookie.value;
      if (tokenToValidate.startsWith('[') && tokenToValidate.endsWith(']')) {
        try {
          console.log("DIRECT_AUTH_DEBUG - Parsing JSON array cookie for token");
          const parsed = JSON.parse(tokenToValidate);
          if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
            tokenToValidate = parsed[0];
            console.log("DIRECT_AUTH_DEBUG - Successfully extracted token from JSON array");
          } else {
            console.warn("DIRECT_AUTH_DEBUG - Parsed cookie was not a valid token array, attempting raw value");
            // Keep original value if parsing fails or format is wrong
          }
        } catch (parseError) {
          console.error("DIRECT_AUTH_DEBUG - Error parsing JSON cookie, attempting raw value:", parseError);
          // Keep original value if parsing fails
        }
      }
      // --- END ADDED --- 
      
      // Create a direct client with the token to validate using the service role key
      const directClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!, // Use service role key instead
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );
      
      // Set the session manually - USE PARSED TOKEN
      const { error: setSessionError } = await directClient.auth.setSession({
        access_token: tokenToValidate, // Use the potentially parsed token
        refresh_token: req.cookies.get(`sb-${currentProjectRef}-auth-token-refresh`)?.value || '',
      });
      
      if (setSessionError) {
        console.log("DIRECT_AUTH_DEBUG - Error setting session:", setSessionError.message);
      } else {
        // Get user to validate token
        const { data: userData, error: userError } = await directClient.auth.getUser();
        
        if (userError) {
          console.log("DIRECT_AUTH_DEBUG - Error getting user, token likely invalid:", userError.message);
        } else if (userData.user) {
          console.log("DIRECT_AUTH_DEBUG - Token is valid, user:", {
            id: userData.user.id,
            email: userData.user.email,
            role: userData.user.role
          });
          // If we got here, set the validation as successful
          directValidationSuccessful = true;
          directValidationUser = userData.user;
        }
      }
    } catch (error) {
      console.error("DIRECT_AUTH_DEBUG - Error with direct validation:", error);
    }
  }
  
  // Create Supabase client using @supabase/ssr with direct request cookie access
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
            // Use req.cookies directly instead of cookieStore
            const value = req.cookies.get(name)?.value;
            
            // Debug line - log every cookie access
            console.log(`COOKIE_DEBUG - Reading cookie: ${name}, Raw value exists: ${!!value}`);
            
            if (!value) return undefined;
            
            // Debug line - log raw value substring
            if (value.length > 20) {
              console.log(`COOKIE_DEBUG - Raw value (truncated): ${value.substring(0, 20)}...`);
            } else {
              console.log(`COOKIE_DEBUG - Raw value: ${value}`);
            }
            
            // Handle JSON-formatted cookies (when token is stored as a JSON array)
            if (value.startsWith('[') && value.endsWith(']')) {
              try {
                console.log(`COOKIE_DEBUG - Detected JSON array format, attempting to parse`);
                const parsed = JSON.parse(value);
                // Return the first item if it's an array
                if (Array.isArray(parsed) && parsed.length > 0) {
                  console.log(`COOKIE_DEBUG - Successfully parsed as array with ${parsed.length} items`);
                  if (parsed[0] && typeof parsed[0] === 'string' && parsed[0].length > 20) {
                    console.log(`COOKIE_DEBUG - Using array item 0 (truncated): ${parsed[0].substring(0, 20)}...`);
                  }
                  return parsed[0];
                } else {
                  console.log(`COOKIE_DEBUG - Parsed but not a valid array, returning raw value`);
                  return value;
                }
              } catch (parseError) {
                console.error("Middleware: Error parsing cookie JSON:", parseError);
                console.log(`COOKIE_DEBUG - Parse failed, returning raw value`);
                return value; // Return the raw value as fallback
              }
            }
            
            console.log(`COOKIE_DEBUG - Not JSON format, returning raw value`);
            return value;
          } catch (error) {
            console.error("Middleware: Error getting cookie:", name, error);
            return undefined;
          }
        },
        async set(name: string, value: string, options: CookieOptions) {
          try {
            // Set cookies on the response
            await response.cookies.set({ name, value, ...options });
          } catch (error) {
            console.error("Middleware: Error setting cookie:", name, error);
          }
        },
        async remove(name: string, options: CookieOptions) {
          try {
            // Remove cookies from the response
            await response.cookies.set({ name, value: '', ...options });
          } catch (error) {
            console.error("Middleware: Error removing cookie:", name, error);
          }
        },
      },
    }
  );
  
  // --- Early Exits (Before Session Check) ---
  
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
  
  // Check if the path is public
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
  
  // --- Session Check and Handling ---
  
  // MODIFICATION: First check if direct validation was successful
  if (directValidationSuccessful && directValidationUser) {
    console.log("Direct validation successful, bypassing getSession check");
    
    // Check role-based permissions for admin paths
    if (ADMIN_PATHS.some(path => pathname.startsWith(path))) {
      console.log("Admin path detected, invoking role middleware");
      return await roleMiddleware(req);
    }
    
    // If not an admin path, allow access
    console.log("Valid session (via direct validation), allowing access");
    return response;
  }
  
  // Fall back to getSession for backward compatibility
  console.log("SUPABASE_DEBUG - About to call getSession()");
  const sessionResult = await supabase.auth.getSession();
  
  // Enhanced debugging for session data
  console.log(`SUPABASE_DEBUG - getSession returned data: ${!!sessionResult.data}, error: ${!!sessionResult.error}`);
  console.log("SUPABASE_DEBUG - Session structure:", JSON.stringify({
    hasSession: !!sessionResult.data.session,
    user: sessionResult.data.session ? {
      id: sessionResult.data.session.user.id,
      email: sessionResult.data.session.user.email,
      role: sessionResult.data.session.user.role
    } : null,
    expires_at: sessionResult.data.session?.expires_at,
    access_token_length: sessionResult.data.session?.access_token?.length || 0,
    refresh_token_length: sessionResult.data.session?.refresh_token?.length || 0,
  }));
  
  const { data: { session }, error } = sessionResult;
  
  // Log session status
  console.log(`Session exists: ${!!session}`);
  if (error) {
      // Log the specific error for better debugging
      console.error("Supabase getSession Error:", error.message);
  }
  console.log("=================================");
  
  // If no session, redirect to sign in
  if (!session || !session.user || !session.access_token) {
    console.log("SUPABASE_DEBUG - No valid session found. Reason:", 
               !session ? "No session object" : 
               !session.user ? "No user in session" : 
               !session.access_token ? "No access token" : "Unknown");
    const redirectUrl = new URL('/auth/sign-in', req.url);
    redirectUrl.searchParams.set('redirectTo', req.nextUrl.pathname);
    console.log(`No session, redirecting to ${redirectUrl.pathname}`);
    // Return a new redirect response. The 'res' object contains potential Set-Cookie headers from getSession.
    // We need to transfer those headers if any exist. A simple redirect might lose them.
    // However, NextResponse.redirect itself handles this correctly usually.
    return NextResponse.redirect(redirectUrl);
  }
  
  // --- Post-Authentication Logic ---
  
  // Check role-based permissions for admin paths
  if (ADMIN_PATHS.some(path => pathname.startsWith(path))) {
    console.log("Admin path detected, invoking role middleware");
    // Revert to original call signature. roleMiddleware will be refactored 
    // to use @supabase/ssr and handle cookies independently.
    return await roleMiddleware(req);
  }
  
  // If session exists and it's not an admin path, allow access.
  // IMPORTANT: Return the 'res' object potentially modified by Supabase.
  console.log("Valid session, allowing access");
  return response;
}

export const config = {
  // Updated matcher to exclude more file extensions explicitly
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|.*\.css$|.*\.js$|.*\.png$|.*\.jpg$|.*\.jpeg$|.*\.gif$|.*\.svg$).*)",
  ],
}
