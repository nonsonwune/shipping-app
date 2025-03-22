/**
 * Utility functions for formatting and validating dates
 */

/**
 * Format a date string in a user-friendly format
 * @param dateString - The date string to format
 * @param options - Format options
 * @returns Formatted date string
 */
export function formatDate(
  dateString: string | null | undefined,
  options: Intl.DateTimeFormatOptions = { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric' 
  }
): string {
  if (!dateString) return 'N/A';
  
  try {
    const date = new Date(dateString);
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }
    
    return date.toLocaleDateString(undefined, options);
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid date';
  }
}

/**
 * Safely format a date string to relative time (e.g., "5 minutes ago")
 * Never throws errors, returns fallback text for invalid dates
 * 
 * @param dateString - The date string to format
 * @param fallback - Fallback value if date is invalid
 * @returns Formatted relative date string
 */
export function safeFormatRelative(
  dateString: string | null | undefined, 
  fallback = 'Recently'
): string {
  if (!dateString) return fallback;
  
  try {
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return fallback;
    }
    
    // Calculate time difference in milliseconds
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    // Format as relative time
    if (diffSeconds < 60) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    } else {
      // More than a week ago, use standard date formatting
      return formatDate(dateString);
    }
  } catch (error) {
    console.error('Error formatting relative date:', error);
    return fallback;
  }
}

/**
 * Format a date string in a safe manner that prevents "Invalid or unexpected token" errors
 * This is especially important when displaying dates in the UI that might come from
 * unreliable sources or have invalid formats
 * 
 * @param dateString - The date string to format safely
 * @param fallback - Fallback value if the date is invalid
 * @param options - Format options
 * @returns Safely formatted date string
 */
export function safeFormatDate(
  dateString: string | null | undefined,
  fallback: string = 'N/A',
  options: Intl.DateTimeFormatOptions = { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric' 
  }
): string {
  if (!dateString) return fallback;
  
  try {
    const date = new Date(dateString);
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      return fallback;
    }
    
    // Use try-catch inside the function to catch any potential toLocaleDateString errors
    try {
      return date.toLocaleDateString(undefined, options);
    } catch (e) {
      console.warn('Error in toLocaleDateString:', e);
      return fallback;
    }
  } catch (error) {
    console.error('Error creating date object:', error);
    return fallback;
  }
}

/**
 * Format a date with time in a human-readable format
 * @param dateString - The date string to format
 * @returns Formatted date with time
 */
export function formatDateTime(
  dateString: string | null | undefined,
  fallback: string = 'N/A'
): string {
  if (!dateString) return fallback;
  
  try {
    const date = new Date(dateString);
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      return fallback;
    }
    
    return date.toLocaleString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    console.error('Error formatting date and time:', error);
    return fallback;
  }
}

/**
 * Check if a date string is valid
 * @param dateString - The date string to validate
 * @returns Whether the date is valid
 */
export function isValidDate(dateString: string | null | undefined): boolean {
  if (!dateString) return false;
  
  try {
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  } catch (error) {
    return false;
  }
}
