import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { initializeTransaction, verifyTransaction, generateTransactionReference } from '@/lib/paystack';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient as createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/payment - Initialize a payment transaction
 */
export async function POST(request: NextRequest) {
  try {
    // Debug: Log the request headers
    console.log('Payment API Request Headers:', Object.fromEntries(request.headers.entries()));
    
    // Log any raw cookies for debugging purposes
    const authCookie = request.cookies.get('sb-rtbqpprntygrgxopxoei-auth-token');
    console.log('Direct cookie from request:', authCookie ? 'Found' : 'Not found');
    
    // Parse the request body
    const body = await request.json();
    const { amount, email } = body;

    console.log('Payment API Request Body:', { amount, email });

    if (!amount || !email) {
      return NextResponse.json(
        { error: 'Amount and email are required' },
        { status: 400 }
      );
    }
    
    // Get auth token from authorization header
    const authHeader = request.headers.get('authorization');
    let token = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
      console.log('Found auth token in Authorization header');
    }
    
    // Create Supabase client with direct cookie handling
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            // We can't set cookies here since we're in a server component
            // This is handled in the response
          },
          remove(name: string, options: any) {
            // We can't remove cookies here since we're in a server component
            // This is handled in the response
          },
        },
      }
    );
    
    // Try to get session from token if available
    let session = null;
    
    if (token) {
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data?.user) {
        // Manually create a session for the authenticated user
        console.log('Successfully authenticated user from token:', data.user.id);
        session = {
          user: data.user,
          access_token: token
        };
      } else {
        console.error('Failed to authenticate with provided token:', error);
      }
    }
    
    // If no session from token, try regular session
    if (!session) {
      const { data: { session: cookieSession }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error:', sessionError);
        return NextResponse.json(
          { error: 'Authentication error' },
          { status: 401 }
        );
      }
      
      if (!cookieSession) {
        console.log('No session found');
        return NextResponse.json(
          { error: 'You must be logged in to make a payment' },
          { status: 401 }
        );
      }
      
      session = cookieSession;
    }
    
    // Get user details
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      );
    }
    
    const userEmail = session.user.email || '';
    const userId = session.user.id;
    
    console.log('User authenticated:', { userId, userEmail });
    
    if (!userEmail || userEmail !== email) {
      console.log('Email mismatch:', { sessionEmail: userEmail, requestEmail: email });
      return NextResponse.json(
        { error: 'Email mismatch. Please use your registered email.' },
        { status: 400 }
      );
    }

    // Initialize Paystack transaction
    console.log("Initializing Paystack transaction...");
    console.log("DEBUG: Amount conversion for Paystack:", {
      originalAmount: amount,
      amountInKobo: amount * 100,
      conversionRate: 100
    });

    // Determine the callback URL - use environment variable or construct from request
    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                      `${request.headers.get('x-forwarded-proto') || 'http'}://${request.headers.get('x-forwarded-host')}`;
    const callbackUrl = `${appBaseUrl}/api/payment/verify`;
    
    console.log("Using callback URL base:", appBaseUrl);
    console.log("Full callback URL:", callbackUrl);

    // Generate a unique reference for this transaction
    const reference = `TXN-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;

    const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: userEmail,
        amount: amount * 100, // Convert to kobo for Paystack
        reference: reference,
        callback_url: `${callbackUrl}?reference=${reference}`, // Include reference in callback URL
        metadata: {
          userId,
          originalAmount: amount, // Store original amount in naira
          conversionRate: 100,
          timestamp: new Date().toISOString()
        }
      }),
    });

    const paystackData = await paystackResponse.json();
    console.log("Paystack response:", paystackData);

    if (!paystackData.status) {
      throw new Error(paystackData.message || "Failed to initialize payment");
    }

    // Store transaction in database
    console.log("Storing transaction in database...");
    const adminClient = createAdminClient();
    const { error: insertError } = await adminClient
      .from("transactions")
      .insert({
        user_id: userId,
        amount: amount, // Store amount in naira
        reference: paystackData.data.reference,
        status: "pending",
        payment_provider: "paystack",
        transaction_type: "wallet_funding",
        type: "credit",
        metadata: {
          paystackReference: paystackData.data.reference,
          originalAmount: amount,
          amountInKobo: amount * 100,
          conversionRate: 100,
          timestamp: new Date().toISOString()
        }
      });

    if (insertError) {
      console.error("Database error when inserting transaction:", insertError);
      throw new Error("Failed to store transaction");
    }

    // Set success response
    return NextResponse.json({
      status: "success",
      data: {
        reference: paystackData.data.reference,
        authorization_url: paystackData.data.authorization_url,
      },
    });

  } catch (error) {
    console.error("Payment initialization error:", error);
    
    return NextResponse.json(
      { error: "Failed to initialize payment" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/payment/verify - Verify a payment transaction
 */
export async function GET(request: NextRequest) {
  try {
    // Get reference from URL
    const { searchParams } = new URL(request.url);
    const reference = searchParams.get('reference');

    if (!reference) {
      return NextResponse.json(
        { error: 'Transaction reference is required' },
        { status: 400 }
      );
    }
    
    // Create the Supabase client - now awaited
    const supabase = await createClient();
    
    // Check if user is authenticated
    console.log('Checking session in verification API...');
    const { data, error: sessionError } = await supabase.auth.getSession();
    
    console.log('Verification API session result:', { 
      hasSession: !!data.session, 
      user: data.session?.user ? {
        id: data.session.user.id,
        email: data.session.user.email
      } : null,
      sessionError: sessionError ? sessionError.message : null 
    });
    
    if (sessionError) {
      console.error('Session error:', sessionError);
      return NextResponse.json(
        { error: 'Authentication error' },
        { status: 401 }
      );
    }
    
    if (!data.session) {
      return NextResponse.json(
        { error: 'You must be logged in to verify a payment' },
        { status: 401 }
      );
    }

    // Verify the transaction with Paystack
    const verificationResult = await verifyTransaction(reference);

    // Only update database if verification is successful
    if (verificationResult.data.status === 'success') {
      try {
        // Create the admin client to bypass RLS
        const adminClient = createAdminClient();
        
        // Check if transaction exists in our database
        const { data: existingTransaction, error: queryError } = await adminClient
          .from('transactions')
          .select('*')
          .eq('reference', reference)
          .single();

        if (queryError) {
          console.error('Error querying transaction:', queryError);
        }

        if (existingTransaction) {
          // Update existing transaction
          const { error } = await adminClient
            .from('transactions')
            .update({
              status: 'completed',
              updated_at: new Date().toISOString(),
            })
            .eq('reference', reference);

          if (error) {
            console.error('Error updating transaction:', error);
          }
        } else {
          // Create a new transaction record if it doesn't exist
          const { error } = await adminClient
            .from('transactions')
            .insert({
              user_id: data.session.user.id,
              reference,
              amount: verificationResult.data.amount / 100, // Convert from kobo to naira
              status: 'completed',
              payment_gateway: 'paystack',
              payment_gateway_reference: verificationResult.data.reference,
              transaction_type: 'wallet_funding',
              metadata: verificationResult.data,
            });

          if (error) {
            console.error('Error creating transaction:', error);
          }
        }
      } catch (dbError) {
        console.error('Database error:', dbError);
      }
    }

    return NextResponse.json({ data: verificationResult.data });
  } catch (error) {
    console.error('Payment verification error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to verify payment' },
      { status: 500 }
    );
  }
}
