"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import dynamic from 'next/dynamic'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { getPaystackPublicKey } from "@/lib/paystack"
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

// Dynamically import PaystackButton with SSR disabled
const PaystackButton = dynamic(
  () => import('react-paystack').then((mod) => mod.PaystackButton),
  { ssr: false }
)

interface FundWalletModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userEmail: string
  onSuccess?: () => void
}

export function FundWalletModal({ 
  open, 
  onOpenChange, 
  userEmail, 
  onSuccess 
}: FundWalletModalProps) {
  const [amount, setAmount] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [directPayment, setDirectPayment] = useState(false)
  const [reference, setReference] = useState("")
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClientComponentClient()

  // Predefined amounts
  const predefinedAmounts = [1000, 5000, 10000, 20000]

  // Get the session token when component mounts and when the modal opens
  useEffect(() => {
    const getSession = async () => {
      try {
        setSessionError(null)
        console.log("Getting session for payment...")
        
        const { data, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error("Error retrieving session:", error.message)
          setSessionError(error.message)
          return
        }
        
        if (data.session) {
          console.log("Session found for payment:", {
            hasToken: !!data.session.access_token,
            tokenLength: data.session.access_token?.length || 0,
            userId: data.session.user.id
          })
          setSessionToken(data.session.access_token)
        } else {
          console.log("No session found for payment")
          setSessionError("No active session found")
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error('Error getting session:', errorMessage)
        setSessionError(errorMessage)
      }
    }
    
    if (open) {
      getSession()
    }
  }, [supabase.auth, open])

  const handleSelectAmount = (value: number) => {
    setAmount(value.toString())
  }

  const handleInitializePayment = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid amount to fund your wallet",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      console.log("Making payment request with auth details:", {
        hasSessionToken: !!sessionToken,
        tokenLength: sessionToken?.length || 0,
        email: userEmail,
        amount: parseFloat(amount)
      })

      // Prepare headers
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      }
      
      if (sessionToken) {
        headers["Authorization"] = `Bearer ${sessionToken}`
      }

      // Make the API request
      const response = await fetch("/api/payment", {
        method: "POST",
        headers,
        credentials: "include", // Important: Include cookies for session auth
        body: JSON.stringify({
          amount: parseFloat(amount),
          email: userEmail,
        }),
      })

      console.log("Payment response status:", response.status)
      
      if (!response.ok) {
        // Try to get detailed error information
        const errorData = await response.json().catch(() => null)
        console.error("Payment API error:", {
          status: response.status,
          statusText: response.statusText,
          errorData
        })
        
        if (response.status === 401) {
          throw new Error("Authentication failed. Please log out and log in again.")
        } else {
          throw new Error(errorData?.error || `Server error: ${response.status}`)
        }
      }

      const result = await response.json()
      console.log("Payment initialized successfully:", result.data.reference)

      // If using Paystack inline
      if (directPayment) {
        setReference(result.data.reference)
      } else {
        // Redirect to Paystack checkout page
        window.location.href = result.data.authorization_url
      }
    } catch (error: any) {
      console.error("Payment initiation error:", error)
      toast({
        title: "Payment Error",
        description: error.message || "Failed to process payment. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Paystack inline config
  const paystackConfig = {
    reference: reference || "",
    email: userEmail,
    amount: parseFloat(amount) * 100, // Convert to kobo
    publicKey: getPaystackPublicKey(),
    text: "Pay Now",
    onSuccess: () => {
      toast({
        title: "Payment Successful",
        description: "Your wallet has been funded successfully",
      })
      onOpenChange(false)
      if (onSuccess) onSuccess()
      router.refresh()
    },
    onClose: () => {
      toast({
        title: "Payment Cancelled",
        description: "Your payment was cancelled",
        variant: "destructive",
      })
    },
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Fund Your Wallet</DialogTitle>
          <DialogDescription>
            Add funds to your wallet to pay for shipments and services.
          </DialogDescription>
        </DialogHeader>
        
        {sessionError && (
          <div className="bg-red-50 p-2 rounded text-sm text-red-600 mb-2">
            Authentication error: {sessionError}. Please try logging out and back in.
          </div>
        )}
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-2">
            {predefinedAmounts.map((preAmount) => (
              <Button
                key={preAmount}
                type="button"
                variant={amount === preAmount.toString() ? "default" : "outline"}
                onClick={() => handleSelectAmount(preAmount)}
                className="text-sm"
              >
                ₦{preAmount.toLocaleString()}
              </Button>
            ))}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (₦)</Label>
            <Input
              id="amount"
              type="number"
              min="100"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="text-xs text-gray-500">
              Minimum amount: ₦100
            </p>
          </div>
        </div>
        
        <DialogFooter>
          {directPayment && reference ? (
            <PaystackButton {...paystackConfig} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md" />
          ) : (
            <Button 
              onClick={handleInitializePayment} 
              disabled={isLoading || !amount || parseFloat(amount) <= 0 || !!sessionError}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? "Processing..." : "Proceed to Payment"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
