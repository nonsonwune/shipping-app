"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Package,
  ShoppingBag,
  Wallet,
  MapPin,
  HelpCircle,
  FileText,
  Fingerprint,
  LogOut,
  Settings,
  CreditCard,
  Gift,
} from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { createBrowserClient, safeQuerySingle } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import type { Database } from "@/types/supabase"

type UserProfile = Database['public']['Tables']['profiles']['Row']

export default function AccountPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [supabase, setSupabase] = useState(createBrowserClient())

  useEffect(() => {
    async function getProfile() {
      setLoading(true);
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError) throw sessionError;
        if (!session) {
          router.push("/auth/sign-in")
          return
        }

        const currentUserId = session.user.id;
        const { data, error } = await safeQuerySingle(
          supabase,
          "profiles",
          "first_name, last_name, username",
          { id: currentUserId }
        )

        if (error) {
          if (error.code === 'PGRST116') {
             console.error("Account page: Possible RLS issue preventing SELECT or table/column doesn't exist?");
          }
          throw error
        }

        setProfile(data)

      } catch (error) {
        console.error("Account page: Error loading profile in CATCH:", error)
      } finally {
        setLoading(false)
      }
    }

    getProfile()
  }, [router, supabase]);

  const handleSignOut = async () => {
    const supabase = createBrowserClient();
    await supabase.auth.signOut()
    router.push("/auth/sign-in")
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="pb-16">
      <h1 className="text-2xl font-bold text-center py-4 text-black dark:text-white">Profile</h1>

      <div className="px-4 py-6 border-b border-slate-200 dark:border-slate-700">
        <h2 className="text-2xl font-bold text-center mb-2 text-black dark:text-white">
          {profile?.first_name && profile?.last_name 
            ? `${profile.first_name} ${profile.last_name}` 
            : profile?.first_name || profile?.last_name || 'User'}
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-center mb-4">{profile?.username || 'No username set'}</p>
        <Link href="/account/edit-profile" className="block w-full">
          <Button className="w-full bg-blue-600 text-white hover:bg-blue-700">Edit Profile</Button>
        </Link>
      </div>

      <div className="divide-y divide-slate-200 dark:divide-slate-700">
        <Link href="/shipments" className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Package className="w-6 h-6 text-blue-600 dark:text-blue-500" />
            <span className="font-medium text-black dark:text-white">Shipments</span>
          </div>
          <span className="text-xl text-slate-500 dark:text-slate-400">→</span>
        </Link>

        <Link href="/shop-and-ship" className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-6 h-6 text-blue-600 dark:text-blue-500" />
            <span className="font-medium text-black dark:text-white">Shop & Ship</span>
          </div>
          <span className="text-xl text-slate-500 dark:text-slate-400">→</span>
        </Link>

        <Link href="/wallet" className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Wallet className="w-6 h-6 text-blue-600 dark:text-blue-500" />
            <span className="font-medium text-black dark:text-white">Wallet</span>
          </div>
          <span className="text-xl text-slate-500 dark:text-slate-400">→</span>
        </Link>

        <Link href="/payment-methods" className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <CreditCard className="w-6 h-6 text-blue-600 dark:text-blue-500" />
            <span className="font-medium text-black dark:text-white">Payment Methods</span>
          </div>
          <span className="text-xl text-slate-500 dark:text-slate-400">→</span>
        </Link>

        <Link href="/saved-addresses" className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <MapPin className="w-6 h-6 text-blue-600 dark:text-blue-500" />
            <span className="font-medium text-black dark:text-white">Saved Addresses</span>
          </div>
          <span className="text-xl text-slate-500 dark:text-slate-400">→</span>
        </Link>

        <Link href="/referrals" className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Gift className="w-6 h-6 text-blue-600 dark:text-blue-500" />
            <span className="font-medium text-black dark:text-white">Refer & Earn</span>
          </div>
          <span className="text-xl text-slate-500 dark:text-slate-400">→</span>
        </Link>

        <Link href="/faq" className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <HelpCircle className="w-6 h-6 text-blue-600 dark:text-blue-500" />
            <span className="font-medium text-black dark:text-white">FAQ</span>
          </div>
          <span className="text-xl text-slate-500 dark:text-slate-400">→</span>
        </Link>

        <Link href="/account/settings" className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-blue-600 dark:text-blue-500" />
            <span className="font-medium text-black dark:text-white">Settings</span>
          </div>
          <span className="text-xl text-slate-500 dark:text-slate-400">→</span>
        </Link>

        <Link href="/terms" className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-600 dark:text-blue-500" />
            <span className="font-medium text-black dark:text-white">Terms & Conditions</span>
          </div>
          <span className="text-xl text-slate-500 dark:text-slate-400">→</span>
        </Link>

        <Link href="/privacy" className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Fingerprint className="w-6 h-6 text-blue-600 dark:text-blue-500" />
            <span className="font-medium text-black dark:text-white">Privacy Policy</span>
          </div>
          <span className="text-xl text-slate-500 dark:text-slate-400">→</span>
        </Link>

        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Fingerprint className="w-6 h-6 text-blue-600 dark:text-blue-500" />
            <span className="font-medium text-black dark:text-white">Face or Fingerprint Login</span>
          </div>
          <Switch />
        </div>

        <button onClick={handleSignOut} className="flex items-center w-full justify-between p-4 text-left">
          <div className="flex items-center gap-3">
            <LogOut className="w-6 h-6 text-red-600 dark:text-red-500" />
            <span className="font-medium text-red-600 dark:text-red-500">Sign Out</span>
          </div>
          <span className="text-xl text-slate-500 dark:text-slate-400">→</span>
        </button>
      </div>

      <div className="p-4 text-center text-muted-foreground text-sm">Version 0.6.9</div>
    </div>
  )
}
