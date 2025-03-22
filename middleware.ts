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

/**
 * Main middleware function to handle authentication and routing
 */
export async function middleware(req: NextRequest) {
  // Get the path requested
  const { pathname } = req.nextUrl;
  
  // Skip middleware for API routes completely
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }
  
  // Skip middleware for excluded paths
  const isExcludedPath = EXCLUDED_PATHS.some(path => pathname.includes(path));
  if (isExcludedPath) {
    return NextResponse.next();
  }
  
  // Create a NextResponse and Supabase client
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  
  // Debug logging
  console.log('====== AUTH MIDDLEWARE LOG ======');
  console.log(`Path: ${pathname}`);
  
  try {
    // Get the session from Supabase
    const { data: { session } } = await supabase.auth.getSession();
    const sessionExists = !!session;
    
    console.log(`Session exists: ${sessionExists}`);
    console.log('=================================');
    
    // Special handling for admin routes - Check roles and permissions
    if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
      // Use the specialized role middleware for admin routes
      return roleMiddleware(req);
    }
    
    // For public paths, no redirection needed regardless of auth status
    if (PUBLIC_PATHS.includes(pathname) || PUBLIC_PATHS.some(path => pathname.startsWith(`${path}/`))) {
      // If user is authenticated and trying to access auth pages, redirect to home
      if (sessionExists && pathname.startsWith('/auth/')) {
        return NextResponse.redirect(new URL('/', req.url));
      }
      
      // Otherwise, allow access to the public path
      return res;
    }
    
    // For protected routes, redirect to login if not authenticated
    if (!sessionExists) {
      console.log('No session found, redirecting to login');
      
      // Different redirect based on path type
      if (pathname.startsWith('/admin')) {
        return NextResponse.redirect(new URL('/admin/login', req.url));
      } else {
        return NextResponse.redirect(new URL('/auth/sign-in', req.url));
      }
    }
    
    // User is authenticated, allow access
    return res;
  } catch (error) {
    console.error('Middleware error:', error);
    
    // On error, redirect to login as a fallback
    if (pathname.startsWith('/admin')) {
      return NextResponse.redirect(new URL('/admin/login', req.url));
    }
    return NextResponse.redirect(new URL('/auth/sign-in', req.url));
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
}
