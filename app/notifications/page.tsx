"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Bell, Package, Wallet, Info, CheckCircle, AlertTriangle } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

type Notification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  metadata?: any;
}

export default function NotificationsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    async function fetchNotifications() {
      try {
        setLoading(true)
        
        // Get the current session
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session) {
          router.push("/auth/sign-in")
          return
        }
        
        // Try to fetch notifications from the database
        try {
          const { data, error } = await supabase
            .from("notifications")
            .select("*")
            .eq("user_id", session.user.id)
          
          if (error) {
            console.error("Error fetching notifications:", error)
          } else if (data) {
            setNotifications(data)
          }
        } catch (err) {
          console.error("Error fetching notifications:", err)
        }
      } catch (error) {
        console.error("Notifications page error:", error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchNotifications()
  }, [router])

  const markAsRead = async (id: string) => {
    try {
      // Update local state
      setNotifications(
        notifications.map((notification) => 
          notification.id === id ? { ...notification, is_read: true } : notification
        )
      )
      
      // Update in database if available
      try {
        const { error } = await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("id", id)
        
        if (error) {
          console.error("Error marking notification as read:", error)
        }
      } catch (err) {
        console.error("Error updating notification:", err)
      }
    } catch (error) {
      console.error("Error in markAsRead:", error)
    }
  }

  const markAllAsRead = async () => {
    try {
      // Update local state
      setNotifications(notifications.map((notification) => ({ ...notification, is_read: true })))
      
      // Update in database if available
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session) {
          const { error } = await supabase
            .from("notifications")
            .update({ is_read: true })
            .eq("user_id", session.user.id)
            .eq("is_read", false)
          
          if (error) {
            console.error("Error marking all notifications as read:", error)
          }
        }
      } catch (err) {
        console.error("Error updating notifications:", err)
      }
    } catch (error) {
      console.error("Error in markAllAsRead:", error)
    }
  }

  // Helper function to get icon based on notification type
  const getNotificationIcon = (type: string) => {
    switch(type) {
      case "shipment":
        return { 
          icon: Package, 
          color: "text-blue-600", 
          bg: "bg-blue-100" 
        };
      case "payment":
        return { 
          icon: Wallet, 
          color: "text-green-600", 
          bg: "bg-green-100" 
        };
      case "system":
        return { 
          icon: Info, 
          color: "text-purple-600", 
          bg: "bg-purple-100" 
        };
      case "success":
        return { 
          icon: CheckCircle, 
          color: "text-green-600", 
          bg: "bg-green-100" 
        };
      case "warning":
        return { 
          icon: AlertTriangle, 
          color: "text-yellow-600", 
          bg: "bg-yellow-100" 
        };
      default:
        return { 
          icon: Bell, 
          color: "text-gray-600", 
          bg: "bg-gray-100" 
        };
    }
  }

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      
      if (date.toDateString() === now.toDateString()) {
        return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      } else if (date.toDateString() === yesterday.toDateString()) {
        return `Yesterday, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      } else {
        return date.toLocaleDateString(undefined, { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        });
      }
    } catch (error) {
      return dateString;
    }
  }

  const unreadCount = notifications.filter((notification) => !notification.is_read).length

  if (loading) {
    return (
      <div className="p-4 flex justify-center items-center min-h-[80vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="p-4 pb-20">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Link href="/" className="mr-4">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Button>
          </Link>
          <h1 className="text-xl font-bold">Notifications</h1>
        </div>
        
        {unreadCount > 0 && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={markAllAsRead}
          >
            Mark all as read
          </Button>
        )}
      </div>
      
      <Tabs defaultValue="all">
        <TabsList className="mb-4">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">
            Unread
            {unreadCount > 0 && (
              <span className="ml-1 bg-primary text-white text-xs px-1.5 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="all">
          {notifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium mb-2">No notifications yet</h3>
              <p className="text-gray-500">We'll notify you when there are updates.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => (
                <div 
                  key={notification.id}
                  className={`p-4 rounded-lg border ${!notification.is_read ? 'bg-blue-50 dark:bg-blue-950/20' : 'bg-white dark:bg-slate-800'}`}
                >
                  <div className="flex">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getNotificationIcon(notification.type).bg} mr-3 flex-shrink-0`}>
                      {React.createElement(getNotificationIcon(notification.type).icon, { 
                        className: `h-5 w-5 ${getNotificationIcon(notification.type).color}` 
                      })}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <h3 className="font-medium mb-1">{notification.title}</h3>
                        {!notification.is_read && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 px-2 text-xs"
                            onClick={() => markAsRead(notification.id)}
                          >
                            Mark as read
                          </Button>
                        )}
                      </div>
                      <p className="text-gray-600 dark:text-gray-300 text-sm mb-2">{notification.message}</p>
                      <p className="text-gray-500 dark:text-gray-400 text-xs">
                        {notification.created_at ? formatDate(notification.created_at) : 'Just now'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="unread">
          {unreadCount === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
              <h3 className="text-lg font-medium mb-2">All caught up!</h3>
              <p className="text-gray-500">You have no unread notifications.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications
                .filter(notification => !notification.is_read)
                .map((notification) => (
                  <div 
                    key={notification.id}
                    className="p-4 rounded-lg border bg-blue-50 dark:bg-blue-950/20"
                  >
                    <div className="flex">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getNotificationIcon(notification.type).bg} mr-3 flex-shrink-0`}>
                        {React.createElement(getNotificationIcon(notification.type).icon, { 
                          className: `h-5 w-5 ${getNotificationIcon(notification.type).color}` 
                        })}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <h3 className="font-medium mb-1">{notification.title}</h3>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 px-2 text-xs"
                            onClick={() => markAsRead(notification.id)}
                          >
                            Mark as read
                          </Button>
                        </div>
                        <p className="text-gray-600 dark:text-gray-300 text-sm mb-2">{notification.message}</p>
                        <p className="text-gray-500 dark:text-gray-400 text-xs">
                          {notification.created_at ? formatDate(notification.created_at) : 'Just now'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
