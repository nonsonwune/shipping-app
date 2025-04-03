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
  // --- DEBUG START ---
  // console.log(`safeQuerySingle: Called for table '${table}', select '${JSON.stringify(selectQuery)}', conditions '${JSON.stringify(conditions)}'`);
  // --- DEBUG END ---
  let returnValue: any = { data: undefined, error: undefined }; // Default structure to avoid destructuring errors

  try {
    // Handle different parameter formats
    let select = typeof selectQuery === 'string' ? selectQuery : selectQuery.select;
    let whereField = typeof selectQuery === 'object' ? selectQuery.eq : null;
    let whereValue = typeof selectQuery === 'object' ? selectQuery.value : null;
    let whereConditions = conditions || (whereField && whereValue ? { [whereField]: whereValue } : {});
    
    // --- DEBUG START ---
    // console.log(`safeQuerySingle: Parsed - select='${select}', conditions='${JSON.stringify(whereConditions)}'`);
    // --- DEBUG END ---
    
    // First check if the table exists with a minimal query (optional, can be removed if confident table exists)
    // const { error: tableCheckError } = await supabase
    //   .from(table)
    //   .select('id')
    //   .limit(1)
    // 
    // if (tableCheckError) {
    //   console.error(`safeQuerySingle: Table check error for ${table}:`, tableCheckError)
    //   returnValue = { data: null, error: tableCheckError }; // Return structured error
    //   console.log("safeQuerySingle: Returning early due to table check error", returnValue);
    //   return returnValue;
    // }
    
    // Now perform the actual query with the specified column
    // --- DEBUG START ---
    // console.log(`safeQuerySingle: Executing main query: from('${table}').select('${select}').match(${JSON.stringify(whereConditions)}).maybeSingle()`);
    // --- DEBUG END ---
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .match(whereConditions)
      .maybeSingle() // Use maybeSingle() instead of single()
    
    // --- DEBUG START ---
    // console.log(`safeQuerySingle: Main query result - data:`, data);
    // console.log(`safeQuerySingle: Main query result - error:`, error);
    // --- DEBUG END ---
    
    if (error) {
      // Handle 406 Not Acceptable error specifically (Might not be needed with maybeSingle, but kept for now)
      if (error.code === '406' || error.message.includes('failed to parse select parameter')) { // Check common 406 messages
        // --- DEBUG START ---
        // console.warn(`safeQuerySingle: 406 error or similar for ${table} query, retrying with '*'`) // Log the 406 warning
        // console.log(`safeQuerySingle: Executing retry query: from('${table}').select('*').match(${JSON.stringify(whereConditions)}).maybeSingle()`);
        // --- DEBUG END ---
        
        // Retry with select('*') which might work if specific select was issue
        const { data: retryData, error: retryError } = await supabase
          .from(table)
          .select('*')
          .match(whereConditions)
          .maybeSingle() // Use maybeSingle() here too
        
        // --- DEBUG START ---
        // console.log(`safeQuerySingle: Retry query result - retryData:`, retryData);
        // console.log(`safeQuerySingle: Retry query result - retryError:`, retryError);
        // --- DEBUG END ---
        
        if (retryError) {
          console.error(`safeQuerySingle: Retry error for ${table}:`, retryError)
          returnValue = { data: null, error: retryError }; // Assign structured error
        } else {
          returnValue = { data: retryData, error: null }; // Assign retry data
        }
      } else {
        // Handle other errors
        console.error(`safeQuerySingle: Query error for ${table}:`, error)
         returnValue = { data: null, error: error }; // Assign structured error
      }
    } else {
      // Success case (no error from main query)
      returnValue = { data: data, error: null }; // Assign success data
    }

  } catch (e) {
    console.error(`safeQuerySingle: Unexpected error querying ${table}:`, e)
     returnValue = { data: null, error: e as Error }; // Assign caught error
  }

  // --- DEBUG START ---
  // console.log("safeQuerySingle: Final return value:", returnValue);
  // --- DEBUG END ---
  return returnValue;
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
