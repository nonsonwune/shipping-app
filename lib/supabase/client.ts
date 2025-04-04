/**
 * Supabase client for browser/client components
 * Only import this in client components ('use client')
 */

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/supabase'
import type { Session, AuthChangeEvent } from '@supabase/supabase-js'

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Singleton instance management
let clientInstance: ReturnType<typeof createBrowserClient<Database>> | null = null

/**
 * Debug logger that only logs in development
 */
function debugLog(...args: any[]) {
  if (process.env.NODE_ENV === 'development') {
    console.log('[Supabase Debug]', ...args)
  }
}

/**
 * Creates a Supabase client for client components with singleton pattern
 * Use this in client components (React components with 'use client')
 */
export function createClient() {
  // Add Debugging
  console.log("DEBUG: Attempting to create browser Supabase client with URL:", supabaseUrl);
  if (supabaseUrl) {
    try {
      const projectRef = supabaseUrl.split('https://')[1]?.split('.')[0];
      console.log("DEBUG: Project ref from URL:", projectRef);
      
      // Check for existing auth cookies
      if (typeof document !== 'undefined') {
        const cookies = document.cookie.split(';').map(c => c.trim());
        const authCookies = cookies.filter(c => c.includes('-auth-token'));
        const refreshCookies = cookies.filter(c => c.includes('-auth-token-refresh') || c.includes('refresh-token'));
        console.log(`DEBUG: Found ${authCookies.length} auth token cookies and ${refreshCookies.length} refresh token cookies`);
        
        if (authCookies.length > 0) {
          console.log("DEBUG: Auth cookies present:", authCookies.map(c => c.substring(0, 30) + '...'));
        }
      }
    } catch (e) {
      console.error("DEBUG: Error parsing Supabase URL for project ref", e);
    }
  } else {
    console.warn("DEBUG: supabaseUrl is not defined");
  }

  if (clientInstance) return clientInstance
  
  debugLog('Creating new browser client instance')
  
  // Create client using the correct import
  clientInstance = createBrowserClient<Database>(
    supabaseUrl,
    supabaseAnonKey
  )
  
  // Initialize session debugging
  if (clientInstance && typeof window !== 'undefined') {
    clientInstance.auth.getSession().then(({ data, error }: { data: { session: Session | null }, error: any }) => {
      if (error) {
        console.log("DEBUG: Initial session check error:", error.message);
      } else {
        console.log("DEBUG: Initial session check result:", 
          data.session ? 
          {
            user_id: data.session.user.id,
            email: data.session.user.email,
            expires_at: new Date(data.session.expires_at! * 1000).toISOString(),
            has_access_token: !!data.session.access_token,
            has_refresh_token: !!data.session.refresh_token,
          } : 
          "No session"
        );
      }
    });
    
    // Listen for auth state changes
    clientInstance.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      console.log(`DEBUG: Auth state changed: ${event}`, 
        session ? { user_id: session.user.id, email: session.user.email } : "No session"
      );
    });
  }
  
  return clientInstance
}

/**
 * Gets the current session from the browser client
 */
export async function getSession() {
  const client = createClient()
  if (!client) {
    debugLog('No client available for getSession')
    return { session: null, error: new Error('Client not available') }
  }
  
  const { data, error } = await client.auth.getSession()
  
  if (error) {
    debugLog('Error getting session:', error)
    return { session: null, error }
  }
  
  return { session: data.session, error: null }
}

/**
 * Gets the user profile from the browser client
 */
export async function getUserProfile() {
  const { data: { session }, error } = await createClient().auth.getSession();
  
  if (error) {
    debugLog('Session retrieval error in getUserProfile:', error);
    return { profile: null, error };
  }
  
  if (!session) {
    debugLog('No session found in getUserProfile');
    return { profile: null, error: new Error('No active session') };
  }
  
  const currentUserId = session.user.id;
  debugLog(`getUserProfile: Fetching profile for user ID: ${currentUserId}`);
  
  const client = createClient();
  const { data, error: profileError } = await client
    .from('profiles')
    .select('*')
    .eq('id', currentUserId)
    .single();
  
  if (profileError) {
    debugLog('Error getting profile in getUserProfile:', profileError);
    if (profileError.code === 'PGRST116' || profileError.message.includes('permission denied') || profileError.message.includes('does not exist')) {
      console.error(`RLS or Existence Error fetching profile for ${currentUserId}:`, profileError.message);
    }
    return { profile: null, error: profileError };
  }
  
  debugLog('Successfully fetched profile:', data);
  return { profile: data, error: null };
}
