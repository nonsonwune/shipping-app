import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import Navigation from "@/components/navigation"
import { ThemeProvider } from "next-themes"
import { AppInitializer } from "@/components/app-init"
import { Toaster } from "@/components/ui/toaster"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Shipping & Logistics App",
  description: "A shipping and logistics mobile application",
  generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <div className="flex flex-col min-h-screen">
            <Navigation />
            <main className="flex-1 pt-16 pb-20">{children}</main>
            <AppInitializer />
            <Toaster />
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}