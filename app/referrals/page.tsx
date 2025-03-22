"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Copy, Share2, Gift, Users } from "lucide-react"

export default function ReferralsPage() {
  const [referralCode, setReferralCode] = useState("CHUKWU1000")
  const [copied, setCopied] = useState(false)

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shareReferral = () => {
    if (navigator.share) {
      navigator.share({
        title: "Join me on Shipping & Logistics App",
        text: `Use my referral code ${referralCode} to get ₦1,000 off your first shipment!`,
        url: "https://shippingapp.com/referral",
      })
    }
  }

  return (
    <div className="p-4 pb-20">
      <div className="flex items-center mb-6">
        <Link href="/account" className="mr-4">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-2xl font-bold">Refer & Earn</h1>
      </div>

      <div className="bg-primary text-white rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold mb-1">Earn ₦1,000</h2>
            <p className="text-sm opacity-90">For every friend who ships with us</p>
          </div>
          <Gift className="w-12 h-12 opacity-80" />
        </div>

        <div className="bg-white/10 rounded-lg p-4 mb-4">
          <p className="text-sm mb-2">Your Referral Code</p>
          <div className="flex items-center gap-2">
            <div className="bg-white/20 rounded-md px-4 py-2 flex-1 text-center font-bold tracking-wider">
              {referralCode}
            </div>
            <Button
              variant="secondary"
              size="icon"
              className="bg-white text-primary hover:bg-white/90"
              onClick={copyToClipboard}
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
          {copied && <p className="text-xs text-center mt-2">Copied to clipboard!</p>}
        </div>

        <Button
          className="w-full bg-white text-primary hover:bg-white/90 flex items-center justify-center gap-2"
          onClick={shareReferral}
        >
          <Share2 className="w-4 h-4" />
          Share Your Code
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <h3 className="font-bold mb-3">How It Works</h3>

        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="bg-blue-100 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
              <span className="text-primary font-bold">1</span>
            </div>
            <div>
              <p className="font-medium">Share your referral code</p>
              <p className="text-sm text-gray-600">Send your unique code to friends and family</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="bg-blue-100 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
              <span className="text-primary font-bold">2</span>
            </div>
            <div>
              <p className="font-medium">Friends sign up & ship</p>
              <p className="text-sm text-gray-600">They get ₦1,000 off their first shipment</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="bg-blue-100 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
              <span className="text-primary font-bold">3</span>
            </div>
            <div>
              <p className="font-medium">You earn rewards</p>
              <p className="text-sm text-gray-600">Get ₦1,000 credited to your wallet for each referral</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-bold">Your Referrals</h3>
          <div className="flex items-center gap-1 bg-blue-100 text-primary px-2 py-1 rounded-full text-xs">
            <Users className="w-3 h-3" />
            <span>3 Total</span>
          </div>
        </div>

        <div className="divide-y">
          {[
            {
              id: 1,
              name: "Chioma Okafor",
              date: "Joined Mar 15, 2024",
              amount: "+₦1,000",
              status: "Completed",
            },
            {
              id: 2,
              name: "Emeka Eze",
              date: "Joined Mar 10, 2024",
              amount: "+₦1,000",
              status: "Completed",
            },
            {
              id: 3,
              name: "Ngozi Adeyemi",
              date: "Joined Feb 28, 2024",
              amount: "+₦1,000",
              status: "Completed",
            },
          ].map((referral) => (
            <div key={referral.id} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
                  <Image src="/placeholder.svg?height=40&width=40" alt="User" width={40} height={40} />
                </div>
                <div>
                  <p className="font-medium">{referral.name}</p>
                  <p className="text-xs text-gray-500">{referral.date}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium text-green-600">{referral.amount}</p>
                <p className="text-xs text-gray-500">{referral.status}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
        <h3 className="font-bold mb-2">Invite Contacts</h3>
        <p className="text-sm text-gray-600 mb-3">Invite your contacts directly from your phone.</p>
        <div className="flex gap-2">
          <Input placeholder="Enter email or phone number" className="flex-1" />
          <Button className="bg-primary">Invite</Button>
        </div>
      </div>
    </div>
  )
}

