'use client';

import { useState } from 'react';
import { Bell, ChevronDown, LogOut, User, Settings } from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

type AdminHeaderProps = {
  user: {
    name: string;
    email: string;
    role: string;
  } | null;
};

export default function AdminHeader({ user }: AdminHeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const router = useRouter();
  const supabase = createClientComponentClient();

  const handleSignOut = async () => {
    try {
      // First, get the current session to make sure there's a valid one
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // If no session, just redirect
        router.push('/admin/login');
        return;
      }
      
      // Use signOut with specific scope (local instead of global)
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      
      if (error) {
        console.error('Error signing out:', error.message);
        // Fallback - try to redirect anyway
        router.push('/admin/login');
        return;
      }
      
      // Redirect only after successful sign-out
      router.push('/admin/login');
    } catch (error) {
      console.error('Unexpected error during sign-out:', error);
      // Fallback redirect
      router.push('/admin/login');
    }
  };

  const toggleDropdown = () => {
    setDropdownOpen(!dropdownOpen);
    if (notificationsOpen) setNotificationsOpen(false);
  };

  const toggleNotifications = () => {
    setNotificationsOpen(!notificationsOpen);
    if (dropdownOpen) setDropdownOpen(false);
  };
  
  // Get initials for avatar
  const getInitials = (name: string = ""): string => {
    if (!name) return "A";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-2 sticky top-0 z-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">Admin Dashboard</h1>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Notifications */}
          <div className="relative">
            <button 
              onClick={toggleNotifications}
              className="p-2 rounded-full hover:bg-gray-100 focus:outline-none"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5 text-gray-600" />
              <span className="absolute top-1 right-1 bg-red-500 rounded-full w-2 h-2"></span>
            </button>
            
            {notificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-md shadow-lg py-1 z-20">
                <div className="px-4 py-2 border-b border-gray-200">
                  <h5 className="text-sm font-medium">Notifications</h5>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <div className="px-4 py-3 border-b border-gray-100 hover:bg-gray-50">
                    <p className="text-sm text-gray-800 font-medium">New shipment created</p>
                    <p className="text-xs text-gray-500 mt-1">2 minutes ago</p>
                  </div>
                  <div className="px-4 py-3 border-b border-gray-100 hover:bg-gray-50">
                    <p className="text-sm text-gray-800 font-medium">Shipment status updated</p>
                    <p className="text-xs text-gray-500 mt-1">1 hour ago</p>
                  </div>
                </div>
                <div className="px-4 py-2 border-t border-gray-200">
                  <a href="#" className="text-xs text-blue-600 hover:text-blue-700">View all notifications</a>
                </div>
              </div>
            )}
          </div>
          
          {/* User menu */}
          <div className="relative">
            <button 
              onClick={toggleDropdown}
              className="flex items-center space-x-2 focus:outline-none"
              aria-label="User menu"
            >
              <Avatar className="h-8 w-8">
                {/* Don't rely on external image, use fallback instead */}
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {getInitials(user?.name)}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:block text-left">
                <div className="text-sm font-medium text-gray-800">{user?.name || 'Admin User'}</div>
                <div className="text-xs text-gray-500">{user?.role || 'Administrator'}</div>
              </div>
              <ChevronDown className="h-4 w-4 text-gray-600" />
            </button>
            
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg py-1 z-20">
                <div className="px-4 py-2 border-b border-gray-200">
                  <div className="text-sm font-medium text-gray-800">{user?.name || 'Admin User'}</div>
                  <div className="text-xs text-gray-500">{user?.email || 'admin@example.com'}</div>
                </div>
                <Link href="/admin/settings/profile" className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                  <User className="h-4 w-4 mr-2 text-gray-500" />
                  Profile
                </Link>
                <Link href="/admin/settings" className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                  <Settings className="h-4 w-4 mr-2 text-gray-500" />
                  Settings
                </Link>
                <button 
                  onClick={handleSignOut}
                  className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <LogOut className="h-4 w-4 mr-2 text-gray-500" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
