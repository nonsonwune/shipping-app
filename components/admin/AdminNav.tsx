'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { 
  LogOut, Package, Settings, BarChart3, Users, 
  HelpCircle, Shield, Home, Truck
} from 'lucide-react';

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const isActive = (path: string) => {
    return pathname === path || pathname?.startsWith(`${path}/`);
  };

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

  return (
    <div className="w-64 bg-white shadow-md flex flex-col h-full">
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-xl font-bold text-primary">Shipping Admin</h1>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-6">
          <nav className="space-y-1">
            <Link
              href="/admin/dashboard"
              className={`flex items-center px-4 py-2 text-sm rounded-md ${
                isActive("/admin/dashboard") 
                  ? "bg-primary text-white" 
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <BarChart3 className="h-5 w-5 mr-3" />
              Dashboard
            </Link>
            
            <Link
              href="/admin/shipments"
              className={`flex items-center px-4 py-2 text-sm rounded-md ${
                isActive("/admin/shipments") 
                  ? "bg-primary text-white" 
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <Package className="h-5 w-5 mr-3" />
              Shipments
            </Link>

            <Link
              href="/admin/staff"
              className={`flex items-center px-4 py-2 text-sm rounded-md ${
                isActive("/admin/staff") 
                  ? "bg-primary text-white" 
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <Users className="h-5 w-5 mr-3" />
              Staff Management
            </Link>
            
            <Link
              href="/admin/users"
              className={`flex items-center px-4 py-2 text-sm rounded-md ${
                isActive("/admin/users") 
                  ? "bg-primary text-white" 
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <Users className="h-5 w-5 mr-3" />
              User Management
            </Link>
            
            <Link
              href="/admin/analytics"
              className={`flex items-center px-4 py-2 text-sm rounded-md ${
                isActive("/admin/analytics") 
                  ? "bg-primary text-white" 
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <BarChart3 className="h-5 w-5 mr-3" />
              Analytics
            </Link>
            
            <Link
              href="/admin/audit-logs"
              className={`flex items-center px-4 py-2 text-sm rounded-md ${
                isActive("/admin/audit-logs") 
                  ? "bg-primary text-white" 
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <Shield className="h-5 w-5 mr-3" />
              Audit Logs
            </Link>
            
            <Link
              href="/admin/support"
              className={`flex items-center px-4 py-2 text-sm rounded-md ${
                isActive("/admin/support") 
                  ? "bg-primary text-white" 
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <HelpCircle className="h-5 w-5 mr-3" />
              Support
            </Link>
            
            <Link
              href="/admin/settings"
              className={`flex items-center px-4 py-2 text-sm rounded-md ${
                isActive("/admin/settings") 
                  ? "bg-primary text-white" 
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <Settings className="h-5 w-5 mr-3" />
              Settings
            </Link>
            
            <Link
              href="/"
              className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md mt-6"
            >
              <Home className="h-5 w-5 mr-3" />
              Back to Site
            </Link>
          </nav>
        </div>
      </div>
      
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={handleSignOut}
          className="flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
