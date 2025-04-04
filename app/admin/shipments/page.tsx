"use client"

import { useState, useEffect } from "react"
import { 
  Package, 
  Edit, 
  Search, 
  ChevronLeft, 
  ChevronRight,
  Filter,
  Calendar,
  RefreshCw
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle
} from "@/components/ui/dialog"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/use-toast"
import { Textarea } from "@/components/ui/textarea"
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { format } from "date-fns"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"

interface Shipment {
  id: string;
  user_id: string;
  service_id: string | null;
  origin_address_id: string | null;
  destination_address_id: string | null;
  origin_text: string | null;
  destination_text: string | null;
  status: string;
  tracking_number: string;
  created_at: string;
  updated_at: string | null;
  estimated_delivery: string | null;
  total_weight: number | null;
  weight: number | null;
  weight_unit: string | null;
  dimensions: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  amount: number | null;
  delivery_instructions: string | null;
  description: string | null;
  package_description: string | null;
  item_description: string | null;
  package_details?: { weight?: number | null };
  [key: string]: any;
}

// Get admin emails from environment variable
// Format: comma-separated list of email addresses
const ADMIN_EMAILS = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',').map(email => email.trim()) || [
  // Fallback default values if env variable is not set
  'admin@yourcompany.com'
];

// Constants for shipment workflow
const STATUS_TRANSITIONS: Record<string, {
  nextStatus: string | null;
  requiredRole: string | null;
  description: string;
}> = {
  'pending': {
    nextStatus: 'processing',
    requiredRole: 'warehouse_staff',
    description: 'Package acceptance and initial processing'
  },
  'processing': {
    nextStatus: 'in_transit',
    requiredRole: 'logistics_staff',
    description: 'Preparing package for shipping'
  },
  'in_transit': {
    nextStatus: 'out_for_delivery',
    requiredRole: 'logistics_staff',
    description: 'Package is on the way to destination'
  },
  'out_for_delivery': {
    nextStatus: 'delivered',
    requiredRole: 'delivery_staff',
    description: 'Package is out for final delivery'
  },
  'delivered': {
    nextStatus: null,
    requiredRole: null,
    description: 'Package has been delivered successfully'
  },
  'cancelled': {
    nextStatus: null,
    requiredRole: null,
    description: 'Shipment has been cancelled'
  },
  'returned': {
    nextStatus: null,
    requiredRole: null,
    description: 'Package has been returned to sender'
  }
};

