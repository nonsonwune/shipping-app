/**
 * Admin client for Supabase with service role
 * Use this ONLY on the server for operations that need to bypass RLS
 */
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { debugLog } from '@/lib/supabase/utils'

// Environment variables must be available
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Creates a Supabase admin client with the service role key
 * IMPORTANT: Only use on the server, never expose to client
 * This client bypasses Row Level Security (RLS)
 */
export function createClient() {
  // Browser-side safety check
  if (typeof window !== 'undefined') {
    throw new Error(
      'createClient() was called in the browser. ' +
      'This method should only be used on the server.'
    )
  }

  // Service role key check
  if (!supabaseServiceKey) {
    console.error('Missing Supabase service role key - check your .env.local file')
    throw new Error('Missing Supabase admin credentials')
  }

  debugLog('Creating Supabase admin client with service role')
  return createSupabaseClient<Database>(
    supabaseUrl, 
    supabaseServiceKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    }
  )
}

/**
 * Directly access any table with admin privileges
 * Use this for maintenance operations, bypassing RLS
 */
export async function adminQuery(tableName: string, queryFn: (query: any) => any) {
  const admin = createClient()
  const query = admin.from(tableName)
  return await queryFn(query)
}

/**
 * Get any user profile by ID with admin privileges
 */
export async function getProfileById(userId: string) {
  const admin = createClient()
  const { data, error } = await admin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  
  if (error) {
    console.error(`Admin error fetching profile for user ${userId}:`, error.message)
    return null
  }
  
  return data
}

/**
 * Update wallet balance for a user with admin privileges
 */
export async function updateWalletBalance(userId: string, newBalance: number) {
  const admin = createClient()
  
  const { data, error } = await admin
    .from('wallets')
    .update({ balance: newBalance })
    .eq('user_id', userId)
    .select()
  
  if (error) {
    console.error(`Admin error updating wallet for user ${userId}:`, error.message)
    return { success: false, error }
  }
  
  return { success: true, data }
}
