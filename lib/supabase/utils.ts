/**
 * Utility functions for Supabase clients
 */

/**
 * Debug logger that only logs in development
 */
export function debugLog(...args: any[]) {
  if (process.env.NODE_ENV === 'development') {
    console.log('[Supabase Debug]', ...args)
  }
}

/**
 * Safely parse JSON with fallback to prevent crashes
 */
export function safeJsonParse(json: string, fallback: any = null) {
  try {
    return JSON.parse(json)
  } catch (e) {
    console.error('Error parsing JSON:', e)
    return fallback
  }
}

/**
 * Safe query for a single record with error handling
 * Handles 406 error gracefully
 */
export async function safeQuerySingle(supabase: any, table: string, select: string, matchObj: any) {
  try {
    // First check if the table exists with a lightweight query
    const { error: tableCheckError } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .limit(1)
    
    if (tableCheckError) {
      console.error(`Error querying table ${table}:`, tableCheckError)
      return { data: null, error: tableCheckError }
    }
    
    // Then run the actual query
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .match(matchObj)
      .single()
    
    if (error) {
      if (error.code === '406') {
        // Record not found
        console.log(`No record found in ${table} for query:`, matchObj)
        return { data: null, error: null }
      } else if (error.code === '404') {
        // Table not found
        console.error(`Table ${table} not found`)
        return { data: null, error }
      } else {
        console.error(`Error querying ${table}:`, error)
        return { data: null, error }
      }
    }
    
    return { data, error: null }
  } catch (e) {
    console.error(`Unexpected error in safeQuerySingle:`, e)
    return { data: null, error: e }
  }
}