// Define staff roles and their permissions
const STAFF_ROLES: Record<string, {
  canUpdateToStatuses: string[];
  description: string;
}> = {
  'admin': {
    canUpdateToStatuses: ['pending', 'processing', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled', 'returned'],
    description: 'Full access to all shipment statuses'
  },
  'warehouse_staff': {
    canUpdateToStatuses: ['processing'],
    description: 'Can update pending shipments to processing'
  },
  'logistics_staff': {
    canUpdateToStatuses: ['in_transit', 'out_for_delivery'],
    description: 'Can update shipments to in transit and out for delivery'
  },
  'delivery_staff': {
    canUpdateToStatuses: ['delivered', 'returned'],
    description: 'Can update shipments to delivered or returned'
  }
};

// Get allowed status transitions based on user role
const getAllowedStatusTransitions = (currentStatus: string, userRole: string): string[] => {
  // For admin users, always return the four specific statuses requested
  if (userRole === 'admin') {
    return ['pending', 'processing', 'in_transit', 'delivered'];
  }
  
  const staffRole = userRole.toLowerCase();
  if (!STAFF_ROLES[staffRole]) {
    return [];
  }
  
  return STAFF_ROLES[staffRole].canUpdateToStatuses;
};

// Check if user can update to a specific status
const canUpdateToStatus = (currentStatus: string, newStatus: string, userRole: string): boolean => {
  // Add debugging
  debugLog(`Checking update permission: role=${userRole}, currentStatus=${currentStatus}, newStatus=${newStatus}`);
  
  // Admin can always update to any status
  if (userRole === 'admin') {
    debugLog('User is admin, permitting status update');
    return true;
  }
  
  const staffRole = userRole.toLowerCase();
  if (!STAFF_ROLES[staffRole]) {
    debugLog(`No permissions defined for role: ${staffRole}`);
    return false;
  }
  
  // Log the allowed statuses for this role
  debugLog(`Allowed statuses for ${staffRole}:`, STAFF_ROLES[staffRole].canUpdateToStatuses);
  
  return STAFF_ROLES[staffRole].canUpdateToStatuses.includes(newStatus);
};

// Helper function to format status for display
const formatStatusForDisplay = (status: string): string => {
  return status.replace(/_/g, ' ');
};

// Format status for database - ensure it matches the db constraint
function formatStatusForDatabase(status: string): string {
  debugLog('Formatting status for DB:', status);
  
  // Standardize the status first (lowercase and trim)
  let formattedStatus = status.toLowerCase().trim();
  
  // Handle special cases
  if (formattedStatus === 'in transit' || formattedStatus === 'in-transit') {
    formattedStatus = 'in_transit';
  } else if (formattedStatus === 'in process' || formattedStatus === 'in-process') {
    formattedStatus = 'processing';
  }
  
  debugLog('Final formatted status:', formattedStatus);
  return formattedStatus;
}

// Format currency - Updated to only use Naira (₦)
const formatCurrency = (value: number | null) => {
  if (value === null || value === undefined) return 'N/A';
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN'
  }).format(value);
};

// Add this after imports
const DEBUG_ENABLED = true;
function debugLog(...args: any[]) {
  if (DEBUG_ENABLED) console.log('[SHIPMENT_DEBUG]', ...args);
}

