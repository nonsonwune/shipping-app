"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Eye, EyeOff } from "lucide-react"
import { createClient as createBrowserClient } from "@/lib/supabase/client"

// Helper function to debug JWT tokens client-side
function debugJwtToken(token: string) {
  try {
    if (!token) {
      console.log("CLIENT_JWT_DEBUG - Token is empty");
      return;
    }
    
    // Split the token into its 3 parts
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.log(`CLIENT_JWT_DEBUG - Invalid token format, has ${parts.length} parts instead of 3`);
      return;
    }
    
    // Decode header
    try {
      const headerB64 = parts[0].replace(/-/g, '+').replace(/_/g, '/');
      const headerStr = atob(headerB64);
      const header = JSON.parse(headerStr);
      console.log("CLIENT_JWT_DEBUG - Header:", header);
    } catch (e) {
      console.log("CLIENT_JWT_DEBUG - Could not decode header:", e);
    }
    
    // Decode payload
    try {
      const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payloadStr = atob(payloadB64);
      const payload = JSON.parse(payloadStr);
      console.log("CLIENT_JWT_DEBUG - Payload:", {
        ...payload,
        // Remove sensitive parts from logging
        sub: payload.sub ? "PRESENT" : "MISSING",
        email: payload.email ? "PRESENT" : "MISSING", 
        exp: payload.exp,
        iat: payload.iat,
        // Check if token is expired
        isExpired: payload.exp ? (payload.exp * 1000 < Date.now()) : "No expiry"
      });
      
      // Explicitly check expiration
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        console.log(`CLIENT_JWT_DEBUG - TOKEN EXPIRED at ${new Date(payload.exp * 1000).toISOString()}, current time is ${new Date().toISOString()}`);
      }
    } catch (e) {
      console.log("CLIENT_JWT_DEBUG - Could not decode payload:", e);
    }
  } catch (error) {
    console.error("CLIENT_JWT_DEBUG - Error inspecting token:", error);
  }
}

