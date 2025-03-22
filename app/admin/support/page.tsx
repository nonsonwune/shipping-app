"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/use-toast"
import { 
  MessageCircle,
  User,
  Mail,
  Phone,
  SendHorizonal,
  RefreshCw
} from "lucide-react"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"

export default function SupportPage() {
  const [userName, setUserName] = useState("")
  const [userEmail, setUserEmail] = useState("")
  const [inquiryType, setInquiryType] = useState("general")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)
  
  // Fetch user info
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session) return
        
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
        
        if (error) {
          console.error("Error fetching profile:", error)
          return
        }
        
        if (profile) {
          setUserName(`${profile.first_name || ''} ${profile.last_name || ''}`.trim())
          setUserEmail(profile.email || session.user.email || '')
        }
      } catch (error) {
        console.error("Error fetching user info:", error)
      }
    }
    
    fetchUserInfo()
  }, [])
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!message.trim()) {
      toast({
        title: "Error",
        description: "Please enter a message",
        variant: "destructive"
      })
      return
    }
    
    try {
      setLoading(true)
      
      // Create support ticket in support_tickets table (if it exists)
      // This is a placeholder for where you would integrate with your support system
      
      // For demo purposes, we'll just show a success message
      toast({
        title: "Support Ticket Created",
        description: "Your message has been sent to our support team",
      })
      
      // Clear form
      setMessage("")
      setInquiryType("general")
    } catch (error) {
      console.error("Error submitting support ticket:", error)
      toast({
        title: "Error",
        description: "Failed to submit support ticket. Please try again later.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            Admin Support
          </CardTitle>
          <CardDescription>
            Get help with administrative tasks or report issues with the platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                  <Input 
                    id="name" 
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="pl-10"
                    placeholder="Your name"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                  <Input 
                    id="email" 
                    type="email"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    className="pl-10"
                    placeholder="Your email"
                    required
                  />
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="inquiry-type">Inquiry Type</Label>
              <Select 
                value={inquiryType} 
                onValueChange={setInquiryType}
              >
                <SelectTrigger id="inquiry-type">
                  <SelectValue placeholder="Select inquiry type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General Question</SelectItem>
                  <SelectItem value="technical">Technical Issue</SelectItem>
                  <SelectItem value="account">Account Management</SelectItem>
                  <SelectItem value="feature">Feature Request</SelectItem>
                  <SelectItem value="bug">Bug Report</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea 
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your issue or question in detail..."
                className="min-h-[150px]"
                required
              />
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <SendHorizonal className="mr-2 h-4 w-4" />
                Send Message
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
      
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Email Support</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start">
              <Mail className="h-5 w-5 mr-2 text-primary" />
              <div>
                <p className="text-sm text-gray-500">Email us directly at:</p>
                <p className="font-medium">admin-support@shipping-app.com</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Phone Support</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start">
              <Phone className="h-5 w-5 mr-2 text-primary" />
              <div>
                <p className="text-sm text-gray-500">Call our admin support team:</p>
                <p className="font-medium">+234 (0) 123-456-7890</p>
                <p className="text-xs text-gray-500">Mon-Fri, 9am-5pm WAT</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Documentation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start">
              <MessageCircle className="h-5 w-5 mr-2 text-primary" />
              <div>
                <p className="text-sm text-gray-500">Access admin documentation:</p>
                <Button variant="link" className="p-0 h-auto">
                  Admin User Guide
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
