import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type DebugData = {
  cookies: Record<string, string>;
  authCookies: string[];
  session: null | Record<string, any>;
  error: null | {
    message: string;
    status?: number;
    name: string;
  };
  user: null | {
    id: string;
    email: string | undefined;
    emailConfirmed: boolean;
    lastSignIn: string | undefined;
    createdAt: string;
  };
  timestamp: string;
}

export async function GET(request: NextRequest) {
  // Debug data object
  const debugData: DebugData = {
    cookies: {},
    authCookies: [],
    session: null,
    error: null,
    user: null,
    timestamp: new Date().toISOString()
  };
  
  try {
    // Get all cookies for debugging
    const cookieStore = request.cookies;
    const allCookies = cookieStore.getAll();
    
    // Log cookie names (not values for security)
    allCookies.forEach(cookie => {
      const isAuth = cookie.name.includes('-auth-token');
      const valuePreview = isAuth ? '[HIDDEN]' : cookie.value.substring(0, 3) + '...';
      debugData.cookies[cookie.name] = valuePreview;
      
      if (isAuth) {
        debugData.authCookies.push(cookie.name);
      }
    });
    
    // Check Supabase session using parsed cookies
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    // Attempt to make a server-side client
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    
    // Try to get session data from auth header if provided
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const { data, error } = await supabase.auth.getUser(token);
      
      if (error) {
        debugData.error = {
          message: error.message,
          status: error.status,
          name: error.name
        };
      } else if (data?.user) {
        debugData.user = {
          id: data.user.id,
          email: data.user.email,
          emailConfirmed: data.user.email_confirmed_at ? true : false,
          lastSignIn: data.user.last_sign_in_at,
          createdAt: data.user.created_at
        };
      }
    } else {
      debugData.error = { 
        message: "No auth header provided",
        status: 401,
        name: "AuthHeaderMissing"
      };
    }
    
    // Return the debug data
    return NextResponse.json(debugData);
  } catch (error: any) {
    return NextResponse.json({
      ...debugData,
      error: {
        message: error.message || "Unknown error",
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    }, { status: 500 });
  }
} 