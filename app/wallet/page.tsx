"use client"

import { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
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
import { createClient, getSession, recoverSession, persistSession } from "@/lib/supabase/client"
import { FundWalletModal } from "@/components/fund-wallet-modal"
import { formatCurrency } from "@/lib/paystack"
import { useToast } from "@/components/ui/use-toast"

interface Transaction {
  id: string
  reference: string
  amount: number
  status: string
  transaction_type?: string
  payment_method?: string
  type?: string
  description?: string
  created_at: string
}

interface Wallet {
  balance: number
  currency: string
}

// Wrapper component to handle search params with Suspense
function WalletContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isFundModalOpen, setIsFundModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSessionRecoveryAttempted, setIsSessionRecoveryAttempted] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const { toast } = useToast();

  // Add state for session tracking
  const [session, setSession] = useState<any>(null);

  // Handle status and session params from payment verification
  const status = searchParams?.get("status") || null;
  const message = searchParams?.get("message") || null;
  const sessionRecovery = searchParams?.get("session_recovery") || null;
  const sessionToken = searchParams?.get('session');

  // Check for session recovery from payment verification
  useEffect(() => {
    const attemptSessionRecovery = async () => {
      // Don't repeat recovery attempts
      if (isSessionRecoveryAttempted) return;
      
      console.log("DEBUG: Attempting session recovery on wallet page");
      setIsSessionRecoveryAttempted(true);
      
      try {
        // Use the standardized session check function
        const { session, error } = await getSession();
        
        if (session) {
          console.log("DEBUG: Active session recovered", session.user.id);
          
          // Refresh wallet data
          await fetchWalletData();
          
          // Show success toast if coming from payment
          if (status === 'success') {
            // Try to ensure session persistence
            await persistSession();

            toast({
              title: "Payment Successful",
              description: "Your wallet has been funded successfully.",
              variant: "default"
            });
            
            // Clean up URL
            router.replace('/wallet');
          }
          return;
        }
        
        // If we still don't have a session, try to recover
        if (status === 'success' || sessionRecovery === 'true') {
          console.log("DEBUG: Trying session recovery for payment completion");
          
          // Try to recover session using the standardized function
          const recoveredSession = await recoverSession();
          
          if (recoveredSession) {
            console.log("DEBUG: Session recovered after manual attempt");
            await fetchWalletData();
            return;
          }
          
          // If recovery failed, redirect to server-side recovery
          window.location.href = '/api/auth/session-recovery?redirect=/wallet';
          return;
        }
        
        console.log("DEBUG: Could not recover session");
      } catch (error) {
        console.error("Session recovery error:", error);
      }
    };

    // Try session recovery when page loads or when returning from payment
    if (status === 'success' || !isSessionRecoveryAttempted) {
      attemptSessionRecovery();
    }

    // Add mount/unmount logging
    console.log("WALLET PAGE: Mount");
    return () => {
      console.log("WALLET PAGE: Unmount");
    };
  }, [searchParams, isSessionRecoveryAttempted, status, toast, router]);

  // Effect to log auth state on change
  useEffect(() => {
    const checkSessionAndLog = async () => {
      const { session: currentSession } = await getSession();
      setSession(currentSession); // Update state
      console.log("WALLET PAGE: Auth State Check", {
        isAuthenticated: !!currentSession,
        userId: currentSession?.user?.id,
        cookies: document.cookie.split(';')
          .filter(c => c.includes('-auth-token'))
          .map(c => c.trim().substring(0, 30) + '...')
      });
    };
    checkSessionAndLog();
    
    // Set up listener for auth changes
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log("WALLET PAGE: Auth State Change Event", { 
        event: _event,
        isAuthenticated: !!session,
        userId: session?.user?.id
      });
      setSession(session);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Function to fetch wallet data
  const fetchWalletData = async () => {
    try {
      setIsLoading(true);
      
      // Use the standardized session check
      const { session, error } = await getSession();
      
      if (error || !session) {
        console.error("No authenticated session found");
        setIsLoading(false);
        return;
      }
      
      // Use the standardized client
      const supabase = createClient();
      
      // Save user email for payment integration
      setUserEmail(session.user.email || "");
      
      console.log("DEBUG: Fetching wallet data for user", session.user.id);
      
      // Use an upsert approach - create the wallet if it doesn't exist or return the existing one
      console.log("DEBUG: Calling get_or_create_wallet RPC function...");
      const { data: walletData, error: walletError } = await supabase
        .rpc('get_or_create_wallet', {
          user_id_param: session.user.id
        });
      
      if (walletError) {
        console.error("Error fetching/creating wallet:", walletError);
        setIsLoading(false);
        return;
      }
      
      console.log("DEBUG: get_or_create_wallet response:", walletData);
      
      // Set the wallet balance
      setBalance(walletData?.balance || 0);
      console.log("Wallet data retrieved successfully:", walletData);

      // Fetch transactions
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (transactionsError) {
        console.error("Error fetching transactions:", transactionsError);
      }

      // Update state with fetched data
      setTransactions(transactionsData || []);
      
      console.log("Wallet data fetched successfully", { 
        balance: walletData?.balance,
        transactionsCount: transactionsData?.length || 0
      });
    } catch (error) {
      console.error("Error in fetchWalletData:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Always fetch wallet data on component mount and when refreshed
  useEffect(() => {
    // Check if we have session and are not currently refreshing
    if (!isRefreshing) {
      fetchWalletData();
    }
    
    // Clean URL if it contains payment params
    if (status || message || sessionToken) {
      // Use Next.js router to replace the current URL without query params
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);
    }
  }, [isRefreshing, status, message, sessionToken]);

  // Function to refresh wallet data
  const refreshWalletData = () => {
    setIsRefreshing(true);
    fetchWalletData();
  };

  const handleFundWallet = () => {
    setIsFundModalOpen(true);
  };

  const onFundSuccess = () => {
    refreshWalletData();
  };

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
            onClick={refreshWalletData}
          >
            <RefreshCw className="w-5 h-5 text-gray-600" />
          </Button>
        )}
      </div>

      <div className="bg-blue-600 text-white rounded-xl p-6 mb-6">
        <p className="text-sm mb-1 text-white">Available Balance</p>
        <h2 className="text-3xl font-bold mb-4 text-white">
          {isLoading ? "Loading..." : formatCurrency(balance, "NGN")}
        </h2>
        <div className="flex gap-3">
          <Button 
            className="bg-white text-blue-600 hover:bg-white/90 flex-1 border-0"
            onClick={handleFundWallet}
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
                        {tx.type === "credit" || tx.transaction_type === "wallet_funding" ? (
                          <Plus className="w-4 h-4 text-green-500" />
                        ) : tx.type === "debit" || tx.transaction_type === "payment" ? (
                          <ArrowDownUp className="w-4 h-4 text-red-500" />
                        ) : tx.transaction_type === "transfer" ? (
                          <ArrowRight className="w-4 h-4 text-blue-500" />
                        ) : (
                          <Clock className="w-4 h-4 text-gray-500" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800 capitalize">
                          {tx.description || tx.transaction_type || tx.type || "Transaction"}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(tx.created_at).toLocaleDateString("en-NG", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })} • {tx.reference ? tx.reference.slice(0, 12) + '...' : 'No reference'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${tx.type === "credit" || tx.transaction_type === "wallet_funding" ? "text-green-600" : tx.type === "debit" || tx.transaction_type === "payment" ? "text-red-600" : tx.transaction_type === "transfer" ? "text-blue-600" : "text-gray-600"}`}>
                        {tx.type === "credit" || tx.transaction_type === "wallet_funding" ? "+" : "-"}
                        {formatCurrency(tx.amount, "NGN")}
                      </p>
                      <span className={`text-xs px-2 py-1 rounded-full ${tx.status === "completed" || tx.status === "success" || tx.status === "SUCCESS" ? "bg-green-100 text-green-800" : tx.status === "pending" || tx.status === "PENDING" || tx.status === "processing" ? "bg-yellow-100 text-yellow-800" : "bg-gray-100 text-gray-800"}`}>
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
          ) : transactions.length > 0 ? (
            <div className="space-y-3">
              {transactions.filter(tx => tx.status === "pending" || tx.status === "PENDING" || tx.status === "processing").map((tx) => (
                <div key={tx.id} className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center mr-3">
                        <Clock className="w-4 h-4 text-yellow-500" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-800 capitalize">
                          {tx.description || tx.transaction_type || tx.type || "Transaction"}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(tx.created_at).toLocaleDateString("en-NG", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })} • {tx.reference ? tx.reference.slice(0, 12) + '...' : 'No reference'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-yellow-600">
                        {tx.type === "credit" || tx.transaction_type === "wallet_funding" ? "+" : "-"}
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
        onSuccess={onFundSuccess}
        userEmail={userEmail}
      />
    </div>
  )
}

// Main export using Suspense boundary
export default function WalletPage() {
  return (
    <Suspense fallback={<div className="p-4">Loading wallet...</div>}>
      <WalletContent />
    </Suspense>
  );
}
