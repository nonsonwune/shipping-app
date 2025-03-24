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
const PAYMENT_ROUTES = [
  '/api/payment/verify',
  '/api/auth/session-recovery', 
  '/wallet' 
];

/**
 * Main middleware function to handle authentication and routing
 */
export async function middleware(req: NextRequest) {
  // Enhanced debug logging
  console.log("====== AUTH MIDDLEWARE LOG ======");
  console.log(`Path: ${req.nextUrl.pathname}`);
  
  // Get the path requested
  const { pathname } = req.nextUrl;
  
  // Skip middleware for API routes completely
  if (pathname.startsWith('/api/')) {
    // Except for the session recovery API which should be allowed
    if (pathname.startsWith('/api/auth/session-recovery')) {
      console.log("Session recovery API detected, allowing request");
      return NextResponse.next();
    }
    console.log("API route detected, skipping auth middleware");
    return NextResponse.next();
  }
  
  // Skip middleware for excluded paths
  const isExcludedPath = EXCLUDED_PATHS.some(path => pathname.includes(path));
  if (isExcludedPath) {
    console.log("Excluded path detected, skipping auth middleware");
    return NextResponse.next();
  }
  
  // Special handling for payment verification redirects
  const url = new URL(req.url);
  const hasPaymentParams = url.searchParams.has('status') || 
                         url.searchParams.has('session') || 
                         url.searchParams.has('reference') ||
                         url.searchParams.has('trxref');
  
  if (pathname === '/wallet' && hasPaymentParams) {
    console.log('Payment verification redirect detected, checking session recovery');
    
    // Check for recovery cookies
    const authRecoveryCookie = req.cookies.get('auth_recovery');
    const paystackSessionCookie = req.cookies.get('paystack_session');
    const sessionTimestampCookie = req.cookies.get('session_timestamp');
    
    // Check if session is still valid (within 1 hour)
    const isValidSession = sessionTimestampCookie && 
      (Date.now() - parseInt(sessionTimestampCookie.value)) < 60 * 60 * 1000;
    
    if ((authRecoveryCookie?.value === 'true' || paystackSessionCookie) && isValidSession) {
      console.log('Valid session recovery cookies detected, allowing request');
      return NextResponse.next();
    }
    
    // If session is expired, clear recovery cookies
    if (sessionTimestampCookie && !isValidSession) {
      console.log('Session expired, clearing recovery cookies');
      const response = NextResponse.next();
      response.cookies.set({ name: 'auth_recovery', value: '', maxAge: 0, path: '/' });
      response.cookies.set({ name: 'recovery_user_id', value: '', maxAge: 0, path: '/' });
      response.cookies.set({ name: 'paystack_session', value: '', maxAge: 0, path: '/' });
      response.cookies.set({ name: 'session_timestamp', value: '', maxAge: 0, path: '/' });
      return response;
    }
  }
  
  // Check if the path is public
  const isPublicPath = PUBLIC_PATHS.some(path => pathname.startsWith(path));
  if (isPublicPath) {
    console.log("Public path detected, skipping auth check");
    return NextResponse.next();
  }
  
  // Initialize Supabase client with the request
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  
  // Get the session from Supabase
  const { data: { session }, error } = await supabase.auth.getSession();
  
  console.log(`Session exists: ${!!session}`);
  console.log("=================================");
  
  // If no session and not a public path, redirect to sign in
  if (!session && !isPublicPath) {
    const redirectUrl = new URL('/auth/sign-in', req.url);
    
    // Add the original URL as a query parameter for redirect after login
    redirectUrl.searchParams.set('redirectTo', req.nextUrl.pathname);
    
    console.log(`No session, redirecting to ${redirectUrl.pathname}`);
    return NextResponse.redirect(redirectUrl);
  }
  
  // Check role-based permissions for admin paths
  if (session && ADMIN_PATHS.some(path => pathname.startsWith(path))) {
    return roleMiddleware(req);
  }
  
  // Continue to the requested page
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
}
