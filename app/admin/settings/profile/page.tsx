"use client"

import { useState, useEffect, useRef } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { toast } from "@/components/ui/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertTriangle, Save, Key, User, Mail, Phone, Shield, RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Database } from "@/types/supabase"

type Profile = Database['public']['Tables']['profiles']['Row']

// Hard-coded admin emails for verification
// In production, this would ideally be stored in environment variables
const ADMIN_EMAILS = [
  'admin@yourcompany.com', 
  '7umunri@gmail.com',
  'chuqunonso@gmail.com'
];

export default function AdminProfileSettings() {
  const router = useRouter()
  const supabase = createClientComponentClient<Database>()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  
  // Use ref to prevent multiple session checks
  const sessionChecked = useRef(false)
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordError, setPasswordError] = useState("")
  
  // Profile update state
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [username, setUsername] = useState("")
  
  // Function to safely format dates
  const safeFormatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "Never";
    
    try {
      const date = new Date(dateString);
      
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        return "Invalid date";
      }
      
      try {
        return date.toLocaleString();
      } catch (error) {
        // Fallback if toLocaleString fails
        return date.toString();
      }
    } catch (error) {
      console.error("Error formatting date:", error);
      return "Date error";
    }
  };
  
  // Fetch profile data
  useEffect(() => {
    const fetchProfile = async () => {
      // Prevent duplicate session checks
      if (sessionChecked.current) return;
      sessionChecked.current = true;
      
      try {
        setLoading(true)
        
        // Get current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error("Session error:", sessionError);
          toast({
            title: "Session Error",
            description: "Please login again",
            variant: "destructive"
          });
          router.push('/admin/login');
          return;
        }
        
        if (!session) {
          console.error("No active session")
          router.push('/admin/login')
          return
        }
        
        const userId = session.user.id
        const userEmail = session.user.email || ""
        setEmail(userEmail)
        
        // Check if user is admin
        const isAdmin = ADMIN_EMAILS.includes(userEmail.toLowerCase());
        if (!isAdmin) {
          toast({
            title: "Access Denied",
            description: "You don't have permission to access admin settings",
            variant: "destructive"
          });
          router.push('/admin/dashboard');
          return;
        }
        
        // Get user profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single()
        
        if (profileError) {
          console.error("Error fetching profile:", profileError)
          toast({
            title: "Error",
            description: "Failed to load profile data",
            variant: "destructive"
          })
          return
        }
        
        if (profileData) {
          setProfile(profileData)
          setFirstName(profileData.first_name || "")
          setLastName(profileData.last_name || "")
          setUsername(profileData.username || "")
          setPhone(profileData.phone || "")
        }
        
      } catch (error) {
        console.error("Error fetching profile data:", error)
        toast({
          title: "Error",
          description: "An unexpected error occurred",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }
    
    fetchProfile()
    
    // Cleanup function to reset ref if component unmounts and remounts
    return () => {
      sessionChecked.current = false;
    };
  }, [router, supabase])
  
  // Update profile information
  const handleProfileUpdate = async () => {
    try {
      setSaving(true)
      setPasswordError("")
      
      if (!profile) return
      
      // Update profile in database
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          first_name: firstName,
          last_name: lastName,
          phone: phone,
          username: username
        })
        .eq('id', profile.id)
      
      if (updateError) {
        console.error("Error updating profile:", updateError)
        toast({
          title: "Error",
          description: "Failed to update profile",
          variant: "destructive"
        })
        return
      }
      
      // Update local state
      setProfile({
        ...profile,
        first_name: firstName,
        last_name: lastName,
        phone: phone,
        username: username
      })
      
      toast({
        title: "Success",
        description: "Profile updated successfully",
      })
      
    } catch (error) {
      console.error("Error updating profile:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }
  
  // Change password
  const handlePasswordChange = async () => {
    try {
      setSaving(true)
      setPasswordError("")
      
      // Validate passwords
      if (!currentPassword || !newPassword || !confirmPassword) {
        setPasswordError("All password fields are required")
        return
      }
      
      if (newPassword !== confirmPassword) {
        setPasswordError("New passwords do not match")
        return
      }
      
      if (newPassword.length < 8) {
        setPasswordError("Password must be at least 8 characters long")
        return
      }
      
      // Verify the current password by attempting a login (Supabase doesn't provide a direct way to verify password)
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: email,
        password: currentPassword,
      })
      
      if (verifyError) {
        setPasswordError("Current password is incorrect")
        return
      }
      
      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })
      
      if (updateError) {
        console.error("Error updating password:", updateError)
        setPasswordError(updateError.message)
        return
      }
      
      // Clear password fields
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      
      toast({
        title: "Success",
        description: "Password updated successfully",
      })
      
    } catch (error) {
      console.error("Error changing password:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }
  
  // Get initials for avatar
  const getInitials = (firstName: string | null, lastName: string | null): string => {
    if (!firstName && !lastName) return "A";
    const initials = (firstName?.charAt(0).toUpperCase() || '') + (lastName?.charAt(0).toUpperCase() || '');
    return initials;
  };
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Profile Settings</CardTitle>
          <CardDescription>
            Manage your account profile and security settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin h-8 w-8 border-t-2 border-primary rounded-full" />
            </div>
          ) : (
            <Tabs defaultValue="profile" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="profile">
                  <User className="h-4 w-4 mr-2" />
                  Profile Details
                </TabsTrigger>
                <TabsTrigger value="security">
                  <Key className="h-4 w-4 mr-2" />
                  Password & Security
                </TabsTrigger>
              </TabsList>
              
              {/* Profile Details Tab */}
              <TabsContent value="profile" className="space-y-6 pt-4">
                <div className="flex items-center space-x-4">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={profile?.avatar_url || ""} alt={firstName + ' ' + lastName} />
                    <AvatarFallback className="text-lg">
                      {getInitials(firstName, lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-lg font-medium">
                      {firstName + ' ' + lastName || "Admin User"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {email}
                    </p>
                  </div>
                </div>
                
                <Separator />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input 
                      id="firstName" 
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Your first name"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input 
                      id="lastName" 
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Your last name"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input 
                      id="username" 
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Your username"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input 
                      id="email" 
                      value={email}
                      readOnly
                      disabled
                      className="bg-gray-50"
                    />
                    <p className="text-xs text-muted-foreground">
                      To change your email address, please contact system administrator
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input 
                      id="phone" 
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Your phone number"
                    />
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <Button 
                    onClick={handleProfileUpdate} 
                    disabled={saving}
                    className="w-full md:w-auto"
                  >
                    {saving ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>
              
              {/* Password & Security Tab */}
              <TabsContent value="security" className="space-y-6 pt-4">
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="mt-0.5">
                      <Shield className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <h3 className="text-base font-medium">Change Your Password</h3>
                      <p className="text-sm text-muted-foreground">
                        Choose a strong password that you don't use elsewhere
                      </p>
                    </div>
                  </div>
                  
                  {passwordError && (
                    <div className="flex items-center space-x-2 p-3 bg-red-50 text-red-800 rounded-md">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-sm">{passwordError}</span>
                    </div>
                  )}
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <Input 
                        id="currentPassword" 
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <Input 
                        id="newPassword" 
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm New Password</Label>
                      <Input 
                        id="confirmPassword" 
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-end">
                    <Button 
                      onClick={handlePasswordChange} 
                      disabled={saving}
                      className="w-full md:w-auto"
                    >
                      {saving ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <Key className="h-4 w-4 mr-2" />
                          Update Password
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="mt-0.5">
                      <Mail className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <h3 className="text-base font-medium">Email Notifications</h3>
                      <p className="text-sm text-muted-foreground">
                        Your email {email} receives important security notifications
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
        <CardFooter className="border-t bg-gray-50/50 justify-between">
          <p className="text-xs text-muted-foreground">
            Last updated: {profile?.updated_at ? safeFormatDate(profile.updated_at) : 'Never'}
          </p>
          <Button variant="outline" onClick={() => router.push('/admin/dashboard')}>
            Back to Dashboard
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
