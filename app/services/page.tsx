"use client"

import Link from "next/link"
import Image from "next/image"
import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { supabase } from "@/lib/supabase"
import { Wallet, Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { ImageUpload } from "@/components/ui/image-upload"

// Content component that uses useSearchParams
function ServicesContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const type = searchParams.get("type") || "import"
  const [selectedService, setSelectedService] = useState<string | null>(null)
  const [step, setStep] = useState<number>(1)
  const [walletBalance, setWalletBalance] = useState<number>(0)
  const [userId, setUserId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    origin: "",
    destination: "",
    weight: "",
    dimensions: "",
    description: "",
    recipientName: "",
    recipientPhone: "",
    deliveryAddress: "",
    deliveryInstructions: "",
    serviceType: type === "import" ? "import-sea" : "export-sea",
    packageImages: [] as string[] // Array to store uploaded image URLs
  })
  const [paymentMethod, setPaymentMethod] = useState<string>("wallet")
  const [pricing, setPricing] = useState({
    basePrice: 0,
    tax: 0,
    insurance: 0,
    total: 0
  })
  const [isRedirecting, setIsRedirecting] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    async function getWalletBalance() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
          router.push("/auth/sign-in")
          return
        }

        // Store the user ID for later use
        setUserId(session.user.id)

        // Fetch wallet balance from the wallets table
        const { data: walletData, error: walletError } = await supabase
          .from("wallets")
          .select("balance")
          .eq("user_id", session.user.id)
          .maybeSingle()

        if (walletData && walletData.balance !== undefined) {
          console.log("Wallet data retrieved:", walletData)
          setWalletBalance(walletData.balance)
        } else {
          console.log("No wallet found, using 0 balance")
          setWalletBalance(0)
        }
        
        if (walletError) {
          console.error("Error fetching wallet balance:", walletError)
        }
      } catch (error) {
        console.error("Error fetching wallet balance:", error)
      }
    }

    getWalletBalance()
  }, [router])

  // Calculate pricing whenever service type or weight changes
  useEffect(() => {
    if (!formData.weight) return

    const weight = parseFloat(formData.weight)
    let basePrice = 0
    
    if (formData.serviceType === "import-sea") {
      basePrice = weight * 1500
    } else if (formData.serviceType === "import-air") {
      basePrice = weight * 2500
    } else if (formData.serviceType === "export-sea") {
      basePrice = weight * 2000
    } else if (formData.serviceType === "export-documents") {
      basePrice = weight * 1000
    } else {
      basePrice = weight * 1200
    }

    const tax = basePrice * 0.075 // 7.5% VAT
    const insurance = basePrice * 0.05 // 5% insurance
    const total = basePrice + tax + insurance

    setPricing({
      basePrice: Math.round(basePrice),
      tax: Math.round(tax),
      insurance: Math.round(insurance),
      total: Math.round(total)
    })
  }, [formData.serviceType, formData.weight])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleServiceTypeChange = (value: string) => {
    setFormData(prev => ({ ...prev, serviceType: value }))
  }

  const handlePaymentMethodChange = (value: string) => {
    setPaymentMethod(value)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (step < 3) {
      setStep(step + 1)
      return
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.push("/auth/sign-in")
        return
      }

      console.log("Current user ID:", session.user.id)

      // Try to fetch profile, but continue even if it doesn't exist
      try {
        const { data: userExists, error: userCheckError } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", session.user.id)
          .single()
          
        if (userCheckError) {
          console.log("User profile check:", userCheckError)
          // Continue anyway - don't block the flow
        }
      } catch (e) {
        console.error("Error checking user profile:", e)
        // Continue anyway - don't block the flow
      }

      // Check if using wallet and has enough balance
      if (paymentMethod === "wallet" && walletBalance < pricing.total) {
        alert("Insufficient wallet balance. Please fund your wallet or choose another payment method.")
        return
      }

      // Create a minimal version of the shipment to avoid foreign key issues
      const { data: shipment, error: shipmentError } = await supabase
        .from("shipments")
        .insert({
          // Required fields only
          tracking_number: `SHP${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 1000)}`,
          // Include all these fields, but as null/default where possible
          user_id: null, // This avoids the foreign key constraint
          company_id: null,
          service_id: null,
          origin_address_id: null,
          destination_address_id: null,
          status: "pending",
          // Store details in text fields
          special_instructions: `Service: ${formData.serviceType}
Origin: ${formData.origin}
Destination: ${formData.destination}
User Email: ${session?.user?.email || "Unknown"}
Additional Instructions: ${formData.deliveryInstructions || "None"}`,
          delivery_address: formData.deliveryAddress,
          recipient_phone: formData.recipientPhone,
          // Package details
          total_weight: parseFloat(formData.weight),
          weight_unit: "kg",
          dimensions: JSON.stringify({
            length: formData.dimensions ? formData.dimensions.split("x")[0] : "0",
            width: formData.dimensions ? formData.dimensions.split("x")[1] : "0",
            height: formData.dimensions ? formData.dimensions.split("x")[2] : "0"
          }),
          description: formData.description || "",
          // Payment details
          amount: pricing.total,
          currency: "NGN",
          // Package images
          metadata: {
            packageImages: formData.packageImages
          }
        })
        .select()

      if (shipmentError) {
        console.error("Error creating shipment:", shipmentError)
        alert("Failed to create shipment. Please try again.")
        return
      }

      // If using wallet, deduct the amount
      if (paymentMethod === "wallet") {
        // First update the wallets table with the new wallet balance
        const { error: walletError } = await supabase
          .from("wallets")
          .update({
            balance: walletBalance - pricing.total
          })
          .eq("user_id", session.user.id)

        if (walletError) {
          console.error("Error deducting from wallet:", walletError)
          alert("Failed to process payment. Please try again.")
          return
        }
      }

      // If booking is successful, redirect to home page
      if (shipment) {
        setIsRedirecting(true)
        toast({
          title: "Success",
          description: "Shipment booked successfully!",
          variant: "default"
        })
        
        // Store the shipment tracking number in localStorage for reference
        if (typeof window !== "undefined") {
          localStorage.setItem("lastBookingSuccess", "true")
          localStorage.setItem("lastTrackingNumber", shipment[0]?.tracking_number || "")
        }
        
        // Redirect to home page after successful booking
        router.push("/")
        return
      }
    } catch (error) {
      console.error("Error processing shipment:", error)
      alert("An error occurred. Please try again.")
    }
  }

  const handleServiceSelect = (service: string) => {
    setSelectedService(service)
    setFormData(prev => ({ ...prev, serviceType: service }))
    setStep(1)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-center py-4">Our Services</h1>
      
      {!selectedService ? (
        <div className="px-4">
          <h2 className="text-3xl font-bold mb-2">Our Services</h2>
          <p className="text-gray-600 mb-6">
            Learn how each service works and why we're the trusted choice for businesses and individuals.
          </p>

          <Button className="bg-[#FFD60A] text-blue-950 hover:bg-[#FFD60A]/90 mb-6 w-full">Contact Sales</Button>

          <div className="grid grid-cols-2 gap-2 mb-6">
            <Link href="/services?type=import">
              <Button variant={type === "import" ? "default" : "outline"} className={`w-full ${type === "import" ? "bg-blue-600 text-white" : "border-blue-600 text-blue-600"}`}>
                Import
              </Button>
            </Link>
            <Link href="/services?type=export">
              <Button variant={type === "export" ? "default" : "outline"} className={`w-full ${type === "export" ? "bg-blue-600 text-white" : "border-blue-600 text-blue-600"}`}>
                Export
              </Button>
            </Link>
          </div>

          {type === "import" ? (
            <>
              <div className="bg-slate-100 rounded-xl overflow-hidden mb-6">
                <div className="p-4">
                  <div className="aspect-[3/2] relative">
                    <img
                      src="/images/sea-import.png"
                      alt="Import by Sea"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="bg-white p-4 rounded-xl mt-4">
                    <h2 className="text-2xl font-bold mb-2">Import by Sea</h2>
                    <p className="text-gray-600 mb-4">
                      Ship heavy and oversized items via sea freight and receive your items in 8-12 weeks.
                    </p>
                    <div className="flex gap-3">
                      <Link href="/services/import-sea/features" className="w-full">
                        <Button variant="outline" className="w-full border-blue-600 text-blue-600 hover:bg-blue-50">
                          View Features
                        </Button>
                      </Link>
                      <Button className="w-full bg-blue-600 text-white hover:bg-blue-700" onClick={() => handleServiceSelect("import-sea")}>
                        Ship Now
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-100 rounded-xl overflow-hidden mb-6">
                <div className="p-4">
                  <div className="aspect-[3/2] relative">
                    <img
                      src="/images/dashboard.png"
                      alt="Import by Air"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="bg-white p-4 rounded-xl mt-4">
                    <h2 className="text-2xl font-bold mb-2">Import by Air</h2>
                    <p className="text-gray-600 mb-4">
                      Fast delivery for time-sensitive shipments. Get your items within 7-14 days.
                    </p>
                    <div className="flex gap-3">
                      <Link href="/services/import-air/features" className="w-full">
                        <Button variant="outline" className="w-full border-blue-600 text-blue-600 hover:bg-blue-50">
                          View Features
                        </Button>
                      </Link>
                      <Button className="w-full bg-blue-600 text-white hover:bg-blue-700" onClick={() => handleServiceSelect("import-air")}>
                        Ship Now
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="bg-slate-100 rounded-xl overflow-hidden mb-6">
                <div className="p-4">
                  <div className="aspect-[3/2] relative">
                    <img
                      src="/images/export-sea.png"
                      alt="Export by Sea"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="bg-white p-4 rounded-xl mt-4">
                    <h2 className="text-2xl font-bold mb-2">Export by Sea</h2>
                    <p className="text-gray-600 mb-4">
                      Send heavy and oversized items via sea freight, delivered in 8-12 weeks.
                    </p>
                    <div className="flex gap-3">
                      <Link href="/services/export-sea/features" className="w-full">
                        <Button variant="outline" className="w-full border-blue-600 text-blue-600 hover:bg-blue-50">
                          View Features
                        </Button>
                      </Link>
                      <Button className="w-full bg-blue-600 text-white hover:bg-blue-700" onClick={() => handleServiceSelect("export-sea")}>
                        Ship Now
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-100 rounded-xl overflow-hidden mb-6">
                <div className="p-4">
                  <div className="aspect-[3/2] relative">
                    <img
                      src="/images/services.png"
                      alt="Document Export"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="bg-white p-4 rounded-xl mt-4">
                    <h2 className="text-2xl font-bold mb-2">Document Export</h2>
                    <p className="text-gray-600 mb-4">
                      Send important documents internationally with tracking and guaranteed delivery.
                    </p>
                    <div className="flex gap-3">
                      <Link href="/services/export-documents/features" className="w-full">
                        <Button variant="outline" className="w-full border-blue-600 text-blue-600 hover:bg-blue-50">
                          View Features
                        </Button>
                      </Link>
                      <Button className="w-full bg-blue-600 text-white hover:bg-blue-700" onClick={() => handleServiceSelect("export-documents")}>
                        Ship Now
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <Card className="mb-24">
          <CardHeader>
            <CardTitle>Book Shipment</CardTitle>
            <CardDescription>
              {selectedService.includes("import") ? "Import" : "Export"} service via {selectedService.includes("sea") ? "sea" : selectedService.includes("air") ? "air" : "document courier"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={`step-${step}`} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="step-1" onClick={() => step > 1 && setStep(1)}>Shipment Details</TabsTrigger>
                <TabsTrigger value="step-2" onClick={() => step > 2 && setStep(2)}>Delivery Info</TabsTrigger>
                <TabsTrigger value="step-3">Payment</TabsTrigger>
              </TabsList>
              
              <form onSubmit={handleSubmit}>
                <TabsContent value="step-1">
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="origin">Origin</Label>
                        <Input
                          id="origin"
                          name="origin"
                          placeholder="Country/City of origin"
                          value={formData.origin}
                          onChange={handleChange}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="destination">Destination</Label>
                        <Input
                          id="destination"
                          name="destination"
                          placeholder="Country/City of destination"
                          value={formData.destination}
                          onChange={handleChange}
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="weight">Weight (kg)</Label>
                        <Input
                          id="weight"
                          name="weight"
                          type="number"
                          placeholder="Package weight in kg"
                          value={formData.weight}
                          onChange={handleChange}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dimensions">Dimensions (optional)</Label>
                        <Input
                          id="dimensions"
                          name="dimensions"
                          placeholder="L x W x H in cm"
                          value={formData.dimensions}
                          onChange={handleChange}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="description">Package Description</Label>
                      <Textarea
                        id="description"
                        name="description"
                        placeholder="Tell us about what you're shipping"
                        value={formData.description}
                        onChange={handleChange}
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <ImageUpload 
                        label="Package Image (Optional)"
                        userId={userId || undefined}
                        onImageUploaded={(imageUrl) => {
                          if (imageUrl) {
                            setFormData(prev => ({
                              ...prev,
                              packageImages: [...prev.packageImages, imageUrl]
                            }));
                          }
                        }}
                      />
                      {formData.packageImages.length > 0 && (
                        <p className="text-sm text-green-600">{formData.packageImages.length} image(s) uploaded</p>
                      )}
                    </div>
                    
                    <Button type="button" onClick={() => setStep(2)} className="w-full bg-blue-600 text-white hover:bg-blue-700">
                      Continue to Delivery Info
                    </Button>
                  </div>
                </TabsContent>
                
                <TabsContent value="step-2">
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="recipientName">Recipient's Name</Label>
                      <Input
                        id="recipientName"
                        name="recipientName"
                        placeholder="Full name"
                        value={formData.recipientName}
                        onChange={handleChange}
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="recipientPhone">Recipient's Phone</Label>
                      <Input
                        id="recipientPhone"
                        name="recipientPhone"
                        placeholder="Phone number"
                        value={formData.recipientPhone}
                        onChange={handleChange}
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="deliveryAddress">Delivery Address</Label>
                      <Textarea
                        id="deliveryAddress"
                        name="deliveryAddress"
                        placeholder="Full delivery address"
                        value={formData.deliveryAddress}
                        onChange={handleChange}
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="deliveryInstructions">Delivery Instructions (optional)</Label>
                      <Textarea
                        id="deliveryInstructions"
                        name="deliveryInstructions"
                        placeholder="Any special instructions for delivery"
                        value={formData.deliveryInstructions}
                        onChange={handleChange}
                      />
                    </div>
                    
                    <div className="flex justify-between">
                      <Button type="button" variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50" onClick={() => setStep(1)}>
                        Back
                      </Button>
                      <Button type="button" className="w-full bg-blue-600 text-white hover:bg-blue-700" onClick={() => setStep(3)}>
                        Continue to Payment
                      </Button>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="step-3">
                  <div className="space-y-4 py-4">
                    {/* Pricing Summary */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Pricing Summary</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex justify-between py-1">
                          <span>Base Price:</span>
                          <span>₦{pricing.basePrice.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span>VAT (7.5%):</span>
                          <span>₦{pricing.tax.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span>Insurance:</span>
                          <span>₦{pricing.insurance.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between py-2 border-t border-gray-200 mt-2 font-bold">
                          <span>Total:</span>
                          <span>₦{pricing.total.toLocaleString()}</span>
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* Wallet Balance */}
                    <div className="bg-slate-100 p-4 rounded-lg flex items-center justify-between">
                      <div className="flex items-center">
                        <Wallet className="h-5 w-5 text-blue-700 mr-2" />
                        <span>Wallet Balance:</span>
                      </div>
                      <span className="font-bold">₦{walletBalance.toLocaleString()}</span>
                    </div>
                    
                    {walletBalance < pricing.total && (
                      <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg text-yellow-800 text-sm">
                        Your wallet balance is insufficient. Please fund your wallet or select another payment method.
                      </div>
                    )}
                    
                    {/* Payment Method Selection */}
                    <div className="space-y-2">
                      <Label htmlFor="paymentMethod">Payment Method</Label>
                      <Select value={paymentMethod} onValueChange={handlePaymentMethodChange}>
                        <SelectTrigger id="paymentMethod">
                          <SelectValue placeholder="Select payment method" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="wallet">Wallet Balance</SelectItem>
                          <SelectItem value="card">Debit/Credit Card</SelectItem>
                          <SelectItem value="bank-transfer">Bank Transfer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {paymentMethod === "card" && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="cardNumber">Card Number</Label>
                          <Input id="cardNumber" placeholder="1234 5678 9012 3456" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="expiryDate">Expiry Date</Label>
                            <Input id="expiryDate" placeholder="MM/YY" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="cvv">CVV</Label>
                            <Input id="cvv" placeholder="123" />
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {paymentMethod === "bank-transfer" && (
                      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                        <p className="text-blue-800 font-medium">Bank Transfer Details</p>
                        <p className="text-sm text-blue-700 mt-2">
                          Bank: First Bank Nigeria<br />
                          Account Name: Shipping App Ltd<br />
                          Account Number: 123456789<br />
                          Reference: {`SHIP-${Date.now().toString().slice(-8)}`}
                        </p>
                      </div>
                    )}
                    
                    <div className="flex justify-between">
                      <Button type="button" variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50" onClick={() => setStep(2)}>
                        Back
                      </Button>
                      <Button 
                        type="submit" 
                        className="w-full bg-blue-600 text-white hover:bg-blue-700"
                        disabled={paymentMethod === "wallet" && walletBalance < pricing.total}
                      >
                        Complete Booking
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </form>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Main component with Suspense wrapper
export default function ServicesPage() {
  return (
    <Suspense fallback={
      <div className="container py-8 text-center">
        <div className="max-w-md mx-auto py-12">
          <Loader2 className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading services...</p>
        </div>
      </div>
    }>
      <ServicesContent />
    </Suspense>
  )
}
