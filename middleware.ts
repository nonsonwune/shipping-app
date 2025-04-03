import { NextRequest, NextResponse } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
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

/**
 * Main middleware function to handle authentication and routing
 */
export async function middleware(req: NextRequest) {
  // Enhanced debug logging
  console.log("====== AUTH MIDDLEWARE LOG ======");
  console.log(`Path: ${req.nextUrl.pathname}`);
  
  // Add Cookie Debugging
  try {
    console.log("COOKIE DEBUG: Auth cookies present:",
      req.cookies.getAll().filter(c => c.name.includes('-auth-token'))
        .map(c => `${c.name.substring(0, 30)}...=${c.value.substring(0, 10)}...`)
    );
  } catch (e) {
    console.error("COOKIE DEBUG: Error reading cookies", e);
  }
  
  // Get the path requested
  const { pathname } = req.nextUrl;
  
  // Initialize the response object. This may be modified by Supabase.
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  
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
          return res;
      }
  
      if (sessionTimestampCookie && !isValidSession) {
          console.log('Session expired, clearing recovery cookies');
          // Clear cookies manually on the 'res' object Supabase uses
          res.cookies.set({ name: 'auth_recovery', value: '', maxAge: 0, path: '/' });
          res.cookies.set({ name: 'recovery_user_id', value: '', maxAge: 0, path: '/' });
          res.cookies.set({ name: 'paystack_session', value: '', maxAge: 0, path: '/' });
          res.cookies.set({ name: 'session_timestamp', value: '', maxAge: 0, path: '/' });
          // Proceed to normal auth check below after clearing cookies
      }
      // If no valid recovery cookies or session expired, proceed to normal auth check below
  }
  
  // Check if the path is public
  const isPublicPath = PUBLIC_PATHS.some(path => pathname.startsWith(path));
  if (isPublicPath) {
    console.log("Public path detected, skipping auth check");
    // Still call getSession to allow Supabase to handle potential cookie updates
    await supabase.auth.getSession();
    return res; // Return Supabase-aware response
  }
  
  // --- Session Check and Handling ---
  
  // Get the session. Supabase helper modifies 'res' with Set-Cookie headers if needed.
  const { data: { session }, error } = await supabase.auth.getSession();
  
  // Log session status
  console.log(`Session exists: ${!!session}`);
  if (error) {
      // Log the specific error for better debugging
      console.error("Supabase getSession Error:", error.message);
  }
  console.log("=================================");
  
  // If no session, redirect to sign in
  if (!session) {
    const redirectUrl = new URL('/auth/sign-in', req.url);
    redirectUrl.searchParams.set('redirectTo', req.nextUrl.pathname);
    console.log(`No session, redirecting to ${redirectUrl.pathname}`);
    // Return a new redirect response. Cookie clearing headers were added to 'res'
    // by getSession(). The browser should process 'res' first.
    return NextResponse.redirect(redirectUrl);
  }
  
  // --- Post-Authentication Logic ---
  
  // Check role-based permissions for admin paths
  if (ADMIN_PATHS.some(path => pathname.startsWith(path))) {
    // roleMiddleware handles its own Supabase client and response/redirects
    console.log("Admin path detected, invoking role middleware");
    return roleMiddleware(req);
  }
  
  // If session exists and it's not an admin path, allow access.
  // IMPORTANT: Return the 'res' object potentially modified by Supabase.
  console.log("Valid session, allowing access");
  return res;
}

export const config = {
  // Updated matcher to exclude more file extensions explicitly
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|.*\.css$|.*\.js$|.*\.png$|.*\.jpg$|.*\.jpeg$|.*\.gif$|.*\.svg$).*)",
  ],
}
