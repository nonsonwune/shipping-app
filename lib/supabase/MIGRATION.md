# Supabase Client Migration Guide

## Overview

This guide explains how to migrate from the previous multiple Supabase client implementations to the new unified architecture. The new system provides:

1. Specialized clients for different contexts (browser, server, API routes, admin)
2. Consistent session management across your application
3. Proper handling of cookies to prevent authentication issues
4. Type safety and robust error handling
5. Safety measures to prevent server code from running in browser contexts

## Client Types

### In Client Components

```typescript
// For 'use client' React components
import { createBrowserClient, getBrowserSession, getBrowserProfile } from '@/lib/supabase'

function MyClientComponent() {
  const [data, setData] = useState(null)
  
  useEffect(() => {
    async function fetchData() {
      const supabase = createBrowserClient()
      const { data } = await supabase.from('my_table').select('*')
      setData(data)
      
      // Or use the helper functions
      const session = await getBrowserSession()
      const profile = await getBrowserProfile()
    }
    
    fetchData()
  }, [])
  
  return <div>{/* component content */}</div>
}
```

### In Server Components

```typescript
// For React Server Components
import { createServerClient, getServerSession, getServerProfile } from '@/lib/supabase'

async function MyServerComponent() {
  const supabase = await createServerClient()
  const { data } = await supabase.from('my_table').select('*')
  
  // Or use the helper functions
  const session = await getServerSession()
  const profile = await getServerProfile()
  
  return <div>{/* component content */}</div>
}
```

### In API Routes / Route Handlers

```typescript
// For Next.js API routes and route handlers
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createServerClient()
  // Rest of your code
  return NextResponse.json({ data })
}
```

### For Admin Operations (bypassing RLS)

```typescript
// For server-side admin operations
import { createAdminClient, adminQuery } from '@/lib/supabase'

// Example usage in an API route
export async function POST(request: NextRequest) {
  // Using the admin client directly
  const admin = createAdminClient()
  const { data } = await admin.from('users').select('*')
  
  // Or using the helper function
  const { data: orders } = await adminQuery('orders', 
    (query) => query.select('*').eq('status', 'pending'))
  
  return NextResponse.json({ success: true })
}
```

## Helper Functions

The new architecture provides several helper functions:

### Session Management

```typescript
import { getBrowserSession, getBrowserProfile } from '@/lib/supabase' // For client components
import { getServerSession, getServerProfile } from '@/lib/supabase' // For server components

// In client components
const session = await getBrowserSession()
const profile = await getBrowserProfile()

// In server components
const session = await getServerSession()
const profile = await getServerProfile()
```

### Safe Query Utilities

```typescript
import { safeQuerySingle } from '@/lib/supabase/utils'

// Safely query wallet balance, avoiding 406 errors
const supabase = createBrowserClient()
const { data, error } = await safeQuerySingle(
  supabase,
  'wallets',
  'balance',
  { user_id: session.user.id }
)
```

## Migration Steps

1. **Replace direct imports**: Change all imports from `@/utils/supabase/client`, `@/lib/supabase`, etc. to use the new unified imports from `@/lib/supabase`.

2. **Update client usage**: Replace direct client usage with the appropriate specialized client:
   - Client components: `createBrowserClient()`
   - Server components: `await createServerClient()`
   - Admin operations: `createAdminClient()`

3. **Fix wallet queries**: Use `safeQuerySingle()` for wallet balance queries to avoid 406 errors.

4. **Add safety checks**: Ensure you're using the right client for each context.

## Example: Updating Services Page

```typescript
// Before
import { supabase } from '@/lib/supabase'

// After
import { createBrowserClient } from '@/lib/supabase'

function ServicesContent() {
  const supabase = createBrowserClient()
  // Rest of your component
}
```

## Example: Updating Payment Verification

```typescript
// Before
import { createClient } from '@/utils/supabase/server'

// After
import { createServerClient } from '@/lib/supabase'

export async function POST(request: Request) {
  const supabase = await createServerClient()
  // Rest of your code
}
```

## Debugging

The new architecture includes debug logging in development mode. To see detailed logs of Supabase operations, check your browser console or server logs.
