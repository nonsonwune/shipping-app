"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Settings, User, Bell, Lock, Globe } from "lucide-react"

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [activeTab, setActiveTab] = useState<string>("general")
  
  useEffect(() => {
    // Determine active tab based on pathname
    if (pathname.includes("/profile")) {
      setActiveTab("profile")
    } else {
      setActiveTab("general")
    }
  }, [pathname])
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account settings and site preferences
          </p>
        </div>
      </div>
      
      <div className="border-b">
        <Tabs value={activeTab} className="w-full">
          <TabsList className="inline-flex h-10 w-full justify-start rounded-none border-b bg-transparent p-0">
            <Link href="/admin/settings" className="w-auto">
              <TabsTrigger
                value="general"
                className={`inline-flex items-center justify-center rounded-none border-b-2 border-b-transparent bg-transparent px-4 py-3 text-sm font-medium text-muted-foreground ring-offset-background transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
                  activeTab === "general" ? "border-b-primary text-foreground" : ""
                } data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none`}
              >
                <Settings className="mr-2 h-4 w-4" />
                General Settings
              </TabsTrigger>
            </Link>
            
            <Link href="/admin/settings/profile" className="w-auto">
              <TabsTrigger
                value="profile"
                className={`inline-flex items-center justify-center rounded-none border-b-2 border-b-transparent bg-transparent px-4 py-3 text-sm font-medium text-muted-foreground ring-offset-background transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
                  activeTab === "profile" ? "border-b-primary text-foreground" : ""
                } data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none`}
              >
                <User className="mr-2 h-4 w-4" />
                Profile
              </TabsTrigger>
            </Link>
          </TabsList>
        </Tabs>
      </div>
      
      <div>{children}</div>
    </div>
  )
}