export default function ShipmentsManagement() {
  const [loading, setLoading] = useState(true)
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [filteredShipments, setFilteredShipments] = useState<Shipment[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [shipmentsPerPage] = useState(10)
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterDateStart, setFilterDateStart] = useState<Date | undefined>(undefined)
  const [filterDateEnd, setFilterDateEnd] = useState<Date | undefined>(undefined)
  
  const [editingShipment, setEditingShipment] = useState<Shipment | null>(null)
  const [shipmentStatus, setShipmentStatus] = useState<string>("")
  const [statusNote, setStatusNote] = useState<string>("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [userRole, setUserRole] = useState<string>("")

  // Fetch shipments and check user role
  useEffect(() => {
    const fetchShipmentsAndRole = async () => {
      const supabase = createClient();
      // Add check for supabase client
      if (!supabase) {
          console.error("Admin Shipments: Supabase client is not available.");
          setLoading(false);
          return;
      }
      
      try {
        setLoading(true)
        
        // Get current session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          console.error("No active session")
          // TODO: Redirect to login?
          setLoading(false); // Ensure loading stops
          return;
        }
        
        const userId = session.user.id
        const userEmail = session.user.email
        
        // Check user role without querying user_roles table
        // Determine role based on email address
        let highestRole = 'user'
        
        if (userEmail && ADMIN_EMAILS.includes(userEmail.toLowerCase())) {
          highestRole = 'admin'
          debugLog(`User ${userEmail} identified as admin`);
        } else if (userEmail && userEmail.includes("staff")) {
          highestRole = 'staff'
          debugLog(`User ${userEmail} identified as staff`);
        } else {
          debugLog(`User ${userEmail} identified as regular user`);
        }
        
        // Set the role explicitly
        setUserRole(highestRole)
        debugLog(`User role set to: ${highestRole}`);
        
        // Fetch shipments
        const fetchShipments = async () => {
            const supabase = createClient();
            // Add check here too, though less likely to be null if checked above
            if (!supabase) {
                console.error("Admin Shipments: Supabase client unavailable for fetching.");
                setLoading(false);
                return;
            }
          try {
            setLoading(true);
            
            // Log to check we're making the query
            console.log("Fetching shipments with full details...");
            
            const { data, error } = await supabase
              .from('shipments')
              .select('*')
              .order('created_at', { ascending: false });

            if (error) {
              throw error;
            }

            // Log the data to see what fields are available
            console.log("Shipments data sample:", data && data.length > 0 ? data[0] : "No shipments found");

            // Type assertion to handle the Supabase type mismatch
            setShipments(data as unknown as Shipment[]);
            setFilteredShipments(data as unknown as Shipment[]);
          } catch (error) {
            console.error("Error fetching shipments:", error);
            toast({
              title: "Error",
              description: "Failed to load shipments",
              variant: "destructive"
            });
          } finally {
            setLoading(false);
          }
        };

        await fetchShipments();
      } catch (error) {
        console.error("Error fetching data:", error)
        toast({
          title: "Error",
          description: "An unexpected error occurred",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }
    
    fetchShipmentsAndRole()
  }, [])
  
  // Handle filtering and searching
  useEffect(() => {
    let results = [...shipments]
    
    // Apply search term filter
    if (searchTerm) {
      results = results.filter(shipment => 
        shipment.tracking_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shipment.recipient_phone?.includes(searchTerm) ||
        shipment.recipient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shipment.origin_text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shipment.destination_text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shipment.status?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    
    // Apply status filter
    if (filterStatus !== "all") {
      results = results.filter(shipment => shipment.status === filterStatus)
    }
    
    // Apply date range filter
    if (filterDateStart) {
      results = results.filter(shipment => 
        new Date(shipment.created_at) >= new Date(filterDateStart.setHours(0, 0, 0, 0))
      )
    }
    
    if (filterDateEnd) {
      results = results.filter(shipment => 
        new Date(shipment.created_at) <= new Date(filterDateEnd.setHours(23, 59, 59, 999))
      )
    }
    
    setFilteredShipments(results)
    setCurrentPage(1) // Reset to first page when filters change
  }, [searchTerm, filterStatus, filterDateStart, filterDateEnd, shipments])
  
  // Get current page shipments
  const indexOfLastShipment = currentPage * shipmentsPerPage
  const indexOfFirstShipment = indexOfLastShipment - shipmentsPerPage
  const currentShipments = filteredShipments.slice(indexOfFirstShipment, indexOfLastShipment)
  const totalPages = Math.ceil(filteredShipments.length / shipmentsPerPage)
  
  // Change page
  const paginate = (pageNumber: number) => setCurrentPage(pageNumber)
  
  // Open edit dialog
  const handleEditShipment = (shipment: Shipment) => {
    console.log("Opening edit dialog for shipment:", shipment);
    setEditingShipment(shipment);
    
    // Make sure the initial status is set correctly 
    // or default to the first status if there's an issue
    if (!shipment.status || shipment.status === '') {
      console.log("No status found, defaulting to 'pending'");
      setShipmentStatus('pending');
    } else {
      console.log("Setting initial status to:", shipment.status);
      setShipmentStatus(shipment.status);
    }
    
    setStatusNote("");
    setIsDialogOpen(true);
  }
  
  // Clear filters
  const clearFilters = () => {
    setSearchTerm("")
    setFilterStatus("all")
    setFilterDateStart(undefined)
    setFilterDateEnd(undefined)
  }
  
  // Update shipment status
  const handleUpdateStatus = async () => {
    console.log("Update status button clicked", { shipmentStatus, editingShipment });
    debugLog("Starting status update process");
    
    const supabase = createClient();
    // Add check for supabase client
    if (!supabase) {
        console.error("Admin Shipments: Supabase client unavailable for update.");
        toast({ title: "Error", description: "Database connection failed.", variant: "destructive" });
        return;
    }
    
    debugLog("Supabase client created successfully");
    
    if (!editingShipment) {
      console.error("No shipment selected for update");
      return;
    }
    
    debugLog("EditingShipment exists, checking permissions");
    
    // Check if user has permission to update to the selected status
    if (!canUpdateToStatus(editingShipment.status, shipmentStatus, userRole)) {
      debugLog("Status update permission denied");
      toast({
        title: "Permission Denied",
        description: `You don't have permission to update shipments to ${formatStatusForDisplay(shipmentStatus)} status`,
        variant: "destructive"
      });
      return;
    }
    
    debugLog("Permission check passed, proceeding with update");
    
    try {
      setLoading(true);
      
      const now = new Date().toISOString();
      
      // Ensure status is properly formatted for database
      const formattedStatus = formatStatusForDatabase(shipmentStatus);
      
      debugLog("Status conversion:", {
        input: shipmentStatus,
        formatted: formattedStatus,
        allowedInDb: ['pending', 'processing', 'in_transit', 'delivered', 'canceled', 'returned']
      });
      
      console.log("Updating shipment status:", {
        shipmentId: editingShipment.id,
        currentStatus: editingShipment.status,
        newStatus: formattedStatus
      });
      
      // Check if status is actually changing
      if (editingShipment.status === formattedStatus) {
        debugLog("Status unchanged - not sending update to database");
        toast({
          title: "No Change",
          description: "The status is already set to " + formatStatusForDisplay(formattedStatus),
        });
        setLoading(false);
        setIsDialogOpen(false);
        return;
      }
      
      // Log the exact query we're about to send
      debugLog("Preparing database update:", {
        table: 'shipments',
        id: editingShipment.id,
        update: { status: formattedStatus, updated_at: now }
      });
      
      // Update shipment status
      debugLog("Executing Supabase update...");
      const updateResult = await supabase
        .from('shipments')
        .update({ 
          status: formattedStatus,
          updated_at: now
        })
        .eq('id', editingShipment.id)
        .select();
      
      debugLog("Raw update response:", updateResult);
      
      const { data: updateData, error: updateError } = updateResult;
      
      if (updateError) {
        console.error("Error updating shipment status:", updateError);
        debugLog("Update error details:", {
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
          code: updateError.code
        });
        
        toast({
          title: "Error",
          description: "Failed to update shipment status: " + updateError.message,
          variant: "destructive"
        });
        return;
      }
      
      console.log("Update successful:", updateData);
      debugLog("Status update succeeded:", updateData);
      
      // Update local state immediately
      setShipments(prevShipments =>
        prevShipments.map(shipment => {
          if (shipment.id === editingShipment.id) {
            debugLog("Updating shipment in local state:", shipment.id);
            return {
              ...shipment,
              status: formattedStatus,
              updated_at: now
            };
          }
          return shipment;
        })
      );
      
      // Close the dialog now that the primary action is complete
      setIsDialogOpen(false);
      
      // Show success notification
      toast({
        title: "Success",
        description: `Shipment status updated to ${formatStatusForDisplay(shipmentStatus)}`,
      });
      
      // Handle notifications after the main update is complete
      handleNotifications(supabase, editingShipment, shipmentStatus, statusNote, now);
      
    } catch (error) {
      debugLog("Caught exception during update:", error);
      console.error("Error updating shipment status:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred: " + (error instanceof Error ? error.message : String(error)),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Separate function to handle notifications
  const handleNotifications = async (
    supabase: any, 
    shipment: Shipment, 
    status: string, 
    note: string, 
    timestamp: string
  ) => {
    try {
      debugLog("Starting notification creation");
      
      // Determine who should be notified based on the new status
      const transitionInfo = STATUS_TRANSITIONS[status];
      const nextStatus = transitionInfo?.nextStatus;
      const nextRequiredRole = transitionInfo?.requiredRole;
      
      // Add status update notification for the customer if there's a note
      if (note.trim()) {
        try {
          debugLog("Creating user notification for status update");
          const notificationData = {
            user_id: shipment.user_id,
            type: 'status_update',
            title: `Shipment Status Updated: ${formatStatusForDisplay(status)}`,
            message: note.trim(),
            date: timestamp,
            is_read: false
          };
          
          debugLog("Notification data:", notificationData);
          
          const { error: userNotificationError } = await supabase
            .from('notifications')
            .insert(notificationData);
          
          if (userNotificationError) {
            debugLog("Error creating user notification:", userNotificationError);
            console.error("Error creating user notification:", userNotificationError);
          } else {
            debugLog("User notification created successfully");
          }
        } catch (err) {
          debugLog("Exception in notification creation:", err);
          console.error("Failed to create notification:", err);
        }
      }
      
      // If there's a next status, create notification for the appropriate staff
      if (nextStatus && nextRequiredRole) {
        try {
          debugLog("Creating staff notification for next status");
          
          // First check if staff_notifications table exists
          const { error: tableCheckError } = await supabase
            .from('staff_notifications')
            .select('id')
            .limit(1);
            
          if (tableCheckError) {
            debugLog("staff_notifications table doesn't exist or isn't accessible", tableCheckError);
            debugLog("Creating regular notification instead");
            
            // Create a regular notification as fallback
            try {
              const adminNotification = {
                user_id: shipment.user_id, // Send to the shipment owner for now
                type: 'staff_notification',
                title: `Staff Action Required: ${formatStatusForDisplay(nextStatus)}`,
                message: `Shipment #${shipment.tracking_number} is ready to be updated to ${formatStatusForDisplay(nextStatus)}.`,
                date: timestamp,
                is_read: false
              };
              
              await supabase
                .from('notifications')
                .insert(adminNotification);
                
              debugLog("Created fallback notification");
            } catch (fallbackError) {
              debugLog("Error creating fallback notification:", fallbackError);
            }
            
            return; // Skip staff notification creation
          }
          
          // In a real application, you would query for users with this role
          // and create targeted notifications for those specific users
          const staffNotificationData = {
            shipment_id: shipment.id,
            type: 'status_ready_for_update',
            title: `Shipment Ready for ${formatStatusForDisplay(nextStatus)}`,
            message: `Shipment #${shipment.id.slice(0, 8)} is ready to be updated to ${formatStatusForDisplay(nextStatus)}.`,
            required_role: nextRequiredRole,
            date: timestamp,
            is_read: false,
            is_assigned: false
          };
          
          debugLog("Staff notification data:", staffNotificationData);
          
          const { error: staffNotificationError } = await supabase
            .from('staff_notifications')
            .insert(staffNotificationData);
          
          if (staffNotificationError) {
            debugLog("Error creating staff notification:", staffNotificationError);
            console.error("Error creating staff notification:", staffNotificationError);
          } else {
            debugLog("Staff notification created successfully");
          }
        } catch (err) {
          debugLog("Exception in staff notification creation:", err);
          console.error("Failed to create staff notification:", err);
        }
      }
    } catch (notificationError) {
      debugLog("Error in handleNotifications:", notificationError);
      console.error("Error handling notifications:", notificationError);
      // Don't show this error to user since the main action succeeded
    }
  };

  // Get status color class
  const getStatusColorClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'processing':
        return 'bg-blue-100 text-blue-800'
      case 'in_transit':
        return 'bg-indigo-100 text-indigo-800'
      case 'out_for_delivery':
        return 'bg-purple-100 text-purple-800'
      case 'delivered':
        return 'bg-green-100 text-green-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      case 'returned':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading && shipments.length === 0) {
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
          <CardTitle>Shipment Management</CardTitle>
          <Button 
            variant="outline" 
            size="sm"
            onClick={clearFilters}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Clear Filters
          </Button>
        </CardHeader>
        <CardContent>
          {/* Filters and search */}
          <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search by name, location..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div>
              <Select
                value={filterStatus}
                onValueChange={setFilterStatus}
              >
                <SelectTrigger>
                  <div className="flex items-center">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Status" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="in_transit">In Transit</SelectItem>
                  <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="returned">Returned</SelectItem>
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
          
          {/* Shipments table */}
          <div className="border rounded-lg overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="w-1/4 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Shipment Details
                  </th>
                  <th scope="col" className="w-1/6 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th scope="col" className="w-1/6 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Origin/Destination
                  </th>
                  <th scope="col" className="w-1/12 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="w-1/12 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th scope="col" className="w-1/12 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th scope="col" className="w-1/12 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentShipments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">
                      No shipments found
                    </td>
                  </tr>
                ) : (
                  currentShipments.map((shipment) => (
                    <tr key={shipment.id}>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-full flex items-center justify-center">
                            <Package className="h-5 w-5 text-gray-500" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {shipment.tracking_number || "No tracking number"}
                            </div>
                            <div className="text-sm text-gray-500">
                              {/* Only check for total_weight which exists in the database */}
                              {shipment.total_weight 
                                ? `${shipment.total_weight} ${shipment.weight_unit || 'kg'}` 
                                : "Weight not specified"}
                            </div>
                            <div className="text-xs text-gray-400">
                              {/* Only check for description which exists in the database */}
                              {shipment.description || "No description"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{shipment.recipient_name || "Customer"}</div>
                        <div className="text-sm text-gray-500">{shipment.recipient_phone || "No phone"}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{shipment.origin_text || "Origin not specified"}</div>
                        <div className="text-sm text-gray-500">→ {shipment.destination_text || "Destination not specified"}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getStatusColorClass(shipment.status)}`}>
                          {formatStatusForDisplay(shipment.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        {formatCurrency(shipment.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(shipment.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleEditShipment(shipment)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
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
                Showing {indexOfFirstShipment + 1} to {Math.min(indexOfLastShipment, filteredShipments.length)} of {filteredShipments.length} shipments
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
      
      {/* Edit shipment dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Shipment Status</DialogTitle>
            <DialogDescription>
              Change the status of this shipment and add optional status notes.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {editingShipment && (
              <>
                <div className="grid grid-cols-4 gap-4">
                  <div className="font-medium text-right">ID:</div>
                  <div className="col-span-3 text-sm">{editingShipment.id}</div>
                  
                  <div className="font-medium text-right">Customer:</div>
                  <div className="col-span-3 text-sm">
                    {editingShipment.recipient_name ? `${editingShipment.recipient_name} (${editingShipment.recipient_phone || 'No phone'})` : editingShipment.recipient_phone || 'No phone'}
                  </div>
                  
                  <div className="font-medium text-right">Route:</div>
                  <div className="col-span-3 text-sm">
                    {editingShipment.origin_text ? `${editingShipment.origin_text} → ${editingShipment.destination_text || 'Destination not specified'}` : 'Route details unavailable'}
                  </div>
                  
                  <div className="font-medium text-right">Current Status:</div>
                  <div className="col-span-3">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getStatusColorClass(editingShipment.status)}`}>
                      {formatStatusForDisplay(editingShipment.status)}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="status">New Status</Label>
                  <Select
                    value={shipmentStatus}
                    onValueChange={(value) => {
                      console.log("Status changed to:", value);
                      setShipmentStatus(value);
                    }}
                  >
                    <SelectTrigger id="status">
                      <div className="flex items-center">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Select status" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {/* Show the statuses allowed by the updated database constraint */}
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="processing">Processing</SelectItem>
                      <SelectItem value="in_transit">In Transit</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="canceled">Canceled</SelectItem>
                      <SelectItem value="returned">Returned</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="status-note">Status Note (Optional)</Label>
                  <Textarea
                    id="status-note"
                    placeholder="Add details about this status update that will be sent to the customer..."
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={(e) => {
                e.preventDefault();
                console.log("Update button clicked");
                handleUpdateStatus();
              }} 
              disabled={loading}
            >
              {loading ? "Updating..." : "Update Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
