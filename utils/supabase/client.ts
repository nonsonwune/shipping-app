import { createClient } from '@supabase/supabase-js';
import { getCookie, setCookie, deleteCookie } from 'cookies-next';
import type { Database } from '@/types/supabase';

// Global singleton instance
let browserClient: ReturnType<typeof createClient<Database>> | null = null;

export const createBrowserClient = () => {
  // Return existing instance if already created in this browser session
  if (browserClient) {
    return browserClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // Create a new instance and store it as the singleton
  browserClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
    },
  });

  return browserClient;
};

// This is separate from the browser client and won't interfere 
export const createServerClient = async () => {
  console.log('[Supabase Debug] Creating Supabase server client instance');
  
  if (typeof window !== 'undefined') {
    throw new Error('createServerClient should not be called in browser context');
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // Create a new server client for each request
  const cookieStorage = {
    async getItem(name: string) {
      try {
        console.log(`[Supabase Debug] Getting cookie: ${name}`);
        const cookie = getCookie(name);
        return cookie?.toString() || null;
      } catch (error) {
        console.error('Error getting cookie:', error);
        return null;
      }
    },
    async setItem(name: string, value: string) {
      try {
        setCookie(name, value, {
          path: '/',
          secure: process.env.NODE_ENV === 'production',
        });
        return;
      } catch (error) {
        console.error('Error setting cookie:', error);
        return;
      }
    },
    async removeItem(name: string) {
      try {
        console.log(`[Supabase Debug] Removing cookie: ${name}`);
        deleteCookie(name, {
          path: '/',
          secure: process.env.NODE_ENV === 'production',
        });
        return;
      } catch (error) {
        console.error('Error removing cookie:', error);
        return;
      }
    }
  };

  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: false,
      persistSession: true,
      autoRefreshToken: true,
      storage: cookieStorage,
    },
  });
};

export const createAdminClient = () => {
  console.log('[Supabase Debug] Creating Supabase admin client with service role');
  
  if (typeof window !== 'undefined') {
    throw new Error('createAdminClient should not be called in browser context');
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE!;

  if (!supabaseServiceRole) {
    throw new Error('SUPABASE_SERVICE_ROLE is required for admin operations');
  }

  return createClient<Database>(supabaseUrl, supabaseServiceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

// Enhanced session recovery function
export const checkSession = async () => {
  try {
    // Create a fresh client for this check to avoid any state issues
    const supabase = createBrowserClient();
    
    // Try to get current session
    const { data, error } = await supabase.auth.getSession();
    
    console.log('Session check result:', data?.session ? 'Session exists' : 'No session');
    
    // Get all cookies for debugging
    const allCookies = document.cookie.split(';').map(cookie => cookie.trim());
    console.log('Current cookies:', allCookies);
    
    if (error || !data?.session) {
      // If we have a refresh token cookie, try to use it
      const refreshToken = getCookie('sb-refresh-token');
      const recoveryFlag = getCookie('auth_recovery');
      const userId = getCookie('recovery_user_id');
      
      if (refreshToken) {
        console.log('Attempting to recover session...');
        try {
          // Try to refresh the session
          const { error: refreshError } = await supabase.auth.refreshSession({
            refresh_token: refreshToken.toString(),
          });
          
          if (refreshError) {
            console.error('Error refreshing session:', refreshError);
            
            // If we have recovery flags, redirect to the recovery endpoint
            if (recoveryFlag && userId) {
              console.log('Recovery cookies found, redirecting to recovery endpoint');
              // Navigate to the session recovery API which will handle server-side recovery
              window.location.href = `/api/auth/session-recovery?redirect=${window.location.pathname}`;
              return { session: null, recovered: false, redirected: true };
            }
          } else {
            // Successful refresh
            const { data: refreshedSession } = await supabase.auth.getSession();
            return { session: refreshedSession.session, recovered: true, redirected: false };
          }
        } catch (err) {
          console.error('Error refreshing session:', err);
        }
      }
      
      // Return null session if we couldn't recover
      return { session: null, recovered: false, redirected: false };
    }
    
    // Return the existing session
    return { session: data.session, recovered: false, redirected: false };
  } catch (error) {
    console.error('Error checking session:', error);
    return { session: null, recovered: false, redirected: false };
  }
};
