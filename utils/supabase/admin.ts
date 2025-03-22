import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

export function createAdminClient(request?: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing Supabase URL');
  }
  
  if (!supabaseServiceKey) {
    console.error('Missing Supabase service role key - check your .env.local file');
    throw new Error('Missing Supabase admin credentials');
  }

  console.log('Creating Supabase admin client with service role key');
  
  return createClient<Database>(
    supabaseUrl,
    supabaseServiceKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          'X-Client-Info': 'shipping-app-admin',
        },
      },
    }
  );
}
