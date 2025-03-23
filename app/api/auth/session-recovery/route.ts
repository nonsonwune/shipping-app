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
    // First check for Supabase refresh token - this is the most reliable method
    const refreshToken = cookieStore.get('sb-refresh-token');
    let userId = cookieStore.get('recovery_user_id')?.value;
    
    console.log("DEBUG SESSION RECOVERY: Refresh token present:", !!refreshToken);
    console.log("DEBUG SESSION RECOVERY: User ID from cookie:", userId || "Not found");
    
    // Create server supabase client using cookies
    const supabase = await createServerClient();
    
    // Check current session (sometimes it might already be valid)
    const { data: currentSession } = await supabase.auth.getSession();
    console.log("DEBUG SESSION RECOVERY: Current session status:", 
      currentSession?.session ? "Active" : "None");
    
    // If we already have a session, we can just redirect
    if (currentSession?.session) {
      console.log("DEBUG SESSION RECOVERY: Session already exists, redirecting");
      
      // Clear recovery cookies as we already have a session
      const response = NextResponse.redirect(new URL(redirectTo, request.url));
      // Clear recovery flags
      response.cookies.set({ name: 'auth_recovery', value: '', maxAge: 0, path: '/' });
      response.cookies.set({ name: 'recovery_user_id', value: '', maxAge: 0, path: '/' });
      response.cookies.set({ name: 'paystack_session', value: '', maxAge: 0, path: '/' });
      
      return response;
    }
    
    // If we have a refresh token, try to use it directly
    if (refreshToken) {
      console.log("DEBUG SESSION RECOVERY: Attempting session refresh with token");
      
      try {
        // Try to manually exchange the refresh token for a new session
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
          refresh_token: refreshToken.value
        });
        
        if (!refreshError && refreshData?.session) {
          console.log("DEBUG SESSION RECOVERY: Session refreshed successfully!");
          
          // Redirect with session restored
          const response = NextResponse.redirect(new URL(redirectTo, request.url));
          // Clear recovery flags as we succeeded
          response.cookies.set({ name: 'auth_recovery', value: '', maxAge: 0, path: '/' });
          response.cookies.set({ name: 'recovery_user_id', value: '', maxAge: 0, path: '/' });
          response.cookies.set({ name: 'paystack_session', value: '', maxAge: 0, path: '/' });
          
          return response;
        } else {
          console.error("DEBUG SESSION RECOVERY: Failed to refresh session:", refreshError);
          // Continue to other methods if refresh failed
        }
      } catch (refreshError) {
        console.error("DEBUG SESSION RECOVERY: Error during refresh:", refreshError);
        // Continue to other methods
      }
    }
    
    // Try to get user ID from paystack session if we don't have it yet
    if (!userId) {
      const paystackSession = cookieStore.get('paystack_session');
      
      if (paystackSession?.value) {
        console.log("DEBUG SESSION RECOVERY: Attempting to decode paystack session");
        try {
          // Decode the session token to get userId
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
    
    // Create admin client to fetch user data and possibly create a new session
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
    
    // Try to create a new session using admin capabilities
    try {
      console.log("DEBUG SESSION RECOVERY: Attempting to create a new session via admin");
      
      // Create an admin session for this user
      const { data: adminAuthData, error: adminAuthError } = await adminClient.auth.admin.createUser({
        email: userData.email,
        email_confirm: true,
        user_metadata: { recovery: true }
      });
      
      if (adminAuthError) {
        // User likely already exists, which is fine
        console.log("DEBUG SESSION RECOVERY: User already exists, trying sign-in");
      } else {
        console.log("DEBUG SESSION RECOVERY: Admin user creation successful");
      }
      
      // Try creating a sign-in link
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
        
        if (verifyError) {
          console.error("DEBUG SESSION RECOVERY: Magic token verification error:", verifyError);
        } else {
          console.log("DEBUG SESSION RECOVERY: Magic link session created successfully!");
          
          // Redirect with session restored
          const response = NextResponse.redirect(new URL(redirectTo, request.url));
          // Clear recovery flags
          response.cookies.set({ name: 'auth_recovery', value: '', maxAge: 0, path: '/' });
          response.cookies.set({ name: 'recovery_user_id', value: '', maxAge: 0, path: '/' });
          response.cookies.set({ name: 'paystack_session', value: '', maxAge: 0, path: '/' });
          
          return response;
        }
      }
    } catch (adminError) {
      console.error("DEBUG SESSION RECOVERY: Admin auth recovery failed:", adminError);
    }
    
    // Try password sign-in as a last resort
    if (process.env.RECOVERY_FALLBACK_PASSWORD) {
      console.log("DEBUG SESSION RECOVERY: Attempting fallback password recovery");
      
      try {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: userData.email,
          password: process.env.RECOVERY_FALLBACK_PASSWORD,
        });
        
        if (signInError) {
          console.error("DEBUG SESSION RECOVERY: Error signing in with fallback password:", signInError);
        } else {
          console.log("DEBUG SESSION RECOVERY: User signed in with fallback password");
          
          // Redirect with session restored
          const response = NextResponse.redirect(new URL(redirectTo, request.url));
          // Clear recovery flags
          response.cookies.set({ name: 'auth_recovery', value: '', maxAge: 0, path: '/' });
          response.cookies.set({ name: 'recovery_user_id', value: '', maxAge: 0, path: '/' });
          response.cookies.set({ name: 'paystack_session', value: '', maxAge: 0, path: '/' });
          
          return response;
        }
      } catch (passwordError) {
        console.error("DEBUG SESSION RECOVERY: Password auth error:", passwordError);
      }
    }
    
    // If we've exhausted all options, we'll set the recovery flags and redirect for client-side handling
    console.log("DEBUG SESSION RECOVERY: All server-side recovery methods failed, sending recovery flags for client");
    
    // Check one more time if we managed to get a session
    const { data: finalSession } = await supabase.auth.getSession();
    
    const response = NextResponse.redirect(new URL(redirectTo, request.url));
    
    if (finalSession?.session) {
      console.log("DEBUG SESSION RECOVERY: Session was created, clearing recovery flags");
      // Clear recovery flags
      response.cookies.set({ name: 'auth_recovery', value: '', maxAge: 0, path: '/' });
      response.cookies.set({ name: 'recovery_user_id', value: '', maxAge: 0, path: '/' });
      response.cookies.set({ name: 'paystack_session', value: '', maxAge: 0, path: '/' });
    } else {
      console.log("DEBUG SESSION RECOVERY: Setting client-side recovery flags");
      // Set recovery flags for client-side handling
      response.cookies.set({
        name: 'auth_recovery',
        value: 'true',
        maxAge: 60 * 60, // 1 hour
        path: '/',
      });
      
      // Include user ID in recovery flag for client
      if (userId) {
        response.cookies.set({
          name: 'recovery_user_id',
          value: userId,
          maxAge: 60 * 60, // 1 hour
          path: '/',
        });
      }
    }
    
    return response;
  } catch (error) {
    console.error("DEBUG SESSION RECOVERY: Session recovery error:", error);
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }
}
