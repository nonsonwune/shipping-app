import { NextRequest, NextResponse } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

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
  
  // Create a response and supabase client
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  
  console.log('====== AUTH MIDDLEWARE LOG ======');
  console.log(`Path: ${pathname}`);
  
  try {
    // Get the session
    const { data: { session } } = await supabase.auth.getSession();
    
    console.log(`Session exists: ${!!session}`);
    console.log('=================================');
    
    if (!session) {
      // No session, redirect to admin login
      console.log('No session found, redirecting to admin login');
      const redirectUrl = new URL('/admin/login', req.url);
      return NextResponse.redirect(redirectUrl);
    }

    // Get user details from session
    const userEmail = session.user.email;
    
    if (!userEmail) {
      console.log('No email associated with this session');
      const noEmailUrl = new URL('/admin/login?error=invalid_user', req.url);
      return NextResponse.redirect(noEmailUrl);
    }
    
    console.log(`User email: ${userEmail}`);
    
    // Check if email matches any admin email
    const isAdmin = ADMIN_EMAILS.includes(userEmail.toLowerCase());
    
    if (isAdmin) {
      console.log('User has admin email, access granted');
      return res;
    }
    
    // For staff, we would implement a similar check here if needed
    // But for now, we're focusing on getting admin access working
    
    // If access checks fail, redirect to login with error
    console.log('User does not have required role for this admin route');
    const permissionsUrl = new URL('/admin/login?error=insufficient_permissions', req.url);
    return NextResponse.redirect(permissionsUrl);
  } catch (error) {
    console.error('Role middleware error:', error);
    const serverErrorUrl = new URL('/admin/login?error=server', req.url);
    return NextResponse.redirect(serverErrorUrl);
  }
}
