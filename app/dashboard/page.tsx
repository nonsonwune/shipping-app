"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { 
  Package, 
  Truck, 
  Calendar, 
  PlusCircle, 
  RefreshCw,
  Wallet
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"

export default function DashboardPage() {
  const router = useRouter()
  const [shipments, setShipments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [walletBalance, setWalletBalance] = useState(0)

  useEffect(() => {
    async function fetchUserData() {
      try {
        setLoading(true)
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session) {
          router.push("/auth/sign-in")
          return
        }

        // Fetch user profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single()
          
        if (profileData) {
          setProfile(profileData)
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
        const { data: shipmentsData, error } = await supabase
          .from("shipments")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(5)

        if (error) {
          console.error("Error fetching shipments:", error)
        } else if (shipmentsData) {
          setShipments(shipmentsData)
        }
      } catch (err) {
        console.error("Error fetching user data:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchUserData()
  }, [router])

  const getStatusColor = (status: string) => {
    switch(status?.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'processing':
        return 'bg-blue-100 text-blue-800'
      case 'in transit':
        return 'bg-purple-100 text-purple-800'
      case 'delivered':
        return 'bg-green-100 text-green-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-md">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-gray-500">Welcome back{profile?.first_name ? `, ${profile.first_name}` : ''}!</p>
      </header>
      
      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Button 
          variant="outline" 
          className="h-auto py-4 flex flex-col items-center justify-center gap-2"
          onClick={() => router.push("/services")}
        >
          <PlusCircle className="h-5 w-5" />
          <span>Book Shipment</span>
        </Button>
        <Button 
          variant="outline" 
          className="h-auto py-4 flex flex-col items-center justify-center gap-2"
          onClick={() => router.push("/track-shipment")}
        >
          <Truck className="h-5 w-5" />
          <span>Track Shipment</span>
        </Button>
      </div>
      
      {/* Wallet card */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg">Wallet Balance</CardTitle>
            <Wallet className="h-5 w-5 text-blue-500" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold mb-2">₦{walletBalance?.toLocaleString() || '0.00'}</p>
          <div className="flex justify-between">
            <Button variant="link" className="p-0 h-auto text-blue-600" onClick={() => router.push('/wallet')}>
              Fund Wallet
            </Button>
            <Button variant="link" className="p-0 h-auto text-gray-500" onClick={() => router.push('/wallet')}>
              View History
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Shipments */}
      <div className="mb-6">
        <Tabs defaultValue="recent">
          <div className="flex justify-between items-center mb-4">
            <TabsList>
              <TabsTrigger value="recent">Recent</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
            </TabsList>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs flex items-center gap-1"
              onClick={() => router.push('/shipments')}
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </Button>
          </div>
          
          <TabsContent value="recent" className="m-0">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : shipments.length > 0 ? (
              <div className="space-y-4">
                {shipments.map((shipment) => (
                  <Card key={shipment.id} className="overflow-hidden" onClick={() => router.push(`/shipments/${shipment.id}`)} role="button">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-medium">#{shipment.tracking_number}</h3>
                          <p className="text-sm text-gray-500">
                            {shipment.created_at ? formatDistanceToNow(new Date(shipment.created_at), { addSuffix: true }) : "Unknown date"}
                          </p>
                        </div>
                        <Badge className={getStatusColor(shipment.status)}>
                          {shipment.status}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center text-sm text-gray-600 mt-3">
                        <Package className="h-4 w-4 mr-1" />
                        <span>{`${shipment.total_weight || '?'} ${shipment.weight_unit || 'kg'}`}</span>
                        <span className="mx-2">•</span>
                        <Calendar className="h-4 w-4 mr-1" />
                        <span>
                          {shipment.created_at ? new Date(shipment.created_at).toLocaleDateString() : "Unknown date"}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Package className="h-10 w-10 mx-auto mb-3 text-gray-400" />
                <p className="text-gray-500">No shipments found</p>
                <Button 
                  variant="link" 
                  className="mt-2"
                  onClick={() => router.push('/services')}
                >
                  Book your first shipment
                </Button>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="active" className="m-0">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Truck className="h-10 w-10 mx-auto mb-3 text-gray-400" />
                <p className="text-gray-500">No active shipments</p>
                <Button 
                  variant="link" 
                  className="mt-2"
                  onClick={() => router.push('/services')}
                >
                  Book a shipment now
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Quick links */}
      <div className="space-y-2">
        <h2 className="text-lg font-medium mb-3">Quick Links</h2>
        <Button 
          variant="outline" 
          className="w-full justify-start"
          onClick={() => router.push('/saved-addresses')}
        >
          Saved Addresses
        </Button>
        <Button 
          variant="outline" 
          className="w-full justify-start"
          onClick={() => router.push('/payment-methods')}
        >
          Payment Methods
        </Button>
        <Button 
          variant="outline" 
          className="w-full justify-start"
          onClick={() => router.push('/referrals')}
        >
          Refer & Earn
        </Button>
      </div>
    </div>
  )
}
