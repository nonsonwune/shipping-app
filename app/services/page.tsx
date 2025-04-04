"use client"

import { useState, useEffect, Suspense, useRef, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form"
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
import { createBrowserClient, safeQuerySingle } from "@/lib/supabase"
import { persistSession, recoverSession } from "@/lib/supabase/client"
import { Wallet, Loader2, Trash2, Plus } from "lucide-react"
import toast from "react-hot-toast"
import { ImageUpload } from "@/components/ui/image-upload"
import { Session } from "@supabase/supabase-js"; // Import Session type

// Debug utility function with proper typing
const debugLog = (...args: any[]): void => {
  console.log(...args);
}

// Content component that uses useSearchParams
function ServicesContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const type = searchParams?.get("type") || "import"
  const [selectedService, setSelectedService] = useState<string | null>(null)
  const [step, setStep] = useState<number>(1)
  const [walletBalance, setWalletBalance] = useState<number>(0)
  const [userId, setUserId] = useState<string | null>(null)
  
  // Define interface for a single item
  interface ShipmentItem {
    id: string; // Unique ID for React key prop
    description: string;
    weight: string;
    quantity: string;
    category: string;
    dimensions: string;
  }

  const [formData, setFormData] = useState({
    origin: "",
    destination: "",
    recipientName: "",
    recipientPhone: "",
    deliveryAddress: "",
    deliveryInstructions: "",
    serviceType: type === "import" ? "import-sea" : "export-sea",
    items: [
      {
        id: crypto.randomUUID(), // Generate unique ID for the first item
        description: "",
        weight: "",
        quantity: "1",
        category: "",
        dimensions: "" 
      }
    ] as ShipmentItem[]
  })
  const [paymentMethod, setPaymentMethod] = useState<string>("wallet")
  const [pricing, setPricing] = useState({
    basePrice: 0,
    tax: 0,
    insurance: 0,
    total: 0
  })
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Use useRef to maintain a single Supabase client instance
  const supabaseRef = useRef<any>(null);
  if (!supabaseRef.current) {
    supabaseRef.current = createBrowserClient();
    debugLog("[DEBUG] Creating Supabase client singleton for Services page");
  }
  const supabase = supabaseRef.current;

  // Add a ref to track if we've persisted the session
  const sessionPersistedRef = useRef(false);

  // Check for cookies
  useEffect(() => {
    // Define cookie check function locally
    const checkCookies = () => {
      debugLog("[DEBUG] Checking auth cookies:", document.cookie);
      const cookies = document.cookie.split(';').map(cookie => cookie.trim());
      debugLog(cookies.length ? "[DEBUG] Found auth cookies:" : "[DEBUG] Found auth cookies: None", cookies);
    };
    
    checkCookies();

    // Session persistence - only do this once when the page loads
    const persistSessionOnLoad = async () => {
      if (!sessionPersistedRef.current) {
        debugLog("[DEBUG] Persisting session on page load");
        const session = await persistSession();
        if (session) {
          debugLog("[DEBUG] Session persisted successfully");
          sessionPersistedRef.current = true;
        }
      }
    };
    
    persistSessionOnLoad();
  }, []);

  useEffect(() => {
    async function getWalletBalance() {
      try {
        debugLog("[DEBUG] Starting wallet balance check...");
        
        // Check cookies first
        const cookies = document.cookie.split(';').map(cookie => cookie.trim());
        debugLog("[DEBUG] Checking auth cookies:", document.cookie);
        debugLog(cookies.length ? "[DEBUG] Found auth cookies:" : "[DEBUG] Found auth cookies: None", cookies);
        
        // Get the session
        const { data: { session }, error: sessionError }: { 
          data: { session: Session | null }, 
          error: Error | null 
        } = await supabase.auth.getSession();
        
        if (sessionError) {
          debugLog("[DEBUG] Error retrieving session for wallet check:", sessionError.message);
          return;
        }
        
        if (!session) {
          debugLog("[DEBUG] No active session found during wallet check");
          setWalletBalance(0);
          return;
        }
        
        debugLog("[DEBUG] Found active session during wallet check:", session.user.id);
        debugLog("[DEBUG] Session expires in:", 
          Math.floor(((session.expires_at || 0) * 1000 - Date.now()) / 1000 / 60), "minutes");
        setUserId(session.user.id);
        
        // Make sure to persist the session when we detect it's valid
        if (!sessionPersistedRef.current) {
          await persistSession();
          sessionPersistedRef.current = true;
          debugLog("[DEBUG] Session persisted during wallet check");
        }
        
        debugLog("[DEBUG] Attempting to fetch wallet with user_id:", session.user.id);
        
        // Query wallet data
        const { data, error } = await supabase
          .from("wallets")
          .select("balance")
          .eq("user_id", session.user.id)
          .single();
        
        if (error) {
          debugLog("[DEBUG] Error fetching wallet data:", error.message, error.code);
          setWalletBalance(0);
          return;
        }
        
        debugLog("[DEBUG] Wallet query result:", data);
        
        // Important fix: Only log "No wallet found" if there's truly no data
        if (!data) {
          debugLog("[DEBUG] No wallet found, using 0 balance");
          setWalletBalance(0);
          return;
        }
        
        // Return the actual balance from the data
        setWalletBalance(data.balance || 0);
      } catch (error) {
        debugLog("[DEBUG] Unexpected error in fetchWalletBalance:", error);
        setWalletBalance(0);
      }
    }

    getWalletBalance()
    
    // Add periodic check to monitor session stability
    const sessionCheckInterval = setInterval(() => {
      if (!supabase) {
        debugLog("[DEBUG] Supabase client is null in session check interval");
        return;
      }
      
      supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
        debugLog("[DEBUG] Session check (interval):", session ? "Valid" : "None");
        if (session) {
          debugLog("[DEBUG] Session expires in:", 
            Math.floor(((session.expires_at || 0) * 1000 - Date.now()) / 1000 / 60), "minutes");
        
          // Check cookies as well
          const checkCookies = () => {
            debugLog("[DEBUG] Checking auth cookies:", document.cookie);
            const cookies = document.cookie.split(';').map(cookie => cookie.trim());
            debugLog(cookies.length ? "[DEBUG] Found auth cookies:" : "[DEBUG] Found auth cookies: None", cookies);
          };
          checkCookies();
        }
      });
    }, 30000); // Check every 30 seconds
    
    return () => {
      clearInterval(sessionCheckInterval)
    }
  }, [supabase])

  // --- Handler Functions for Items Array --- 
  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: crypto.randomUUID(), // Use crypto for better UUID generation
          description: "",
          weight: "",
          quantity: "1",
          category: "",
          dimensions: ""
        }
      ]
    }));
  };

  const removeItem = (idToRemove: string) => {
    // Prevent removing the last item
    if (formData.items.length <= 1) {
      toast("You must have at least one item.");
      return;
    }
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== idToRemove)
    }));
  };

  const updateItem = (idToUpdate: string, field: keyof ShipmentItem, value: string) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.id === idToUpdate ? { ...item, [field]: value } : item
      )
    }));
  };
  // --- End Handler Functions ---

  // Calculate pricing whenever service type or items change
  useEffect(() => {
    let calculatedBasePrice = 0;
    const taxRate = 0.075; // 7.5% VAT
    const insuranceRate = 0.05; // 5% insurance
    const serviceBaseRate = formData.serviceType.includes('air') ? 2500 : formData.serviceType.includes('sea') ? 1500 : 1200;

    // Iterate through each item to calculate base price
    formData.items.forEach(item => {
      const weight = parseFloat(item.weight) || 0; // Default to 0 if parsing fails
      const quantity = parseInt(item.quantity, 10) || 1; // Default to 1
      
      if (weight > 0 && quantity > 0) {
        calculatedBasePrice += weight * quantity * serviceBaseRate;
      }
    });

    // Calculate final pricing
    const tax = calculatedBasePrice * taxRate;
    const insurance = calculatedBasePrice * insuranceRate;
    const total = calculatedBasePrice + tax + insurance;

    // Update pricing state
    setPricing({
      basePrice: Math.round(calculatedBasePrice),
      tax: Math.round(tax),
      insurance: Math.round(insurance),
      total: Math.round(total)
    });
    
    console.log("Pricing updated:", { 
        items: formData.items, 
        calculatedTotal: Math.round(total) 
    });

  }, [formData.serviceType, formData.items]) // Depend on items array and serviceType

  // This generic handleChange only works for top-level fields now
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    if (name in formData && name !== 'items') {
      setFormData(prev => ({ ...prev, [name]: value }));
    } else {
       console.warn(`Attempted to handle change for unmanaged field or item: ${name}`);
    }
  }

  const handleServiceTypeChange = (value: string) => {
    setFormData(prev => ({ ...prev, serviceType: value }))
  }

  const handlePaymentMethodChange = (value: string) => {
    setPaymentMethod(value)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // --- Validation --- 
    // Basic validation for top-level fields
    if (!formData.origin || !formData.destination || !formData.recipientName || !formData.recipientPhone || !formData.deliveryAddress || !paymentMethod) {
      toast.error("Missing required shipment or recipient information.");
      setIsLoading(false);
      return;
    }
    
    // Validate each item
    let itemsValid = true;
    formData.items.forEach((item, index) => {
      if (!item.description || !item.weight || parseFloat(item.weight) <= 0 || !item.quantity || parseInt(item.quantity, 10) <= 0) {
        toast.error(`Please fill in description, weight (>0), and quantity (>0) for Item ${index + 1}.`);
        itemsValid = false;
      }
    });

    if (!itemsValid) {
        setIsLoading(false);
        return;
      }

    // Wallet balance check (already done in API, but good for frontend feedback)
      if (paymentMethod === "wallet" && walletBalance < pricing.total) {
      toast.error("Insufficient balance. Please fund your wallet or select another payment method.");
      setIsLoading(false);
      return;
    }
    // --- End Validation --- 

    // Prepare data for the API
    const apiData = {
        serviceType: formData.serviceType,
        origin: formData.origin,
        destination: formData.destination,
        recipientName: formData.recipientName,
        recipientPhone: formData.recipientPhone,
        deliveryAddress: formData.deliveryAddress,
        deliveryInstructions: formData.deliveryInstructions,
        paymentMethod: paymentMethod,
        // Convert weight/quantity to numbers for API
        items: formData.items.map(item => ({
            ...item,
            weight: parseFloat(item.weight) || 0,
            quantity: parseInt(item.quantity, 10) || 1
        }))
    };

    console.log("Submitting data to API:", JSON.stringify(apiData, null, 2));

    try {
        const response = await fetch('/api/shipments/create-with-items', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(apiData),
        });

        const result = await response.json();

        if (!response.ok) {
            // Handle specific errors from the API
            if (response.status === 400 && result.error === 'Insufficient wallet balance') {
                 toast.error("Insufficient wallet balance. Please fund your wallet.");
          } else {
                toast.error(`Error: ${result.error || 'Failed to book shipment.'}`);
            }
            throw new Error(result.error || `HTTP error ${response.status}`);
        }

        // --- Success Flow ---
        toast.success(result.message || "Shipment booked successfully!");
        
        // Store tracking number if available
        if (typeof window !== "undefined" && result.trackingNumber) {
            localStorage.setItem("lastBookingSuccess", "true");
            localStorage.setItem("lastTrackingNumber", result.trackingNumber);
        }
        
        // Handle potential warnings (like payment deduction issues)
        if (result.warning) {
            console.warn("Shipment booked with warning:", result.warning);
            // Optionally show a different message to the user
        }

        setIsRedirecting(true);
        // Refresh wallet balance potentially?
        // await getWalletBalance(); // Might cause race condition with redirect
        
        setTimeout(() => {
            router.push("/shipments"); // Redirect to shipments list
        }, 1500);

    } catch (error: any) {
        debugLog("[DEBUG] Error submitting shipment:", error);
        // Check if the error message indicates it was an HTTP error already handled
        // Or if it's a specific handled error like insufficient balance
        const isHandledError = 
            (error.message && error.message.includes('HTTP error')) ||
            (error.message && error.message.includes('Insufficient wallet balance')); 
            
        if (!isHandledError) {
             // If the error wasn't an HTTP error already toasted, show a generic message
             toast.error("An unexpected error occurred during submission.");
        }
        // If it was a handled error (like !response.ok), the specific toast was already shown.
    } finally {
       setIsLoading(false);
    }
  };

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

          <div className="flex justify-start gap-2 mb-6">
            <Link href="/services?type=import">
              <Button variant={type === "import" ? "default" : "outline"} className={`${type === "import" ? "bg-blue-600 text-white" : "border-blue-600 text-blue-600"}`}>
                Import
              </Button>
            </Link>
            <Link href="/services?type=export">
              <Button variant={type === "export" ? "default" : "outline"} className={`${type === "export" ? "bg-blue-600 text-white" : "border-blue-600 text-blue-600"}`}>
                Export
              </Button>
            </Link>
          </div>

          {/* --- Apply responsive layout WITHIN the conditional rendering --- */}
          {type === "import" ? (
            // ADD WRAPPER DIV for Import services
            <div className="flex flex-col md:flex-row gap-6 mb-6">
              {/* Import Sea Card - Add responsive width & Restore Original Content */}
              <div className="bg-slate-100 rounded-xl overflow-hidden w-full md:w-1/2">
                <div className="p-4">
                  <div className="aspect-[3/2] relative">
                     <img
                       src="/images/sea-import.png"
                       alt="Import by Sea"
                       className="w-full h-full object-cover rounded-md"
                     />
                  </div>
                  <div className="bg-white p-4 rounded-xl mt-4">
                    <h2 className="text-xl font-bold mb-2">Import by Sea</h2>
                    <p className="text-gray-600 mb-4 text-sm">
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

              {/* Import Air Card - Add responsive width & Restore Original Content */}
              <div className="bg-slate-100 rounded-xl overflow-hidden w-full md:w-1/2">
                 <div className="p-4">
                   <div className="aspect-[3/2] relative">
                     <img
                       src="/images/dashboard.png"
                       alt="Import by Air"
                       className="w-full h-full object-cover rounded-md"
                     />
                   </div>
                   <div className="bg-white p-4 rounded-xl mt-4">
                     <h2 className="text-xl font-bold mb-2">Import by Air</h2>
                     <p className="text-gray-600 mb-4 text-sm">
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
            </div> // Close Import flex container
          ) : (
            // ADD WRAPPER DIV for Export services
            <div className="flex flex-col md:flex-row gap-6 mb-6">
              {/* Export Sea Card - Add responsive width & Restore Original Content */}
              <div className="bg-slate-100 rounded-xl overflow-hidden w-full md:w-1/2">
                 <div className="p-4">
                   <div className="aspect-[3/2] relative">
                     <img
                       src="/images/export-sea.png"
                       alt="Export by Sea"
                       className="w-full h-full object-cover rounded-md"
                     />
                   </div>
                   <div className="bg-white p-4 rounded-xl mt-4">
                     <h2 className="text-xl font-bold mb-2">Export by Sea</h2>
                     <p className="text-gray-600 mb-4 text-sm">
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

              {/* Document Export Card - Add responsive width & Restore Original Content */}
              <div className="bg-slate-100 rounded-xl overflow-hidden w-full md:w-1/2">
                 <div className="p-4">
                   <div className="aspect-[3/2] relative">
                     <img
                       src="/images/services.png"
                       alt="Document Export"
                       className="w-full h-full object-cover rounded-md"
                     />
                   </div>
                   <div className="bg-white p-4 rounded-xl mt-4">
                     <h2 className="text-xl font-bold mb-2">Document Export</h2>
                     <p className="text-gray-600 mb-4 text-sm">
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
            </div> // Close Export flex container
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
                    
                    <Label className="font-semibold">Package Details</Label>
                    <div className="space-y-4">
                      {formData.items.map((item, index) => (
                        <div key={item.id} className="p-4 border border-gray-200 rounded-lg bg-gray-50/50 relative">
                          {formData.items.length > 1 && (
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="icon" 
                              className="absolute top-2 right-2 h-6 w-6" 
                              onClick={() => removeItem(item.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                              <span className="sr-only">Remove Item</span>
                            </Button>
                          )}
                          <h4 className="font-medium mb-3">Item {index + 1}</h4>
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <Label htmlFor={`item-desc-${item.id}`}>Description</Label>
                              <Textarea 
                                id={`item-desc-${item.id}`} 
                                placeholder="Detailed description of the item"
                                value={item.description}
                                onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                                required 
                                rows={2} 
                              />
                            </div>
                    <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <Label htmlFor={`item-weight-${item.id}`}>Weight (kg)</Label>
                        <Input
                                  id={`item-weight-${item.id}`} 
                          type="number"
                                  placeholder="e.g., 1.5" 
                                  value={item.weight}
                                  min="0.1" 
                                  step="0.1" 
                                  onChange={(e) => updateItem(item.id, 'weight', e.target.value)}
                          required
                        />
                      </div>
                              <div className="space-y-1">
                                <Label htmlFor={`item-quantity-${item.id}`}>Quantity</Label>
                        <Input
                                  id={`item-quantity-${item.id}`} 
                                  type="number" 
                                  placeholder="1" 
                                  value={item.quantity}
                                  min="1" 
                                  step="1" 
                                  onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                                  required 
                        />
                      </div>
                    </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <Label htmlFor={`item-category-${item.id}`}>Category (Optional)</Label>
                                <Input 
                                  id={`item-category-${item.id}`} 
                                  placeholder="e.g., Electronics, Clothing"
                                  value={item.category}
                                  onChange={(e) => updateItem(item.id, 'category', e.target.value)}
                      />
                    </div>
                              <div className="space-y-1">
                                <Label htmlFor={`item-dimensions-${item.id}`}>Dimensions (LxWxH cm, Optional)</Label>
                                <Input 
                                  id={`item-dimensions-${item.id}`} 
                                  placeholder="e.g., 30x20x10"
                                  value={item.dimensions}
                                  onChange={(e) => updateItem(item.id, 'dimensions', e.target.value)}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="w-full border-dashed mt-4"
                      onClick={addItem}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Another Item
                    </Button>
                    
                    <Button type="button" onClick={() => setStep(2)} className="w-full bg-blue-600 text-white hover:bg-blue-700 mt-4">
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
                    
                    <div className="mt-6">
                      <Button 
                        type="submit" 
                        className="w-full"
                        disabled={isLoading || isRedirecting}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          "Book Shipment"
                        )}
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
