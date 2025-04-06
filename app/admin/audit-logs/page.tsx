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
  action: string  // Corresponds to TG_OP (INSERT, UPDATE, DELETE)
  resource: string // Corresponds to TG_TABLE_NAME
  resource_id: string | null
  details: any
  ip_address: string | null
  created_at: string
  is_system_action: boolean
  actor_email: string | null
  actor_name: string | null
  execution_type: string // 'Automated System' or 'Human Admin'
  execution_type_class: string // CSS classes for styling
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
        
        const supabase = createClient()
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
        
        const userEmail = session.user.email || ''
        const isAdminEmail = userEmail.includes('@admin') || 
                             userEmail === 'chuqunonso@gmail.com' || 
                             userEmail.endsWith('@yourdomain.com')
        
        const highestRole = isAdminEmail ? 'admin' : 'user'
        setUserRole(highestRole)
        
        if (highestRole !== 'admin') {
          toast({
            title: "Access Denied",
            description: "Only administrators can view audit logs",
            variant: "destructive"
          })
          router.push('/admin/dashboard')
          return
        }
        
        // Fetch logs from the VIEW instead of the table
        const { data: logsData, error: logsError } = await supabase
          .from('admin_audit_logs_view') // Use the view name
          .select('*') // Select all columns from the view
          .order('created_at', { ascending: false })
          .limit(500)
        
        if (logsError) {
          console.error("Error fetching audit logs from view:", logsError)
          toast({
            title: "Error",
            description: "Failed to fetch audit logs",
            variant: "destructive"
          })
          return
        }
        
        // Explicitly cast the data to the updated AuditLog type
        const typedLogsData = logsData as AuditLog[]
        
        setLogs(typedLogsData)
        setFilteredLogs(typedLogsData)
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
    
    // Apply search filter (include actor_name and actor_email)
    if (searchTerm) {
      results = results.filter(log => 
        log.resource_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.actor_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.actor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.ip_address?.includes(searchTerm) ||
        JSON.stringify(log.details).toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    
    // Apply action type filter (using the 'action' column from the view)
    if (filterAction !== "all") {
      results = results.filter(log => log.action.toLowerCase() === filterAction.toLowerCase())
    }
    
    // Apply resource type filter (using the 'resource' column from the view)
    if (filterResource !== "all") {
      results = results.filter(log => log.resource.toLowerCase() === filterResource.toLowerCase())
    }

    // Apply system action filter (using 'is_system_action' from the view)
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
      const headers = [
        "Actor Name", 
        "Actor Email", 
        "Action", 
        "Resource", 
        "Resource ID", 
        // "Affected User", // This info is often in details JSON now
        "Execution Type", 
        "IP Address", 
        "Date/Time"
      ];
      
      const csvRows = filteredLogs.map(log => {
        const row = [
          log.actor_name || 'N/A',
          log.actor_email || 'N/A',
          log.action, // Direct from view
          log.resource, // Direct from view
          log.resource_id || '',
          log.execution_type, // 'Automated System' or 'Human Admin'
          log.ip_address || '',
          new Date(log.created_at).toLocaleString()
        ];
        
        return row.map(value => {
          const stringValue = value === null || value === undefined ? '' : String(value);
          const escapedValue = stringValue.replace(/"/g, '""');
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
            {/* Search Filter */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search by resource ID, admin..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {/* Action Filter */}
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
            {/* Actor Type Filter */}
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
             {/* Resource Filter */}
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
             {/* Start Date Filter */}
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
             {/* End Date Filter */}
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
          </div> {/* Closing div for filters grid */}

          {/* Audit logs table */}
          <div className="border rounded-lg overflow-x-auto max-h-[70vh] overflow-y-auto shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[180px]">Actor</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[150px]">Action</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[180px]">Resource</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[220px]">Details</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[180px]">IP / Location</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[140px]">Date/Time</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500"> {/* Adjusted colSpan */}
                      No audit logs found
                    </td>
                  </tr>
                ) : (
                  currentLogs.map((log, index) => (
                    <tr
                      key={log.id}
                      className={log.execution_type_class || (index % 2 === 0 ? "bg-white" : "bg-gray-50")} // Use class from view
                    >
                      {/* Actor Column */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                           <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-white ${log.is_system_action ? 'bg-blue-600' : 'bg-purple-600'}`}>
                             {log.is_system_action ? 'S' : (log.actor_name?.[0] || '?')}
                           </div>
                           <div className="ml-4">
                             <div className="text-sm font-medium text-gray-900">
                               {log.actor_name || 'Unknown'}
                               {log.is_system_action && (
                                 <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                   System
                                 </span>
                               )}
                             </div>
                             <div className="text-xs text-gray-500">
                               {log.actor_email || 'N/A'}
                             </div>
                           </div>
                        </div>
                      </td>
                      {/* Action Column */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                         {formatActionType(log.action)} {/* Use 'action' from view */}
                      </td>
                      {/* Resource Column */}
                      <td className="px-6 py-4 whitespace-nowrap">
                         <div className="text-sm text-gray-900">
                           {formatResourceType(log.resource)} {/* Use 'resource' from view */}
                         </div>
                         <div className="text-xs text-gray-500 font-mono">
                           {log.resource_id || '-'}
                         </div>
                      </td>
                      {/* Details Column */}
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
                      {/* IP / Location Column */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                         <div className="font-mono text-xs">{log.ip_address || '-'}</div>
                      </td>
                      {/* Date/Time Column */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>{new Date(log.created_at).toLocaleDateString()}</div>
                        <div className="text-xs">
                          {new Date(log.created_at).toLocaleTimeString()}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody> {/* Closing tbody */}
            </table> {/* Closing table */}
          </div> {/* Closing div for table container */}

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
        </CardContent> {/* Closing CardContent */}
      </Card> {/* Closing Card */}
    </div> /* Closing main container div */
  );
}
