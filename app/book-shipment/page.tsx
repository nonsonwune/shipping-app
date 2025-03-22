"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function BookShipmentPage() {
  const [step, setStep] = useState(1)
  const [importType, setImportType] = useState("sea")
  const [exportType, setExportType] = useState("sea-export")
  const [activeTab, setActiveTab] = useState("import")

  return (
    <div className="p-4 pb-20">
      <div className="flex items-center mb-6">
        <Link href="/" className="mr-4">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-2xl font-bold">Book Shipment</h1>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center mb-6">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? "bg-primary text-white" : "bg-gray-200"}`}
        >
          1
        </div>
        <div className={`h-1 flex-1 ${step >= 2 ? "bg-primary" : "bg-gray-200"}`}></div>
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? "bg-primary text-white" : "bg-gray-200"}`}
        >
          2
        </div>
        <div className={`h-1 flex-1 ${step >= 3 ? "bg-primary" : "bg-gray-200"}`}></div>
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? "bg-primary text-white" : "bg-gray-200"}`}
        >
          3
        </div>
      </div>

      {step === 1 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Shipment Type</h2>

          <Tabs defaultValue="import" className="mb-6" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="import">Import</TabsTrigger>
              <TabsTrigger value="export">Export</TabsTrigger>
            </TabsList>
            <TabsContent value="import" className="mt-4">
              <RadioGroup value={importType} onValueChange={setImportType} className="space-y-4">
                <div className="border rounded-lg p-4 flex items-start space-x-3">
                  <RadioGroupItem value="sea" id="sea" className="mt-1" />
                  <div>
                    <Label htmlFor="sea" className="text-lg font-medium">
                      Import by Sea
                    </Label>
                    <p className="text-gray-600 text-sm">
                      Ship heavy and oversized items via sea freight. 8-12 weeks delivery.
                    </p>
                  </div>
                </div>

                <div className="border rounded-lg p-4 flex items-start space-x-3">
                  <RadioGroupItem value="air" id="air" className="mt-1" />
                  <div>
                    <Label htmlFor="air" className="text-lg font-medium">
                      Import by Air
                    </Label>
                    <p className="text-gray-600 text-sm">Faster shipping for urgent items. 1-2 weeks delivery.</p>
                  </div>
                </div>

                <div className="border rounded-lg p-4 flex items-start space-x-3">
                  <RadioGroupItem value="china" id="china" className="mt-1" />
                  <div>
                    <Label htmlFor="china" className="text-lg font-medium">
                      China Imports
                    </Label>
                    <p className="text-gray-600 text-sm">
                      Import from China's retailers and manufacturers. Delivered affordably.
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </TabsContent>
            <TabsContent value="export" className="mt-4">
              <RadioGroup value={exportType} onValueChange={setExportType} className="space-y-4">
                <div className="border rounded-lg p-4 flex items-start space-x-3">
                  <RadioGroupItem value="sea-export" id="sea-export" className="mt-1" />
                  <div>
                    <Label htmlFor="sea-export" className="text-lg font-medium">
                      Export by Sea
                    </Label>
                    <p className="text-gray-600 text-sm">
                      Send heavy and oversized items via sea freight. 8-12 weeks delivery.
                    </p>
                  </div>
                </div>

                <div className="border rounded-lg p-4 flex items-start space-x-3">
                  <RadioGroupItem value="air-export" id="air-export" className="mt-1" />
                  <div>
                    <Label htmlFor="air-export" className="text-lg font-medium">
                      Export by Air
                    </Label>
                    <p className="text-gray-600 text-sm">Quick and reliable air freight shipping options.</p>
                  </div>
                </div>
              </RadioGroup>
            </TabsContent>
          </Tabs>

          <Button className="w-full" onClick={() => setStep(2)}>
            Continue
          </Button>
        </div>
      )}

      {step === 2 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Shipment Details</h2>

          <div className="space-y-4 mb-6">
            <div>
              <Label htmlFor="item-description">Item Description</Label>
              <Input id="item-description" placeholder="e.g. Electronics, Clothing, etc." />
            </div>

            <div>
              <Label htmlFor="weight">Weight (kg)</Label>
              <Input id="weight" type="number" placeholder="Enter weight in kg" />
            </div>

            <div>
              <Label htmlFor="dimensions">Dimensions (cm)</Label>
              <div className="grid grid-cols-3 gap-2">
                <Input placeholder="Length" />
                <Input placeholder="Width" />
                <Input placeholder="Height" />
              </div>
            </div>

            <div>
              <Label htmlFor="value">Declared Value (₦)</Label>
              <Input id="value" type="number" placeholder="Enter item value" />
            </div>

            <div>
              <Label htmlFor="category">Category</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="electronics">Electronics</SelectItem>
                  <SelectItem value="clothing">Clothing</SelectItem>
                  <SelectItem value="furniture">Furniture</SelectItem>
                  <SelectItem value="auto-parts">Auto Parts</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="w-1/2" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button className="w-1/2" onClick={() => setStep(3)}>
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Shipping Information</h2>

          <div className="space-y-4 mb-6">
            <div>
              <Label>Origin Address</Label>
              <div className="border rounded-lg p-4 mb-2">
                <p className="font-medium">Select from saved addresses</p>
              </div>
              <Button variant="outline" className="w-full">
                Add New Address
              </Button>
            </div>

            <div>
              <Label>Destination Address</Label>
              <div className="border rounded-lg p-4 mb-2">
                <p className="font-medium">Select from saved addresses</p>
              </div>
              <Button variant="outline" className="w-full">
                Add New Address
              </Button>
            </div>

            <div>
              <Label htmlFor="shipping-method">Shipping Method</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select shipping method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="express">Express</SelectItem>
                  <SelectItem value="priority">Priority</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border rounded-lg p-4 mb-6">
            <div className="flex justify-between mb-2">
              <span>Shipping Cost</span>
              <span className="font-medium">₦25,000</span>
            </div>
            <div className="flex justify-between mb-2">
              <span>Insurance</span>
              <span className="font-medium">₦2,500</span>
            </div>
            <div className="flex justify-between mb-2">
              <span>Tax</span>
              <span className="font-medium">₦1,375</span>
            </div>
            <div className="border-t pt-2 flex justify-between font-bold">
              <span>Total</span>
              <span>₦28,875</span>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="w-1/2" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button className="w-1/2">Confirm & Pay</Button>
          </div>
        </div>
      )}
    </div>
  )
}

