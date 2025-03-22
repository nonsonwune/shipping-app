"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { toast } from "@/components/ui/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertTriangle, Save, Lock, RefreshCw, Globe, Truck, Mail, Settings } from "lucide-react"
import { useRouter } from "next/navigation"

const ADMIN_EMAILS = [
  'admin@yourcompany.com', 
  '7umunri@gmail.com',
  'chuqunonso@gmail.com'
]; // Add your admin email addresses here

type SystemSettings = {
  id: string
  key: string
  value: string | number | boolean
  description: string
  category: string
  updated_at: string
}

export default function AdminSettings() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<SystemSettings[]>([])
  const [groupedSettings, setGroupedSettings] = useState<Record<string, SystemSettings[]>>({})
  const [userRole, setUserRole] = useState<string>("staff") // Default to staff to be safe
  
  // Fetch settings and user role
  useEffect(() => {
    const fetchSettingsAndRole = async () => {
      try {
        setLoading(true)
        
        // Get current session
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session) {
          console.error("No active session")
          router.push('/auth/sign-in')
          return
        }
        
        const userId = session.user.id
        const userEmail = session.user.email || ""
        
        // Skip user_roles table to avoid recursion policy error
        // Check admin status directly by email instead
        const isAdmin = ADMIN_EMAILS.includes(userEmail.toLowerCase());
        const highestRole = isAdmin ? 'admin' : 'user';
        
        if (highestRole !== 'admin') {
          console.error("User does not have admin role")
          router.push('/admin/dashboard')
          return
        }
        
        setUserRole(highestRole)
        
        // Get system settings
        const { data: settingsData, error: settingsError } = await supabase
          .from('system_settings')
          .select('*')
          .order('category', { ascending: true })
          .order('key', { ascending: true })
        
        if (settingsError) {
          console.error("Error fetching settings:", settingsError)
          toast({
            title: "Error",
            description: "Failed to load system settings",
            variant: "destructive"
          })
          return
        }
        
        // If no settings exist yet, create default settings
        if (!settingsData || settingsData.length === 0) {
          const defaultSettings = [
            // General settings
            {
              key: 'site_name',
              value: 'Shipping App',
              description: 'Name of the website',
              category: 'general'
            },
            {
              key: 'maintenance_mode',
              value: false,
              description: 'Put the site in maintenance mode',
              category: 'general'
            },
            {
              key: 'contact_email',
              value: 'support@shippingapp.com',
              description: 'Contact email for support',
              category: 'general'
            },
            
            // Shipping settings
            {
              key: 'base_shipping_rate',
              value: 1000,
              description: 'Base rate for shipping (in ₦)',
              category: 'shipping'
            },
            {
              key: 'weight_multiplier',
              value: 500,
              description: 'Price per kg (in ₦)',
              category: 'shipping'
            },
            {
              key: 'distance_multiplier',
              value: 100,
              description: 'Price per km (in ₦)',
              category: 'shipping'
            },
            {
              key: 'express_shipping_markup',
              value: 1.5,
              description: 'Markup multiplier for express shipping',
              category: 'shipping'
            },
            
            // Notification settings
            {
              key: 'email_notifications',
              value: true,
              description: 'Send email notifications for shipment updates',
              category: 'notifications'
            },
            {
              key: 'sms_notifications',
              value: true,
              description: 'Send SMS notifications for shipment updates',
              category: 'notifications'
            },
            
            // Security settings
            {
              key: 'require_email_verification',
              value: true,
              description: 'Require email verification for new accounts',
              category: 'security'
            },
            {
              key: 'login_attempts_limit',
              value: 5,
              description: 'Maximum failed login attempts before lockout',
              category: 'security'
            },
            {
              key: 'session_timeout_minutes',
              value: 60,
              description: 'Session timeout in minutes',
              category: 'security'
            }
          ]
          
          // Insert default settings
          for (const setting of defaultSettings) {
            const { error } = await supabase
              .from('system_settings')
              .insert(setting)
            
            if (error) {
              console.error(`Error creating default setting ${setting.key}:`, error)
            }
          }
          
          // Fetch again after creating defaults
          const { data: newSettings, error } = await supabase
            .from('system_settings')
            .select('*')
            .order('category', { ascending: true })
            .order('key', { ascending: true })
          
          if (error) {
            console.error("Error fetching settings after creating defaults:", error)
          } else {
            setSettings(newSettings || [])
          }
        } else {
          setSettings(settingsData)
        }
      } catch (error) {
        console.error("Error fetching settings:", error)
        toast({
          title: "Error",
          description: "An unexpected error occurred",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }
    
    fetchSettingsAndRole()
  }, [router])
  
  // Group settings by category
  useEffect(() => {
    const grouped: Record<string, SystemSettings[]> = {}
    
    settings.forEach(setting => {
      if (!grouped[setting.category]) {
        grouped[setting.category] = []
      }
      grouped[setting.category].push(setting)
    })
    
    setGroupedSettings(grouped)
  }, [settings])
  
  // Update a setting value
  const updateSettingValue = (id: string, value: string | number | boolean) => {
    setSettings(prevSettings => 
      prevSettings.map(setting => 
        setting.id === id ? { ...setting, value } : setting
      )
    )
  }
  
  // Save all settings
  const saveSettings = async () => {
    try {
      setSaving(true)
      
      for (const setting of settings) {
        const { error } = await supabase
          .from('system_settings')
          .update({ value: setting.value })
          .eq('id', setting.id)
        
        if (error) {
          console.error(`Error updating setting ${setting.key}:`, error)
          toast({
            title: "Error",
            description: `Failed to update ${setting.key}`,
            variant: "destructive"
          })
          return
        }
      }
      
      toast({
        title: "Success",
        description: "Settings updated successfully",
      })
    } catch (error) {
      console.error("Error saving settings:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }
  
  // Process setting input based on inferred type
  const renderSettingInput = (setting: SystemSettings) => {
    const value = setting.value
    
    // Boolean setting (switch)
    if (typeof value === 'boolean' || value === 'true' || value === 'false') {
      const boolValue = typeof value === 'string' ? value === 'true' : !!value
      return (
        <Switch 
          checked={boolValue}
          onCheckedChange={(checked) => updateSettingValue(setting.id, checked)}
        />
      )
    }
    
    // Numeric setting
    if (typeof value === 'number' || !isNaN(Number(value))) {
      return (
        <Input 
          type="number"
          value={value.toString()}
          onChange={(e) => updateSettingValue(setting.id, Number(e.target.value))}
        />
      )
    }
    
    // Default: string setting
    return (
      <Input 
        type="text"
        value={value.toString()}
        onChange={(e) => updateSettingValue(setting.id, e.target.value)}
      />
    )
  }
  
  // Get icon for category
  const getCategoryIcon = (category: string) => {
    switch(category) {
      case 'general':
        return <Settings className="h-4 w-4" />
      case 'shipping':
        return <Truck className="h-4 w-4" />
      case 'notifications':
        return <Mail className="h-4 w-4" />
      case 'security':
        return <Lock className="h-4 w-4" />
      default:
        return <Settings className="h-4 w-4" />
    }
  }
  
  // Format category name
  const formatCategoryName = (category: string) => {
    return category.charAt(0).toUpperCase() + category.slice(1)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>System Settings</CardTitle>
            <CardDescription>Configure global settings for the shipping application</CardDescription>
          </div>
          <Button onClick={saveSettings} disabled={saving}>
            {saving ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent>
          {/* Admin-only warning */}
          <div className="bg-yellow-50 border border-yellow-200 p-4 mb-6 rounded-md flex items-start">
            <AlertTriangle className="h-5 w-5 text-yellow-500 mr-3 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-yellow-800">Admin-only section</h4>
              <p className="text-sm text-yellow-700">
                Changes made here will affect the entire system. Please proceed with caution.
              </p>
            </div>
          </div>
          
          {/* Settings tabs by category */}
          <Tabs defaultValue={Object.keys(groupedSettings)[0] || 'general'}>
            <TabsList className="mb-4">
              {Object.keys(groupedSettings).map(category => (
                <TabsTrigger key={category} value={category} className="flex items-center">
                  {getCategoryIcon(category)}
                  <span className="ml-2">{formatCategoryName(category)}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            
            {Object.entries(groupedSettings).map(([category, categorySettings]) => (
              <TabsContent key={category} value={category} className="space-y-4">
                {categorySettings.map(setting => (
                  <div key={setting.id} className="flex flex-col space-y-1.5">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                      <div className="col-span-2 md:col-span-2">
                        <Label htmlFor={setting.key}>{setting.key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</Label>
                        <p className="text-sm text-gray-500">{setting.description}</p>
                      </div>
                      <div className="col-span-1 md:col-span-1">
                        {renderSettingInput(setting)}
                      </div>
                    </div>
                    <Separator className="my-2" />
                  </div>
                ))}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={() => router.push('/admin/dashboard')}>
            Cancel
          </Button>
          <Button onClick={saveSettings} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
