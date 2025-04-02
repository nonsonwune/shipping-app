/**
 * Supabase client for browser/client components
 * Only import this in client components ('use client')
 */

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/types/supabase'

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Singleton instance management
let clientInstance: ReturnType<typeof createClientComponentClient<Database>> | null = null

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
      console.log("DEBUG: Project ref from URL:", supabaseUrl.split('https://')[1]?.split('.')[0]);
    } catch (e) {
      console.error("DEBUG: Error parsing Supabase URL for project ref", e);
    }
  } else {
    console.warn("DEBUG: supabaseUrl is not defined");
  }

  if (clientInstance) return clientInstance
  
  debugLog('Creating new browser client instance')
  // Simplify client creation to avoid type errors
  clientInstance = createClientComponentClient<Database>()
  
  return clientInstance
}

/**
 * Manually persist a session token to prevent session loss
 * This is a workaround for cases where the Supabase auth cookies are being cleared
 */
export async function persistSession() {
  const client = createClient()
  if (!client) {
    debugLog('No client available for persistSession')
    return null
  }
  
  const { data, error } = await client.auth.getSession()
  
  if (error || !data.session) {
    debugLog('No session to persist')
    return null
  }
  
  try {
    // Store session in localStorage as backup
    localStorage.setItem('sb-session-backup', JSON.stringify(data.session))
    
    // Manually set the refresh token cookie with maximum security settings
    document.cookie = `sb-refresh-token=${data.session.refresh_token}; path=/; SameSite=Strict; secure; max-age=604800` // 7 days
    
    debugLog('Session backup created')
    return data.session
  } catch (e) {
    debugLog('Error persisting session:', e)
    return data.session
  }
}

/**
 * Try to recover a lost session from backup storage
 */
export async function recoverSession() {
  debugLog('Attempting to recover session...')

  // Add debugging for available auth cookies
  try {
    const allCookies = document.cookie.split(';').map(c => c.trim());
    const authCookies = allCookies.filter(c => c.includes('-auth-token='));
    debugLog('Found auth cookies:', authCookies);
  } catch(e) {
    debugLog('Error reading cookies for debug:', e);
  }

  const client = createClient()
  if (!client) {
    debugLog('No client available for recoverSession')
    return null
  }
  
  try {
    // Check for existing session first
    const { data: sessionData } = await client.auth.getSession()
    if (sessionData.session) {
      debugLog('Active session exists, no recovery needed')
      return sessionData.session
    }
    
    // Try to get refresh token from cookies
    const refreshTokenCookie = document.cookie
      .split('; ')
      .find(row => row.startsWith('sb-refresh-token='))
      ?.split('=')[1]
    
    // Try to get session backup from localStorage
    const sessionBackup = localStorage.getItem('sb-session-backup')
    
    if (refreshTokenCookie) {
      debugLog('Found refresh token in cookies, attempting refresh')
      const { data: refreshData, error: refreshError } = await client.auth.refreshSession()
      
      if (!refreshError && refreshData.session) {
        debugLog('Session refreshed successfully from cookie')
        return refreshData.session
      }
    }
    
    if (sessionBackup) {
      debugLog('Found session backup in localStorage')
      
      try {
        const parsedSession = JSON.parse(sessionBackup)
        if (parsedSession && parsedSession.refresh_token) {
          debugLog('Attempting to set session from backup')
          
          // Set the session manually
          const { data: setData, error: setError } = await client.auth.setSession({
            refresh_token: parsedSession.refresh_token,
            access_token: parsedSession.access_token
          })
          
          if (!setError && setData.session) {
            debugLog('Session recovered successfully from backup')
            return setData.session
          } else {
            debugLog('Failed to set session from backup:', setError)
          }
        }
      } catch (e) {
        debugLog('Error parsing session backup:', e)
      }
    }
    
    debugLog('No session could be recovered')
    return null
  } catch (e) {
    debugLog('Error during session recovery:', e)
    return null
  }
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
  const { session, error } = await getSession()
  
  if (error || !session) {
    debugLog('No session found for profile retrieval')
    return { profile: null, error: error || new Error('No session') }
  }
  
  const client = createClient()
  const { data, error: profileError } = await client
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single()
  
  if (profileError) {
    debugLog('Error getting profile:', profileError)
    return { profile: null, error: profileError }
  }
  
  return { profile: data, error: null }
}
