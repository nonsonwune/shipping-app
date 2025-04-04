"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, CreditCard, AlertCircle } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { createClient } from '@/lib/supabase/client'
import { generateTransactionReference, formatCurrency } from "@/lib/paystack"

export default function FundWalletPage() {
  const [amount, setAmount] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [userEmail, setUserEmail] = useState("")
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  // Predefined amounts
  const predefinedAmounts = [1000, 5000, 10000, 20000]

  useEffect(() => {
    async function fetchUserData() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) {
          toast({
            title: "Authentication required",
            description: "Please sign in to fund your wallet",
            variant: "destructive",
          })
          router.push("/sign-in")
          return
        }

        setUserEmail(session.user.email || "")
      } catch (error) {
        console.error("Error fetching user data:", error)
      }
    }

    fetchUserData()
  }, [supabase, router, toast])

  const handleSelectAmount = (value: number) => {
    setAmount(value.toString())
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
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
      const response = await fetch("/api/payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: parseFloat(amount),
          email: userEmail,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to initialize payment")
      }

      // Redirect to Paystack checkout page
      window.location.href = result.data.authorization_url
    } catch (error: any) {
      toast({
        title: "Payment Error",
        description: error.message || "Failed to process payment. Please try again.",
        variant: "destructive",
      })
      setIsLoading(false)
    }
  }

  return (
    <div className="container max-w-md mx-auto p-6">
      <Link href="/wallet" className="inline-flex items-center mb-6 text-blue-600">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Wallet
      </Link>
      
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Fund Your Wallet</h1>
          <p className="text-gray-600 mt-1">
            Add funds to your wallet to pay for shipments and services
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (₦)</Label>
            <Input
              id="amount"
              type="number"
              min="100"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="text-lg"
              required
            />
            <p className="text-xs text-gray-500">Minimum amount: ₦100</p>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            {predefinedAmounts.map((preAmount) => (
              <Button
                key={preAmount}
                type="button"
                variant={amount === preAmount.toString() ? "default" : "outline"}
                onClick={() => handleSelectAmount(preAmount)}
              >
                ₦{preAmount.toLocaleString()}
              </Button>
            ))}
          </div>
          
          <div className="bg-blue-50 p-4 rounded-lg flex items-start space-x-3">
            <CreditCard className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-800">Secure Payment</p>
              <p className="text-xs text-gray-600">
                Your payment is securely processed by Paystack
              </p>
            </div>
          </div>
          
          {parseFloat(amount) > 0 && (
            <div className="border-t border-gray-200 pt-4">
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Amount:</span>
                <span className="font-medium">{formatCurrency(parseFloat(amount), "NGN")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Processing Fee:</span>
                <span className="font-medium">₦0.00</span>
              </div>
              <div className="flex justify-between mt-2 pt-2 border-t border-gray-200">
                <span className="font-bold">Total:</span>
                <span className="font-bold">{formatCurrency(parseFloat(amount), "NGN")}</span>
              </div>
            </div>
          )}
          
          <Button 
            type="submit" 
            className="w-full bg-blue-600 hover:bg-blue-700 py-6"
            disabled={isLoading || !amount || parseFloat(amount) <= 0}
          >
            {isLoading ? "Processing..." : "Proceed to Payment"}
          </Button>
        </form>
      </div>
      
      <div className="mt-6 bg-yellow-50 rounded-lg p-4 border border-yellow-100">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-gray-800">Important Note</p>
            <p className="text-xs text-gray-600">
              After successful payment, your wallet will be credited automatically. 
              If you encounter any issues, please contact support.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
