/**
 * Payment verification route
 * Handles webhook and redirect verification from Paystack
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

// Keep track of processed transactions to prevent duplicates
const processedTransactions = new Set<string>();

// Log all processed transactions for debugging
function logProcessedTransactions() {
  console.log("DUPLICATE CHECK: Currently processed transactions:", Array.from(processedTransactions));
}

// Helper function to get user by email
async function getUserByEmail(email: string) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: userData, error } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .single();

  if (error) {
    console.error("Error looking up user by email:", error);
    return null;
  }

  return userData?.id;
}

/**
 * Verify a transaction and update user's wallet
 */
export async function GET(request: NextRequest) {
  console.log("=========================");
  console.log("PAYMENT VERIFICATION FLOW STARTED");
  console.log("=========================");
  
  // Log request details
  const requestId = Date.now().toString();
  console.log(`[${requestId}] Request URL:`, request.url);
  console.log(`[${requestId}] Request headers:`, {
    referer: request.headers.get('referer'),
    origin: request.headers.get('origin'),
    userAgent: request.headers.get('user-agent')
  });

  // Log all cookies for debugging
  const allCookies: Record<string, string> = {};
  request.cookies.getAll().forEach(cookie => {
    allCookies[cookie.name] = cookie.value.substring(0, 15) + '...';
  });
  console.log(`[${requestId}] Request cookies:`, allCookies);
  
  // Create admin client to bypass RLS
  const adminClient = createAdminClient();
  console.log(`[${requestId}] Admin client created`);
  
  // Get the reference from the URL
  const { searchParams } = new URL(request.url);
  const reference = searchParams.get("reference");
  console.log(`[${requestId}] Transaction reference:`, reference);

  if (!reference) {
    console.log(`[${requestId}] No reference provided, redirecting to error page`);
    return NextResponse.redirect(
      new URL("/wallet?status=failed&message=No reference provided", request.url),
      { status: 303 }
    );
  }

  // Check if this request has been processed before
  const isFirstRequest = !processedTransactions.has(reference);
  console.log(`[${requestId}] Is first request for this reference: ${isFirstRequest}`);
  logProcessedTransactions();

  // Add safeguard against duplicate processing within the same server instance
  if (processedTransactions.has(reference)) {
    console.log(`[${requestId}] DUPLICATE PREVENTION: Transaction already processed in this server instance:`, reference);
    return NextResponse.redirect(
      new URL("/wallet?status=success&message=Payment already processed", request.url),
      { status: 303 }
    );
  }

  console.log(`[${requestId}] Payment verification initiated`);
  console.log(`[${requestId}] Verifying transaction with reference:`, reference);
  
  try {
    // Verify transaction with Paystack
    console.log(`[${requestId}] Making Paystack API call to verify transaction`);
    const paystackResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const paystackData = await paystackResponse.json();
    console.log(`[${requestId}] Paystack verification response status:`, paystackData.status);
    console.log(`[${requestId}] Paystack verification response message:`, paystackData.message);

    if (!paystackData.status) {
      throw new Error(paystackData.message || "Transaction verification failed");
    }

    const transaction = paystackData.data;
    console.log(`[${requestId}] Transaction details:`, {
      reference: transaction.reference,
      status: transaction.status,
      amount: transaction.amount,
      metadata: transaction.metadata
    });

    // Get user ID from transaction metadata or customer email
    const userId = transaction.metadata?.userId || 
                  (await getUserByEmail(transaction.customer.email));

    if (!userId) {
      console.error(`[${requestId}] User not found for email:`, transaction.customer.email);
      throw new Error("User not found");
    }
    
    console.log(`[${requestId}] User ID:`, userId);

    // Convert amount from kobo to naira
    const amountInNaira = parseFloat(transaction.amount) / 100;
    console.log(`[${requestId}] Amount conversion:`, {
      originalAmount: transaction.amount,
      amountInNaira,
      conversionRate: 100
    });

    // Get current wallet balance for logging
    let initialWalletBalance = 0;
    let initialLastUpdated = null;
    try {
      const { data: walletData } = await adminClient
        .from("wallets")
        .select("balance, last_updated")
        .eq("user_id", userId)
        .single();
      if (walletData) {
        initialWalletBalance = walletData.balance;
        initialLastUpdated = walletData.last_updated;
        console.log(`[${requestId}] WALLET BALANCE CHECK: Initial balance =`, initialWalletBalance);
        console.log(`[${requestId}] WALLET BALANCE CHECK: Last updated =`, initialLastUpdated);
      } else {
        console.log(`[${requestId}] No existing wallet found for initial balance check`);
      }
    } catch (error) {
      console.log(`[${requestId}] Error checking initial wallet balance:`, error);
    }

    // Mark transaction as being processed to prevent duplicates
    processedTransactions.add(reference);
    console.log(`[${requestId}] Added transaction to processed set`);
    logProcessedTransactions();

    // Check if transaction already exists and get its status
    console.log(`[${requestId}] Checking if transaction already exists in database`);
    const { data: existingTransaction, error: txFetchError } = await adminClient
      .from("transactions")
      .select("*")
      .eq("reference", reference)
      .single();

    if (txFetchError) {
      console.log(`[${requestId}] Transaction not found in database:`, txFetchError.message);
    }

    if (existingTransaction) {
      console.log(`[${requestId}] Transaction already exists in database:`, {
        id: existingTransaction.id,
        status: existingTransaction.status,
        created_at: existingTransaction.created_at,
        metadata: existingTransaction.metadata,
      });
      
      // Check if wallet has already been updated for this transaction
      // This is the core protection against double updates
      const walletUpdated = existingTransaction.metadata?.wallet_updated === true;
      console.log(`[${requestId}] Wallet already updated for this transaction: ${walletUpdated}`);
      
      if (walletUpdated) {
        console.log(`[${requestId}] DUPLICATE PREVENTION: Wallet already updated for this transaction, skipping update`);
      } else if (existingTransaction.status === "pending" && transaction.status === "success") {
        console.log(`[${requestId}] Updating transaction status from pending to completed`);
        
        // Using DB transaction to ensure atomicity of the operation
        console.log(`[${requestId}] Attempting to update via database function`);
        const { data: rpcData, error: txError } = await adminClient.rpc('update_transaction_and_wallet', {
          p_transaction_reference: reference,
          p_user_id: userId,
          p_amount: amountInNaira,
          p_wallet_updated: true,
          p_metadata: JSON.stringify({
            ...existingTransaction.metadata,
            wallet_updated: true,
            wallet_update_timestamp: new Date().toISOString(),
            paystack_verification: transaction,
            verificationTimestamp: new Date().toISOString()
          })
        });
        
        console.log(`[${requestId}] Database function result:`, { data: rpcData, error: txError ? txError.message : null });
        
        if (txError) {
          console.error(`[${requestId}] Error in DB transaction:`, txError);
          // Fallback to manual update if RPC is not available
          console.log(`[${requestId}] Falling back to manual update logic`);
          try {
            // --- Refined Fallback Logic --- 
            
            // 1. Re-fetch the transaction within the fallback to get the absolute latest state
            console.log(`[${requestId}] Re-fetching transaction state before manual update`);
            const { data: currentTxState, error: fetchError } = await adminClient
              .from("transactions")
              .select("status, metadata")
              .eq("reference", reference)
              .single();

            if (fetchError || !currentTxState) {
                console.error(`[${requestId}] Failed to re-fetch transaction state:`, fetchError);
                throw new Error("Failed to confirm transaction state before manual update.");
            }

            // 2. Check AGAIN if wallet was updated, potentially by a concurrent request or previous step
            const walletAlreadyUpdated = currentTxState.metadata?.wallet_updated === true;
            console.log(`[${requestId}] Manual Fallback Check: Wallet already updated? ${walletAlreadyUpdated}`);

            if (walletAlreadyUpdated) {
                console.log(`[${requestId}] Manual Fallback: Wallet already updated, skipping duplicate update.`);
            } else if (currentTxState.status !== 'completed') {
                // 3. Only proceed if wallet not updated and transaction isn't already marked completed
                
                // First, try to mark the transaction as completed and wallet_updated=true atomically
                console.log(`[${requestId}] Attempting to mark transaction completed/wallet_updated before balance update`);
                const { error: markError } = await adminClient
              .from("transactions")
              .update({
                status: "completed",
                updated_at: new Date().toISOString(),
                metadata: {
                      ...currentTxState.metadata, // Use re-fetched metadata
                      wallet_updated: true, // Mark as updated NOW
                      wallet_update_timestamp: new Date().toISOString(),
                      paystack_verification: transaction, // Log paystack data
                      verificationTimestamp: new Date().toISOString(),
                      manual_fallback_update: true // Flag that fallback was used
                    }
                  })
                  .eq("reference", reference)
                  // Add a condition to prevent race conditions if another process updated it concurrently
                  .eq("metadata->>wallet_updated", false); // Only update if wallet_updated is still false 
                                                        // Note: ->> might require casting metadata to jsonb if not already
                                                        // Or use: .filter('metadata->>wallet_updated', 'is', 'false')
                                                        // Adjust based on your exact table schema
                
                if (markError) {
                    // This could fail if the concurrent update condition wasn't met (race condition)
                    console.error(`[${requestId}] Error marking transaction completed/wallet_updated:`, markError);
                    // Potentially re-fetch and check status again, or rely on next request
                    throw new Error("Failed to mark transaction before wallet update.");
            } else {
                    console.log(`[${requestId}] Transaction successfully marked completed/wallet_updated.`);
            
                    // 4. NOW update the wallet balance (consider using DB function/transaction here too if possible)
                    console.log(`[${requestId}] Proceeding with wallet balance update.`);
            const { data: walletData, error: walletError } = await adminClient
              .from("wallets")
                      .select("balance") // Only select balance
              .eq("user_id", userId)
              .single();
  
                    if (walletError && walletError.code !== 'PGRST116') {
                        console.error(`[${requestId}] Error fetching wallet for update:`, walletError);
                        throw walletError; // Rethrow if not 'not found'
                    }

                    const currentBalance = walletData?.balance || 0;
                    const newBalance = currentBalance + amountInNaira;

                    console.log(`[${requestId}] Updating wallet balance:`, {
                      currentBalance: currentBalance,
                amountToAdd: amountInNaira,
                      newBalance: newBalance
              });
  
                    // Use upsert for wallet - creates if not exists, updates if exists
                    const { error: upsertWalletError } = await adminClient
                .from("wallets")
                        .upsert({ 
                            user_id: userId,
                            balance: newBalance, 
                            currency: 'NGN', // Assuming NGN
                  last_updated: new Date().toISOString()
                        }, { onConflict: 'user_id' }); // Specify conflict column
                        
                    if (upsertWalletError) {
                      console.error(`[${requestId}] Error upserting wallet:`, upsertWalletError);
                      // IMPORTANT: Consider how to handle this failure. Revert transaction status?
                      throw upsertWalletError;
              } else {
                      console.log(`[${requestId}] Wallet balance upserted successfully.`);
                    }
                }
            } else {
                console.log(`[${requestId}] Manual Fallback: Transaction status already 'completed' or wallet_updated=true, skipping balance update.`);
            }
            // --- End Refined Fallback Logic ---
          } catch (error) {
            console.error(`[${requestId}] Error in manual wallet update:`, error);
            // Do not re-throw here, allow redirect to success page but log the error
            // The transaction might be marked updated, but balance failed. Needs monitoring.
          }
        } else {
          console.log(`[${requestId}] Wallet and transaction updated successfully via DB transaction`);
        }
        
        // Check final wallet balance
        try {
          const { data: finalWalletData } = await adminClient
            .from("wallets")
            .select("balance, last_updated")
            .eq("user_id", userId)
            .single();
          if (finalWalletData) {
            const addedAmount = finalWalletData.balance - initialWalletBalance;
            console.log(`[${requestId}] WALLET BALANCE CHECK: Final balance =`, finalWalletData.balance);
            console.log(`[${requestId}] WALLET BALANCE CHECK: Last updated =`, finalWalletData.last_updated);
            console.log(`[${requestId}] WALLET BALANCE CHECK: Calculated Difference =`, addedAmount);

            // Debugging for amount comparison
            console.log(`[${requestId}] WALLET DEBUG: Amount added = ${addedAmount}, Expected amount = ${amountInNaira}`);
            
            if (Math.abs(addedAmount - amountInNaira) > 0.01) { // Use tolerance for float comparison
              console.error(`[${requestId}] WALLET BALANCE MISMATCH: Expected to add ${amountInNaira} but added ${addedAmount}`);
            }
          } else {
            console.log(`[${requestId}] Could not check final wallet balance.`);
          }
        } catch (error) {
          console.log(`[${requestId}] Error checking final wallet balance:`, error);
        }
      }
      
      console.log(`[${requestId}] Redirecting to success page`);
      return NextResponse.redirect(
        new URL("/wallet?status=success&message=Payment successful", request.url),
        { status: 303 }
      );
    }

    // For new transactions
    console.log(`[${requestId}] Creating new transaction record`);
    
    // Insert transaction record with required fields
    console.log(`[${requestId}] Inserting transaction into database`);
    const { data: insertedTransaction, error: insertError } = await adminClient
      .from("transactions")
      .insert({
        user_id: userId,
        amount: amountInNaira, // Store amount in naira
        reference: transaction.reference,
        status: transaction.status === "success" ? "completed" : "pending",
        payment_provider: "paystack",
        transaction_type: "wallet_funding", // Required field 
        type: "credit", // Required field
        payment_gateway: "paystack",
        payment_gateway_reference: transaction.reference,
        metadata: {
          ...transaction.metadata,
          // Initialize with wallet_updated = false
          wallet_updated: false,
          originalAmount: transaction.amount,
          amountInNaira,
          conversionRate: 100,
          transaction_id: new Date().getTime(), // Add a unique ID to prevent duplicate updates
          verificationTimestamp: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (insertError) {
      console.error(`[${requestId}] Error inserting transaction:`, insertError);
      throw new Error("Failed to store transaction");
    } else {
      console.log(`[${requestId}] Transaction inserted successfully:`, {
        id: insertedTransaction?.id,
        status: insertedTransaction?.status
      });
    }

    // Update wallet balance if transaction is successful
    if (transaction.status === "success") {
      console.log(`[${requestId}] New successful transaction, updating wallet balance`);
      
      // Using DB transaction to ensure atomicity of the operation
      console.log(`[${requestId}] Attempting to update via database function for new transaction`);
      const { data: rpcData, error: txError } = await adminClient.rpc('update_transaction_and_wallet', {
        p_transaction_reference: reference,
        p_user_id: userId,
        p_amount: amountInNaira,
        p_wallet_updated: true,
        p_metadata: JSON.stringify({
          ...transaction.metadata,
          wallet_updated: true,
          wallet_update_timestamp: new Date().toISOString(), 
          originalAmount: transaction.amount,
          amountInNaira,
          conversionRate: 100,
          verificationTimestamp: new Date().toISOString()
        })
      });
      
      console.log(`[${requestId}] Database function result for new transaction:`, { data: rpcData, error: txError ? txError.message : null });
      
      if (txError) {
        console.error(`[${requestId}] Error in DB transaction for new transaction:`, txError);
        // Fallback to manual update
        console.log(`[${requestId}] Falling back to manual update for new transaction`);
        try {
          // --- Refined Fallback Logic --- 
          
          // 1. Re-fetch the transaction within the fallback to get the absolute latest state
          console.log(`[${requestId}] Re-fetching transaction state before manual update`);
          const { data: currentTxState, error: fetchError } = await adminClient
            .from("transactions")
            .select("status, metadata")
            .eq("reference", reference)
            .single();

          if (fetchError || !currentTxState) {
              console.error(`[${requestId}] Failed to re-fetch transaction state:`, fetchError);
              throw new Error("Failed to confirm transaction state before manual update.");
          }

          // 2. Check AGAIN if wallet was updated, potentially by a concurrent request or previous step
          const walletAlreadyUpdated = currentTxState.metadata?.wallet_updated === true;
          console.log(`[${requestId}] Manual Fallback Check: Wallet already updated? ${walletAlreadyUpdated}`);

          if (walletAlreadyUpdated) {
              console.log(`[${requestId}] Manual Fallback: Wallet already updated, skipping duplicate update.`);
          } else if (currentTxState.status !== 'completed') {
              // 3. Only proceed if wallet not updated and transaction isn't already marked completed
              
              // First, try to mark the transaction as completed and wallet_updated=true atomically
              console.log(`[${requestId}] Attempting to mark transaction completed/wallet_updated before balance update`);
          const { error: markError } = await adminClient
            .from("transactions")
            .update({
                  status: "completed",
                  updated_at: new Date().toISOString(),
              metadata: {
                    ...currentTxState.metadata, // Use re-fetched metadata
                    wallet_updated: true, // Mark as updated NOW
                wallet_update_timestamp: new Date().toISOString(),
                    paystack_verification: transaction, // Log paystack data
                    verificationTimestamp: new Date().toISOString(),
                    manual_fallback_update: true // Flag that fallback was used
                  }
                })
                .eq("reference", reference)
                // Add a condition to prevent race conditions if another process updated it concurrently
                .eq("metadata->>wallet_updated", false); // Only update if wallet_updated is still false 
                                                      // Note: ->> might require casting metadata to jsonb if not already
                                                      // Or use: .filter('metadata->>wallet_updated', 'is', 'false')
                                                      // Adjust based on your exact table schema
            
          if (markError) {
                  // This could fail if the concurrent update condition wasn't met (race condition)
                  console.error(`[${requestId}] Error marking transaction completed/wallet_updated:`, markError);
                  // Potentially re-fetch and check status again, or rely on next request
                  throw new Error("Failed to mark transaction before wallet update.");
              } else {
                  console.log(`[${requestId}] Transaction successfully marked completed/wallet_updated.`);
                  
                  // 4. NOW update the wallet balance (consider using DB function/transaction here too if possible)
                  console.log(`[${requestId}] Proceeding with wallet balance update.`);
                  const { data: walletData, error: walletError } = await adminClient
                    .from("wallets")
                    .select("balance") // Only select balance
                    .eq("user_id", userId)
                    .single();
                    
                  if (walletError && walletError.code !== 'PGRST116') {
                      console.error(`[${requestId}] Error fetching wallet for update:`, walletError);
                      throw walletError; // Rethrow if not 'not found'
                  }

                  const currentBalance = walletData?.balance || 0;
                  const newBalance = currentBalance + amountInNaira;

                  console.log(`[${requestId}] Updating wallet balance:`, {
                    currentBalance: currentBalance,
                    amountToAdd: amountInNaira,
                    newBalance: newBalance
                  });

                  // Use upsert for wallet - creates if not exists, updates if exists
                  const { error: upsertWalletError } = await adminClient
                      .from("wallets")
                      .upsert({ 
                          user_id: userId,
                          balance: newBalance, 
                          currency: 'NGN', // Assuming NGN
                          last_updated: new Date().toISOString()
                      }, { onConflict: 'user_id' }); // Specify conflict column
                      
                  if (upsertWalletError) {
                    console.error(`[${requestId}] Error upserting wallet:`, upsertWalletError);
                    // IMPORTANT: Consider how to handle this failure. Revert transaction status?
                    throw upsertWalletError;
                  } else {
                    console.log(`[${requestId}] Wallet balance upserted successfully.`);
                  }
              }
          } else {
              console.log(`[${requestId}] Manual Fallback: Transaction status already 'completed' or wallet_updated=true, skipping balance update.`);
          }
          // --- End Refined Fallback Logic ---
        } catch (error) {
          console.error(`[${requestId}] Error in manual wallet update for new transaction:`, error);
          throw error;
        }
      } else {
        console.log(`[${requestId}] New transaction: Wallet and transaction updated successfully via DB transaction`);
      }
      
      // Check final wallet balance
      try {
        const { data: finalWalletData } = await adminClient
          .from("wallets")
          .select("balance, last_updated")
          .eq("user_id", userId)
          .single();
        if (finalWalletData) {
          const addedAmount = finalWalletData.balance - initialWalletBalance;
          console.log(`[${requestId}] WALLET BALANCE CHECK: Final balance =`, finalWalletData.balance);
          console.log(`[${requestId}] WALLET BALANCE CHECK: Last updated =`, finalWalletData.last_updated);
          console.log(`[${requestId}] WALLET BALANCE CHECK: Calculated Difference =`, addedAmount);

          // Debugging for amount comparison
          console.log(`[${requestId}] WALLET DEBUG: Amount added = ${addedAmount}, Expected amount = ${amountInNaira}`);
          
          if (Math.abs(addedAmount - amountInNaira) > 0.01) { // Use tolerance for float comparison
            console.error(`[${requestId}] WALLET BALANCE MISMATCH: Expected to add ${amountInNaira} but added ${addedAmount}`);
          }
        } else {
          console.log(`[${requestId}] Could not check final wallet balance.`);
        }
      } catch (error) {
        console.log(`[${requestId}] Error checking final wallet balance for new transaction:`, error);
      }
    }

    // Generate a secure session token for redirect
    const sessionToken = Buffer.from(`${userId}:${Date.now()}`).toString('base64');
    console.log(`[${requestId}] Generated session token for redirect`);
    
    // --- Construct Absolute Redirect URL --- 
    const publicAppUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!publicAppUrl) {
        console.error(`[${requestId}] ERROR: NEXT_PUBLIC_APP_URL is not set. Cannot construct absolute redirect URL.`);
        // Fallback to relative redirect, which might fail as observed
        return NextResponse.redirect(new URL("/wallet?status=failed&message=Configuration Error", request.url), { status: 303 });
    }

    // Create redirect URL with success message using the public app URL as the base
    const redirectUrl = new URL("/wallet", publicAppUrl);
    redirectUrl.searchParams.set("status", "success");
    redirectUrl.searchParams.set("message", "Payment successful");
    // Append other params if needed (like amount, session token previously added)
    // redirectUrl.searchParams.set("session", sessionToken);
    // redirectUrl.searchParams.set("amount", amountInNaira.toString());
    console.log(`[${requestId}] Constructed Absolute Redirect URL:`, redirectUrl.toString());
    // --- End Absolute Redirect URL --- 

    // Create response with the absolute redirect URL
    const response = NextResponse.redirect(redirectUrl.toString(), { status: 303 }); // Use .toString()
    console.log(`[${requestId}] Created redirect response`);

    // Set cookie max age to 1 hour
    const cookieMaxAge = 60 * 60; // 1 hour in seconds

    // --- Explicitly set cookie domain --- 
    let appDomain: string | undefined = undefined;
    try {
      // Extract hostname (domain) from the configured app URL
      const appUrl = process.env.NEXT_PUBLIC_APP_URL;
      if (appUrl) {
          const parsedUrl = new URL(appUrl);
          // Use hostname, removing port if present (cookies apply to hostname)
          appDomain = parsedUrl.hostname;
          // Handle localhost specifically - browsers often treat localhost differently
          if (appDomain === 'localhost') {
            appDomain = undefined; // Let browser handle localhost default
          }
          console.log(`[${requestId}] Using cookie domain: ${appDomain || 'default (localhost)'}`);
      } else {
          console.warn(`[${requestId}] NEXT_PUBLIC_APP_URL not set, using default cookie domain`);
      }
    } catch (e) {
        console.error(`[${requestId}] Error parsing NEXT_PUBLIC_APP_URL for cookie domain:`, e);
    }

    // Function to create cookie options with explicit domain (if applicable)
    const getCookieOptions = (maxAge: number, httpOnly = true) => ({
        httpOnly: httpOnly,
        path: '/',
        maxAge: maxAge,
        sameSite: 'lax' as const,
        secure: process.env.NODE_ENV === 'production' || request.url.startsWith('https'), // Secure if prod or request is HTTPS (like ngrok)
        domain: appDomain // Set domain if derived, otherwise undefined lets browser default
    });
    // --- End Explicit cookie domain logic --- 

    // Preserve existing auth cookie if present
    const existingAuthCookie = request.cookies.get('sb-rtbqpprntygrgxopxoei-auth-token');
    if (existingAuthCookie) {
      response.cookies.set({
        name: 'sb-rtbqpprntygrgxopxoei-auth-token',
        value: existingAuthCookie.value,
        ...getCookieOptions(cookieMaxAge, true) // Use helper, keep httpOnly true for auth token
      });
      console.log(`[${requestId}] Attempted to preserve existing auth cookie with explicit domain settings`);
    }

    // Set recovery cookies with improved security & explicit domain
    response.cookies.set({
      name: 'paystack_session',
      value: sessionToken,
      ...getCookieOptions(cookieMaxAge, true) // Keep httpOnly true
    });

    response.cookies.set({
      name: 'auth_recovery',
      value: 'true',
      ...getCookieOptions(cookieMaxAge, false) // httpOnly: false if client script needs it
    });

    response.cookies.set({
      name: 'recovery_user_id',
      value: userId,
      ...getCookieOptions(cookieMaxAge, false) // httpOnly: false if client script needs it
    });

    response.cookies.set({
      name: 'session_timestamp',
      value: Date.now().toString(),
      ...getCookieOptions(cookieMaxAge, false) // httpOnly: false if client script needs it
    });

    console.log(`[${requestId}] Set recovery cookies with explicit domain settings`);
    console.log(`[${requestId}] Payment verification flow completed successfully`);
    console.log("=========================");

    return response;

  } catch (error) {
    console.error(`[${requestId}] Payment verification error:`, error);
    console.log("=========================");
    return NextResponse.redirect(
      new URL("/wallet?status=failed&message=Verification error", request.url),
      { status: 303 }
    );
  }
} 