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
  const supabase = createRouteHandlerClient({ cookies });
  
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
    const { data: existingTransaction } = await supabase
      .from("transactions")
      .select("*")
      .eq("reference", reference)
      .single();

    if (existingTransaction) {
      console.log("Transaction already exists:", existingTransaction);
      return NextResponse.redirect(
        new URL("/wallet?status=success&message=Transaction already processed", request.url),
        { status: 303 }
      );
    }

    // Insert transaction record
    const { error: insertError } = await supabase
      .from("transactions")
      .insert({
        user_id: userId,
        amount: amountInNaira, // Store amount in naira
        reference: transaction.reference,
        status: transaction.status,
        payment_provider: "paystack",
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
      const { data: walletData, error: walletError } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (walletError) {
        console.error("Error fetching wallet:", walletError);
        throw new Error("Wallet not found");
      }

      console.log("DEBUG: Updating wallet balance:", {
        currentBalance: walletData.balance,
        amountToAdd: amountInNaira,
        newBalance: walletData.balance + amountInNaira
      });

      const { error: updateError } = await supabase
        .from("wallets")
        .update({ balance: walletData.balance + amountInNaira })
        .eq("user_id", userId);

      if (updateError) {
        console.error("Error updating wallet balance:", updateError);
        throw new Error("Failed to update wallet balance");
      }

      // Link transaction to wallet
      const { error: linkError } = await supabase
        .from("wallet_transactions")
        .insert({
          wallet_id: walletData.id,
          transaction_id: transaction.reference,
          amount: amountInNaira,
          type: "credit",
          status: "completed"
        });

      if (linkError) {
        console.error("Error linking transaction to wallet:", linkError);
        throw new Error("Failed to link transaction to wallet");
      }
    }

    // Generate a secure session token for redirect
    const sessionToken = Buffer.from(`${userId}:${Date.now()}`).toString('base64');
    
    // Create redirect URL with success message
    const redirectUrl = new URL("/wallet", request.url);
    redirectUrl.searchParams.set("status", "success");
    redirectUrl.searchParams.set("message", "Payment successful");
    redirectUrl.searchParams.set("session", sessionToken);

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