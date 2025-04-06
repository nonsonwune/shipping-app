"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Eye, EyeOff, ArrowLeft } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase"

export default function SignUpPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    accountType: "",
    referralSource: "",
  })
  const [showPassword, setShowPassword] = useState(false)
  const [verifyNotRobot, setVerifyNotRobot] = useState(false)
  const [agreeToTerms, setAgreeToTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!verifyNotRobot) {
      setError("Please verify that you are not a robot")
      return
    }

    if (!agreeToTerms) {
      setError("You must agree to the Terms of Service and Privacy Policy")
      return
    }

    // Enhanced input validation
    const validateInput = () => {
      // Email validation with regex
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        setError("Please enter a valid email address");
        return false;
      }

      // Password validation - at least 8 chars, with numbers and letters
      if (formData.password.length < 8) {
        setError("Password must be at least 8 characters long");
        return false;
      }

      const hasLetter = /[a-zA-Z]/.test(formData.password);
      const hasNumber = /\d/.test(formData.password);
      if (!hasLetter || !hasNumber) {
        setError("Password must contain both letters and numbers");
        return false;
      }

      // Name validation - prevent special characters that could be used for injection
      const nameRegex = /^[a-zA-Z\s'-]+$/;
      if (!nameRegex.test(formData.firstName) || !nameRegex.test(formData.lastName)) {
        setError("Names can only contain letters, spaces, hyphens, and apostrophes");
        return false;
      }

      // Phone validation - allow only numbers, +, and hyphens
      const phoneRegex = /^[0-9+\-\s()]+$/;
      if (!phoneRegex.test(formData.phone)) {
        setError("Phone number can only contain digits, +, -, spaces, and parentheses");
        return false;
      }

      return true;
    };

    if (!validateInput()) {
      return;
    }

    setError(null)
    setLoading(true)

    try {
      console.log("🔍 DEBUG: Starting sign-up process with data:", {
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        accountType: formData.accountType,
        // Omitting password for security
      });
      
      // For development, we'll create a user with automatic confirmation
      const supabase = createBrowserClient();
      console.log("🔍 DEBUG: Supabase client created");
      
      // First, attempt to check if the auth API is reachable
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        console.log("🔍 DEBUG: Auth API test result:", sessionError ? "Error" : "Success", sessionError);
      } catch (sessionTestError) {
        console.error("🔍 DEBUG: Auth API test failed completely:", sessionTestError);
      }

      console.log("🔍 DEBUG: Calling auth.signUp");
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
            phone: formData.phone,
            account_type: formData.accountType,
            referral_source: formData.referralSource,
          },
          // This is a development-only setting - would be removed in production
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        console.error("🔍 DEBUG: Sign-up error details:", {
          message: error.message,
          status: error.status,
          name: error.name,
          // Attempting to extract any additional details
          details: error.stack || JSON.stringify(error),
        });
        throw error
      }

      console.log("🔍 DEBUG: Sign-up response:", data);

      // In development, we can automatically redirect to sign-in
      // In production, this would redirect to a verification page
      if (data.user) {
        // Log the successful registration in our audit system
        try {
          // Get IP address from client (in a real app, you'd get this from a server API)
          const ipAddress = "client-side-ip-unavailable";
          
          // Get user agent
          const userAgent = navigator.userAgent;
          
          // Log the registration
          await supabase.rpc('log_user_registration', {
            p_user_id: data.user.id,
            p_email: data.user.email,
            p_ip_address: ipAddress,
            p_user_agent: userAgent
          });
          
          console.log("🔍 DEBUG: Registration audit log created");
        } catch (logError) {
          // Don't fail registration if logging fails
          console.error("🔍 DEBUG: Failed to create audit log:", logError);
        }
        
        // Production-ready behavior - redirect to email confirmation page
        setError(null);
        router.push("/auth/verification?email=" + encodeURIComponent(formData.email));
      }
    } catch (error: any) {
      console.error("🔍 DEBUG: Sign-up catch block error:", error);
      setError(error.message || "Failed to sign up");
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-md mx-auto">
      <div className="flex items-center mb-6">
        <Link href="/auth/sign-in" className="mr-4">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-2xl font-bold">Create an account</h1>
      </div>

      <form onSubmit={handleSignUp} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name</Label>
          <Input
            id="firstName"
            name="firstName"
            placeholder="First Name"
            value={formData.firstName}
            onChange={handleChange}
            required
            className="border border-gray-300 bg-white text-gray-900 shadow-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name</Label>
          <Input
            id="lastName"
            name="lastName"
            placeholder="Last Name"
            value={formData.lastName}
            onChange={handleChange}
            required
            className="border border-gray-300 bg-white text-gray-900 shadow-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            required
            className="border border-gray-300 bg-white text-gray-900 shadow-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone number</Label>
          <Input
            id="phone"
            name="phone"
            placeholder="Phone number"
            value={formData.phone}
            onChange={handleChange}
            required
            className="border border-gray-300 bg-white text-gray-900 shadow-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              required
              className="border border-gray-300 bg-white text-gray-900 shadow-sm"
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

        <div className="space-y-2">
          <Label htmlFor="accountType">Account Type</Label>
          <Select onValueChange={(value) => handleSelectChange("accountType", value)} required>
            <SelectTrigger className="border border-gray-300 bg-white text-gray-900">
              <SelectValue placeholder="Account Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="individual">Individual</SelectItem>
              <SelectItem value="business">Business</SelectItem>
              <SelectItem value="corporate">Corporate</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="referralSource">How did you hear about us?</Label>
          <Select onValueChange={(value) => handleSelectChange("referralSource", value)}>
            <SelectTrigger className="border border-gray-300 bg-white text-gray-900">
              <SelectValue placeholder="How did you hear about us?" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="friend">Friend or Family</SelectItem>
              <SelectItem value="social">Social Media</SelectItem>
              <SelectItem value="search">Search Engine</SelectItem>
              <SelectItem value="ad">Advertisement</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center space-x-2 border border-gray-200 p-3 rounded-md bg-gray-50">
          <Checkbox
            id="verifyRobot"
            checked={verifyNotRobot}
            onCheckedChange={(checked) => setVerifyNotRobot(checked as boolean)}
            className="border-gray-400 h-5 w-5 data-[state=checked]:bg-blue-600"
          />
          <Label htmlFor="verifyRobot" className="text-sm font-medium leading-none text-gray-700">
            Verify that you are not a robot
          </Label>
        </div>

        <div className="flex items-start space-x-2 border border-gray-200 p-3 rounded-md bg-gray-50">
          <Checkbox
            id="terms"
            checked={agreeToTerms}
            onCheckedChange={(checked) => setAgreeToTerms(checked as boolean)}
            className="border-gray-400 h-5 w-5 data-[state=checked]:bg-blue-600 mt-0.5"
          />
          <Label htmlFor="terms" className="text-sm font-medium leading-tight text-gray-700">
            By clicking Confirm, I acknowledge that I have read, understood and agreed to the Topship's{" "}
            <Link href="/privacy" className="text-blue-600 hover:underline font-semibold">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link href="/terms" className="text-blue-600 hover:underline font-semibold">
              Terms of Service
            </Link>
          </Label>
        </div>

        {error && <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">{error}</div>}

        <Button 
          type="submit" 
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium border border-blue-700 shadow-md" 
          disabled={loading}
        >
          {loading ? "Creating account..." : "Create account"}
        </Button>

        <div className="text-center mt-6">
          <p className="text-sm text-muted-foreground">
            Have an account already?{" "}
            <Link href="/auth/sign-in" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </form>
    </div>
  )
}
