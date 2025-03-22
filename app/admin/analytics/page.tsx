"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
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
        
        // Get date ranges based on selected time period
        const endDate = new Date()
        let startDate = new Date()
        let previousStartDate = new Date()
        let groupByFormat = ""
        
        switch(timeRange) {
          case "week":
            startDate.setDate(endDate.getDate() - 7)
            previousStartDate.setDate(startDate.getDate() - 7)
            groupByFormat = "day"
            break
          case "month":
            startDate.setMonth(endDate.getMonth() - 1)
            previousStartDate.setMonth(startDate.getMonth() - 1)
            groupByFormat = "week"
            break
          case "year":
            startDate.setFullYear(endDate.getFullYear() - 1)
            previousStartDate.setFullYear(startDate.getFullYear() - 1)
            groupByFormat = "month"
            break
        }
        
        // Convert dates to ISO strings
        const startDateStr = startDate.toISOString()
        const endDateStr = endDate.toISOString()
        const previousStartDateStr = previousStartDate.toISOString()
        
        // Fetch all shipments within the date range
        const { data: currentShipments, error: shipmentsError } = await supabase
          .from('shipments')
          .select('*')
          .gte('created_at', startDateStr)
          .lte('created_at', endDateStr)
          .order('created_at', { ascending: true })
        
        if (shipmentsError) {
          console.error("Error fetching shipments:", shipmentsError)
          return
        }
        
        // Fetch previous period shipments for comparison
        const { data: previousShipments, error: prevShipmentsError } = await supabase
          .from('shipments')
          .select('*')
          .gte('created_at', previousStartDateStr)
          .lt('created_at', startDateStr)
        
        if (prevShipmentsError) {
          console.error("Error fetching previous shipments:", prevShipmentsError)
        }
        
        // Fetch users created in current period
        const { data: currentUsers, error: usersError } = await supabase
          .from('profiles')
          .select('*')
          .gte('created_at', startDateStr)
          .lte('created_at', endDateStr)
        
        if (usersError) {
          console.error("Error fetching users:", usersError)
        }
        
        // Fetch users created in previous period
        const { data: previousUsers, error: prevUsersError } = await supabase
          .from('profiles')
          .select('*')
          .gte('created_at', previousStartDateStr)
          .lt('created_at', startDateStr)
        
        if (prevUsersError) {
          console.error("Error fetching previous users:", prevUsersError)
        }
        
        // Process shipments by date
        const shipmentsByDate: Record<string, number> = {}
        const revenueByDate: Record<string, number> = {}
        
        // Initialize date range for the chart based on time range
        const dateLabels = generateDateLabels(startDate, endDate, timeRange)
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
        
        // Calculate comparative stats
        const currentTotalShipments = currentShipments?.length || 0
        const previousTotalShipments = previousShipments?.length || 0
        
        const currentTotalRevenue = currentShipments?.reduce((sum, s) => sum + (s.amount || 0), 0) || 0
        const previousTotalRevenue = previousShipments?.reduce((sum, s) => sum + (s.amount || 0), 0) || 0
        
        const currentTotalUsers = currentUsers?.length || 0
        const previousTotalUsers = previousUsers?.length || 0
        
        const averageOrderValue = currentTotalShipments > 0 ? currentTotalRevenue / currentTotalShipments : 0
        
        // Calculate growth percentages
        const shipmentsGrowth = calculateGrowthPercentage(currentTotalShipments, previousTotalShipments)
        const revenueGrowth = calculateGrowthPercentage(currentTotalRevenue, previousTotalRevenue)
        const userGrowth = calculateGrowthPercentage(currentTotalUsers, previousTotalUsers)
        
        setComparisons({
          shipmentsGrowth,
          revenueGrowth,
          userGrowth,
          averageOrder: averageOrderValue
        })
        
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
