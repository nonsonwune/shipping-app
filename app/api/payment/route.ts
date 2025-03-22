import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { initializeTransaction, verifyTransaction, generateTransactionReference } from '@/lib/paystack';

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
    
    // Try to get the Authorization token from the header
    const authHeader = request.headers.get('authorization');
    let user = null;
    
    // Create standard Supabase client for server - now async
    const supabase = await createClient();
    
    // Try cookie-based auth first
    console.log('Trying cookie-based authentication...');
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Cookie auth result:', { hasSession: !!session });
      
      if (session) {
        user = session.user;
        console.log('User authenticated via cookie:', { id: user.id, email: user.email });
      }
    } catch (cookieError) {
      console.error('Cookie auth error:', cookieError);
    }
    
    // If cookie auth failed, try token-based auth
    if (!user && authHeader && authHeader.startsWith('Bearer ')) {
      console.log('Trying token-based authentication...');
      const token = authHeader.replace('Bearer ', '');
      
      try {
        const { data, error } = await supabase.auth.getUser(token);
        
        if (error) {
          console.error('Token authentication error:', error);
        } else if (data.user) {
          user = data.user;
          console.log('User authenticated via token:', { id: user.id, email: user.email });
        }
      } catch (tokenError) {
        console.error('Token processing error:', tokenError);
      }
    }
    
    // If no user is authenticated, return 401
    if (!user) {
      console.log('No authenticated user found');
      return NextResponse.json(
        { error: 'You must be logged in to make a payment' },
        { status: 401 }
      );
    }

    // Get user details
    const userEmail = user.email || '';
    const userId = user.id;
    
    console.log('User authenticated:', { userId, userEmail });
    
    if (!userEmail || userEmail !== email) {
      console.log('Email mismatch:', { sessionEmail: userEmail, requestEmail: email });
      return NextResponse.json(
        { error: 'Email mismatch. Please use your registered email.' },
        { status: 400 }
      );
    }

    // Generate a unique reference for this transaction
    const reference = generateTransactionReference();
    
    // Create metadata for the transaction
    const metadata = {
      user_id: userId,
      transaction_type: 'wallet_funding',
    };

    // Initialize a transaction with Paystack
    console.log('Initializing Paystack transaction...');
    const paystackResponse = await initializeTransaction({
      amount,
      email: userEmail,
      reference,
      metadata: {
        ...metadata,
        custom_fields: [
          {
            display_name: "Email Address",
            variable_name: "email",
            value: userEmail
          },
          {
            display_name: "User ID",
            variable_name: "user_id",
            value: userId
          }
        ]
      },
      // Update to use our new API verification endpoint instead of frontend page
      callback_url: `${request.nextUrl.origin}/api/payment/verify?reference=${reference}`,
    });

    console.log('Paystack response:', paystackResponse.data);

    // Check if transactions table structure exists before inserting
    try {
      console.log('Storing transaction in database...');
      
      // First, check if we can get the table structure
      const { error: tableCheckError } = await supabase
        .from('transactions')
        .select('id')
        .limit(1);
      
      if (tableCheckError) {
        console.error('Error checking transactions table:', tableCheckError);
        // Don't try to insert if table structure is invalid
      } else {
        // Attempt to insert with proper error handling
        try {
          const { error } = await supabase
            .from('transactions')
            .insert({
              user_id: userId,
              reference,
              amount,
              status: 'pending',
              transaction_type: 'wallet_funding',
              metadata: {
                email: userEmail,
                user_id: userId,
                authorization_url: paystackResponse.data.authorization_url,
                access_code: paystackResponse.data.access_code,
              },
            });

          if (error) {
            console.error('Database error when inserting transaction:', error);
            // Log detailed error but continue payment flow
          } else {
            console.log('Transaction successfully recorded in database');
          }
        } catch (insertError) {
          console.error('Failed to insert transaction record:', insertError);
        }
      }
    } catch (dbError) {
      console.error('Database error:', dbError);
      // Continue with the payment flow even if DB insertion fails
    }

    return NextResponse.json({ data: paystackResponse.data });
  } catch (error) {
    console.error('Payment initiation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process payment' },
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
        // Check if transaction exists in our database
        const { data: existingTransaction, error: queryError } = await supabase
          .from('transactions')
          .select('*')
          .eq('reference', reference)
          .single();

        if (queryError) {
          console.error('Error querying transaction:', queryError);
        }

        if (existingTransaction) {
          // Update existing transaction
          const { error } = await supabase
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
          const { error } = await supabase
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
