"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Package, Filter, Search } from "lucide-react"
import { Input } from "@/components/ui/input"

export default function ShipmentsPage() {
  const [searchQuery, setSearchQuery] = useState("")

  // Sample shipment data
  const activeShipments = [
    {
      id: "TRK123456789",
      type: "China Import",
      status: "In Transit",
      statusColor: "bg-blue-100 text-blue-800",
      origin: "Guangzhou, China",
      destination: "Lagos, Nigeria",
      date: "Mar 10, 2024",
      estimatedDelivery: "Apr 15, 2024",
    },
    {
      id: "TRK987654321",
      type: "Import by Air",
      status: "Processing",
      statusColor: "bg-yellow-100 text-yellow-800",
      origin: "New York, USA",
      destination: "Lagos, Nigeria",
      date: "Mar 18, 2024",
      estimatedDelivery: "Apr 2, 2024",
    },
  ]

  const completedShipments = [
    {
      id: "TRK567891234",
      type: "Export by Sea",
      status: "Delivered",
      statusColor: "bg-green-100 text-green-800",
      origin: "Lagos, Nigeria",
      destination: "Rotterdam, Netherlands",
      date: "Jan 5, 2024",
      deliveryDate: "Feb 28, 2024",
    },
    {
      id: "TRK456789123",
      type: "Import by Sea",
      status: "Delivered",
      statusColor: "bg-green-100 text-green-800",
      origin: "Dubai, UAE",
      destination: "Lagos, Nigeria",
      date: "Dec 10, 2023",
      deliveryDate: "Jan 25, 2024",
    },
    {
      id: "TRK345678912",
      type: "China Import",
      status: "Delivered",
      statusColor: "bg-green-100 text-green-800",
      origin: "Shenzhen, China",
      destination: "Lagos, Nigeria",
      date: "Nov 15, 2023",
      deliveryDate: "Jan 5, 2024",
    },
  ]

  // Filter shipments based on search query
  const filteredActiveShipments = activeShipments.filter(
    (shipment) =>
      shipment.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shipment.type.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const filteredCompletedShipments = completedShipments.filter(
    (shipment) =>
      shipment.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shipment.type.toLowerCase().includes(searchQuery.toLowerCase()),
  )

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
          {filteredActiveShipments.length > 0 ? (
            <div className="space-y-4">
              {filteredActiveShipments.map((shipment) => (
                <Link href={`/track-shipment?id=${shipment.id}`} key={shipment.id}>
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-bold">{shipment.id}</h3>
                        <p className="text-sm text-gray-500">{shipment.type}</p>
                      </div>
                      <span className={`${shipment.statusColor} text-xs px-2 py-1 rounded-full`}>
                        {shipment.status}
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
                        <p className="font-medium">{shipment.origin}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Destination</p>
                        <p className="font-medium">{shipment.destination}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Date</p>
                        <p className="font-medium">{shipment.date}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Est. Delivery</p>
                        <p className="font-medium">{shipment.estimatedDelivery}</p>
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
              <Link href="/book-shipment">
                <Button className="bg-primary text-white">Book a Shipment</Button>
              </Link>
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          {filteredCompletedShipments.length > 0 ? (
            <div className="space-y-4">
              {filteredCompletedShipments.map((shipment) => (
                <Link href={`/track-shipment?id=${shipment.id}`} key={shipment.id}>
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-bold">{shipment.id}</h3>
                        <p className="text-sm text-gray-500">{shipment.type}</p>
                      </div>
                      <span className={`${shipment.statusColor} text-xs px-2 py-1 rounded-full`}>
                        {shipment.status}
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
                        <p className="font-medium">{shipment.origin}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Destination</p>
                        <p className="font-medium">{shipment.destination}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Date</p>
                        <p className="font-medium">{shipment.date}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Delivery Date</p>
                        <p className="font-medium">{shipment.deliveryDate}</p>
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

