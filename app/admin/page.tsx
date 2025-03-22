"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function AdminRoot() {
  const router = useRouter()
  
  // Automatically redirect to the dashboard
  useEffect(() => {
    router.replace('/admin/dashboard')
  }, [router])
  
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
    </div>
  )
}
