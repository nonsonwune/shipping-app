import { NextRequest, NextResponse } from 'next/server';
import * as adminModule from '@/lib/supabase/admin';
import { createClient as createServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  console.log("Session recovery API called");
  
  // Get all cookies for debugging
  const cookieStore = request.cookies;
  const allCookies = cookieStore.getAll();
  console.log("DEBUG SESSION RECOVERY: All cookies:", allCookies.map((c) => `${c.name}=${c.value.substring(0, 5)}...`));
  
  // Get redirect URL (default to wallet)
  const searchParams = request.nextUrl.searchParams;
  const redirectTo = searchParams.get('redirect') || '/wallet';
  
  try {
    // Create server supabase client
    const supabase = await createServerClient();
    
    // Check current session first
    const { data: currentSession } = await supabase.auth.getSession();
    console.log("DEBUG SESSION RECOVERY: Current session status:", 
      currentSession?.session ? "Active" : "None");
    
    // If we already have a session, we can just redirect
    if (currentSession?.session) {
      console.log("DEBUG SESSION RECOVERY: Session already exists, redirecting");
      
      // Clear recovery cookies as we already have a session
      const response = NextResponse.redirect(new URL(redirectTo, request.url));
      response.cookies.set({ name: 'auth_recovery', value: '', maxAge: 0, path: '/' });
      response.cookies.set({ name: 'recovery_user_id', value: '', maxAge: 0, path: '/' });
      response.cookies.set({ name: 'paystack_session', value: '', maxAge: 0, path: '/' });
      response.cookies.set({ name: 'session_timestamp', value: '', maxAge: 0, path: '/' });
      
      return response;
    }
    
    // Try to get user ID from various sources
    let userId = cookieStore.get('recovery_user_id')?.value;
    
    if (!userId) {
      const paystackSession = cookieStore.get('paystack_session');
      if (paystackSession?.value) {
        try {
          const decodedParts = Buffer.from(paystackSession.value, 'base64').toString().split(':');
          if (decodedParts.length > 0) {
            userId = decodedParts[0];
            console.log("DEBUG SESSION RECOVERY: Recovered user ID from token:", userId);
          }
        } catch (decodeError) {
          console.error("DEBUG SESSION RECOVERY: Error decoding paystack session:", decodeError);
        }
      }
    }
    
    // If we still don't have a userId, we can't proceed
    if (!userId) {
      console.log("DEBUG SESSION RECOVERY: No user ID available, cannot proceed with recovery");
      return NextResponse.redirect(new URL(redirectTo, request.url));
    }
    
    // Create admin client to fetch user data
    const adminClient = adminModule.createClient();
    
    // Get user details using admin client
    const { data: userData, error: userError } = await adminClient
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single();
      
    if (userError || !userData) {
      console.error("ERROR SESSION RECOVERY: Error retrieving user profile:", userError);
      return NextResponse.redirect(new URL(redirectTo, request.url));
    }
    
    console.log("DEBUG SESSION RECOVERY: User profile found:", userData.email);
    
    // Try to create a new session
    try {
      console.log("DEBUG SESSION RECOVERY: Attempting to create a new session");
      
      // Try password sign-in first if fallback password is available
      if (process.env.RECOVERY_FALLBACK_PASSWORD) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: userData.email,
          password: process.env.RECOVERY_FALLBACK_PASSWORD,
        });
        
        if (!signInError && signInData?.session) {
          console.log("DEBUG SESSION RECOVERY: User signed in with fallback password");
          
          // Redirect with session restored
          const response = NextResponse.redirect(new URL(redirectTo, request.url));
          // Clear recovery flags
          response.cookies.set({ name: 'auth_recovery', value: '', maxAge: 0, path: '/' });
          response.cookies.set({ name: 'recovery_user_id', value: '', maxAge: 0, path: '/' });
          response.cookies.set({ name: 'paystack_session', value: '', maxAge: 0, path: '/' });
          response.cookies.set({ name: 'session_timestamp', value: '', maxAge: 0, path: '/' });
          
          return response;
        }
      }
      
      // If password sign-in fails, try magic link
      const { data: signInData, error: signInError } = await adminClient.auth.admin.generateLink({
        type: 'magiclink',
        email: userData.email,
        options: {
          redirectTo: new URL(redirectTo, request.url).toString()
        }
      });
      
      if (signInError) {
        console.error("DEBUG SESSION RECOVERY: Error generating magic link:", signInError);
      } else if (signInData?.properties?.hashed_token) {
        console.log("DEBUG SESSION RECOVERY: Got valid magic link token, verifying");
        
        // Directly use the token to create a session
        const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
          email: userData.email,
          token: signInData.properties.hashed_token,
          type: 'magiclink'
        });
        
        if (!verifyError && verifyData?.session) {
          console.log("DEBUG SESSION RECOVERY: Magic link session created successfully!");
          
          // Redirect with session restored
          const response = NextResponse.redirect(new URL(redirectTo, request.url));
          // Clear recovery flags
          response.cookies.set({ name: 'auth_recovery', value: '', maxAge: 0, path: '/' });
          response.cookies.set({ name: 'recovery_user_id', value: '', maxAge: 0, path: '/' });
          response.cookies.set({ name: 'paystack_session', value: '', maxAge: 0, path: '/' });
          response.cookies.set({ name: 'session_timestamp', value: '', maxAge: 0, path: '/' });
          
          return response;
        }
      }
    } catch (authError) {
      console.error("DEBUG SESSION RECOVERY: Auth recovery failed:", authError);
    }
    
    // If we've exhausted all options, we'll set the recovery flags and redirect for client-side handling
    console.log("DEBUG SESSION RECOVERY: All server-side recovery methods failed, sending recovery flags for client");
    
    const response = NextResponse.redirect(new URL(redirectTo, request.url));
    
    // Set recovery flags for client-side handling
    response.cookies.set({
      name: 'auth_recovery',
      value: 'true',
      maxAge: 60 * 60, // 1 hour
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    });
    
    response.cookies.set({
      name: 'recovery_user_id',
      value: userId,
      maxAge: 60 * 60, // 1 hour
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    });
    
    response.cookies.set({
      name: 'session_timestamp',
      value: Date.now().toString(),
      maxAge: 60 * 60, // 1 hour
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    });
    
    return response;
  } catch (error) {
    console.error("DEBUG SESSION RECOVERY: Session recovery error:", error);
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }
}
