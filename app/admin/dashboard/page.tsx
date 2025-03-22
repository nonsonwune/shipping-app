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
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { AdminDateDisplay } from "@/components/admin/AdminDateDisplay"
import { Database } from "@/types/supabase"

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

  const supabase = createClientComponentClient<Database>()

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
          
        if (usersError) {
          console.error("Error fetching users count:", usersError)
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
        const { data: recentShipments, error: recentError } = await supabase
          .from('shipments')
          .select('*, profiles:user_id(first_name, last_name, email)')
          .order('created_at', { ascending: false })
          .limit(5)
          
        if (recentError) {
          console.error("Error fetching recent shipments:", recentError)
        }
        
        setStats({
          totalShipments: shipmentsCount || 0,
          pendingShipments: pendingCount || 0,
          completedShipments: completedCount || 0,
          totalUsers: usersCount || 0,
          totalRevenue,
          recentShipments: recentShipments || [],
        })
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
              Active shipping platform users
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
              <Button variant="outline" size="sm">View All Shipments</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
