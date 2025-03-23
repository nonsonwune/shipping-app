"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Grid, Heart, Bell, User } from "lucide-react"
import NotificationDropdown from "@/components/notifications/notification-dropdown"
import { useState } from "react"

export default function Navigation() {
  const pathname = usePathname() || ""
  const [showNotifications, setShowNotifications] = useState(false)
  
  // Don't render navigation on auth pages or admin pages
  if (pathname?.startsWith('/auth') || pathname?.startsWith('/admin')) {
    return null
  }

  return (
    <>
      {/* Top notification bar */}
      <div className="fixed top-0 left-0 right-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 z-50">
        <div className="max-w-md mx-auto flex justify-between items-center py-3 px-4">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Shipping App</h1>
          <div>
            <NotificationDropdown />
          </div>
        </div>
      </div>

      {/* Bottom navigation bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 rounded-t-3xl shadow-lg z-50 navigation-bar">
        <div className="max-w-md mx-auto flex justify-around items-center py-3 px-4">
          <Link href="/" className={`flex flex-col items-center ${pathname === "/" ? "text-blue-600 dark:text-blue-500" : "text-slate-500 dark:text-slate-400"}`}>
            <Grid className="w-6 h-6" />
            <span className="text-sm mt-1">Dashboard</span>
          </Link>

          <Link
            href="/services"
            className={`flex flex-col items-center ${pathname?.includes("/services") ? "text-blue-600 dark:text-blue-500" : "text-slate-500 dark:text-slate-400"}`}
          >
            <Heart className="w-6 h-6" />
            <span className="text-sm mt-1">Services</span>
          </Link>

          <Link
            href="/notifications"
            className={`flex flex-col items-center ${pathname?.includes("/notifications") ? "text-blue-600 dark:text-blue-500" : "text-slate-500 dark:text-slate-400"}`}
          >
            <Bell className="w-6 h-6" />
            <span className="text-sm mt-1">Notifications</span>
          </Link>

          <Link
            href="/account"
            className={`flex flex-col items-center ${pathname?.includes("/account") ? "text-blue-600 dark:text-blue-500" : "text-slate-500 dark:text-slate-400"}`}
          >
            <User className="w-6 h-6" />
            <span className="text-sm mt-1">Account</span>
          </Link>
        </div>
      </div>
    </>
  )
}
