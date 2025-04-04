/**
 * ⚠️ DEPRECATED: This file uses the older @supabase/auth-helpers-nextjs library.
 * Do not use for new code. Imports should be made directly from the functions
 * exported in the `lib/supabase/` directory (e.g., `lib/supabase/client.ts`,
 * `lib/supabase/server.ts`) which use the newer `@supabase/ssr` library.
 *
 * Supabase client exports (BROWSER-SAFE)
 * 
 * ⚠️ WARNING: This file is being refactored to the lib/supabase/ folder structure.
 * For new code, use the specific imports from lib/supabase/ subfolders.
 */

// Only include browser-safe imports 
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { StorageAdapter } from '@supabase/auth-helpers-shared'
import type { Database } from '@/types/supabase'
import { createClient } from '@supabase/supabase-js'

// Environment variables that are safe for client use
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Singleton instance for client components
let clientInstance: ReturnType<typeof createClientComponentClient<Database>> | null = null
// Track the URL that was used to create the instance for proper reinitialization if needed
let instanceUrl: string | null = null

/**
 * Creates a Supabase client for client components with singleton pattern
 * Use this in client components (React components with 'use client')
 */
export function createBrowserClient() {
  // Get the current Supabase URL and key
  const currentUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const currentKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  
  // If URL has changed or we don't have an instance, create a new one
  if (!clientInstance || instanceUrl !== currentUrl) {
    console.log(`Creating new Supabase client instance with URL: ${currentUrl.substring(0, 30)}...`);
    instanceUrl = currentUrl;
    
    // Check for existing auth cookies
    if (typeof document !== 'undefined') {
      console.log("Browser client checking for existing auth cookies");
      const cookies = document.cookie.split(';').map(c => c.trim());
      const authCookies = cookies.filter(c => c.startsWith('sb-') && c.includes('-auth-token'));
      console.log(`Found ${authCookies.length} auth cookies:`, 
        authCookies.map(c => c.split('=')[0])
      );
    }
    
    // Create with proper auth settings
    clientInstance = createClientComponentClient<Database>({
      supabaseUrl: currentUrl,
      supabaseKey: currentKey,
    });
    
    // Initialize the client with a session check
    if (typeof window !== 'undefined' && clientInstance) {
      // Immediately check for a session on client creation
      clientInstance.auth.getSession().then(({ data, error }) => {
        if (error) {
          console.error("Browser client session initialization error:", error);
        } else {
          console.log("Browser client session initialized:", {
            hasSession: !!data.session,
            user: data.session ? {
              id: data.session.user.id,
              email: data.session.user.email,
              expires_at: data.session.expires_at
            } : null
          });
        }
      });
    }
  }
  
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

// Add this function to create a server client with JWT verification
export function createServerComponentClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  return createClient<Database>(
    supabaseUrl,
    supabaseServiceRole,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}
