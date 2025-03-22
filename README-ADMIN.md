# Admin Authentication System

This document explains how the admin authentication system works in the shipping application and provides guidance for setting up and managing administrators.

## Overview

The admin authentication system uses Supabase for user management and implements a role-based access control system. The key components are:

1. **Database tables:**
   - `roles` - Stores the available roles (admin, staff, user)
   - `user_roles` - Junction table that links users to their roles

2. **Authentication flow:**
   - When a user tries to access the admin area, middleware checks for an active session
   - If a session exists, the user's roles are checked
   - Only users with the "admin" role can access admin-protected routes
   - Staff members have access to a limited subset of admin routes

3. **Components:**
   - `role-middleware.ts` - Handles authentication and authorization checks
   - `AdminLayout` - Client-side component that verifies admin access
   - Admin login page - Handles admin-specific authentication

## Getting Started

### Setting Up the Database

1. Run the migration script to create the necessary tables and functions:

```bash
npx supabase migration up
```

This will create the `roles` and `user_roles` tables with appropriate security policies.

### Creating an Admin User in Production

Use the included admin seeding script to create an admin user:

```bash
# Make the script executable
chmod +x scripts/seed-admin.js

# Run with custom credentials (recommended for production)
node scripts/seed-admin.js "admin@yourcompany.com" "SecurePassword123!"
```

This script will:
1. Create a new user with the provided email and password
2. Assign the admin role to this user
3. Create a profile for the user

### Managing Admin Users

You can manage admin users through:

1. **Admin Dashboard:** Navigate to Users section in the admin dashboard
2. **Direct Database Access:** Manage roles through the Supabase dashboard:
   - Assign roles by inserting records into the `user_roles` table
   - Create new roles in the `roles` table if needed

## Security Considerations

1. **Row Level Security:** The database tables use Supabase Row Level Security to ensure that:
   - Only admin users can create/update/delete roles
   - Regular users cannot modify role assignments

2. **Authentication Protection:**
   - All admin routes are protected by middleware
   - Client-side checks prevent unauthorized access to admin components
   - Role verification happens on both server and client side

3. **Session Management:**
   - Sessions are managed by Supabase Auth
   - JWT tokens are used for authentication
   - Invalid sessions are redirected to the login page

## Troubleshooting

### Common Issues

1. **Failed to parse cookie string errors:**
   - These warnings appear in the console due to Supabase parsing JWT tokens as JSON
   - They don't affect functionality and can be safely ignored

2. **Authentication Loops:**
   - If you experience authentication loops, check that:
     - The middleware is correctly configured
     - The database has the proper tables and relationships
     - The user has the admin role assigned

3. **Role Assignment Failures:**
   - Ensure the `roles` table exists and contains the admin role
   - Check that the user_id and role_id in the `user_roles` table are correct

### Database Verification

You can verify the database setup with these SQL queries:

```sql
-- Check if roles exist
SELECT * FROM public.roles;

-- Check user role assignments
SELECT 
  auth.users.email,
  roles.name as role
FROM 
  auth.users
  JOIN public.user_roles ON auth.users.id = public.user_roles.user_id
  JOIN public.roles ON public.user_roles.role_id = public.roles.id;
```

## Technical Details

### Middleware Implementation

The role middleware checks the user's session and roles before allowing access to admin routes:

1. When a request comes in, the middleware intercepts it
2. The session is extracted using Supabase Auth helpers
3. If the session exists, user roles are checked against the required role for the route
4. Access is granted or denied based on role verification

### Client-Side Protection

Even if middleware is bypassed, the `AdminLayout` component provides an additional layer of protection:

1. On mount, it checks for an active session
2. It verifies the user has admin privileges
3. It redirects unauthorized users to the login page

This provides defense in depth for the admin section.

## Custom Configuration

### Environment Variables

The admin authentication system uses these environment variables:

- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - For admin-level operations (required for seeding)

Make sure these are set in your `.env.local` file.

### Production Settings

For production environments:

1. Create a strong, unique password for your admin user
2. Consider enabling additional security features in Supabase:
   - Email verification
   - Multi-factor authentication
   - Login throttling

3. Regularly audit the `user_roles` table to ensure only authorized users have admin access
