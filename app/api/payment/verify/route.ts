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
    try {
      const { data: walletData } = await adminClient
        .from("wallets")
        .select("balance, last_updated")
        .eq("user_id", userId)
        .single();
      if (walletData) {
        initialWalletBalance = walletData.balance;
        console.log(`[${requestId}] WALLET BALANCE CHECK: Initial balance =`, initialWalletBalance);
        console.log(`[${requestId}] WALLET BALANCE CHECK: Last updated =`, walletData.last_updated);
      }
    } catch (error) {
      console.log(`[${requestId}] No existing wallet found for initial balance check`);
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
            // First, update transaction to include processing flag
            console.log(`[${requestId}] Updating transaction with processing flag`);
            const { error: updateError } = await adminClient
              .from("transactions")
              .update({
                status: "completed",
                updated_at: new Date().toISOString(),
                metadata: {
                  ...existingTransaction.metadata,
                  processing_wallet_update: true,
                  verificationTimestamp: new Date().toISOString()
                }
              })
              .eq("reference", reference);
              
            if (updateError) {
              console.error(`[${requestId}] Error updating transaction:`, updateError);
            } else {
              console.log(`[${requestId}] Transaction updated with processing flag`);
            }
            
            // Now check wallet and update it
            console.log(`[${requestId}] Checking if wallet exists`);
            const { data: walletData, error: walletError } = await adminClient
              .from("wallets")
              .select("*")
              .eq("user_id", userId)
              .single();
  
            if (walletError) {
              // Create wallet if it doesn't exist
              if (walletError.code === 'PGRST116') {
                console.log(`[${requestId}] Wallet not found, creating new wallet for user:`, userId);
                const { error: createError } = await adminClient
                  .from("wallets")
                  .insert({
                    user_id: userId,
                    balance: amountInNaira,
                    currency: "NGN"
                  });
                  
                if (createError) {
                  console.error(`[${requestId}] Error creating wallet:`, createError);
                } else {
                  console.log(`[${requestId}] Created new wallet with initial balance:`, amountInNaira);
                }
              } else {
                console.error(`[${requestId}] Error fetching wallet:`, walletError);
                throw walletError;
              }
            } else {
              // Update existing wallet
              console.log(`[${requestId}] Updating existing wallet balance:`, {
                currentBalance: walletData.balance,
                amountToAdd: amountInNaira,
                newBalance: walletData.balance + amountInNaira
              });
  
              const { error: updateWalletError } = await adminClient
                .from("wallets")
                .update({ 
                  balance: walletData.balance + amountInNaira,
                  last_updated: new Date().toISOString()
                })
                .eq("user_id", userId);
              
              if (updateWalletError) {
                console.error(`[${requestId}] Error updating wallet:`, updateWalletError);
              } else {
                console.log(`[${requestId}] Wallet balance updated successfully`);
              }
            }
            
            // Finally, mark transaction as having updated the wallet
            console.log(`[${requestId}] Marking transaction as wallet_updated = true`);
            const { error: finalUpdateError } = await adminClient
              .from("transactions")
              .update({
                metadata: {
                  ...existingTransaction.metadata,
                  wallet_updated: true,
                  wallet_update_timestamp: new Date().toISOString(),
                  paystack_verification: transaction,
                  verificationTimestamp: new Date().toISOString()
                }
              })
              .eq("reference", reference);
            
            if (finalUpdateError) {
              console.error(`[${requestId}] Error marking transaction as updated:`, finalUpdateError);
            } else {
              console.log(`[${requestId}] Transaction marked as wallet_updated = true`);
            }
          } catch (error) {
            console.error(`[${requestId}] Error in manual wallet update:`, error);
            throw error;
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
            console.log(`[${requestId}] WALLET BALANCE CHECK: Final balance =`, finalWalletData.balance);
            console.log(`[${requestId}] WALLET BALANCE CHECK: Last updated =`, finalWalletData.last_updated);
            console.log(`[${requestId}] WALLET BALANCE CHECK: Difference =`, finalWalletData.balance - initialWalletBalance);
            
            if (finalWalletData.balance - initialWalletBalance !== amountInNaira) {
              console.error(`[${requestId}] WALLET BALANCE MISMATCH: Expected to add ${amountInNaira} but added ${finalWalletData.balance - initialWalletBalance}`);
            }
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
          // Check if wallet exists
          console.log(`[${requestId}] Checking if wallet exists for new transaction`);
          const { data: walletData, error: walletError } = await adminClient
            .from("wallets")
            .select("*")
            .eq("user_id", userId)
            .single();

          if (walletError) {
            // Create wallet if it doesn't exist
            if (walletError.code === 'PGRST116') {
              console.log(`[${requestId}] Wallet not found, creating new wallet for user:`, userId);
              const { error: createError } = await adminClient
                .from("wallets")
                .insert({
                  user_id: userId,
                  balance: amountInNaira,
                  currency: "NGN"
                });
                
              if (createError) {
                console.error(`[${requestId}] Error creating wallet for new transaction:`, createError);
              } else {
                console.log(`[${requestId}] Created new wallet with initial balance:`, amountInNaira);
              }
            } else {
              console.error(`[${requestId}] Error fetching wallet for new transaction:`, walletError);
              throw walletError;
            }
          } else {
            // Update existing wallet
            console.log(`[${requestId}] Updating existing wallet balance for new transaction:`, {
              currentBalance: walletData.balance,
              amountToAdd: amountInNaira,
              newBalance: walletData.balance + amountInNaira
            });

            const { error: updateError } = await adminClient
              .from("wallets")
              .update({ 
                balance: walletData.balance + amountInNaira,
                last_updated: new Date().toISOString()
              })
              .eq("user_id", userId);
              
            if (updateError) {
              console.error(`[${requestId}] Error updating wallet for new transaction:`, updateError);
            } else {
              console.log(`[${requestId}] Wallet balance updated successfully for new transaction`);
            }
          }
          
          // Mark transaction as having updated the wallet
          console.log(`[${requestId}] Marking new transaction as wallet_updated = true`);
          const { error: markError } = await adminClient
            .from("transactions")
            .update({
              metadata: {
                ...transaction.metadata,
                wallet_updated: true,
                wallet_update_timestamp: new Date().toISOString(),
                originalAmount: transaction.amount,
                amountInNaira,
                conversionRate: 100,
                verificationTimestamp: new Date().toISOString()
              }
            })
            .eq("reference", reference);
            
          if (markError) {
            console.error(`[${requestId}] Error marking new transaction as updated:`, markError);
          } else {
            console.log(`[${requestId}] New transaction marked as wallet_updated = true`);
          }
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
          console.log(`[${requestId}] WALLET BALANCE CHECK: Final balance =`, finalWalletData.balance);
          console.log(`[${requestId}] WALLET BALANCE CHECK: Last updated =`, finalWalletData.last_updated);
          console.log(`[${requestId}] WALLET BALANCE CHECK: Difference =`, finalWalletData.balance - initialWalletBalance);
          
          if (finalWalletData.balance - initialWalletBalance !== amountInNaira) {
            console.error(`[${requestId}] WALLET BALANCE MISMATCH: Expected to add ${amountInNaira} but added ${finalWalletData.balance - initialWalletBalance}`);
          }
        }
      } catch (error) {
        console.log(`[${requestId}] Error checking final wallet balance for new transaction:`, error);
      }
    }

    // Generate a secure session token for redirect
    const sessionToken = Buffer.from(`${userId}:${Date.now()}`).toString('base64');
    console.log(`[${requestId}] Generated session token for redirect`);
    
    // Create redirect URL with success message
    const redirectUrl = new URL("/wallet", request.url);
    redirectUrl.searchParams.set("status", "success");
    redirectUrl.searchParams.set("message", "Payment successful");
    redirectUrl.searchParams.set("session", sessionToken);
    redirectUrl.searchParams.set("amount", amountInNaira.toString());
    console.log(`[${requestId}] Redirect URL:`, redirectUrl.toString());

    // Create response with redirect
    const response = NextResponse.redirect(redirectUrl, { status: 303 });
    console.log(`[${requestId}] Created redirect response`);

    // Set cookie max age to 1 hour
    const cookieMaxAge = 60 * 60; // 1 hour in seconds

    // Preserve existing auth cookie if present
    const existingAuthCookie = request.cookies.get('sb-rtbqpprntygrgxopxoei-auth-token');
    if (existingAuthCookie) {
      response.cookies.set({
        name: 'sb-rtbqpprntygrgxopxoei-auth-token',
        value: existingAuthCookie.value,
        httpOnly: true,
        path: '/',
        maxAge: cookieMaxAge,
        sameSite: 'lax'
      });
      console.log(`[${requestId}] Preserved existing auth cookie`);
    }

    // Set recovery cookies with improved security
    response.cookies.set({
      name: 'paystack_session',
      value: sessionToken,
      httpOnly: true,
      path: '/',
      maxAge: cookieMaxAge,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    });

    response.cookies.set({
      name: 'auth_recovery',
      value: 'true',
      path: '/',
      maxAge: cookieMaxAge,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    });

    response.cookies.set({
      name: 'recovery_user_id',
      value: userId,
      path: '/',
      maxAge: cookieMaxAge,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    });

    response.cookies.set({
      name: 'session_timestamp',
      value: Date.now().toString(),
      path: '/',
      maxAge: cookieMaxAge,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    });

    console.log(`[${requestId}] Set recovery cookies`);
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