"use client"

import { useState, useEffect, useTransition } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Package, Filter, Search, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import { formatDistanceToNow, format } from "date-fns"

// Define shipment type
interface Shipment {
  id: string;
  tracking_number?: string;
  service_type?: string;
  status?: string;
  origin?: string;
  destination?: string;
  origin_text?: string;
  destination_text?: string;
  created_at: string;
  updated_at?: string;
  user_id: string;
  amount?: number;
  [key: string]: any; // For any other properties
}

export default function ShipmentsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [activeShipments, setActiveShipments] = useState<Shipment[]>([])
  const [completedShipments, setCompletedShipments] = useState<Shipment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchShipments = async () => {
      try {
        setLoading(true)
        
        const supabase = createClient()
        
        // First check if user is authenticated
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session) {
          setError("Please sign in to view your shipments")
          setLoading(false)
          return
        }
        
        // Fetch shipments with active statuses (not delivered or cancelled)
        const { data: activeData, error: activeError } = await supabase
          .from("shipments")
          .select("*")
          .eq("user_id", session.user.id)
          .not("status", "in", '("delivered","cancelled")')
          .order("created_at", { ascending: false })
        
        if (activeError) {
          console.error("Error fetching active shipments:", activeError)
          setError("Failed to load active shipments")
          setLoading(false)
          return
        }
        
        // Fetch completed shipments (delivered or cancelled)
        const { data: completedData, error: completedError } = await supabase
          .from("shipments")
          .select("*")
          .eq("user_id", session.user.id)
          .in("status", ["delivered", "cancelled"])
          .order("created_at", { ascending: false })
        
        if (completedError) {
          console.error("Error fetching completed shipments:", completedError)
          setError("Failed to load completed shipments")
          setLoading(false)
          return
        }
        
        setActiveShipments(activeData || [])
        setCompletedShipments(completedData || [])
      } catch (error) {
        console.error("Error fetching shipments:", error)
        setError("An unexpected error occurred")
      } finally {
        setLoading(false)
      }
    }
    
    fetchShipments()
  }, [])

  // Helper to determine status color based on shipment status
  const getStatusColor = (status: string | undefined) => {
    if (!status) return "bg-gray-100 text-gray-800"
    
    switch(status.toLowerCase()) {
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

  // Format date helper
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return "N/A"
    try {
      return format(new Date(dateString), 'MMM d, yyyy')
    } catch (err) {
      console.error("Date formatting error:", err)
      return "Invalid date"
    }
  }

  // Filter shipments based on search query
  const filteredActiveShipments = activeShipments.filter(
    (shipment) =>
      shipment?.tracking_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shipment?.service_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shipment?.origin_text?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shipment?.destination_text?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredCompletedShipments = completedShipments.filter(
    (shipment) =>
      shipment?.tracking_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shipment?.service_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shipment?.origin_text?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shipment?.destination_text?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (error) {
    return (
      <div className="p-4 pb-20">
        <div className="flex items-center mb-6">
          <Link href="/" className="mr-4">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-2xl font-bold">Shipments</h1>
        </div>
        <div className="text-center py-8">
          <p className="text-red-500 mb-4">{error}</p>
          <Link href="/">
            <Button>Return to Dashboard</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 pb-20">
      <div className="flex items-center mb-6">
        <Link href="/" className="mr-4">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-2xl font-bold">Shipments</h1>
      </div>

      <div className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search shipments"
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button variant="outline" className="px-3">
          <Filter className="w-4 h-4" />
        </Button>
      </div>

      <Tabs defaultValue="active" className="mb-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-2">Loading shipments...</span>
            </div>
          ) : filteredActiveShipments.length > 0 ? (
            <div className="space-y-4">
              {filteredActiveShipments.map((shipment) => (
                <Link href={`/shipments/${shipment.id}`} key={shipment.id}>
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-bold">#{shipment.tracking_number || shipment.id.slice(0, 8)}</h3>
                        <p className="text-sm text-gray-500">{shipment.service_type}</p>
                      </div>
                      <span className={`${getStatusColor(shipment.status)} text-xs px-2 py-1 rounded-full`}>
                        {shipment.status || "Unknown"}
                      </span>
                    </div>

                    <div className="flex items-center mb-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <div className="h-0.5 w-16 bg-gray-200 mx-1"></div>
                      <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-gray-500">Origin</p>
                        <p className="font-medium">{shipment.origin_text || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Destination</p>
                        <p className="font-medium">{shipment.destination_text || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Date</p>
                        <p className="font-medium">{formatDate(shipment.created_at)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Est. Delivery</p>
                        <p className="font-medium">{shipment.estimated_delivery_date ? formatDate(shipment.estimated_delivery_date) : "TBD"}</p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="font-medium text-gray-500 mb-2">No active shipments found</h3>
              <p className="text-sm text-gray-400 mb-4">Start shipping with us today!</p>
              <Link href="/services">
                <Button className="bg-primary text-white">Book a Shipment</Button>
              </Link>
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-2">Loading shipments...</span>
            </div>
          ) : filteredCompletedShipments.length > 0 ? (
            <div className="space-y-4">
              {filteredCompletedShipments.map((shipment) => (
                <Link href={`/shipments/${shipment.id}`} key={shipment.id}>
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-bold">#{shipment.tracking_number || shipment.id.slice(0, 8)}</h3>
                        <p className="text-sm text-gray-500">{shipment.service_type}</p>
                      </div>
                      <span className={`${getStatusColor(shipment.status)} text-xs px-2 py-1 rounded-full`}>
                        {shipment.status || "Unknown"}
                      </span>
                    </div>

                    <div className="flex items-center mb-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <div className="h-0.5 w-16 bg-green-200 mx-1"></div>
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-gray-500">Origin</p>
                        <p className="font-medium">{shipment.origin_text || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Destination</p>
                        <p className="font-medium">{shipment.destination_text || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Date</p>
                        <p className="font-medium">{formatDate(shipment.created_at)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Delivery Date</p>
                        <p className="font-medium">{formatDate(shipment.updated_at)}</p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="font-medium text-gray-500 mb-2">No completed shipments found</h3>
              <p className="text-sm text-gray-400">Your completed shipments will appear here</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
