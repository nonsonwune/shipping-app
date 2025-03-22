"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  ArrowLeft, 
  Calculator, 
  ArrowRight, 
  Package, 
  BadgePercent,
  Truck
} from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

export default function QuotePage() {
  const [shippingType, setShippingType] = useState("standard")
  const [originCountry, setOriginCountry] = useState("china")
  const [destinationCountry, setDestinationCountry] = useState("nigeria")
  const [weight, setWeight] = useState("")
  const [calculatedQuote, setCalculatedQuote] = useState<any>(null)

  const handleCalculate = () => {
    // In a real app, this would call an API
    const baseRate = {
      standard: 12,
      express: 25,
      economy: 8
    }[shippingType]
    
    const parsedWeight = parseFloat(weight) || 0
    
    if (parsedWeight <= 0) {
      alert("Please enter a valid weight")
      return
    }

    const totalCost = parsedWeight * baseRate
    const estimatedDays = {
      standard: "7-14",
      express: "3-5",
      economy: "14-21"
    }[shippingType]

    setCalculatedQuote({
      shippingType,
      originCountry,
      destinationCountry,
      weight: parsedWeight,
      cost: totalCost,
      estimatedDays,
      currency: "USD"
    })
  }

  return (
    <div className="p-4 pb-20">
      <div className="flex items-center mb-6">
        <Link href="/" className="mr-4">
          <ArrowLeft className="w-6 h-6 text-gray-800" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-800">Get Shipping Quote</h1>
      </div>

      <Tabs defaultValue="standard" className="mb-6" onValueChange={setShippingType}>
        <TabsList className="grid w-full grid-cols-3 bg-gray-100">
          <TabsTrigger value="standard" className="text-gray-800 data-[state=active]:bg-white">
            Standard
          </TabsTrigger>
          <TabsTrigger value="express" className="text-gray-800 data-[state=active]:bg-white">
            Express
          </TabsTrigger>
          <TabsTrigger value="economy" className="text-gray-800 data-[state=active]:bg-white">
            Economy
          </TabsTrigger>
        </TabsList>
        <TabsContent value="standard" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Standard Shipping</CardTitle>
              <CardDescription>
                Balanced speed and cost, ideal for most shipments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm space-y-2">
                <div className="flex items-center">
                  <Truck className="w-4 h-4 mr-2 text-blue-600" />
                  <span>7-14 days typical delivery time</span>
                </div>
                <div className="flex items-center">
                  <Package className="w-4 h-4 mr-2 text-blue-600" />
                  <span>Full tracking and insurance included</span>
                </div>
                <div className="flex items-center">
                  <BadgePercent className="w-4 h-4 mr-2 text-blue-600" />
                  <span>Best value for normal shipping needs</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="express" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Express Shipping</CardTitle>
              <CardDescription>
                Fastest delivery option for urgent shipments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm space-y-2">
                <div className="flex items-center">
                  <Truck className="w-4 h-4 mr-2 text-blue-600" />
                  <span>3-5 days typical delivery time</span>
                </div>
                <div className="flex items-center">
                  <Package className="w-4 h-4 mr-2 text-blue-600" />
                  <span>Priority handling and premium tracking</span>
                </div>
                <div className="flex items-center">
                  <BadgePercent className="w-4 h-4 mr-2 text-blue-600" />
                  <span>Best option for time-sensitive items</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="economy" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Economy Shipping</CardTitle>
              <CardDescription>
                Most affordable option for non-urgent shipments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm space-y-2">
                <div className="flex items-center">
                  <Truck className="w-4 h-4 mr-2 text-blue-600" />
                  <span>14-21 days typical delivery time</span>
                </div>
                <div className="flex items-center">
                  <Package className="w-4 h-4 mr-2 text-blue-600" />
                  <span>Standard tracking included</span>
                </div>
                <div className="flex items-center">
                  <BadgePercent className="w-4 h-4 mr-2 text-blue-600" />
                  <span>Budget-friendly for non-urgent shipments</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Shipping Details</CardTitle>
          <CardDescription>
            Enter your shipment details to get a quote
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <Label htmlFor="origin">Origin</Label>
              <Select value={originCountry} onValueChange={setOriginCountry}>
                <SelectTrigger id="origin">
                  <SelectValue placeholder="Select origin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="china">China</SelectItem>
                  <SelectItem value="usa">USA</SelectItem>
                  <SelectItem value="uk">UK</SelectItem>
                  <SelectItem value="eu">Europe</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="destination">Destination</Label>
              <Select value={destinationCountry} onValueChange={setDestinationCountry}>
                <SelectTrigger id="destination">
                  <SelectValue placeholder="Select destination" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nigeria">Nigeria</SelectItem>
                  <SelectItem value="ghana">Ghana</SelectItem>
                  <SelectItem value="kenya">Kenya</SelectItem>
                  <SelectItem value="southafrica">South Africa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mb-4">
            <Label htmlFor="weight">Package Weight (kg)</Label>
            <Input
              type="number"
              id="weight"
              placeholder="Enter weight in kg"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              min="0.1"
              step="0.1"
            />
          </div>

          <Button 
            onClick={handleCalculate} 
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            <Calculator className="w-4 h-4 mr-2" />
            Calculate Quote
          </Button>
        </CardContent>
      </Card>

      {calculatedQuote && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle>Your Shipping Quote</CardTitle>
            <CardDescription>
              Based on your shipping details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="text-3xl font-bold text-blue-700 mb-1">
                ${calculatedQuote.cost.toFixed(2)} {calculatedQuote.currency}
              </div>
              <div className="text-sm text-gray-600">
                Estimated delivery time: {calculatedQuote.estimatedDays} days
              </div>
            </div>

            <div className="bg-white rounded-lg p-3 space-y-2 text-sm border border-blue-100">
              <div className="grid grid-cols-2">
                <span className="text-gray-600">Shipping Method:</span>
                <span className="font-medium text-right capitalize">{calculatedQuote.shippingType}</span>
              </div>
              <div className="grid grid-cols-2">
                <span className="text-gray-600">Origin:</span>
                <span className="font-medium text-right capitalize">{calculatedQuote.originCountry}</span>
              </div>
              <div className="grid grid-cols-2">
                <span className="text-gray-600">Destination:</span>
                <span className="font-medium text-right capitalize">{calculatedQuote.destinationCountry}</span>
              </div>
              <div className="grid grid-cols-2">
                <span className="text-gray-600">Weight:</span>
                <span className="font-medium text-right">{calculatedQuote.weight} kg</span>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full bg-blue-600 hover:bg-blue-700">
              Proceed to Book Shipment
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}