export default function SignInPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)

  // Check for existing session on load
  useEffect(() => {
    const checkSession = async () => {
      try {
        console.log("Checking for existing session on page load");
        setCheckingSession(true);
        
        // ADDED: Clear stale cookies from other Supabase projects
        clearStaleSupabaseCookies();
        
        // Create client and check for active session
        const supabase = createBrowserClient();
        
        // First try the standard getSession approach
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        console.log("Session check result:", session ? "Session exists" : "No session");
        
        if (session) {
          console.log("Active session found, redirecting to dashboard");
          window.location.href = "/";
          return;
        }
        
        // If no session from getSession, look for auth cookies that might be valid
        // but not properly recognized by getSession
        // REMOVED - No longer needed with unified @supabase/ssr handling
        /*
        const cookies = document.cookie.split(';').map(c => c.trim());
        const authCookiePrefix = 'sb-rtbqpprntygrgxopxoei-auth-token=';
        const authCookie = cookies.find(c => c.startsWith(authCookiePrefix));
        console.log("Current cookies:", cookies);
        
        if (authCookie) {
          // Extract token from cookie
          const token = authCookie.substring(authCookiePrefix.length);
          console.log("Found auth token cookie, checking validity");
          
          // Debug the token
          debugJwtToken(token);
          
          try {
            // Try to fetch user profile with the token
            const response = await fetch('/api/auth/test-token', {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
              },
              credentials: 'include'
            });
            
            const result = await response.json();
            console.log("Token validation result:", result);
            
            if (response.ok && result.valid) {
              console.log("Token is valid according to direct validation, redirecting");
              window.location.href = "/";
              return;
            } else {
              console.log("Token is invalid according to direct validation, staying on login page");
            }
          } catch (error) {
            console.error("Error validating token:", error);
          }
        }
        */
      } catch (err) {
        console.error("Error checking session:", err);
      } finally {
        setCheckingSession(false);
      }
    };
    
    checkSession();
  }, []);

  // ADDED: Function to clear stale Supabase cookies from other projects
  const clearStaleSupabaseCookies = () => {
    try {
      console.log("Clearing stale Supabase cookies");
      const currentProjectRef = "rtbqpprntygrgxopxoei"; // Your current Supabase project ref
      
      // Get all cookies
      const cookies = document.cookie.split(';');
      
      // Find and clear any Supabase auth cookies from other projects
      cookies.forEach(cookie => {
        const trimmedCookie = cookie.trim();
        const [name] = trimmedCookie.split('=');
        
        if (name && name.includes('-auth-token')) {
          // Extract project ref from cookie name (sb-{projectRef}-auth-token)
          const parts = name.split('-');
          if (parts.length >= 3 && parts[0] === 'sb') {
            const cookieProjectRef = parts[1];
            
            // If this is not our current project, clear the cookie
            if (cookieProjectRef !== currentProjectRef) {
              console.log(`Clearing stale cookie from project: ${cookieProjectRef}`);
              // Clear the cookie by setting expired date
              document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;`;
              
              // Also clear any localStorage items for this project
              const localStorageKey = `sb-${cookieProjectRef}-auth-token`;
              if (localStorage.getItem(localStorageKey)) {
                console.log(`Clearing stale localStorage item: ${localStorageKey}`);
                localStorage.removeItem(localStorageKey);
              }
            }
          }
        }
      });
      
      console.log("Finished clearing stale cookies");
    } catch (error) {
      console.error("Error clearing stale cookies:", error);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setDebugInfo(null)
    setLoading(true)
    
    // ADDED: Clear stale cookies before signing in
    clearStaleSupabaseCookies();
    
    console.log("Sign-in attempt started with email:", email)

    try {
      console.log("Calling supabase.auth.signInWithPassword with:", { email })
      const supabase = createBrowserClient();
      
      // Explicitly log out first to clear any potential stale session state
      console.log("Explicitly signing out first to ensure clean state");
      await supabase.auth.signOut();
      
      // Sign in with a small delay to ensure previous signout has processed
      await new Promise(resolve => setTimeout(resolve, 300));
      
      console.log("Now attempting to sign in");
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      console.log("Sign-in API response received")
      
      if (error) {
        console.error("Sign-in error:", error.message, error)
        throw error
      }

      console.log("Sign-in successful, user data:", data.user ? {
        id: data.user.id,
        email: data.user.email,
        hasMetadata: !!data.user.user_metadata
      } : 'No user data')
      
      console.log("Session data:", data.session ? {
        access_token: data.session.access_token ? `${data.session.access_token.substring(0, 10)}...` : null,
        refresh_token: data.session.refresh_token ? `${data.session.refresh_token.substring(0, 10)}...` : null,
        expires_at: data.session.expires_at
      } : 'No session data')

      if (data.user && data.session) {
        console.log("User authenticated successfully");
        
        // Debug JWT token data
        if (data.session.access_token) {
          console.log("Debugging access token from successful login:");
          debugJwtToken(data.session.access_token);
        }
        
        // Double-check session via getSession to ensure it was saved properly
        console.log("Verifying session was properly saved via getSession");
        const sessionCheck = await supabase.auth.getSession();
        console.log("getSession result:", sessionCheck.data.session ? "Session exists" : "No session");
        
        // Debug getSession response
        if (sessionCheck.data.session) {
          console.log("Session after getSession:", {
            user: sessionCheck.data.session.user ? "Present" : "Missing",
            access_token: sessionCheck.data.session.access_token ? "Present" : "Missing",
            refresh_token: sessionCheck.data.session.refresh_token ? "Present" : "Missing"
          });
        } else {
          console.log("No session returned from getSession");
        }
        
        // Set debug info to show success
        setDebugInfo("Authentication successful! Redirecting to dashboard...");
        
        // Wait a bit longer to ensure session data is properly stored
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Force a hard reload to ensure the browser picks up the new session
        window.location.href = "/";
      } else {
        // Just in case we get no data but also no error
        console.warn("No user data returned, but no error either")
        setError("Failed to sign in. Please check your credentials.")
      }
    } catch (error: any) {
      console.error("Sign-in catch block error:", error)
      setError(error.message || "Failed to sign in. Please check your credentials.")
      
      // Add debug information
      const cookies = document.cookie.split(';').map(c => c.trim());
      setDebugInfo(`Debug info:
- Browser cookies: ${cookies.join(', ')}
- Local storage auth key exists: ${!!localStorage.getItem('sb-rtbqpprntygrgxopxoei-auth-token')}
- Error details: ${error.message || 'Unknown error'}

If you continue to experience issues, try clearing your browser cookies and local storage, then try again.`);
    } finally {
      setLoading(false)
    }
  }

  // If still checking session, show loading state
  if (checkingSession) {
    return (
      <div className="p-6 max-w-md mx-auto bg-white flex flex-col items-center justify-center min-h-[50vh]">
        <div className="animate-pulse text-center">
          <p className="text-gray-600">Checking authentication status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-md mx-auto bg-white">
      <h1 className="text-3xl font-bold mb-8 text-foreground">Welcome Back</h1>

      <form onSubmit={handleSignIn} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-foreground font-medium">Email address</Label>
          <Input
            id="email"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="border-gray-300 shadow-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-foreground font-medium">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="border-gray-300 shadow-sm"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="remember"
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked as boolean)}
              className="border-gray-300 data-[state=checked]:bg-primary"
            />
            <Label
              htmlFor="remember"
              className="text-sm font-medium text-gray-700 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Remember Me
            </Label>
          </div>
          <Link href="/auth/forgot-password" className="text-primary hover:underline text-sm font-medium">
            Forgot Password?
          </Link>
        </div>

        {error && <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">{error}</div>}
        
        {debugInfo && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs p-3 rounded-md whitespace-pre-line">
            {debugInfo}
          </div>
        )}

        <div className="pt-4">
          <Button 
            type="submit" 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium border border-blue-700 shadow-md" 
            disabled={loading}
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin mr-2 h-4 w-4 border-2 border-t-transparent border-white rounded-full"></div>
                <span>Signing In...</span>
              </div>
            ) : (
              <span>Sign In</span>
            )}
          </Button>
        </div>

        <p className="text-center text-sm text-gray-600 mt-6">
          Don&apos;t have an account?{" "}
          <Link href="/auth/sign-up" className="text-primary hover:underline font-medium">
            Sign Up
          </Link>
        </p>
      </form>
    </div>
  );
}
