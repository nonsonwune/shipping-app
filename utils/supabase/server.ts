import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  console.log('Creating Supabase server client');
  
  // Use explicit typing to avoid TypeScript errors with ReadonlyRequestCookies
  // In Next.js 15, cookies() returns ReadonlyRequestCookies
  const cookieStore = await cookies()
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async get(name) {
          // For debugging
          if (name === 'sb-rtbqpprntygrgxopxoei-auth-token') {
            console.log(`Trying to get auth cookie: ${name}`);
          }
          
          try {
            return cookieStore.get(name)?.value
          } catch (error) {
            console.error(`Error getting cookie ${name}:`, error);
            return undefined;
          }
        },
        async set(name, value, options) {
          // For debugging
          if (name === 'sb-rtbqpprntygrgxopxoei-auth-token') {
            console.log(`Setting auth cookie: ${name}`);
          }
          
          try {
            // Handle readonly cookies in Next.js 15
            // This is for SSR only
            await cookieStore.set({ 
              name, 
              value, 
              ...options 
            })
          } catch (error) {
            console.error(`Error setting cookie ${name}:`, error);
          }
        },
        async remove(name, options) {
          // For debugging
          if (name === 'sb-rtbqpprntygrgxopxoei-auth-token') {
            console.log(`Removing auth cookie: ${name}`);
          }
          
          try {
            // Handle readonly cookies in Next.js 15
            await cookieStore.set({ 
              name, 
              value: '', 
              ...options, 
              maxAge: 0 
            })
          } catch (error) {
            console.error(`Error removing cookie ${name}:`, error);
          }
        },
      },
    }
  )
}
