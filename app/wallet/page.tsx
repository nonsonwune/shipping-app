"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { 
  ArrowLeft, 
  Plus, 
  ArrowDownUp, 
  Clock, 
  CreditCard, 
  Gift,
  RefreshCw,
  ArrowRight 
} from "lucide-react"
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { FundWalletModal } from "@/components/fund-wallet-modal"
import { formatCurrency } from "@/lib/paystack"
import { useToast } from "@/components/ui/use-toast"

interface Transaction {
  id: string
  reference: string
  amount: number
  status: string
  transaction_type: string
  created_at: string
}

interface Wallet {
  balance: number
  currency: string
}

export default function WalletPage() {
  const [walletData, setWalletData] = useState<Wallet | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [pendingTransactions, setPendingTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [userEmail, setUserEmail] = useState("")
  const [isFundModalOpen, setIsFundModalOpen] = useState(false)
  const supabase = createClientComponentClient()
  const { toast } = useToast()

  useEffect(() => {
    async function fetchWalletData() {
      setIsLoading(true)
      try {
        // Get user session
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) {
          throw new Error("User not authenticated")
        }

        setUserEmail(session.user.email || "")

        // Fetch wallet data
        const { data: wallet, error: walletError } = await supabase
          .from("wallets")
          .select("*")
          .eq("user_id", session.user.id)
          .single()

        if (walletError && walletError.code !== "PGRST116") {
          console.error("Error fetching wallet:", walletError)
        }

        // Fetch transactions
        const { data: txData, error: txError } = await supabase
          .from("transactions")
          .select("*")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false })

        if (txError) {
          console.error("Error fetching transactions:", txError)
        }

        setWalletData(wallet || { balance: 0, currency: "NGN" })
        
        if (txData) {
          setTransactions(txData.filter(tx => tx.status === "completed"))
          setPendingTransactions(txData.filter(tx => tx.status === "pending"))
        }
      } catch (error) {
        console.error("Error in wallet data fetch:", error)
        toast({
          title: "Error",
          description: "Failed to load wallet data. Please try again.",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchWalletData()
  }, [supabase, toast])

  const refreshData = () => {
    setIsLoading(true)
    // Re-fetch data
    setTimeout(() => {
      window.location.reload()
    }, 500)
  }

  // Format transaction date
  const formatTransactionDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  // Get transaction icon based on type
  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "wallet_funding":
        return <Plus className="w-4 h-4 text-green-500" />
      case "payment":
        return <ArrowDownUp className="w-4 h-4 text-red-500" />
      case "transfer":
        return <ArrowRight className="w-4 h-4 text-blue-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  // Get transaction badge color based on type
  const getTransactionBadgeClass = (type: string) => {
    switch (type) {
      case "wallet_funding":
        return "bg-green-100 text-green-800"
      case "payment":
        return "bg-red-100 text-red-800"
      case "transfer":
        return "bg-blue-100 text-blue-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <div className="p-4 pb-20">
      <div className="flex items-center mb-6">
        <Link href="/" className="mr-4">
          <ArrowLeft className="w-6 h-6 text-gray-800" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-800">Wallet</h1>
        
        {!isLoading && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="ml-auto" 
            onClick={refreshData}
          >
            <RefreshCw className="w-5 h-5 text-gray-600" />
          </Button>
        )}
      </div>

      <div className="bg-blue-600 text-white rounded-xl p-6 mb-6">
        <p className="text-sm mb-1 text-white">Available Balance</p>
        <h2 className="text-3xl font-bold mb-4 text-white">
          {isLoading ? "Loading..." : formatCurrency(walletData?.balance || 0, walletData?.currency || "NGN")}
        </h2>
        <div className="flex gap-3">
          <Button 
            className="bg-white text-blue-600 hover:bg-white/90 flex-1 border-0"
            onClick={() => setIsFundModalOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2 text-blue-600" />
            Fund
          </Button>
          <Button className="bg-blue-700 text-white hover:bg-blue-800 flex-1 border-0">
            <ArrowDownUp className="w-4 h-4 mr-2 text-white" />
            Transfer
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <Link href="/payment-methods" className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex flex-col items-center">
            <CreditCard className="w-8 h-8 text-blue-600 mb-2" />
            <span className="text-sm font-medium text-gray-800">Payment Methods</span>
          </div>
        </Link>
        <Link href="#" className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex flex-col items-center">
            <Clock className="w-8 h-8 text-blue-600 mb-2" />
            <span className="text-sm font-medium text-gray-800">Transaction History</span>
          </div>
        </Link>
      </div>

      <Tabs defaultValue="transactions" className="mb-6">
        <TabsList className="grid w-full grid-cols-2 bg-gray-100">
          <TabsTrigger value="transactions" className="text-gray-800 data-[state=active]:bg-white">
            Transactions
          </TabsTrigger>
          <TabsTrigger value="pending" className="text-gray-800 data-[state=active]:bg-white">
            Pending
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="transactions" className="mt-4">
          {isLoading ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <p className="text-gray-500">Loading transactions...</p>
            </div>
          ) : transactions.length > 0 ? (
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div key={tx.id} className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center mr-3">
                        {getTransactionIcon(tx.transaction_type)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800 capitalize">
                          {tx.transaction_type.replace('_', ' ')}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatTransactionDate(tx.created_at)} • {tx.reference ? tx.reference.slice(0, 12) + '...' : 'No reference'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${tx.transaction_type === "payment" ? "text-red-600" : "text-green-600"}`}>
                        {tx.transaction_type === "payment" ? "-" : "+"}
                        {formatCurrency(tx.amount, "NGN")}
                      </p>
                      <span className={`text-xs px-2 py-1 rounded-full ${getTransactionBadgeClass(tx.transaction_type)}`}>
                        {tx.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <p className="text-gray-700 mb-2">No transactions yet</p>
              <p className="text-sm text-gray-500">Your transaction history will appear here</p>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="pending" className="mt-4">
          {isLoading ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <p className="text-gray-500">Loading pending transactions...</p>
            </div>
          ) : pendingTransactions.length > 0 ? (
            <div className="space-y-3">
              {pendingTransactions.map((tx) => (
                <div key={tx.id} className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center mr-3">
                        <Clock className="w-4 h-4 text-yellow-500" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-800 capitalize">
                          {tx.transaction_type.replace('_', ' ')}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatTransactionDate(tx.created_at)} • {tx.reference ? tx.reference.slice(0, 12) + '...' : 'No reference'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-yellow-600">
                        {tx.transaction_type === "payment" ? "-" : "+"}
                        {formatCurrency(tx.amount, "NGN")}
                      </p>
                      <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-800">
                        {tx.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <p className="text-gray-700 mb-2">No pending transactions</p>
              <p className="text-sm text-gray-500">Your pending transactions will appear here</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
        <h3 className="font-medium mb-2 text-gray-800">Refer & Earn</h3>
        <p className="text-sm text-gray-600 mb-3">
          Invite friends to join and earn ₦1,000 when they make their first shipment
        </p>
        <Link href="/referrals">
          <Button className="w-full bg-blue-600 text-white hover:bg-blue-700">
            <Gift className="w-4 h-4 mr-2" />
            Invite Friends
          </Button>
        </Link>
      </div>
      
      {/* Fund Wallet Modal */}
      <FundWalletModal
        open={isFundModalOpen}
        onOpenChange={setIsFundModalOpen}
        userEmail={userEmail}
        onSuccess={refreshData}
      />
    </div>
  )
}
