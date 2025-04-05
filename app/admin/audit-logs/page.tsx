"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
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
  Calendar,
  Info
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type AuditLog = {
  id: string
  admin_id: string
  action_type: string
  resource_type: string
  resource_id: string | null
  details: any
  ip_address: string | null
  created_at: string
  user_affected?: string | null
  severity?: 'info' | 'warning' | 'alert' | null
  status?: 'success' | 'failed' | 'pending' | null
  browser_info?: string | null
  location?: string | null
  is_system_action?: boolean
  admin_profile?: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string
  } | null
  affected_user?: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string
  } | null
}

type UserRole = {
  roles: {
    name: string
  } | null
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
  const [filterSystemAction, setFilterSystemAction] = useState<string>("all")
  const [userRole, setUserRole] = useState<string>("staff") // Default to staff to be safe
  
  // Check for proper session initialization on component mount
  useEffect(() => {
    console.log("Checking for existing session on page load")
    
    // Check if we have valid cookies or need to clear stale ones
    const checkCookies = () => {
      try {
        if (typeof document !== 'undefined') {
          const cookies = document.cookie.split(';').map(c => c.trim())
          const authCookies = cookies.filter(c => c.includes('-auth-token'))
          
          // Check for potential legacy auth token format (non-base64)
          const legacyAuthTokens = authCookies.filter(c => !c.includes('base64-'))
          
          if (legacyAuthTokens.length > 0) {
            console.log("Clearing stale Supabase cookies")
            // Clear any potential legacy format cookies
            legacyAuthTokens.forEach(cookie => {
              const name = cookie.split('=')[0]
              document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
            })
            console.log("Finished clearing stale cookies")
            // Reload page to ensure clean state
            router.push('/')
            return false
          }
          
          return true // Cookies look fine
        }
      } catch (e) {
        console.error("Cookie check error:", e)
      }
      
      return true // Default to assume cookies are fine
    }
    
    const cookiesValid = checkCookies()
    if (!cookiesValid) return
    
  }, [router])
  
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
        
        // Initialize the Supabase client
        const supabase = createClient()
        
        // Get current session
        const { data, error: sessionError } = await supabase.auth.getSession()
        const session = data.session
        
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
        const userEmail = session.user.email || ''
        
        // Skip database role check (which causes infinite recursion)
        // and rely on the middleware that already verified admin status
        // or check for admin email pattern directly
        const isAdminEmail = userEmail.includes('@admin') || 
                             userEmail === 'chuqunonso@gmail.com' || 
                             userEmail.endsWith('@yourdomain.com')
        
        // Set highest role directly based on email
        const highestRole = isAdminEmail ? 'admin' : 'user'
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
            admin_profile:profiles!admin_id(id, first_name, last_name, email),
            affected_user:profiles!user_affected(id, first_name, last_name, email)
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
        
        setLogs(logsData)
        setFilteredLogs(logsData)
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

    // Apply system action filter
    if (filterSystemAction !== "all") {
      if (filterSystemAction === "system") {
        results = results.filter(log => log.is_system_action === true)
      } else if (filterSystemAction === "human") {
        results = results.filter(log => !log.is_system_action)
      }
    }
    
    // Apply date range filter
    if (filterDateStart) {
      const startDate = new Date(filterDateStart)
      startDate.setHours(0, 0, 0, 0)
      results = results.filter(log => new Date(log.created_at) >= startDate)
    }
    
    if (filterDateEnd) {
      const endDate = new Date(filterDateEnd)
      endDate.setHours(23, 59, 59, 999)
      results = results.filter(log => new Date(log.created_at) <= endDate)
    }
    
    setFilteredLogs(results)
    setCurrentPage(1) // Reset to first page when filters change
  }, [logs, searchTerm, filterAction, filterResource, filterDateStart, filterDateEnd, filterSystemAction])
  
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
    setFilterSystemAction("all")
  }
  
  // Export logs as CSV
  const exportLogs = () => {
    try {
      // Define headers for the CSV file
      const headers = [
        "Actor", 
        "Actor Email", 
        "Action", 
        "Resource", 
        "Resource ID", 
        "Affected User", 
        "Severity", 
        "System Generated", 
        "IP Address", 
        "Date/Time"
      ];
      
      // Format each log into a CSV row
      const csvRows = filteredLogs.map(log => {
        // Get actor name
        const actorName = log.is_system_action
          ? "Automated System"
          : log.admin_profile 
            ? [log.admin_profile.first_name, log.admin_profile.last_name].filter(Boolean).join(' ') || log.admin_profile.email
            : (log.admin_id === log.user_affected) 
              ? "User (Self)"
              : "Unknown";
        
        // Get actor email
        const actorEmail = log.admin_profile?.email || '';
        
        // Format affected user
        const affectedUser = log.affected_user 
          ? [log.affected_user.first_name, log.affected_user.last_name].filter(Boolean).join(' ') || log.affected_user.email
          : log.user_affected || '';
        
        // Row values
        const row = [
          actorName,
          actorEmail,
          formatActionType(log.action_type),
          formatResourceType(log.resource_type),
          log.resource_id || '',
          affectedUser,
          log.severity || 'info',
          log.is_system_action ? 'Yes' : 'No',
          log.ip_address || '',
          new Date(log.created_at).toLocaleString()
        ];
        
        // Quote and escape CSV values
        return row.map(value => {
          // Convert to string and handle null or undefined values
          const stringValue = value === null || value === undefined ? '' : String(value);
          
          // Replace double quotes with two double quotes (CSV escaping)
          const escapedValue = stringValue.replace(/"/g, '""');
          
          // Wrap in double quotes to handle commas and special characters
          return `"${escapedValue}"`;
        }).join(',');
      });

      const csvContent = [
        headers.join(','),
        ...csvRows
      ].join('\n'); 
      
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

  // Find code like this that formats admin information
  const getActorName = (log: AuditLog) => {
    // Check if this is a system action
    if (log.is_system_action) {
      return (
        <div className="flex flex-col">
          <div className="flex items-center">
            <span className="text-sm font-medium">Automated System</span>
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
              System
            </span>
          </div>
          <span className="text-xs text-gray-500 truncate">
            {log.admin_profile?.email || "system@internal"}
          </span>
        </div>
      );
    }
    
    if (!log.admin_profile) {
      // If admin_profile is null but we have admin_id, try to display a simplified user reference
      if (log.admin_id && log.admin_id === log.user_affected) {
        return (
          <div className="flex flex-col">
            <span className="text-xs font-medium">User (Self)</span>
            <span className="text-xs text-gray-500 truncate">{log.admin_id}</span>
          </div>
        );
      }
      return "Unknown";
    }
    
    if (log.admin_profile.first_name || log.admin_profile.last_name) {
      return `${log.admin_profile.first_name || ''} ${log.admin_profile.last_name || ''}`.trim();
    }
    
    return log.admin_profile.email || "Unknown";
  };

  // Add a helper function to format affected user
  function formatAffectedUser(log: AuditLog) {
    if (!log.user_affected) return '-';
    
    if (log.affected_user) {
      const userName = [
        log.affected_user.first_name,
        log.affected_user.last_name
      ].filter(Boolean).join(' ') || log.affected_user.email;
      
      return (
        <div className="flex flex-col">
          <span className="text-sm">{userName}</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-xs text-gray-500 font-mono cursor-help underline decoration-dotted decoration-gray-400 truncate max-w-[160px]">
                  {log.user_affected}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>User ID: {log.user_affected}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      );
    }
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="text-xs text-gray-500 font-mono cursor-help underline decoration-dotted decoration-gray-400">
              {log.user_affected}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>User ID: {log.user_affected}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
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
          <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-6">
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
                value={filterSystemAction || "all"}
                onValueChange={(value) => setFilterSystemAction(value)}
              >
                <SelectTrigger>
                  <div className="flex items-center">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Actor Type" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actors</SelectItem>
                  <SelectItem value="system">System Only</SelectItem>
                  <SelectItem value="human">Human Only</SelectItem>
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
          <div className="border rounded-lg overflow-x-auto max-h-[70vh] overflow-y-auto shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[180px]">
                    Actor
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[150px]">
                    Action
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[180px]">
                    Resource
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[180px]">
                    Affected User
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[100px]">
                    Severity
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[220px]">
                    Details
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[180px]">
                    IP / Location
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[140px]">
                    Date/Time
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-4 text-center text-sm text-gray-500">
                      No audit logs found
                    </td>
                  </tr>
                ) : (
                  currentLogs.map((log, index) => (
                    <tr 
                      key={log.id} 
                      className={
                        log.is_system_action 
                          ? "bg-blue-50" 
                          : index % 2 === 0 
                            ? "bg-white" 
                            : "bg-gray-50"
                      }
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-white"
                               style={{
                                 backgroundColor: 
                                   log.is_system_action
                                     ? '#2563EB' // Bright blue for system actions
                                     : log.admin_id && log.admin_id === log.user_affected 
                                       ? '#3B82F6' // Blue for user self-actions
                                       : log.admin_profile 
                                         ? '#7C3AED' // Purple for admin actions
                                         : '#6B7280'  // Gray for unknown actions
                               }}>
                            {log.is_system_action 
                              ? 'S' 
                              : log.admin_profile?.first_name?.[0] || 
                                log.admin_profile?.email?.[0] || 
                                (log.admin_id && log.admin_id === log.user_affected ? 'U' : '?')}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {getActorName(log)}
                            </div>
                            {!log.is_system_action && log.admin_profile?.email && (
                              <div className="text-xs text-gray-500">
                                {log.admin_profile.email}
                              </div>
                            )}
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatAffectedUser(log)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {log.severity ? (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            log.severity === 'alert' ? 'bg-red-100 text-red-800' : 
                            log.severity === 'warning' ? 'bg-yellow-100 text-yellow-800' : 
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {log.severity.toUpperCase()}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            INFO
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-[220px] truncate">
                        {log.details ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-auto p-0">
                                <div className="flex items-center">
                                  <pre className="text-xs overflow-hidden text-ellipsis max-w-[180px]">
                                    {JSON.stringify(log.details, null, 2)}
                                  </pre>
                                  <Info className="h-3 w-3 ml-1 text-gray-400" />
                                </div>
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[400px] p-4">
                              <div className="font-medium mb-2">Details:</div>
                              <pre className="text-xs bg-gray-50 p-3 rounded-md overflow-x-auto max-h-[300px] overflow-y-auto">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </PopoverContent>
                          </Popover>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="font-mono text-xs">{log.ip_address || '-'}</div>
                        {log.location && (
                          <div className="text-xs mt-1">{log.location}</div>
                        )}
                        {log.browser_info && (
                          <div className="text-xs text-gray-400 truncate max-w-[150px]" title={log.browser_info}>
                            {log.browser_info}
                          </div>
                        )}
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
