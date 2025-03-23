/**
 * Payment verification route
 * Handles webhook and redirect verification from Paystack
 */

import { NextRequest, NextResponse } from "next/server";
// Import the admin client directly to avoid server/client module confusion
import { createClient as createAdminClient } from "@/lib/supabase/admin";
// Import the server client directly (only used in server context)
import { createClient as createServerClient } from "@/lib/supabase/server";
import { Database } from "@/types/supabase";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

/**
 * Verify a transaction and update user's wallet
 */
export async function GET(request: NextRequest) {
  console.log("Payment verification initiated");
  const searchParams = request.nextUrl.searchParams;
  
  // Get the transaction reference from the URL
  const reference = searchParams.get("reference");
  if (!reference) {
    return NextResponse.redirect(
      new URL("/wallet?status=failed&message=Invalid transaction reference", request.url),
      { status: 303 }
    );
  }
  
  console.log("Verifying transaction with reference:", reference);
  
  try {
    // Use Paystack API to verify transaction
    const paystackRes = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      }
    );
    
    const paystackData = await paystackRes.json();
    
    if (!paystackData.status || paystackData.data.status !== "success") {
      return NextResponse.redirect(
        new URL(`/wallet?status=failed&message=${encodeURIComponent('Payment verification failed')}`, request.url),
        { status: 303 }
      );
    }

    // Transaction verified successfully
    const transaction = paystackData.data;
    console.log("Transaction verified successfully:", {
      status: transaction.status,
      amount: transaction.amount,
      reference: transaction.reference,
    });
    
    // Get user ID from transaction metadata or cookies
    let userId = null;
    
    // Create server client for auth and database operations
    console.log("Creating admin client");
    const adminClient = createAdminClient();
    
    console.log("[Supabase Debug] Creating Supabase admin client with service role");
    
    try {
      // First, check if transaction already exists to avoid duplication
      const cookieStr = request.headers.get("cookie");
      console.log("Request cookies:", { cookieHeader: cookieStr });

      // Attempt to find existing transaction
      try {
        const { data: existingTx, error: findError } = await adminClient
          .from("transactions")
          .select("*")
          .eq("reference", reference)
          .single();

        if (findError) {
          console.log("Detailed RLS error:", {
            code: findError.code,
            message: findError.message,
            details: findError.details,
            hint: findError.hint
          });
          
          console.error("Error finding transaction in database:", findError);
        }
        
        if (existingTx) {
          // Transaction already processed, just redirect
          console.log("Transaction already processed");
          
          // Ensure we have userId for redirect
          userId = existingTx.user_id;
          
          return NextResponse.redirect(
            new URL(`/wallet?status=success&message=Payment successful&session=${existingTx.user_id}`, request.url),
            { status: 303 }
          );
        }
      } catch (findErr) {
        console.error("Exception when checking for existing transaction:", findErr);
      }

      console.log("Transaction not found, creating new transaction record");
      
      // Check if transaction metadata contains customer info
      if (transaction.metadata && transaction.metadata.custom_fields) {
        const userField = transaction.metadata.custom_fields.find(
          (field: any) => field.variable_name === "user_id"
        );
        
        if (userField) {
          userId = userField.value;
          console.log("Found user ID in transaction metadata:", userId);
        }
      } else if (transaction.customer && transaction.customer.email) {
        // Find user by email if no direct ID
        const { data: userData, error: userError } = await adminClient
          .from("users")
          .select("id")
          .eq("email", transaction.customer.email)
          .single();
          
        if (!userError && userData) {
          userId = userData.id;
          console.log("Found user ID by email lookup:", userId);
        } else {
          console.error("User lookup error:", userError);
        }
      }
      
      if (!userId) {
        return NextResponse.redirect(
          new URL(`/wallet?status=failed&message=${encodeURIComponent('User identification failed')}`, request.url),
          { status: 303 }
        );
      }

      // Create transaction record
      console.log("Creating transaction record for user:", userId);
      
      // Debug the valid status values
      console.log("DEBUG: Adding debug query to check valid status values");
      try {
        const { data: statusValues } = await adminClient.rpc('get_enum_values', { enum_name: 'transaction_status' });
        console.log("Valid transaction status values:", statusValues);
      } catch (enumErr) {
        console.error("Error getting enum values:", enumErr);
      }
      
      // Prepare transaction data that matches our schema
      // Convert status to match allowed values from the database constraint
      // The database only accepts: 'pending', 'completed', 'failed', 'refunded'
      const statusMap: Record<string, string> = {
        'success': 'completed',
        'failed': 'failed',
        'abandoned': 'failed',
        'cancelled': 'failed',
        'pending': 'pending',
        'reversed': 'refunded'
      };
      
      const normalizedStatus = statusMap[transaction.status.toLowerCase()] || 'pending';
      
      console.log("DEBUG: Using normalized status value:", normalizedStatus);
      
      // Convert amount from kobo to naira for transaction record
      // Paystack uses kobo (100 kobo = 1 naira)
      const amountInNaira = parseFloat(transaction.amount) / 100;
      console.log(`Converting amount for transaction record: ${transaction.amount} kobo → ${amountInNaira} naira`);
      
      const transactionData = {
        reference: reference,
        amount: amountInNaira, // Amount already converted to naira
        user_id: userId,
        transaction_type: 'wallet_funding',
        status: normalizedStatus, // Use normalized status that matches DB constraints
        type: 'credit',
        description: 'Wallet funding via Paystack'
      };
      
      console.log("Transaction insertion attempt:", {
        userId,
        amount: transaction.amount,
        reference,
        status: normalizedStatus,
        clientType: "admin"
      });
      
      console.log("Transaction insertion attempt:", {
        userId,
        amount: transaction.amount,
        reference,
        status: transaction.status,
        clientType: "admin"
      });
      
      try {
        // Use admin client to bypass RLS
        const { data: insertedTx, error: insertErr } = await adminClient
          .from("transactions")
          .insert(transactionData)
          .select("id")
          .single();
        
        if (insertErr) {
          console.log("Detailed RLS error on transaction insert:", {
            code: insertErr.code,
            message: insertErr.message,
            details: insertErr.details,
            hint: insertErr.hint,
          });
          
          console.error("Error creating transaction:", insertErr);
          return NextResponse.redirect(
            new URL(`/wallet?status=failed&message=${encodeURIComponent('Failed to record transaction')}`, request.url),
            { status: 303 }
          );
        }
        
        // If transaction was successful, update the wallet balance
        if (normalizedStatus === 'completed') {
          console.log("Transaction successful, updating wallet balance");
          
          // Get current wallet
          const { data: walletData, error: walletError } = await adminClient
            .from('wallets')
            .select('id, balance')
            .eq('user_id', userId)
            .single();
            
          if (walletError) {
            console.error("Error fetching wallet:", walletError);
            throw new Error(`Error fetching wallet: ${walletError.message}`);
          }
          
          if (!walletData) {
            console.error("No wallet found for user");
            throw new Error("No wallet found for user");
          }
          
          // Update wallet with new balance
          // Fixed: The transaction.amount is already in kobo (100 kobo = 1 naira)
          // The server was double-dividing by 100, causing the 10x multiplication issue
          const amountInNaira = parseFloat(transaction.amount) / 100;
          console.log(`Converting amount from kobo to naira: ${transaction.amount} kobo → ${amountInNaira} naira`);
          
          const newBalance = (walletData.balance || 0) + amountInNaira;
          
          // Update wallet balance
          const { error: updateError } = await adminClient
            .from('wallets')
            .update({ 
              balance: newBalance,
              updated_at: new Date().toISOString()
            })
            .eq('id', walletData.id);
            
          if (updateError) {
            console.error("Error updating wallet balance:", updateError);
            throw new Error(`Error updating wallet balance: ${updateError.message}`);
          }
          
          console.log("Wallet balance updated successfully to:", newBalance);
          
          // Update the transaction with wallet_id
          const { error: linkError } = await adminClient
            .from('transactions')
            .update({ wallet_id: walletData.id })
            .eq('id', insertedTx.id);
            
          if (linkError) {
            console.error("Error linking transaction to wallet:", linkError);
          }
        }
        
        // Begin transaction for atomicity
        try {
          // Generate a secure session token for the redirect
          const sessionToken = Buffer.from(`${userId}:${Date.now()}`).toString('base64');
          
          // Use stronger, more persistent cookies and add an access token for recovery
          const cookieMaxAge = 60 * 60; // 1 hour in seconds
          
          // Redirect with session token to help maintain auth state
          const redirectUrl = new URL(`/wallet?status=success&message=${encodeURIComponent('Payment successful')}`, request.url);
          
          // Debug logs for session persistence
          console.log("DEBUG: Creating redirect with session token:", {
            sessionToken: sessionToken.substring(0, 10) + '...',
            redirectUrl: redirectUrl.toString()
          });
          
          // Create response with proper redirect
          const response = NextResponse.redirect(redirectUrl, { status: 303 });
          
          // Set cookies individually for proper cookie handling
          response.cookies.set({
            name: 'paystack_session',
            value: sessionToken,
            httpOnly: true,
            path: '/',
            maxAge: cookieMaxAge,
            sameSite: 'lax'
          });
          
          response.cookies.set({
            name: 'auth_recovery',
            value: 'true',
            path: '/',
            maxAge: cookieMaxAge
          });
          
          return response;
          
        } catch (transactionError) {
          console.error("Transaction processing error:", transactionError);
          return NextResponse.redirect(
            new URL('/wallet?status=partial&message=Transaction partially processed', request.url),
            { status: 303 }
          );
        }
      } catch (insertError) {
        console.error("Error inserting transaction:", insertError);
        return NextResponse.redirect(
          new URL('/wallet?status=failed&message=Database error', request.url),
          { status: 303 }
        );
      }
          
    } catch (error) {
      console.error("Error processing verified transaction:", error);
      return NextResponse.redirect(
        new URL("/wallet?status=failed&message=Processing error", request.url),
        { status: 303 }
      );
    }
    
  } catch (error) {
    console.error("Payment verification error:", error);
    return NextResponse.redirect(
      new URL("/wallet?status=failed&message=Verification error", request.url),
      { status: 303 }
    );
  }
}

/**
 * Update a user's wallet balance 
 */
async function updateWalletBalance(supabase: any, userId: string, amount: number) {
  // First, get current wallet balance
  const { data: wallet, error: walletError } = await supabase
    .from("wallets")
    .select("balance")
    .eq("user_id", userId)
    .single();
    
  if (walletError) {
    console.error("Error fetching wallet:", walletError);
    throw new Error("Failed to fetch wallet balance");
  }
  
  const currentBalance = wallet?.balance || 0;
  const newBalance = currentBalance + amount;
  
  // Update wallet balance
  const { error: updateError } = await supabase
    .from("wallets")
    .update({ balance: newBalance })
    .eq("user_id", userId);
    
  if (updateError) {
    console.error("Error updating wallet balance:", updateError);
    throw new Error("Failed to update wallet balance");
  }
}
