"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CheckCircle, XCircle, Loader2, ArrowLeft } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { formatCurrency } from "@/lib/paystack"

// Wrap the component that uses useSearchParams with Suspense
function VerifyPaymentContent() {
  const [isVerifying, setIsVerifying] = useState(true)
  const [isSuccess, setIsSuccess] = useState(false)
  const [amount, setAmount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  
  // Get reference from URL
  const reference = searchParams.get("reference")

  useEffect(() => {
    async function verifyPayment() {
      if (!reference) {
        setError("Missing transaction reference")
        setIsVerifying(false)
        return
      }

      try {
        const response = await fetch(`/api/payment?reference=${reference}`, {
          method: "GET",
          credentials: "include", // Include credentials for authentication
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || "Failed to verify payment")
        }

        if (result.data.status === "success") {
          setIsSuccess(true)
          setAmount(result.data.transaction.amount)
          toast({
            title: "Payment Successful",
            description: "Your wallet has been funded successfully",
          })
        } else {
          setError("Payment verification failed. Please contact support.")
          toast({
            title: "Payment Failed",
            description: "Your payment could not be verified",
            variant: "destructive",
          })
        }
      } catch (error: any) {
        setError(error.message || "An error occurred during verification")
        toast({
          title: "Verification Error",
          description: error.message || "Failed to verify your payment",
          variant: "destructive",
        })
      } finally {
        setIsVerifying(false)
      }
    }

    verifyPayment()
  }, [reference, toast])

  return (
    <div className="container max-w-md mx-auto p-6">
      <Link href="/wallet" className="inline-flex items-center mb-6 text-blue-600">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Wallet
      </Link>
      
      <div className="bg-white rounded-xl shadow-md p-8 text-center">
        <h1 className="text-2xl font-bold mb-6">Payment Verification</h1>
        
        {isVerifying ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-12 w-12 text-blue-600 animate-spin mb-4" />
            <p className="text-gray-600">Verifying your payment...</p>
          </div>
        ) : isSuccess ? (
          <div className="flex flex-col items-center justify-center py-8">
            <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Payment Successful!</h2>
            {amount && (
              <p className="text-lg text-gray-600 mb-4">
                Your wallet has been funded with {formatCurrency(amount, "NGN")}
              </p>
            )}
            <p className="text-sm text-gray-500 mb-6">
              Reference: {reference}
            </p>
            <Button onClick={() => router.push("/wallet")} className="bg-blue-600 hover:bg-blue-700">
              Return to Wallet
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8">
            <XCircle className="h-16 w-16 text-red-500 mb-4" />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Payment Failed</h2>
            <p className="text-gray-600 mb-6">{error || "Something went wrong during verification"}</p>
            <div className="space-y-3">
              <Button onClick={() => router.push("/wallet/fund")} className="w-full bg-blue-600 hover:bg-blue-700">
                Try Again
              </Button>
              <Button 
                variant="outline" 
                onClick={() => router.push("/wallet")} 
                className="w-full"
              >
                Return to Wallet
              </Button>
            </div>
          </div>
        )}
      </div>
      
      <div className="mt-6 text-center text-sm text-gray-500">
        <p>Having issues? <Link href="/contact-us" className="text-blue-600 hover:underline">Contact Support</Link></p>
      </div>
    </div>
  )
}

// Main component with Suspense wrapper
export default function VerifyPaymentPage() {
  return (
    <Suspense fallback={
      <div className="container max-w-md mx-auto p-6 text-center">
        <div className="bg-white rounded-xl shadow-md p-8">
          <Loader2 className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading payment verification...</p>
        </div>
      </div>
    }>
      <VerifyPaymentContent />
    </Suspense>
  )
}
