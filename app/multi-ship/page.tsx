"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  PackageCheck, 
  Calculator
} from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
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

// Shipment item interface
interface ShipmentItem {
  id: string
  description: string
  weight: string
  quantity: string
  category: string
}

export default function MultiShipPage() {
  const [shipmentItems, setShipmentItems] = useState<ShipmentItem[]>([
    { id: "1", description: "", weight: "", quantity: "1", category: "" }
  ])
  const [originCountry, setOriginCountry] = useState("china")
  const [destinationCountry, setDestinationCountry] = useState("nigeria")

  // Add new shipment item
  const addShipmentItem = () => {
    const newItem = {
      id: Date.now().toString(),
      description: "",
      weight: "",
      quantity: "1",
      category: ""
    }
    setShipmentItems([...shipmentItems, newItem])
  }

  // Remove a shipment item
  const removeShipmentItem = (id: string) => {
    if (shipmentItems.length <= 1) return
    setShipmentItems(shipmentItems.filter(item => item.id !== id))
  }

  // Update a shipment item
  const updateShipmentItem = (id: string, field: keyof ShipmentItem, value: string) => {
    setShipmentItems(
      shipmentItems.map(item => 
        item.id === id ? { ...item, [field]: value } : item
      )
    )
  }

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log({ shipmentItems, originCountry, destinationCountry })
    // In a real app, you would submit this data to your backend
  }

  return (
    <div className="p-4 pb-20">
      <div className="flex items-center mb-6">
        <Link href="/" className="mr-4">
          <ArrowLeft className="w-6 h-6 text-gray-800" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-800">Multi-Ship</h1>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Create Multiple Shipments</CardTitle>
          <CardDescription>
            Add multiple items to ship in a single order
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-4 mb-6">
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

            <div className="space-y-4">
              {shipmentItems.map((item, index) => (
                <div key={item.id} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-medium">Item {index + 1}</h3>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => removeShipmentItem(item.id)} 
                      disabled={shipmentItems.length <= 1}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4 mb-4">
                    <div>
                      <Label htmlFor={`description-${item.id}`}>Description</Label>
                      <Textarea 
                        id={`description-${item.id}`}
                        placeholder="Item description"
                        value={item.description}
                        onChange={(e) => updateShipmentItem(item.id, "description", e.target.value)}
                        rows={2}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor={`category-${item.id}`}>Category</Label>
                      <Select 
                        value={item.category} 
                        onValueChange={(value) => updateShipmentItem(item.id, "category", value)}
                      >
                        <SelectTrigger id={`category-${item.id}`}>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="electronics">Electronics</SelectItem>
                          <SelectItem value="clothing">Clothing</SelectItem>
                          <SelectItem value="accessories">Accessories</SelectItem>
                          <SelectItem value="others">Others</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor={`weight-${item.id}`}>Weight (kg)</Label>
                      <Input 
                        id={`weight-${item.id}`}
                        type="number"
                        placeholder="0.0"
                        value={item.weight}
                        min="0.1"
                        step="0.1"
                        onChange={(e) => updateShipmentItem(item.id, "weight", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`quantity-${item.id}`}>Quantity</Label>
                      <Input 
                        id={`quantity-${item.id}`}
                        type="number"
                        placeholder="1"
                        value={item.quantity}
                        min="1"
                        onChange={(e) => updateShipmentItem(item.id, "quantity", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Button 
              type="button" 
              variant="outline" 
              className="mt-4 w-full border-dashed"
              onClick={addShipmentItem}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Another Item
            </Button>

            <div className="flex gap-4 mt-6">
              <Button type="button" variant="outline" className="flex-1">
                <Calculator className="w-4 h-4 mr-2" />
                Calculate Shipping
              </Button>
              <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700">
                <PackageCheck className="w-4 h-4 mr-2" />
                Ship Now
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Benefits of Multi-Ship</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-gray-600 list-disc pl-5">
            <li>Combine multiple items into a single shipment</li>
            <li>Save on shipping costs with bulk discounts</li>
            <li>Track all your items with a single tracking number</li>
            <li>Simplify customs clearance with consolidated documentation</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
