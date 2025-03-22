"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { createTestUser, supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export default function DevTools() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  
  async function handleCreateTestUser() {
    setLoading(true)
    setMessage("Creating test user...")
    try {
      await createTestUser()
      setMessage("Test user created! Email: test@example.com, Password: password123")
    } catch (error) {
      console.error(error)
      setMessage("Error creating test user")
    } finally {
      setLoading(false)
    }
  }
  
  async function handleSignInTestUser() {
    setLoading(true)
    setMessage("Signing in test user...")
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: "test@example.com",
        password: "password123",
      })
      
      if (error) {
        throw error
      }
      
      setMessage("Signed in as test user!")
      setTimeout(() => {
        router.push("/?dev_test=true")
      }, 1000)
    } catch (error) {
      console.error(error)
      setMessage("Error signing in test user")
    } finally {
      setLoading(false)
    }
  }
  
  async function handleSignOut() {
    setLoading(true)
    setMessage("Signing out...")
    try {
      await supabase.auth.signOut()
      setMessage("Signed out!")
    } catch (error) {
      console.error(error)
      setMessage("Error signing out")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Development Tools</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Test User Management</CardTitle>
            <CardDescription>Create and use a test account for development</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              variant="outline" 
              className="w-full"
              onClick={handleCreateTestUser}
              disabled={loading}
            >
              {loading ? "Working..." : "Create Test User"}
            </Button>
            
            <Button 
              className="w-full bg-blue-600"
              onClick={handleSignInTestUser}
              disabled={loading}
            >
              {loading ? "Working..." : "Sign In as Test User"}
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full border-red-300 text-red-600"
              onClick={handleSignOut}
              disabled={loading}
            >
              {loading ? "Working..." : "Sign Out"}
            </Button>
            
            {message && (
              <div className="p-3 bg-gray-100 rounded-md mt-4 text-sm">
                {message}
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            <Link href="/auth/sign-in" className="text-sm text-blue-600">
              Back to Sign In
            </Link>
            <Link href="/?dev_test=true" className="text-sm text-blue-600">
              Go to Dashboard
            </Link>
          </CardFooter>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Development Info</CardTitle>
            <CardDescription>Information about the app configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <h3 className="font-medium">Environment</h3>
              <p className="text-sm text-muted-foreground">
                {process.env.NODE_ENV}
              </p>
            </div>
            <div>
              <h3 className="font-medium">Supabase URL</h3>
              <p className="text-sm text-muted-foreground truncate">
                {process.env.NEXT_PUBLIC_SUPABASE_URL}
              </p>
            </div>
            <div>
              <h3 className="font-medium">Known Issues</h3>
              <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                <li>
                  "Failed to parse cookie string" warnings are expected with Supabase JWT handling
                </li>
                <li>
                  Dependency conflicts with date-fns and react-day-picker resolved with --legacy-peer-deps
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
