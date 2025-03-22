"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { 
  Bell, 
  BellOff, 
  CheckCircle2, 
  Package, 
  AlertCircle, 
  Info,
  Truck,
  X
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { safeFormatRelative } from "@/utils/date-helpers"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/components/ui/use-toast"

type Notification = {
  id: string
  user_id: string
  type: string
  title: string
  message: string
  is_read: boolean
  data: any
  created_at: string
}

export default function NotificationDropdown() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  
  // Fetch notifications on component mount
  useEffect(() => {
    fetchNotifications()
    
    // Set up real-time subscription for new notifications
    const channel = supabase
      .channel('notification_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${supabase.auth.getSession().then(({ data }) => data.session?.user.id)}`
        },
        (payload) => {
          // Add new notification to the list
          const newNotification = payload.new as Notification
          setNotifications(prev => [newNotification, ...prev])
          setUnreadCount(count => count + 1)
          
          // Show toast for new notification
          toast({
            title: newNotification.title,
            description: newNotification.message,
            duration: 5000,
          })
        }
      )
      .subscribe()
    
    // Clean up subscription on unmount
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])
  
  // Fetch notifications from Supabase
  const fetchNotifications = async () => {
    try {
      setLoading(true)
      
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        return
      }
      
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .limit(20)
      
      if (error) {
        console.error('Error fetching notifications:', error)
        return
      }
      
      setNotifications(data || [])
      setUnreadCount(data?.filter(n => !n.is_read).length || 0)
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setLoading(false)
    }
  }
  
  // Mark notification as read
  const markAsRead = async (id: string) => {
    try {
      // Update in database
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
        
      if (error) {
        console.error('Error marking notification as read:', error)
        return
      }
      
      // Update local state
      setNotifications(prev => 
        prev.map(n => 
          n.id === id ? { ...n, is_read: true } : n
        )
      )
      setUnreadCount(count => Math.max(0, count - 1))
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }
  
  // Mark all as read
  const markAllAsRead = async () => {
    try {
      // Get all unread notification IDs
      const unreadIds = notifications
        .filter(n => !n.is_read)
        .map(n => n.id)
      
      if (unreadIds.length === 0) return
      
      // Update in database
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .in('id', unreadIds)
      
      if (error) {
        console.error('Error marking all notifications as read:', error)
        return
      }
      
      // Update local state
      setNotifications(prev => 
        prev.map(n => ({ ...n, is_read: true }))
      )
      setUnreadCount(0)
      
      toast({
        title: "Notifications",
        description: "All notifications marked as read",
      })
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
    }
  }
  
  // Get icon for notification type
  const getNotificationIcon = (type: string) => {
    switch(type) {
      case 'status_update':
        return <Truck className="h-5 w-5 text-blue-500" />
      case 'payment_success':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />
      case 'payment_failed':
        return <AlertCircle className="h-5 w-5 text-red-500" />
      case 'system':
        return <Info className="h-5 w-5 text-purple-500" />
      default:
        return <Package className="h-5 w-5 text-gray-500" />
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-medium">Notifications</h4>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={markAllAsRead}
              className="text-xs h-8"
            >
              Mark all as read
            </Button>
          )}
        </div>
        
        <div className="max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center items-center h-20">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
              <BellOff className="h-10 w-10 text-gray-400 mb-2" />
              <p className="text-gray-500">No notifications yet</p>
            </div>
          ) : (
            <div>
              {notifications.map((notification) => (
                <div 
                  key={notification.id} 
                  className={`
                    flex p-4 border-b hover:bg-gray-50 cursor-pointer
                    ${notification.is_read ? 'opacity-70' : 'bg-blue-50/50'}
                  `}
                  onClick={() => !notification.is_read && markAsRead(notification.id)}
                >
                  <div className="flex-shrink-0 mr-3">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 mb-0.5 flex items-center">
                      {notification.title}
                      {!notification.is_read && (
                        <span className="h-2 w-2 bg-blue-500 rounded-full ml-2"></span>
                      )}
                    </p>
                    <p className="text-sm text-gray-500 break-words">{notification.message}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {safeFormatRelative(notification.created_at, 'Just now')}
                    </p>
                  </div>
                  {!notification.is_read && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead(notification.id);
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="p-2 border-t flex justify-center">
          <Button 
            variant="link" 
            className="text-xs" 
            onClick={() => setIsOpen(false)}
          >
            Close
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
