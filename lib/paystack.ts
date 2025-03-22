/**
 * Paystack API utilities for handling payments
 */

// Get Paystack API keys from environment variables
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';
const PAYSTACK_PUBLIC_KEY = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '';

// Base URL for Paystack API
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

/**
 * Initialize a transaction with Paystack
 * @param amount Amount in kobo (smallest currency unit)
 * @param email Customer email
 * @param reference Optional unique transaction reference
 * @param metadata Optional additional data
 * @param callback_url Optional URL to redirect to after payment
 */
export async function initializeTransaction({
  amount,
  email,
  reference,
  metadata = {},
  callback_url,
}: {
  amount: number;
  email: string;
  reference?: string;
  metadata?: Record<string, any>;
  callback_url?: string;
}) {
  try {
    if (!PAYSTACK_SECRET_KEY) {
      throw new Error('Paystack secret key is not configured');
    }

    const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100), // Convert to kobo/cents
        email,
        reference,
        metadata,
        callback_url,
        channels: ['card'],
        send_email: true,
        customer: {
          email: email,
          first_name: metadata.first_name || '',
          last_name: metadata.last_name || '',
          phone: metadata.phone || ''
        }
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to initialize Paystack transaction');
    }

    return data;
  } catch (error) {
    console.error('Paystack initialization error:', error);
    throw error;
  }
}

/**
 * Verify a transaction with Paystack
 * @param reference Transaction reference
 */
export async function verifyTransaction(reference: string) {
  try {
    if (!PAYSTACK_SECRET_KEY) {
      throw new Error('Paystack secret key is not configured');
    }

    const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${reference}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to verify Paystack transaction');
    }

    return data;
  } catch (error) {
    console.error('Paystack verification error:', error);
    throw error;
  }
}

/**
 * Get all transactions for a customer
 * @param customer Customer code or email
 * @param perPage Number of records per page
 * @param page Page number
 */
export async function listTransactions({
  customer,
  perPage = 10,
  page = 1,
}: {
  customer?: string;
  perPage?: number;
  page?: number;
}) {
  try {
    if (!PAYSTACK_SECRET_KEY) {
      throw new Error('Paystack secret key is not configured');
    }
    
    let url = `${PAYSTACK_BASE_URL}/transaction?perPage=${perPage}&page=${page}`;
    if (customer) {
      url += `&customer=${customer}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to list Paystack transactions');
    }

    return data;
  } catch (error) {
    console.error('Paystack list transactions error:', error);
    throw error;
  }
}

/**
 * Generate a unique transaction reference
 * @returns Unique transaction reference
 */
export function generateTransactionReference() {
  return `TXN-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
}

/**
 * Format amount to currency
 * @param amount Amount in standard units (e.g., naira)
 * @param currency Currency code (e.g., NGN)
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number, currency = 'NGN') {
  const formatter = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  });
  
  return formatter.format(amount);
}

// Export Paystack public key for client-side use
export const getPaystackPublicKey = () => {
  if (!PAYSTACK_PUBLIC_KEY) {
    console.warn('Paystack public key is not configured');
  }
  return PAYSTACK_PUBLIC_KEY;
};
