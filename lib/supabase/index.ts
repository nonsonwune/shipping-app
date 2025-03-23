/**
 * Unified Supabase client exports
 * This is the main entry point for all Supabase-related functionality
 */

// Import client function implementations
import { 
  createClient as createClientFn, 
  getSession as getSessionFn,
  getUserProfile as getUserProfileFn,
  persistSession as persistSessionFn,
  recoverSession as recoverSessionFn
} from "./client"

// Import admin function implementations 
// Note: adminClient.ts exports a function named createClient that we import as createAdminClientFn
import * as adminModule from "./admin"

// Import utils and debug helpers
import { debugLog as debugLogFn, safeJsonParse as safeJsonParseFn, safeQuerySingle as safeQuerySingleFn } from "./utils"

// Import types
import type { Database } from "@/types/supabase"

// Re-export utility functions
export const debugLog = debugLogFn
export const safeJsonParse = safeJsonParseFn
export const safeQuerySingle = safeQuerySingleFn

// Export types
export type { Database }

// Export browser-safe functions with browser-specific naming
export const createBrowserClient = createClientFn
export const getSession = getSessionFn
export const getUserProfile = getUserProfileFn

// Export admin functions - use the module's createClient function
export const createAdminClient = adminModule.createClient

/**
 * Persists the current session to localStorage and cookies
 * Helps prevent session loss during redirects
 */
export async function persistSession(supabase: any) {
  try {
    const isBrowser = typeof window !== 'undefined'
    if (!isBrowser) {
      return false; // Don't attempt in server context
    }
    
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      // Ensure session is properly stored in localStorage
      localStorage.setItem('supabase.auth.token', JSON.stringify(session));
      return true;
    }
  } catch (error) {
    console.error("Error persisting session:", error);
  }
  return false;
}

/**
 * Attempts to recover a session after redirects
 * Can help with maintaining authentication state during payment flows
 */
export async function recoverSession(supabase: any) {
  try {
    const isBrowser = typeof window !== 'undefined'
    if (!isBrowser) {
      return false; // Don't attempt in server context
    }
    
    // First check if we already have a valid session
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      console.log("Valid session already exists, no recovery needed");
      return true;
    }
    
    // If no session, refresh to try recovering it
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      console.error("Session recovery failed:", error);
      return false;
    }
    
    if (data?.session) {
      console.log("Session successfully recovered");
      return true;
    }
  } catch (error) {
    console.error("Error during session recovery:", error);
  }
  
  return false;
}

/**
 * IMPORTANT: Server-side functions are now imported directly from their modules
 * - Use createBrowserClient from '@/lib/supabase' for client components
 * - Use createServerClient from '@/lib/supabase/server' for server components
 * - Use createAdminClient from '@/lib/supabase' for admin operations
 */
