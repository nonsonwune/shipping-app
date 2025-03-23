/**
 * Supabase client exports (BROWSER-SAFE)
 * 
 * ⚠️ WARNING: This file is being refactored to the lib/supabase/ folder structure.
 * For new code, use the specific imports from lib/supabase/ subfolders.
 */

// Only include browser-safe imports 
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/types/supabase'

// Environment variables that are safe for client use
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Singleton instance for client components
let clientInstance: ReturnType<typeof createClientComponentClient<Database>> | null = null

/**
 * Creates a Supabase client for client components with singleton pattern
 * Use this in client components (React components with 'use client')
 */
export function createBrowserClient() {
  if (clientInstance) return clientInstance
  
  clientInstance = createClientComponentClient<Database>()
  return clientInstance
}

/**
 * Helper function to handle 406 errors when querying Supabase
 * Safe to use in both client and server components
 */
export async function safeQuerySingle(
  supabase: any, 
  table: string, 
  selectQuery: string | { select: string, eq: string, value: any },
  conditions?: Record<string, any>
) {
  try {
    // Handle different parameter formats
    let select = typeof selectQuery === 'string' ? selectQuery : selectQuery.select;
    let whereField = typeof selectQuery === 'object' ? selectQuery.eq : null;
    let whereValue = typeof selectQuery === 'object' ? selectQuery.value : null;
    let whereConditions = conditions || (whereField && whereValue ? { [whereField]: whereValue } : {});
    
    // First check if the table exists with a minimal query
    const { error: tableCheckError } = await supabase
      .from(table)
      .select('id')
      .limit(1)
    
    if (tableCheckError) {
      console.error(`Table check error for ${table}:`, tableCheckError)
      return null
    }
    
    // Now perform the actual query with the specified column
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .match(whereConditions)
      .single()
    
    if (error) {
      // Handle 406 Not Acceptable error specifically
      if (error.code === '406') {
        console.warn(`406 error for ${table} query, retrying with '*'`)
        
        // Retry with select('*') which usually works
        const { data: fullData, error: retryError } = await supabase
          .from(table)
          .select('*')
          .match(whereConditions)
          .single()
        
        if (retryError) {
          console.error(`Retry error for ${table}:`, retryError)
          return null
        }
        
        return fullData
      }
      
      console.error(`Query error for ${table}:`, error)
      return null
    }
    
    return data
  } catch (e) {
    console.error(`Unexpected error querying ${table}:`, e)
    return null
  }
}

// BACKWARD COMPATIBILITY EXPORTS
// These are provided for legacy code but should be replaced with the new pattern

// Export a default client for convenience in client components only
// This is for backward compatibility with existing code
export const supabase = typeof window !== 'undefined' ? createBrowserClient() : null

// Legacy type exports - these should eventually move to types/supabase
export type UserMetadata = {
  name?: string
  avatar_url?: string
  created_at: string
  phone?: string
  account_type?: string
}

export type UserProfile = {
  id: string
  first_name?: string
  last_name?: string
  username?: string
  avatar_url?: string
  created_at: string
  phone?: string
  account_type?: string
  email?: string
}
