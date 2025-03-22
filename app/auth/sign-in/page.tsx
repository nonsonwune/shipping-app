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
import { supabase } from "@/lib/supabase"

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
        
        // Check for active session and redirect if found
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        console.log("Session check result:", session ? "Session exists" : "No session");
        
        if (session) {
          console.log("Active session found, redirecting to dashboard");
          window.location.href = "/";
          return;
        }
        
        // Log cookies for debugging
        const cookies = document.cookie.split(';').map(c => c.trim());
        console.log("Current cookies:", cookies);
      } catch (err) {
        console.error("Error checking session:", err);
      } finally {
        setCheckingSession(false);
      }
    };
    
    checkSession();
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setDebugInfo(null)
    setLoading(true)
    
    console.log("Sign-in attempt started with email:", email)

    try {
      console.log("Calling supabase.auth.signInWithPassword with:", { email })
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
        access_token: !!data.session.access_token,
        refresh_token: !!data.session.refresh_token,
        expires_at: data.session.expires_at
      } : 'No session data')

      if (data.user && data.session) {
        console.log("User authenticated successfully");
        
        // Set debug info to show success
        setDebugInfo("Authentication successful! Redirecting to dashboard...");
        
        // Wait briefly to ensure session data is properly stored
        await new Promise(resolve => setTimeout(resolve, 1000));
        
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
