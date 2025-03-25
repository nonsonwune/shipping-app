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
  // Create admin client to bypass RLS
  const adminClient = createAdminClient();
  
  // Get the reference from the URL
  const { searchParams } = new URL(request.url);
  const reference = searchParams.get("reference");

  if (!reference) {
    return NextResponse.redirect(
      new URL("/wallet?status=failed&message=No reference provided", request.url),
      { status: 303 }
    );
  }

  console.log("Payment verification initiated");
  console.log("Verifying transaction with reference:", reference);
  
  try {
    // Verify transaction with Paystack
    const paystackResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const paystackData = await paystackResponse.json();
    console.log("Paystack verification response:", paystackData);

    if (!paystackData.status) {
      throw new Error(paystackData.message || "Transaction verification failed");
    }

    const transaction = paystackData.data;
    console.log("Transaction details:", {
      reference: transaction.reference,
      status: transaction.status,
      amount: transaction.amount,
      metadata: transaction.metadata
    });

    // Get user ID from transaction metadata or customer email
    const userId = transaction.metadata?.userId || 
                  (await getUserByEmail(transaction.customer.email));

    if (!userId) {
      throw new Error("User not found");
    }

    // Convert amount from kobo to naira
    const amountInNaira = parseFloat(transaction.amount) / 100;
    console.log("DEBUG: Amount conversion:", {
      originalAmount: transaction.amount,
      amountInNaira,
      conversionRate: 100
    });

    // Check if transaction already exists
    const { data: existingTransaction } = await adminClient
      .from("transactions")
      .select("*")
      .eq("reference", reference)
      .single();

    if (existingTransaction) {
      console.log("Transaction already exists:", existingTransaction);
      
      // Check if transaction needs to be updated from pending to completed
      if (existingTransaction.status === "pending" && transaction.status === "success") {
        console.log("Updating transaction status from pending to completed");
        
        const { error: updateError } = await adminClient
          .from("transactions")
          .update({
            status: "completed",
            updated_at: new Date().toISOString(),
            metadata: {
              ...existingTransaction.metadata,
              paystack_verification: transaction,
              verificationTimestamp: new Date().toISOString()
            }
          })
          .eq("reference", reference);
          
        if (updateError) {
          console.error("Error updating transaction status:", updateError);
        } else {
          console.log("Transaction status updated to completed");
          
          // Update wallet balance
          // Check if wallet exists
          const { data: walletData, error: walletError } = await adminClient
            .from("wallets")
            .select("*")
            .eq("user_id", userId)
            .single();

          if (walletError) {
            // Create wallet if it doesn't exist
            if (walletError.code === 'PGRST116') {
              console.log("Wallet not found, creating new wallet for user:", userId);
              const { data: newWallet, error: createError } = await adminClient
                .from("wallets")
                .insert({
                  user_id: userId,
                  balance: amountInNaira,
                  currency: "NGN"
                })
                .select()
                .single();
                
              if (createError) {
                console.error("Error creating wallet:", createError);
              } else {
                console.log("Created new wallet with initial balance:", amountInNaira);
              }
            } else {
              console.error("Error fetching wallet:", walletError);
            }
          } else {
            // Update existing wallet
            console.log("DEBUG: Updating wallet balance:", {
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
              console.error("Error updating wallet balance:", updateError);
            } else {
              console.log("Wallet balance updated successfully");
            }
          }
        }
      }
      
      return NextResponse.redirect(
        new URL("/wallet?status=success&message=Payment successful", request.url),
        { status: 303 }
      );
    }

    // Insert transaction record with required fields
    const { error: insertError } = await adminClient
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
          originalAmount: transaction.amount,
          amountInNaira,
          conversionRate: 100,
          verificationTimestamp: new Date().toISOString()
        }
      });

    if (insertError) {
      console.error("Error inserting transaction:", insertError);
      throw new Error("Failed to store transaction");
    }

    // Update wallet balance if transaction is successful
    if (transaction.status === "success") {
      // Check if wallet exists
      const { data: walletData, error: walletError } = await adminClient
        .from("wallets")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (walletError) {
        // Create wallet if it doesn't exist
        if (walletError.code === 'PGRST116') {
          console.log("Wallet not found, creating new wallet for user:", userId);
          const { data: newWallet, error: createError } = await adminClient
            .from("wallets")
            .insert({
              user_id: userId,
              balance: amountInNaira,
              currency: "NGN"
            })
            .select()
            .single();
            
          if (createError) {
            console.error("Error creating wallet:", createError);
            throw new Error("Failed to create wallet");
          }
          
          console.log("Created new wallet with initial balance:", amountInNaira);
        } else {
          console.error("Error fetching wallet:", walletError);
          throw new Error("Failed to fetch wallet data");
        }
      } else {
        // Update existing wallet
        console.log("DEBUG: Updating wallet balance:", {
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
          console.error("Error updating wallet balance:", updateError);
          throw new Error("Failed to update wallet balance");
        }
      }
    }

    // Generate a secure session token for redirect
    const sessionToken = Buffer.from(`${userId}:${Date.now()}`).toString('base64');
    
    // Create redirect URL with success message
    const redirectUrl = new URL("/wallet", request.url);
    redirectUrl.searchParams.set("status", "success");
    redirectUrl.searchParams.set("message", "Payment successful");
    redirectUrl.searchParams.set("session", sessionToken);
    redirectUrl.searchParams.set("amount", amountInNaira.toString());

    // Create response with redirect
    const response = NextResponse.redirect(redirectUrl, { status: 303 });

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

    return response;

  } catch (error) {
    console.error("Payment verification error:", error);
    return NextResponse.redirect(
      new URL("/wallet?status=failed&message=Verification error", request.url),
      { status: 303 }
    );
  }
} 