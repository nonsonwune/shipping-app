"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Search, Package, CheckCircle, Truck, Box } from "lucide-react"

export default function TrackShipmentPage() {
  const [trackingNumber, setTrackingNumber] = useState("")
  const [isTracking, setIsTracking] = useState(false)

  const handleTrack = () => {
    if (trackingNumber) {
      setIsTracking(true)
    }
  }

  return (
    <div className="p-4 pb-20">
      <div className="flex items-center mb-6">
        <Link href="/" className="mr-4">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-2xl font-bold">Track Shipment</h1>
      </div>

      <div className="mb-6">
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="Enter tracking number"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
          />
          <Button className="bg-primary" onClick={handleTrack}>
            <Search className="w-4 h-4" />
          </Button>
        </div>

        <p className="text-sm text-gray-500">
          Enter your tracking number to get real-time updates on your shipment status
        </p>
      </div>

      {isTracking ? (
        <div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold">TRK123456789</h3>
                <p className="text-sm text-gray-500">China Import</p>
              </div>
              <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">In Transit</span>
            </div>

            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-500">Origin</span>
              <span className="font-medium">Guangzhou, China</span>
            </div>

            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-500">Destination</span>
              <span className="font-medium">Lagos, Nigeria</span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Estimated Delivery</span>
              <span className="font-medium">Apr 15, 2024</span>
            </div>
          </div>

          <h3 className="font-bold mb-4">Tracking History</h3>

          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>

            <div className="relative pl-12 pb-6">
              <div className="absolute left-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="flex justify-between">
                  <h4 className="font-medium">Order Confirmed</h4>
                  <span className="text-sm text-gray-500">Mar 1, 2024</span>
                </div>
                <p className="text-sm text-gray-600">Your order has been confirmed and is being processed</p>
              </div>
            </div>

            <div className="relative pl-12 pb-6">
              <div className="absolute left-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                <Package className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="flex justify-between">
                  <h4 className="font-medium">Package Received</h4>
                  <span className="text-sm text-gray-500">Mar 5, 2024</span>
                </div>
                <p className="text-sm text-gray-600">Your package has been received at our warehouse in China</p>
              </div>
            </div>

            <div className="relative pl-12 pb-6">
              <div className="absolute left-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Truck className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="flex justify-between">
                  <h4 className="font-medium">In Transit</h4>
                  <span className="text-sm text-gray-500">Mar 10, 2024</span>
                </div>
                <p className="text-sm text-gray-600">Your package is in transit to the destination country</p>
              </div>
            </div>

            <div className="relative pl-12">
              <div className="absolute left-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <Box className="w-5 h-5 text-gray-400" />
              </div>
              <div>
                <div className="flex justify-between">
                  <h4 className="font-medium text-gray-400">Delivered</h4>
                  <span className="text-sm text-gray-400">Pending</span>
                </div>
                <p className="text-sm text-gray-400">Your package will be delivered to your address</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="font-medium text-gray-500 mb-2">No tracking information</h3>
          <p className="text-sm text-gray-400">Enter a tracking number to see shipment details</p>
        </div>
      )}
    </div>
  )
}

