"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CheckCircle } from "lucide-react"

export default function VerificationPage() {
  return (
    <div className="p-6 max-w-md mx-auto text-center">
      <div className="flex justify-center mb-6">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
      </div>

      <h1 className="text-2xl font-bold mb-4">Verify your email</h1>

      <p className="text-muted-foreground mb-6">
        We've sent a verification link to your email address. Please check your inbox and click the link to verify your
        account.
      </p>

      <div className="space-y-4">
        <Button className="w-full bg-primary text-white">Resend verification email</Button>

        <Link href="/auth/sign-in">
          <Button variant="outline" className="w-full">
            Back to sign in
          </Button>
        </Link>
      </div>
    </div>
  )
}

