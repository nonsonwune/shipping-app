/**
 * Server client for Supabase
 * Use this in server components and API routes
 */
import { createServerClient as createSSRClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/supabase'
import { debugLog } from './utils'

// Environment variables must be available
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Cache for cookie store to avoid repeated creation
let cachedCookieStore: any = null;

/**
 * Safe function to get cookie store, handling both sync and async cases
 */
const getCookieStore = async () => {
  try {
    if (cachedCookieStore) return cachedCookieStore;
    
    const cookieStore = cookies();
    // Check if cookieStore is a promise and await it if needed
    cachedCookieStore = cookieStore instanceof Promise ? await cookieStore : cookieStore;
    return cachedCookieStore;
  } catch (error) {
    console.error('Error accessing cookie store:', error);
    return null;
  }
};

/**
 * Creates a Supabase client for server components and API routes
 * Properly handles cookies in Next.js App Router
 */
export async function createClient() {
  // Browser-side safety check
  if (typeof window !== 'undefined') {
    throw new Error(
      'Server createClient() was called in the browser. ' +
      'Use client.ts createClient() method for client components instead.'
    )
  }

  debugLog('Creating Supabase server client instance')
  
  // Get cookie store - ensure it's initialized
  const cookieStore = await getCookieStore();
  
  // Create cookie handlers with proper error handling
  const cookieHandlers = {
    get(name: string) {
      try {
        debugLog(`Getting cookie: ${name}`);
        if (!cookieStore) return undefined;
        return cookieStore.get(name)?.value;
      } catch (error) {
        console.error(`Error getting cookie ${name}:`, error);
        return undefined;
      }
    },
    set(name: string, value: string, options?: any) {
      try {
        debugLog(`Setting cookie: ${name}`);
        if (!cookieStore) return;
        cookieStore.set({ name, value, ...options });
      } catch (error) {
        console.error(`Error setting cookie ${name}:`, error);
      }
    },
    remove(name: string, options?: any) {
      try {
        debugLog(`Removing cookie: ${name}`);
        if (!cookieStore) return;
        cookieStore.set({ name, value: '', ...options, maxAge: 0 });
      } catch (error) {
        console.error(`Error removing cookie ${name}:`, error);
      }
    }
  };
  
  // Return the client with proper cookie handling
  return createSSRClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: cookieHandlers
    }
  )
}

/**
 * Get the current user session in server components
 */
export async function getSession() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getSession()
  
  if (error) {
    console.error('Error getting session in server component:', error.message)
    return null
  }
  
  return data.session
}

/**
 * Get the current user profile in server components
 */
export async function getUserProfile() {
  const session = await getSession()
  
  if (!session?.user) {
    return null
  }
  
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single()
  
  if (error) {
    console.error('Error fetching user profile in server component:', error.message)
    return null
  }
  
  return data
}
