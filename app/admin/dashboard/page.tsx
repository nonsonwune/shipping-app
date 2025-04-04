"use client"

import { useState, useEffect } from "react"
import { 
  Package, 
  Users, 
  TrendingUp, 
  DollarSign,
  Truck,
  Clock,
  CheckCircle,
  AlertTriangle
} from "lucide-react"
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { AdminDateDisplay } from "@/components/admin/AdminDateDisplay"
import { Database } from "@/types/supabase"
import Link from "next/link"

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalShipments: 0,
    pendingShipments: 0,
    completedShipments: 0,
    totalUsers: 0,
    totalRevenue: 0,
    recentShipments: [] as any[],
  })

  // Create a standard client (with user's permissions)
  const supabase = createClient()
  
  // Force count all users (admin operation - will still respect RLS)
  const countAllUsers = async () => {
    console.log("DEBUG - Running direct SQL count query...");
    try {
      // Try with a direct SQL query
      const { data, error } = await supabase.rpc('count_all_profiles', {});
      console.log("DEBUG - SQL count result:", data, error);
      
      if (error) {
        console.error("Error with RPC count:", error);
      } else {
        return data;
      }
    } catch (err) {
      console.error("Error counting users via SQL:", err);
    }
    return null;
  }

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true)
        
        // Fetch total shipments count
        const { count: shipmentsCount, error: shipmentsError } = await supabase
          .from('shipments')
          .select('*', { count: 'exact', head: true })
          
        if (shipmentsError) {
          console.error("Error fetching shipments count:", shipmentsError)
        }
        
        // Fetch pending shipments count
        const { count: pendingCount, error: pendingError } = await supabase
          .from('shipments')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')
          
        if (pendingError) {
          console.error("Error fetching pending shipments:", pendingError)
        }
        
        // Fetch completed shipments count
        const { count: completedCount, error: completedError } = await supabase
          .from('shipments')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'delivered')
          
        if (completedError) {
          console.error("Error fetching completed shipments:", completedError)
        }
        
        // Fetch total users count
        const { count: usersCount, error: usersError } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          // This counts all users in the profiles table, regardless of account_type
          
        console.log("DEBUG - All users count:", usersCount);
        
        // Fetch all users directly to see what we're getting
        const { data: allProfiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, email, account_type');
          
        console.log("DEBUG - All profiles data:", allProfiles, "Error:", profilesError);
          
        if (usersError) {
          console.error("Error fetching users count:", usersError)
        }
        
        // Try to get a full count through direct SQL
        const sqlCount = await countAllUsers();
        console.log("DEBUG - SQL count result (all profiles):", sqlCount);
        
        // Fetch active users (with account_type set)
        const { count: activeUsersCount, error: activeUsersError } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .or('account_type.eq.customer,account_type.eq.admin,account_type.eq.individual,account_type.eq.corporate,account_type.eq.business')
          
        console.log("DEBUG - Active users count (specific account types):", activeUsersCount);
        
        // Debug query - show users with account_type
        const { data: usersWithAccountType, error: debugError } = await supabase
          .from('profiles')
          .select('id, email, account_type')
          .or('account_type.eq.customer,account_type.eq.admin,account_type.eq.individual,account_type.eq.corporate,account_type.eq.business')
          
        console.log("DEBUG - Users with specific account_type:", usersWithAccountType);
          
        if (activeUsersError) {
          console.error("Error fetching active users count:", activeUsersError)
        }
        
        // Fetch total revenue
        const { data: revenue, error: revenueError } = await supabase
          .from('shipments')
          .select('amount')
          
        if (revenueError) {
          console.error("Error fetching revenue:", revenueError)
        }
        
        let totalRevenue = 0
        if (revenue) {
          totalRevenue = revenue.reduce((sum, shipment) => sum + (shipment.amount || 0), 0)
        }
        
        // Fetch recent shipments
        // Skip any relational join attempts since they're causing errors
        // We'll fetch shipments first, then profiles separately
        let { data: recentShipments, error: recentError } = await supabase
          .from('shipments')
          .select('*')  // Just get all shipment data without joins
          .order('created_at', { ascending: false })
          .limit(5)
          
        if (recentError) {
          console.error("Error fetching recent shipments:", recentError)
        } else if (recentShipments && recentShipments.length > 0) {
          // Manually fetch profile data for each shipment
          try {
            const shipmentsWithProfiles = await Promise.all(
              recentShipments.map(async (shipment) => {
                if (shipment.user_id) {
                  // Get profile data using user_id
                  const { data: profileData } = await supabase
                    .from('profiles')
                    .select('first_name, last_name, email')
                    .eq('id', shipment.user_id)
                    .single()
                  
                  return {
                    ...shipment,
                    profiles: profileData || null
                  }
                }
                return { ...shipment, profiles: null }
              })
            )
            recentShipments = shipmentsWithProfiles
          } catch (error) {
            console.error("Error fetching profile data:", error)
          }
        }
        
        setStats({
          totalShipments: shipmentsCount || 0,
          pendingShipments: pendingCount || 0,
          completedShipments: completedCount || 0,
          totalUsers: sqlCount || activeUsersCount || usersCount || 0, // Use SQL count if available, fallback to others
          totalRevenue,
          recentShipments: recentShipments || [],
        })
        
        console.log("DEBUG - Final stats object:", {
          totalShipments: shipmentsCount || 0,
          pendingShipments: pendingCount || 0,
          completedShipments: completedCount || 0,
          totalUsers: sqlCount || activeUsersCount || usersCount || 0, // Show which value we're using
          totalRevenue,
          recentShipments: recentShipments?.length || 0,
        });
      } catch (error) {
        console.error("Dashboard data fetch error:", error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchDashboardData()
  }, [supabase])

  const getShipmentStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'in transit':
        return 'bg-blue-100 text-blue-800'
      case 'delivered':
        return 'bg-green-100 text-green-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Shipments</CardTitle>
            <Package className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalShipments}</div>
            <p className="text-xs text-muted-foreground">
              {stats.completedShipments} delivered
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              Active users with account type
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₦{stats.totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              From all processed shipments
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Shipments</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingShipments}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting processing or pickup
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Completion Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Shipment Completion Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span>Completed</span>
              </div>
              <span className="font-medium">
                {stats.totalShipments 
                  ? Math.round((stats.completedShipments / stats.totalShipments) * 100) 
                  : 0}%
              </span>
            </div>
            <Progress 
              value={stats.totalShipments 
                ? (stats.completedShipments / stats.totalShipments) * 100 
                : 0
              } 
              className="h-2"
            />
          </div>
        </CardContent>
      </Card>

      {/* Recent Shipments */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Shipments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {stats.recentShipments.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No recent shipments found</p>
            ) : (
              <div className="rounded-md border">
                <div className="grid grid-cols-5 gap-4 p-4 font-medium border-b">
                  <div>ID</div>
                  <div>Customer</div>
                  <div>Status</div>
                  <div>Date</div>
                  <div>Amount</div>
                </div>
                <div className="divide-y">
                  {stats.recentShipments.map((shipment) => (
                    <div key={shipment.id} className="grid grid-cols-5 gap-4 p-4 text-sm">
                      <div className="font-medium">#{shipment.id.toString().slice(-6)}</div>
                      <div>{shipment.profiles?.first_name} {shipment.profiles?.last_name}</div>
                      <div>
                        <span className={`px-2 py-1 rounded-full text-xs ${getShipmentStatusColor(shipment.status)}`}>
                          {shipment.status || 'Unknown'}
                        </span>
                      </div>
                      <div>
                        <AdminDateDisplay date={shipment.created_at} />
                      </div>
                      <div className="font-medium">₦{(shipment.amount || 0).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end">
              <Link href="/admin/shipments">
                <Button variant="outline" size="sm">View All Shipments</Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
