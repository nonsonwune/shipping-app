'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/supabase';
import AdminNav from '../../components/admin/AdminNav';
import AdminHeader from '../../components/admin/AdminHeader';
import { Loader2 } from 'lucide-react';

// Hard-coded admin emails for verification
// In production, this would ideally be stored in environment variables
const ADMIN_EMAILS = [
  'admin@yourcompany.com', 
  '7umunri@gmail.com',
  'chuqunonso@gmail.com'
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();
  const sessionChecked = useRef(false);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userInfo, setUserInfo] = useState<{
    name: string;
    email: string;
    role: string;
  } | null>(null);
  
  // Determine if we're on the login page
  const isLoginPage = pathname === '/admin/login';

  useEffect(() => {
    // On the login page, we don't need to verify admin status
    if (isLoginPage) {
      setLoading(false);
      return;
    }
    
    // Prevent duplicate checks and infinite loops
    if (sessionChecked.current) return;
    sessionChecked.current = true;

    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Error checking session:', error.message);
          setLoading(false);
          router.push('/admin/login?error=session_error');
          return;
        }

        if (!session || !session.user) {
          console.log('No active session - redirecting to admin login');
          setLoading(false);
          router.push('/admin/login');
          return;
        }

        setUser(session.user);

        // Check if email matches admin email list
        const userEmail = session.user.email?.toLowerCase();
        const isAdmin = ADMIN_EMAILS.includes(userEmail || '');
        console.log('Admin status:', isAdmin);
        
        if (!isAdmin) {
          console.error('User does not have admin role');
          setLoading(false);
          router.push('/admin/login?error=not_admin');
          return;
        }

        // Fetch user profile information
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('first_name, last_name, email')
          .eq('id', session.user.id)
          .single();

        if (profileError) {
          console.error('Error fetching user profile:', profileError.message);
        } else if (profile) {
          const fullName = [profile.first_name, profile.last_name]
            .filter(Boolean)
            .join(' ');
            
          setUserInfo({
            name: fullName || 'Admin User',
            email: profile.email || session.user.email || '',
            role: 'Administrator'
          });
        } else {
          // Use default values if profile not found
          setUserInfo({
            name: 'Admin User',
            email: session.user.email || '',
            role: 'Administrator'
          });
        }

        setLoading(false);
      } catch (error) {
        console.error('Unexpected error during session check:', error);
        setLoading(false);
        router.push('/admin/login?error=unexpected');
      }
    };

    checkSession();

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        router.push('/admin/login');
      } else if (event === 'SIGNED_IN' && session) {
        setUser(session.user);
        // Don't need to redirect here since the effect will handle it
      }
    });

    return () => {
      subscription.unsubscribe();
      sessionChecked.current = false; // Reset on unmount
    };
  }, [router, supabase, isLoginPage]);

  // For the login page, just render the children
  if (isLoginPage) {
    return <>{children}</>;
  }

  // Loading state for admin pages
  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        <p className="mt-4 text-gray-500">Loading admin panel...</p>
      </div>
    );
  }

  // If not loading but user isn't authenticated, show nothing during redirect
  if (!user) {
    return null;
  }

  // Render the admin layout with navigation and header
  return (
    <div className="flex h-screen bg-gray-100">
      <AdminNav />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminHeader user={userInfo} />
        <main className="flex-1 overflow-y-auto p-4">{children}</main>
      </div>
    </div>
  );
}
