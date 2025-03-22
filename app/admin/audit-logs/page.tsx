"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  Filter, 
  Download,
  Shield,
  RefreshCw,
  Calendar
} from "lucide-react"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { toast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"
import { format } from "date-fns"

type AuditLog = {
  id: string
  admin_id: string
  action_type: string
  resource_type: string
  resource_id: string | null
  details: any
  ip_address: string | null
  created_at: string
  admin_profile?: {
    first_name: string | null
    last_name: string | null
    email: string
  }
}

export default function AuditLogsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [logsPerPage] = useState(20)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterAction, setFilterAction] = useState<string>("all")
  const [filterResource, setFilterResource] = useState<string>("all")
  const [filterDateStart, setFilterDateStart] = useState<Date | undefined>(undefined)
  const [filterDateEnd, setFilterDateEnd] = useState<Date | undefined>(undefined)
  const [userRole, setUserRole] = useState<string>("staff") // Default to staff to be safe
  
  // Define available actions and resources for filtering
  const actionTypes = [
    "all",
    "update_status",
    "update_setting",
    "assign_role",
    "remove_role"
  ]
  
  const resourceTypes = [
    "all",
    "shipment",
    "system_setting",
    "user_role"
  ]
  
  // Fetch audit logs and check user role
  useEffect(() => {
    const fetchLogsAndCheckRole = async () => {
      try {
        setLoading(true)
        
        // Get current session
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session) {
          toast({
            title: "Not authenticated",
            description: "Please sign in to access this page",
            variant: "destructive"
          })
          router.push('/auth/sign-in')
          return
        }
        
        const userId = session.user.id
        
        // Check user role
        const { data: userRoles, error: roleError } = await supabase
          .from('user_roles')
          .select('roles:role_id(name)')
          .eq('user_id', userId)

        if (roleError) {
          console.error("Error fetching user roles:", roleError)
          return
        }
        
        // Extract highest role (admin > staff > user)
        let highestRole = 'user'
        userRoles?.forEach(role => {
          if (role.roles && typeof role.roles === 'object' && 'name' in role.roles) {
            const roleName = role.roles.name as string
            if (roleName === 'admin') highestRole = 'admin'
            else if (roleName === 'staff' && highestRole !== 'admin') highestRole = 'staff'
          }
        })
        
        setUserRole(highestRole)
        
        // If not admin, redirect to dashboard
        if (highestRole !== 'admin') {
          toast({
            title: "Access Denied",
            description: "Only administrators can view audit logs",
            variant: "destructive"
          })
          router.push('/admin/dashboard')
          return
        }
        
        // Fetch audit logs with admin profile info
        const { data: logsData, error: logsError } = await supabase
          .from('admin_audit_logs')
          .select(`
            *,
            admin_profile:admin_id (
              first_name,
              last_name,
              email
            )
          `)
          .order('created_at', { ascending: false })
          .limit(500) // Limit to recent logs for performance
        
        if (logsError) {
          console.error("Error fetching audit logs:", logsError)
          toast({
            title: "Error",
            description: "Failed to fetch audit logs",
            variant: "destructive"
          })
          return
        }
        
        setLogs(logsData || [])
        setFilteredLogs(logsData || [])
      } catch (error) {
        console.error("Error:", error)
        toast({
          title: "Error",
          description: "An unexpected error occurred",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }
    
    fetchLogsAndCheckRole()
  }, [router])
  
  // Filter logs when filter criteria change
  useEffect(() => {
    let results = [...logs]
    
    // Apply search filter
    if (searchTerm) {
      results = results.filter(log => 
        log.resource_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.admin_profile?.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.ip_address?.includes(searchTerm) ||
        JSON.stringify(log.details).toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    
    // Apply action type filter
    if (filterAction !== "all") {
      results = results.filter(log => log.action_type === filterAction)
    }
    
    // Apply resource type filter
    if (filterResource !== "all") {
      results = results.filter(log => log.resource_type === filterResource)
    }
    
    // Apply date range filter
    if (filterDateStart) {
      results = results.filter(log => 
        new Date(log.created_at) >= new Date(filterDateStart.setHours(0, 0, 0, 0))
      )
    }
    
    if (filterDateEnd) {
      results = results.filter(log => 
        new Date(log.created_at) <= new Date(filterDateEnd.setHours(23, 59, 59, 999))
      )
    }
    
    setFilteredLogs(results)
    setCurrentPage(1) // Reset to first page when filters change
  }, [searchTerm, filterAction, filterResource, filterDateStart, filterDateEnd, logs])
  
  // Get current page logs
  const indexOfLastLog = currentPage * logsPerPage
  const indexOfFirstLog = indexOfLastLog - logsPerPage
  const currentLogs = filteredLogs.slice(indexOfFirstLog, indexOfLastLog)
  const totalPages = Math.ceil(filteredLogs.length / logsPerPage)
  
  // Change page
  const paginate = (pageNumber: number) => setCurrentPage(pageNumber)
  
  // Format action type for display
  const formatActionType = (actionType: string) => {
    return actionType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }
  
  // Format resource type for display
  const formatResourceType = (resourceType: string) => {
    return resourceType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }
  
  // Clear all filters
  const clearFilters = () => {
    setSearchTerm("")
    setFilterAction("all")
    setFilterResource("all")
    setFilterDateStart(undefined)
    setFilterDateEnd(undefined)
  }
  
  // Export logs as CSV
  const exportLogs = () => {
    try {
      // Build CSV content
      const headers = [
        "ID",
        "Admin Email",
        "Action Type",
        "Resource Type",
        "Resource ID",
        "Details",
        "IP Address",
        "Date"
      ]
      
      const csvContent = [
        headers.join(','),
        ...filteredLogs.map(log => [
          log.id,
          log.admin_profile?.email || 'Unknown',
          log.action_type,
          log.resource_type,
          log.resource_id || '',
          JSON.stringify(log.details || {}).replace(/,/g, ';'),
          log.ip_address || '',
          new Date(log.created_at).toISOString()
        ].join(','))
      ].join('\n')
      
      // Create download link
      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.setAttribute('hidden', '')
      a.setAttribute('href', url)
      a.setAttribute('download', `audit_logs_${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      
      toast({
        title: "Export Successful",
        description: "Audit logs have been exported as CSV",
      })
    } catch (error) {
      console.error("Error exporting logs:", error)
      toast({
        title: "Export Failed",
        description: "Failed to export audit logs",
        variant: "destructive"
      })
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
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Security Audit Logs
            </CardTitle>
            <CardDescription>
              Track and monitor all administrative actions in the system
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={clearFilters}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportLogs}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters and search */}
          <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-5">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search by resource ID, admin..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div>
              <Select
                value={filterAction}
                onValueChange={setFilterAction}
              >
                <SelectTrigger>
                  <div className="flex items-center">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Action Type" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {actionTypes.map(action => (
                    <SelectItem key={action} value={action}>
                      {action === "all" ? "All Actions" : formatActionType(action)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Select
                value={filterResource}
                onValueChange={setFilterResource}
              >
                <SelectTrigger>
                  <div className="flex items-center">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Resource Type" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {resourceTypes.map(resource => (
                    <SelectItem key={resource} value={resource}>
                      {resource === "all" ? "All Resources" : formatResourceType(resource)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    {filterDateStart ? format(filterDateStart, 'PPP') : 'Start Date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={filterDateStart}
                    onSelect={setFilterDateStart}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    {filterDateEnd ? format(filterDateEnd, 'PPP') : 'End Date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={filterDateEnd}
                    onSelect={setFilterDateEnd}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          {/* Audit logs table */}
          <div className="border rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Admin
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Resource
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Details
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    IP Address
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date/Time
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                      No audit logs found
                    </td>
                  </tr>
                ) : (
                  currentLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8 bg-primary text-white rounded-full flex items-center justify-center">
                            {log.admin_profile?.first_name?.[0] || log.admin_profile?.email?.[0] || 'U'}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {log.admin_profile?.first_name} {log.admin_profile?.last_name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {log.admin_profile?.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatActionType(log.action_type)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatResourceType(log.resource_type)}
                        </div>
                        <div className="text-xs text-gray-500 font-mono">
                          {log.resource_id || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-[220px] truncate">
                        {log.details ? (
                          <pre className="text-xs overflow-hidden text-ellipsis">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {log.ip_address || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>{new Date(log.created_at).toLocaleDateString()}</div>
                        <div className="text-xs">
                          {new Date(log.created_at).toLocaleTimeString()}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-gray-500">
                Showing {indexOfFirstLog + 1} to {Math.min(indexOfLastLog, filteredLogs.length)} of {filteredLogs.length} logs
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => paginate(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => Math.abs(p - currentPage) < 3 || p === 1 || p === totalPages)
                  .map((page, i, pages) => {
                    const showEllipsis = i > 0 && pages[i] - pages[i - 1] > 1;
                    return (
                      <div key={page} className="flex items-center">
                        {showEllipsis && <span className="px-2">...</span>}
                        <Button
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => paginate(page)}
                        >
                          {page}
                        </Button>
                      </div>
                    );
                  })}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
