import { safeFormatDate, safeFormatRelative } from '@/utils/date-helpers';

type AdminDateDisplayProps = {
  date: string | null | undefined;
  format?: 'standard' | 'relative';
  fallback?: string;
}

/**
 * A component for safely displaying dates in the admin panel
 * Prevents "Invalid or unexpected token" errors by using our safe date formatting functions
 */
export function AdminDateDisplay({ 
  date, 
  format = 'standard',
  fallback = 'N/A' 
}: AdminDateDisplayProps) {
  // Use our safe date formatting utilities
  const formattedDate = format === 'relative' 
    ? safeFormatRelative(date, fallback)
    : safeFormatDate(date, fallback);
    
  return <>{formattedDate}</>;
}
