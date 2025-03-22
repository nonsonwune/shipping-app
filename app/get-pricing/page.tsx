"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Calculator } from "lucide-react"

export default function GetPricingPage() {
  const [showResults, setShowResults] = useState(false)

  const handleCalculate = () => {
    setShowResults(true)
  }

  return (
    <div className="p-4 pb-20">
      <div className="flex items-center mb-6">
        <Link href="/" className="mr-4">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-2xl font-bold">Get Pricing</h1>
      </div>

      <div className="bg-blue-50 rounded-xl p-4 mb-6">
        <h2 className="font-bold mb-2">Shipping Rate Calculator</h2>
        <p className="text-sm">Get an estimate for your shipping costs based on weight, dimensions, and destination.</p>
      </div>

      <div className="space-y-4 mb-6">
        <div>
          <Label htmlFor="service-type">Service Type</Label>
          <Select>
            <SelectTrigger>
              <SelectValue placeholder="Select service type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="import-sea">Import by Sea</SelectItem>
              <SelectItem value="import-air">Import by Air</SelectItem>
              <SelectItem value="china-imports">China Imports</SelectItem>
              <SelectItem value="export-sea">Export by Sea</SelectItem>
              <SelectItem value="export-air">Export by Air</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="origin">Origin</Label>
          <Select>
            <SelectTrigger>
              <SelectValue placeholder="Select origin country" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="us">United States</SelectItem>
              <SelectItem value="cn">China</SelectItem>
              <SelectItem value="uk">United Kingdom</SelectItem>
              <SelectItem value="ae">United Arab Emirates</SelectItem>
              <SelectItem value="ng">Nigeria</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="destination">Destination</Label>
          <Select>
            <SelectTrigger>
              <SelectValue placeholder="Select destination country" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="us">United States</SelectItem>
              <SelectItem value="cn">China</SelectItem>
              <SelectItem value="uk">United Kingdom</SelectItem>
              <SelectItem value="ae">United Arab Emirates</SelectItem>
              <SelectItem value="ng">Nigeria</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="weight">Weight (kg)</Label>
          <Input id="weight" type="number" placeholder="Enter weight" />
        </div>

        <div>
          <Label>Dimensions (cm)</Label>
          <div className="grid grid-cols-3 gap-2">
            <Input placeholder="Length" />
            <Input placeholder="Width" />
            <Input placeholder="Height" />
          </div>
        </div>

        <div>
          <Label htmlFor="item-value">Item Value (₦)</Label>
          <Input id="item-value" type="number" placeholder="Enter value" />
        </div>

        <Button className="w-full bg-primary" onClick={handleCalculate}>
          <Calculator className="w-4 h-4 mr-2" />
          Calculate Shipping Cost
        </Button>
      </div>

      {showResults && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <h3 className="font-bold mb-3">Estimated Shipping Costs</h3>

          <div className="space-y-3 mb-4">
            <div className="flex justify-between">
              <span className="text-gray-600">Base Shipping Rate</span>
              <span className="font-medium">₦25,000</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">Weight Surcharge</span>
              <span className="font-medium">₦5,000</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">Insurance (optional)</span>
              <span className="font-medium">₦2,500</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">Customs Clearance</span>
              <span className="font-medium">₦3,000</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">VAT (7.5%)</span>
              <span className="font-medium">₦2,662.50</span>
            </div>

            <div className="border-t pt-2 flex justify-between font-bold">
              <span>Total Estimated Cost</span>
              <span>₦38,162.50</span>
            </div>
          </div>

          <p className="text-xs text-gray-500 mb-4">
            Note: This is an estimate only. Actual costs may vary based on final weight, dimensions, and customs duties.
          </p>

          <div className="flex gap-3">
            <Button variant="outline" className="w-1/2">
              Save Quote
            </Button>
            <Link href="/book-shipment" className="w-1/2">
              <Button className="w-full bg-primary">Book Shipment</Button>
            </Link>
          </div>
        </div>
      )}

      <div className="bg-blue-50 rounded-xl p-4">
        <h3 className="font-bold mb-2">Need a Custom Quote?</h3>
        <p className="text-sm text-gray-600 mb-3">
          For special items, bulk shipping, or commercial freight, contact our sales team for a personalized quote.
        </p>
        <Button variant="outline" className="w-full border-primary text-primary">
          Contact Sales
        </Button>
      </div>
    </div>
  )
}

