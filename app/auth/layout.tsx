import type React from "react"
import { Inter } from "next/font/google"

const inter = Inter({ subsets: ["latin"] })

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4" data-auth-page="true">
      <div className="w-full max-w-md space-y-8">
        {children}
      </div>
    </div>
  )
}
