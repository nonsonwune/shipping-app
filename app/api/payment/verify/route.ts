import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';
import { verifyTransaction } from '@/lib/paystack';
import { headers } from 'next/headers';

export async function GET(request: NextRequest) {
  console.log("Payment verification initiated");
  const searchParams = request.nextUrl.searchParams;
  const reference = searchParams.get('reference');

  if (!reference) {
    console.error("No reference provided for verification");
    return NextResponse.redirect(new URL('/', request.url));
  }

  try {
    console.log(`Verifying transaction with reference: ${reference}`);
    
    // Verify the transaction with Paystack
    const verificationResult = await verifyTransaction(reference);
    
    if (!verificationResult.status) {
      console.error("Payment verification failed:", verificationResult.message);
      return NextResponse.redirect(
        new URL(`/wallet?status=failed&message=${encodeURIComponent(verificationResult.message || 'Verification failed')}`, request.url)
      );
    }

    const transactionData = verificationResult.data;
    console.log("Transaction verified successfully:", {
      status: transactionData.status,
      amount: transactionData.amount / 100, // Convert from kobo to Naira
      reference: transactionData.reference
    });

    // Only proceed if payment is successful
    if (transactionData.status === 'success') {
      // Try admin client first, but fall back to regular client if there's an error
      let supabase;
      try {
        // Try to use admin client first
        supabase = createAdminClient(request);
      } catch (adminError) {
        console.log("Admin client creation failed, falling back to regular client:", adminError);
        supabase = await createClient();
      }
      
      // Find the transaction in our database
      const { data: transaction, error: findError } = await supabase
        .from('transactions')
        .select('*')
        .eq('reference', reference)
        .single();

      if (findError) {
        console.error("Error finding transaction in database:", findError);
        // If transaction not found, create a new one
        if (findError.code === 'PGRST116' || findError.code === 'PGRST204') {
          console.log("Transaction not found, creating new transaction record");
          
          // Extract user_id from metadata or fallback to getting it from session
          let userId;
          
          try {
            // Try to get from metadata first
            userId = transactionData.metadata?.user_id;
            
            // If not found in metadata, try to get from session
            if (!userId) {
              const { data } = await supabase.auth.getSession();
              userId = data.session?.user.id;
              console.log("Got user ID from session:", userId);
            }
          } catch (sessionError) {
            console.error("Error getting user ID:", sessionError);
          }
          
          if (!userId) {
            console.error("User ID not found in transaction metadata or session");
            return NextResponse.redirect(
              new URL('/wallet?status=failed&message=User identification failed', request.url)
            );
          }

          // Create transaction record
          const { error: insertError } = await supabase
            .from('transactions')
            .insert({
              user_id: userId,
              reference: transactionData.reference,
              amount: transactionData.amount / 100, // Convert from kobo to Naira
              status: 'completed',
              transaction_type: 'wallet_funding',
              type: 'payment',
              payment_gateway: 'paystack',
              payment_gateway_reference: transactionData.id.toString(),
              metadata: {
                payment_method: transactionData.channel,
                email: transactionData.customer.email,
                paystack_data: transactionData
              }
            });

          if (insertError) {
            console.error("Error creating transaction record:", insertError);
            
            // Even if there's an insert error, try to update wallet balance directly
            try {
              // Check if wallet exists
              const { data: wallet } = await supabase
                .from('wallets')
                .select('*')
                .eq('user_id', userId)
                .single();
                
              if (wallet) {
                // Update existing wallet
                await supabase
                  .from('wallets')
                  .update({
                    balance: wallet.balance + (transactionData.amount / 100),
                    last_updated: new Date().toISOString()
                  })
                  .eq('user_id', userId);
                  
                console.log("Updated wallet balance manually for user:", userId);
              } else {
                // Create new wallet
                await supabase
                  .from('wallets')
                  .insert({
                    user_id: userId,
                    balance: transactionData.amount / 100,
                    currency: 'NGN'
                  });
                  
                console.log("Created new wallet manually for user:", userId);
              }
            } catch (walletError) {
              console.error("Manual wallet update failed:", walletError);
              return NextResponse.redirect(
                new URL('/wallet?status=partial&message=Transaction recorded but wallet update failed', request.url)
              );
            }
          } else {
            console.log("Transaction record created successfully");
          }
        } else {
          return NextResponse.redirect(
            new URL('/wallet?status=failed&message=Database error', request.url)
          );
        }
      } else {
        // Transaction exists, update its status
        console.log("Updating existing transaction status to completed");
        const { error: updateError } = await supabase
          .from('transactions')
          .update({
            status: 'completed',
            payment_gateway_reference: transactionData.id.toString(),
            metadata: {
              ...transaction.metadata,
              payment_method: transactionData.channel,
              paystack_data: transactionData
            }
          })
          .eq('reference', reference);

        if (updateError) {
          console.error("Error updating transaction:", updateError);
          
          // Try to update wallet directly if transaction update fails
          try {
            const { data: wallet } = await supabase
              .from('wallets')
              .select('*')
              .eq('user_id', transaction.user_id)
              .single();
              
            if (wallet && transaction.status !== 'completed') {
              await supabase
                .from('wallets')
                .update({
                  balance: wallet.balance + transaction.amount,
                  last_updated: new Date().toISOString()
                })
                .eq('user_id', transaction.user_id);
                
              console.log("Updated wallet balance manually after transaction update error");
            }
          } catch (walletError) {
            console.error("Manual wallet update failed:", walletError);
          }
          
          return NextResponse.redirect(
            new URL('/wallet?status=partial&message=Payment successful but database update failed', request.url)
          );
        }
      }
      
      // Preserve the session by including "replace: true" and not using window.location
      console.log("Transaction processed successfully, redirecting to success page");
      return NextResponse.redirect(
        new URL('/wallet?status=success&message=Payment successful', request.url),
        { status: 303 }
      );
    } else {
      console.log("Payment not successful:", transactionData.status);
      return NextResponse.redirect(
        new URL(`/wallet?status=failed&message=${encodeURIComponent(transactionData.gateway_response)}`, request.url)
      );
    }
  } catch (error: any) {
    console.error("Error during payment verification:", error);
    return NextResponse.redirect(
      new URL(`/wallet?status=error&message=${encodeURIComponent(error.message || 'Verification error')}`, request.url)
    );
  }
}
