"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import StatCard from "@/components/stat-card"
import ActionCard from "@/components/action-card"
import { Globe, Package, FileText, MapPin, Wallet } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import type { User } from "@supabase/supabase-js"
import { ThemeToggle } from "@/components/theme-toggle"

// Define UserProfile type if not already imported
type UserProfile = {
  id: string
  first_name?: string
  last_name?: string
  email?: string
  created_at?: string
  username?: string
  avatar_url?: string
  wallet_balance?: number
}

export default function Home() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [walletBalance, setWalletBalance] = useState(0)
  const [shipments, setShipments] = useState<any[]>([])
  const [shipmentStats, setShipmentStats] = useState({
    active: 0,
    delivered: 0,
    activeThisWeek: 0,
    deliveredThisMonth: 0
  })

  useEffect(() => {
    async function getProfile() {
      try {
        // Get the current session
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
          router.push("/auth/sign-in")
          return
        }

        // Store user data
        setUser(session.user)

        // Create a minimal profile from user data
        const userProfile = {
          id: session.user.id,
          first_name: session.user.user_metadata?.first_name || session.user.user_metadata?.name || "User",
          last_name: session.user.user_metadata?.last_name || "",
          email: session.user.email || "",
          wallet_balance: 0,
        }

        try {
          // Try to fetch profile from profiles table
          const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .maybeSingle() // Use maybeSingle instead of single to avoid errors when no row is found

          if (data) {
            console.log("Profile data retrieved:", data)
            setProfile(data)
          } else {
            console.log("No profile found, using user metadata instead")
            setProfile(userProfile)
          }
        } catch (profileError) {
          console.error("Error loading profile:", profileError)
          
          // Use the minimal profile from user data if the profiles table doesn't exist
          setProfile(userProfile)
        }
        
        // Fetch wallet balance from wallets table
        try {
          const { data: walletData, error: walletError } = await supabase
            .from("wallets")
            .select("balance")
            .eq("user_id", session.user.id)
            .maybeSingle();
            
          if (walletData) {
            console.log("Wallet data retrieved:", walletData);
            setWalletBalance(walletData.balance || 0);
          } else {
            console.log("No wallet found, using 0 balance");
            setWalletBalance(0);
          }
          
          if (walletError) {
            console.error("Error fetching wallet:", walletError);
          }
        } catch (walletError) {
          console.error("Error fetching wallet:", walletError);
        }
        
        // Fetch recent shipments
        try {
          const { data: shipmentsData, error: shipmentsError } = await supabase
            .from("shipments")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(5)
            
          if (shipmentsError) {
            console.error("Error fetching shipments:", shipmentsError)
          } else if (shipmentsData) {
            setShipments(shipmentsData)
            
            // Calculate shipment stats
            const active = shipmentsData.filter(s => 
              s.status && ['pending', 'processing', 'in transit'].includes(s.status.toLowerCase())
            ).length
            
            const delivered = shipmentsData.filter(s => 
              s.status && s.status.toLowerCase() === 'delivered'
            ).length
            
            // Calculate dates for this week and month
            const now = new Date()
            const startOfWeek = new Date(now)
            startOfWeek.setDate(now.getDate() - now.getDay()) // Start of current week (Sunday)
            
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1) // Start of current month
            
            // Count shipments for this week and month
            const activeThisWeek = shipmentsData.filter(s => {
              if (!s.status || !['pending', 'processing', 'in transit'].includes(s.status.toLowerCase())) return false
              const shipmentDate = new Date(s.created_at)
              return shipmentDate >= startOfWeek
            }).length
            
            const deliveredThisMonth = shipmentsData.filter(s => {
              if (!s.status || s.status.toLowerCase() !== 'delivered') return false
              const shipmentDate = new Date(s.created_at)
              return shipmentDate >= startOfMonth
            }).length
            
            setShipmentStats({
              active,
              delivered,
              activeThisWeek,
              deliveredThisMonth
            })
          }
        } catch (shipmentsError) {
          console.error("Error fetching shipments:", shipmentsError)
        }
      } catch (error) {
        console.error("Dashboard error:", error)
      } finally {
        setLoading(false)
      }
    }

    getProfile()
  }, [router])

  // Helper function to get display name from profile
  const getDisplayName = () => {
    if (!profile) return "User";
    
    // Try different profile fields that might contain the name
    if (profile.first_name && profile.last_name) {
      return `${profile.first_name} ${profile.last_name}`;
    } else if (profile.first_name) {
      return profile.first_name;
    } else if (profile.last_name) {
      return profile.last_name;
    } else if (profile.username) {
      return profile.username;
    } else {
      return "User";
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="p-6 pb-20">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground">
            Welcome back, {getDisplayName()}
          </p>
          <ThemeToggle />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <StatCard
          title="Active Shipments"
          value={shipmentStats.active.toString()}
          icon={<Package className="w-4 h-4" />}
          trend={shipmentStats.activeThisWeek > 0 ? `+${shipmentStats.activeThisWeek} this week` : "No new shipments"}
        />
        <StatCard
          title="Delivered"
          value={shipmentStats.delivered.toString()}
          icon={<FileText className="w-4 h-4" />}
          trend={shipmentStats.deliveredThisMonth > 0 ? `+${shipmentStats.deliveredThisMonth} this month` : "No deliveries this month"}
        />
      </div>

      {/* Wallet Widget */}
      <div className="bg-white dark:bg-slate-800 rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-700 mb-6">
        <div className="p-4">
          <div className="flex items-center mb-3">
            <Wallet className="h-6 w-6 text-blue-700 mr-2" />
            <h3 className="text-base font-medium">Wallet Balance</h3>
          </div>
          <p className="text-xl font-bold mb-4">₦{walletBalance.toLocaleString()}</p>
          <Link href="/wallet">
            <Button className="w-full bg-blue-700 hover:bg-blue-800 text-white">
              Fund Wallet
            </Button>
          </Link>
        </div>
      </div>

      <div className="space-y-4 mb-6">
        <h2 className="text-lg font-medium">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-4">
          <ActionCard
            title="Ship Package"
            icon={<Package className="w-5 h-5" />}
            href="/services"
            description="Send a package"
          />
          <ActionCard 
            title="Track" 
            icon={<MapPin className="w-5 h-5" />} 
            href="/track" 
            description="Track your shipment"
          />
          <ActionCard
            title="Multi-Ship"
            icon={<Globe className="w-5 h-5" />}
            href="/multi-ship"
            description="Send to multiple locations"
          />
          <ActionCard
            title="Get a Quote"
            icon={<FileText className="w-5 h-5" />}
            href="/quote"
            description="Calculate shipping costs"
          />
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-medium mb-3">Recent Shipments</h2>
        {shipments.length > 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-4 space-y-4">
            {shipments.slice(0, 2).map((shipment) => (
              <div key={shipment.id} className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-black dark:text-white">
                    {shipment.tracking_number || "Shipment"}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {shipment.status || "Status unknown"}
                  </p>
                </div>
                <Link href={`/shipments/${shipment.id}`}>
                  <Button variant="outline" size="sm">
                    {shipment.status && shipment.status.toLowerCase() === 'delivered' ? 'Details' : 'Track'}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-6 text-center">
            <Package className="h-8 w-8 mx-auto mb-3 text-slate-400" />
            <p className="text-sm text-slate-500">No shipments yet</p>
            <Link href="/services">
              <Button variant="link" className="mt-2 p-0">
                Book your first shipment
              </Button>
            </Link>
          </div>
        )}
      </div>

      <div>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-medium">Quick Links</h2>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-4 space-y-3">
          <Link href="/services" className="block">
            <div className="flex items-center">
              <Package className="h-5 w-5 mr-3 text-primary" />
              <div>
                <p className="text-sm font-medium text-black dark:text-white">Ship Package</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Send a domestic or international package</p>
              </div>
            </div>
          </Link>
          <Link href="/track" className="block">
            <div className="flex items-center">
              <MapPin className="h-5 w-5 mr-3 text-primary" />
              <div>
                <p className="text-sm font-medium text-black dark:text-white">Track Shipment</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Check the status of your package</p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
