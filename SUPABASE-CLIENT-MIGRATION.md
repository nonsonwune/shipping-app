# Supabase Client Standardization

This document provides instructions for resolving the "Multiple GoTrueClient instances" issue by standardizing the Supabase client implementation across the entire codebase.

## Issue Description

The application currently has multiple Supabase client implementations:

1. `/utils/supabase/client.ts` - Using `createClient` from '@supabase/supabase-js' with a `createBrowserClient` function
2. `/lib/supabase/client.ts` - Using `createClientComponentClient` from '@supabase/auth-helpers-nextjs' with a `createClient` function
3. Middleware using `createMiddlewareClient` for auth checks

This leads to the "Multiple GoTrueClient instances detected in the same browser context" error, which can cause authentication issues, session management problems, and unexpected behavior.

## Migration Strategy

To resolve this issue, we need to standardize on a single Supabase client implementation. We will use the `/lib/supabase/client.ts` implementation as the standard across the entire codebase.

### Step 1: Update Imports in Client Components

For any component using Supabase client, update the imports to use the standardized client:

```typescript
// OLD
import { createBrowserClient, checkSession } from "@/utils/supabase/client";

// NEW
import { createClient, getSession, recoverSession } from "@/lib/supabase/client";
```

### Step 2: Update Client Creation

Update any instances of `createBrowserClient()` to use `createClient()`:

```typescript
// OLD
const supabase = createBrowserClient();

// NEW
const supabase = createClient();
```

### Step 3: Update Session Management

Replace the `checkSession` function with the standardized session management functions:

```typescript
// OLD
const sessionResult = await checkSession();
if (sessionResult.session) {
  // Use sessionResult.session
}

// NEW
const { session, error } = await getSession();
if (session) {
  // Use session
}
```

### Step 4: Update Session Recovery Logic

Replace any custom session recovery logic with the standardized recovery function:

```typescript
// OLD
if (sessionResult.redirected) {
  // Handle redirect
}

// NEW
// Try to recover session using the standardized function
const recoveredSession = await recoverSession();
if (recoveredSession) {
  // Session recovered
} else {
  // Redirect or handle failure
}
```

## Files Already Updated

1. `app/wallet/page.tsx` - Updated to use the standardized client implementation

## Files That Need To Be Updated

The following files may still be using the old client implementation:

1. Any components importing from `@/utils/supabase/client` directly
2. Any components using the `checkSession` function from `utils/supabase/client.ts`

## Testing Strategy

After updating each file:

1. Test authentication flows (sign in, sign up, sign out)
2. Test protected routes access
3. Verify session persistence across page refreshes and navigation
4. Check browser console for any "Multiple GoTrueClient instances" errors

## Long-term Solution

Consider adding ESLint rules to prevent using deprecated client implementations:

```json
{
  "rules": {
    "no-restricted-imports": [
      "error",
      {
        "paths": [
          {
            "name": "@/utils/supabase/client",
            "message": "Please use @/lib/supabase/client instead for consistent Supabase client implementation."
          }
        ]
      }
    ]
  }
}
``` 