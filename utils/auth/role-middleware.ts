import { NextRequest, NextResponse } from "next/server";
import { type User } from '@supabase/supabase-js'

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
 * Middleware to check if the user has the required role to access a specific admin route.
 * Assumes the user has already been authenticated by the main middleware.
 */
export async function roleMiddleware(
  req: NextRequest, 
  response: NextResponse, // Accept response object
  user: User // Accept authenticated user object
) {
  // Get the path being requested
  const { pathname } = req.nextUrl;
  
  // This check is likely redundant if main middleware handles it, but keep for safety
  if (!pathname.startsWith('/admin')) {
    return response; // Pass through the existing response
  }
  
  // Allow access to public admin paths (e.g., /admin/login) 
  // This check IS necessary here
  if (PUBLIC_ADMIN_PATHS.some(path => pathname.startsWith(path))) {
    return response; 
  }
  
  console.log('====== ROLE MIDDLEWARE LOG ======');
  console.log(`Path: ${pathname}`);
  
  // Use the user object passed from the main middleware
  try {
    const userEmail = user.email;
    
    if (!userEmail) {
      // This shouldn't happen if main middleware validated user, but handle defensively
      console.log('Role Middleware: No email associated with authenticated user object!');
      const noEmailUrl = new URL('/admin/login?error=invalid_user', req.url);
      return NextResponse.redirect(noEmailUrl);
    }
    
    console.log(`Role Middleware User email: ${userEmail}`);
    
    const isAdmin = ADMIN_EMAILS.includes(userEmail.toLowerCase());
    
    if (isAdmin) {
      console.log('Role Middleware: User has admin email, access granted');
      // Return the response potentially modified by main middleware
      return response; 
    }
    
    // TODO: Implement staff role check if needed using user.role or similar
    // const isStaff = STAFF_PATHS.includes(pathname); // Example check
    // const userRole = user.app_metadata?.role; // Assuming role is stored
    // if (isStaff && userRole === 'staff') { ... return response; }

    console.log('Role Middleware: User does not have required role for this admin route');
    // Redirect to admin login OR a general unauthorized page
    const permissionsUrl = new URL('/admin/login?error=insufficient_permissions', req.url); 
    return NextResponse.redirect(permissionsUrl);
    
  } catch (error) {
    // Catch any unexpected errors during role check
    console.error('Role middleware error:', error);
    const serverErrorUrl = new URL('/admin/login?error=server', req.url);
    return NextResponse.redirect(serverErrorUrl);
  }
}
