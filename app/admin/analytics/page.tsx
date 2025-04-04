"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, ResponsiveContainer, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TrendingUp, ArrowUp, ArrowDown, DollarSign } from "lucide-react"

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState("week")
  const [shipmentStats, setShipmentStats] = useState<any[]>([])
  const [revenueStats, setRevenueStats] = useState<any[]>([])
  const [comparisons, setComparisons] = useState({
    shipmentsGrowth: 0,
    revenueGrowth: 0,
    userGrowth: 0,
    averageOrder: 0
  })

  // Fetch analytics data
  useEffect(() => {
    const fetchAnalyticsData = async () => {
      try {
        setLoading(true)
        
        // Get start and end dates for current period
        const currentEndDate = new Date()
        const currentStartDate = new Date()
        currentStartDate.setDate(currentStartDate.getDate() - 30) // Last 30 days
        
        // Get start and end dates for previous period
        const prevEndDate = new Date(currentStartDate)
        const prevStartDate = new Date(currentStartDate)
        prevStartDate.setDate(prevStartDate.getDate() - 30) // Previous 30 days
        
        // Initialize Supabase client
        const supabase = createClient()
        
        // Fetch all shipments within the date range
        const { data: currentShipments, error: shipmentsError } = await supabase
          .from('shipments')
          .select('*')
          .gte('created_at', currentStartDate.toISOString())
          .lte('created_at', currentEndDate.toISOString())
        
        if (shipmentsError) {
          console.error("Error fetching shipments:", shipmentsError)
          return
        }
        
        // Fetch previous period shipments for comparison
        const { data: previousShipments, error: prevShipmentsError } = await supabase
          .from('shipments')
          .select('*')
          .gte('created_at', prevStartDate.toISOString())
          .lte('created_at', prevEndDate.toISOString())
        
        if (prevShipmentsError) {
          console.error("Error fetching previous shipments:", prevShipmentsError)
          return
        }
        
        // Fetch users created in current period
        const { data: currentUsers, error: usersError } = await supabase
          .from('profiles')
          .select('*')
          .gte('created_at', currentStartDate.toISOString())
          .lte('created_at', currentEndDate.toISOString())
        
        if (usersError) {
          console.error("Error fetching users:", usersError)
          return
        }
        
        // Fetch users created in previous period
        const { data: previousUsers, error: prevUsersError } = await supabase
          .from('profiles')
          .select('*')
          .gte('created_at', prevStartDate.toISOString())
          .lte('created_at', prevEndDate.toISOString())
        
        if (prevUsersError) {
          console.error("Error fetching previous users:", prevUsersError)
          return
        }
        
        // Process the data for display
        
        // Data by status
        const statusCounts: Record<string, number> = {}
        
        // Type-safe version of the loop
        currentShipments?.forEach((shipment: any) => {
          const status = shipment.status || 'unknown'
          statusCounts[status] = (statusCounts[status] || 0) + 1
        })
        
        const statusData = Object.entries(statusCounts).map(([status, count]) => ({
          status: status.replace(/_/g, ' '),
          count
        }))
        
        // Revenue data for current vs previous period
        const currentRevenue = currentShipments?.reduce((sum: number, s: any) => sum + (s.amount || 0), 0) || 0
        const previousRevenue = previousShipments?.reduce((sum: number, s: any) => sum + (s.amount || 0), 0) || 0
        
        // Calculate comparative stats
        const currentTotalShipments = currentShipments?.length || 0
        const previousTotalShipments = previousShipments?.length || 0
        
        const averageOrderValue = currentTotalShipments > 0 ? currentRevenue / currentTotalShipments : 0
        
        // Calculate growth percentages
        const shipmentsGrowth = calculateGrowthPercentage(currentTotalShipments, previousTotalShipments)
        const revenueGrowth = calculateGrowthPercentage(currentRevenue, previousRevenue)
        const userGrowth = calculateGrowthPercentage(currentUsers?.length || 0, previousUsers?.length || 0)
        
        setComparisons({
          shipmentsGrowth,
          revenueGrowth,
          userGrowth,
          averageOrder: averageOrderValue
        })
        
        // Process shipments by date
        const shipmentsByDate: Record<string, number> = {}
        const revenueByDate: Record<string, number> = {}
        
        // Initialize date range for the chart based on time range
        const dateLabels = generateDateLabels(currentStartDate, currentEndDate, timeRange)
        dateLabels.forEach(date => {
          shipmentsByDate[date] = 0
          revenueByDate[date] = 0
        })
        
        // Group shipments by date
        currentShipments?.forEach(shipment => {
          const date = formatDate(new Date(shipment.created_at), timeRange)
          shipmentsByDate[date] = (shipmentsByDate[date] || 0) + 1
          revenueByDate[date] = (revenueByDate[date] || 0) + (shipment.amount || 0)
        })
        
        // Format data for charts
        const shipmentData = Object.keys(shipmentsByDate).map(date => ({
          date,
          shipments: shipmentsByDate[date]
        }))
        
        const revenueData = Object.keys(revenueByDate).map(date => ({
          date,
          revenue: revenueByDate[date]
        }))
        
        setShipmentStats(shipmentData)
        setRevenueStats(revenueData)
        
      } catch (error) {
        console.error("Error fetching analytics data:", error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchAnalyticsData()
  }, [timeRange])
  
  // Helper function to format dates for grouping
  const formatDate = (date: Date, range: string) => {
    switch(range) {
      case "week":
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      case "month":
        return `Week ${Math.ceil(date.getDate() / 7)} of ${date.toLocaleDateString('en-US', { month: 'short' })}`
      case "year":
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      default:
        return date.toLocaleDateString()
    }
  }
  
  // Generate an array of date labels for the chart
  const generateDateLabels = (start: Date, end: Date, range: string) => {
    const labels = []
    const current = new Date(start)
    
    while (current <= end) {
      labels.push(formatDate(current, range))
      
      // Increment date based on the range
      switch(range) {
        case "week":
          current.setDate(current.getDate() + 1)
          break
        case "month":
          current.setDate(current.getDate() + 7)
          break
        case "year":
          current.setMonth(current.getMonth() + 1)
          break
      }
    }
    
    return labels
  }
  
  // Calculate growth percentage
  const calculateGrowthPercentage = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0
    return Math.round(((current - previous) / previous) * 100)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Analytics & Reporting</h2>
        <Tabs 
          defaultValue="week" 
          className="w-[400px]"
          value={timeRange}
          onValueChange={setTimeRange}
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="week">Last 7 Days</TabsTrigger>
            <TabsTrigger value="month">Last Month</TabsTrigger>
            <TabsTrigger value="year">Last Year</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      {/* Comparative Stats */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Shipment Growth</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center">
              {comparisons.shipmentsGrowth}%
              {comparisons.shipmentsGrowth > 0 ? (
                <ArrowUp className="h-4 w-4 text-green-500 ml-2" />
              ) : comparisons.shipmentsGrowth < 0 ? (
                <ArrowDown className="h-4 w-4 text-red-500 ml-2" />
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              Compared to previous {timeRange}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue Growth</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center">
              {comparisons.revenueGrowth}%
              {comparisons.revenueGrowth > 0 ? (
                <ArrowUp className="h-4 w-4 text-green-500 ml-2" />
              ) : comparisons.revenueGrowth < 0 ? (
                <ArrowDown className="h-4 w-4 text-red-500 ml-2" />
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              Compared to previous {timeRange}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Users</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center">
              {comparisons.userGrowth}%
              {comparisons.userGrowth > 0 ? (
                <ArrowUp className="h-4 w-4 text-green-500 ml-2" />
              ) : comparisons.userGrowth < 0 ? (
                <ArrowDown className="h-4 w-4 text-red-500 ml-2" />
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              New sign-ups compared to previous {timeRange}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Order Value</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₦{Math.round(comparisons.averageOrder).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Per shipment in this period
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Shipment Volume</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={shipmentStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="shipments" fill="#3b82f6" name="Shipments" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Revenue</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value) => `₦${value.toLocaleString()}`} />
                  <Legend />
                  <Bar dataKey="revenue" fill="#10b981" name="Revenue (₦)" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
