"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { 
  Package, 
  Truck, 
  MapPin, 
  Phone, 
  Calendar, 
  Clock, 
  User, 
  Info,
  ArrowLeft
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { useToast } from "@/components/ui/use-toast"

// Helper function to format dates
const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
}

export default function ShipmentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [shipment, setShipment] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchShipment() {
      try {
        setLoading(true)
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session) {
          router.push("/auth/sign-in")
          return
        }

        const { data, error } = await supabase
          .from("shipments")
          .select("*")
          .eq("id", params.id)
          .single()

        if (error) {
          throw error
        }

        if (data) {
          setShipment(data)
        } else {
          setError("Shipment not found")
        }
      } catch (err: any) {
        console.error("Error fetching shipment:", err)
        setError(err.message || "Failed to load shipment details")
        toast({
          title: "Error",
          description: "Failed to load shipment details",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    if (params.id) {
      fetchShipment()
    }
  }, [params.id, router, toast])

  // Format special instructions to display in a readable format
  const formatSpecialInstructions = (instructions: string) => {
    if (!instructions) return {}
    
    // Try to parse the special instructions into a structured format
    const lines = instructions.split('\n')
    const result: Record<string, string> = {}
    
    lines.forEach(line => {
      const [key, value] = line.split(':').map(s => s.trim())
      if (key && value) {
        result[key] = value
      }
    })
    
    return result
  }

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

  // Parse the special instructions if available
  const parsedInstructions = shipment ? formatSpecialInstructions(shipment.special_instructions) : {}

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-md">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-md">
        <div className="text-center">
          <h2 className="text-xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-600">{error}</p>
          <Button 
            variant="outline" 
            className="mt-6"
            onClick={() => router.push("/")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Return to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  if (!shipment) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-md">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-4">Shipment Not Found</h2>
          <p className="text-gray-600">The shipment you're looking for doesn't exist or you don't have permission to view it.</p>
          <Button 
            variant="outline" 
            className="mt-6"
            onClick={() => router.push("/")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Return to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-md">
      <Button 
        variant="outline" 
        className="mb-6"
        onClick={() => router.push("/")}
      >
        <ArrowLeft className="w-4 h-4 mr-2" /> Back
      </Button>
      
      <Card className="shadow-md">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-xl">Shipment Details</CardTitle>
              <CardDescription className="mt-1">
                Tracking #: {shipment.tracking_number}
              </CardDescription>
            </div>
            <Badge className={getStatusColor(shipment.status)}>
              {shipment.status?.charAt(0).toUpperCase() + shipment.status?.slice(1) || "Unknown"}
            </Badge>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="pt-6">
          {/* Service Details */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-500 mb-2">SERVICE DETAILS</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start">
                <Package className="w-5 h-5 mr-2 text-gray-500" />
                <div>
                  <p className="text-sm font-medium">Service Type</p>
                  <p className="text-sm text-gray-600">{parsedInstructions.Service || "Standard"}</p>
                </div>
              </div>
              <div className="flex items-start">
                <Calendar className="w-5 h-5 mr-2 text-gray-500" />
                <div>
                  <p className="text-sm font-medium">Created</p>
                  <p className="text-sm text-gray-600">
                    {shipment.created_at ? formatDistanceToNow(new Date(shipment.created_at), { addSuffix: true }) : "Unknown"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Location Information */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-500 mb-2">LOCATIONS</h3>
            <div className="space-y-4">
              <div className="flex items-start">
                <MapPin className="w-5 h-5 mr-2 text-gray-500" />
                <div>
                  <p className="text-sm font-medium">Origin</p>
                  <p className="text-sm text-gray-600">{parsedInstructions.Origin || "Not specified"}</p>
                </div>
              </div>
              <div className="flex items-start">
                <MapPin className="w-5 h-5 mr-2 text-gray-500" />
                <div>
                  <p className="text-sm font-medium">Destination</p>
                  <p className="text-sm text-gray-600">{parsedInstructions.Destination || "Not specified"}</p>
                </div>
              </div>
              <div className="flex items-start">
                <MapPin className="w-5 h-5 mr-2 text-gray-500" />
                <div>
                  <p className="text-sm font-medium">Delivery Address</p>
                  <p className="text-sm text-gray-600">{shipment.delivery_address || "Not specified"}</p>
                </div>
              </div>
              <div className="flex items-start">
                <Phone className="w-5 h-5 mr-2 text-gray-500" />
                <div>
                  <p className="text-sm font-medium">Recipient Phone</p>
                  <p className="text-sm text-gray-600">{shipment.recipient_phone || "Not specified"}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Package Details */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-500 mb-2">PACKAGE DETAILS</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start">
                <Package className="w-5 h-5 mr-2 text-gray-500" />
                <div>
                  <p className="text-sm font-medium">Weight</p>
                  <p className="text-sm text-gray-600">
                    {shipment.total_weight ? `${shipment.total_weight} ${shipment.weight_unit || 'kg'}` : "Not specified"}
                  </p>
                </div>
              </div>
              <div className="flex items-start">
                <Package className="w-5 h-5 mr-2 text-gray-500" />
                <div>
                  <p className="text-sm font-medium">Dimensions</p>
                  <p className="text-sm text-gray-600">
                    {shipment.dimensions ? (
                      (() => {
                        try {
                          const dims = JSON.parse(shipment.dimensions);
                          return `${dims.length}x${dims.width}x${dims.height} cm`;
                        } catch (e) {
                          return shipment.dimensions;
                        }
                      })()
                    ) : "Not specified"}
                  </p>
                </div>
              </div>
            </div>
            {shipment.description && (
              <div className="flex items-start mt-4">
                <Info className="w-5 h-5 mr-2 text-gray-500" />
                <div>
                  <p className="text-sm font-medium">Description</p>
                  <p className="text-sm text-gray-600">{shipment.description}</p>
                </div>
              </div>
            )}
          </div>

          {/* Payment Details */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 mb-2">PAYMENT DETAILS</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between mb-2">
                <span className="text-sm">Amount</span>
                <span className="text-sm font-semibold">
                  {shipment.amount ? `${shipment.currency || 'NGN'} ${shipment.amount.toLocaleString()}` : "Not specified"}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
        <Separator />
        <CardFooter className="flex justify-between pt-4">
          <Button variant="outline" onClick={() => window.print()}>
            Print Details
          </Button>
          <Button variant="default">
            Track Shipment
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
