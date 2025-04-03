import "./globals.css"
import Navigation from "@/components/navigation"
import { ThemeProvider } from "@/components/theme-provider"
import { AppInitializer } from "@/components/app-init"
import { ReactNode } from "react"
import type { Metadata, Viewport } from "next"

export const metadata: Metadata = {
  title: "Shipping App",
  description: "Simple shipping application",
  icons: {
    icon: "/favicon.ico"
  }
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeProvider defaultTheme="light">
          <AppInitializer />
          <Navigation />
          <div className="container mx-auto max-w-5xl pt-16 pb-20">
            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}