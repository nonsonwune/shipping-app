import { NextRequest, NextResponse } from 'next/server';
import { Database } from '@/types/supabase'; // Assuming you have this types file
import { createClient as createAdminClient } from '@/lib/supabase/admin'; // Import admin client

// Define the expected structure for each item in the request
interface ShipmentItemInput {
  description: string;
  weight: number; // Expecting number from frontend conversion
  quantity: number; // Expecting number
  category?: string;
  dimensions?: string;
}

// Define the expected request body structure
interface CreateShipmentRequestBody {
  serviceType: string;
  origin: string;
  destination: string;
  recipientName: string;
  recipientPhone: string;
  deliveryAddress: string;
  deliveryInstructions?: string;
  paymentMethod: string;
  items: ShipmentItemInput[];
}

// Placeholder for actual pricing logic - replace with your real calculation
function calculateTotalPrice(items: ShipmentItemInput[], serviceType: string): number {
  let total = 0;
  const baseRate = serviceType.includes('air') ? 2500 : serviceType.includes('sea') ? 1500 : 1200;
  const taxRate = 0.075;
  const insuranceRate = 0.05;

  items.forEach(item => {
    const itemWeight = item.weight || 0;
    const itemQuantity = item.quantity || 1;
    const itemBasePrice = itemWeight * itemQuantity * baseRate;
    total += itemBasePrice;
  });

  const tax = total * taxRate;
  const insurance = total * insuranceRate;
  return Math.round(total + tax + insurance);
}

export async function POST(request: NextRequest) {
  console.log('[API Route] Starting shipment creation process');

  const authHeader = request.headers.get('authorization');
  let userId = null;
  let adminClient = null;
  let responseSent = false;

  try {
    // Simplify: Directly attempt token authentication
    if (authHeader && authHeader.startsWith('Bearer ')) {
      console.log('Attempting token-based authentication for shipment creation...');
      const token = authHeader.replace('Bearer ', '');
      
      // Log token information for debugging (first few chars only for security)
      console.log(`Token received (truncated): ${token.substring(0, 10)}...`);
      
      try {
        // Initialize admin client
        adminClient = createAdminClient(); 
        
        // Improved error handling for token verification
        try {
          const { data, error } = await adminClient.auth.getUser(token);
          
          if (error) {
            console.error('Token authentication error:', error.message);
            // If token is invalid, treat as unauthorized
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
          } else if (data.user) {
            userId = data.user.id;
            console.log('User authenticated via token for shipment creation:', userId);
          }
        } catch (tokenVerifyError) {
          console.error('Token verification error:', tokenVerifyError);
          
          // Try alternate authentication if token verification fails
          console.log('Attempting to get session directly...');
          const { data: sessionData } = await adminClient.auth.getSession();
          
          if (sessionData.session?.user) {
            userId = sessionData.session.user.id;
            console.log('User authenticated via session for shipment creation:', userId);
          } else {
            console.error('Session authentication failed, no user found');
            return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
          }
        }
      } catch (tokenError) {
        console.error('Token processing error:', tokenError);
        return NextResponse.json({ error: 'Token processing failed' }, { status: 500 });
      }
    } else {
      // No Authorization header found
       console.error('API Error: Missing Authorization header');
       return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
    }
    
    // Check if userId was successfully obtained
    if (!userId) {
      // This case should theoretically be covered above, but as a safeguard:
      console.error('API Error: Authentication failed, user ID not found after checks.');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse Request Body
    const body = await request.json();
    const { 
      items, 
      serviceType,
      origin,
      destination,
      recipientName,
      recipientPhone,
      deliveryAddress,
      deliveryInstructions,
      paymentMethod 
    } = body;

    // 3. Validate Input (Basic)
    if (!items || items.length === 0 || !serviceType || !origin || !destination || !recipientName || !recipientPhone || !deliveryAddress || !paymentMethod) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 4. Calculate Total Price
    const totalAmount = calculateTotalPrice(items, serviceType);

    // 5. Handle Payment (Wallet Example)
    const client = adminClient; // No fallback to standard client needed
    if (paymentMethod === 'wallet') {
      const { data: wallet, error: walletError } = await client
        .from('wallets')
        .select('balance')
        .eq('user_id', userId)
        .single();

      if (walletError || !wallet) {
        console.error('API Error: Failed to fetch wallet', walletError);
        return NextResponse.json({ error: 'Failed to verify wallet balance' }, { status: 500 });
      }

      if (wallet.balance < totalAmount) {
        return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 400 });
      }
    } else {
      // Handle other payment methods
      return NextResponse.json({ error: 'Selected payment method not implemented yet' }, { status: 501 });
    }

    // 6. Call the Database Function to Create Shipment and Items
    console.log(`Calling create_shipment_with_items for user ${userId}`);
    const { data: shipmentResult, error: rpcError } = await client.rpc('create_shipment_with_items', {
        p_user_id: userId,
        p_service_type: serviceType,
        p_origin: origin,
        p_destination: destination,
        p_recipient_name: recipientName,
        p_recipient_phone: recipientPhone,
        p_delivery_address: deliveryAddress,
        p_delivery_instructions: deliveryInstructions || '',
        p_payment_method: paymentMethod,
        p_total_amount: totalAmount,
        p_items: items
    });

    if (rpcError) {
      console.error('API Error: RPC function failed', rpcError);
      return NextResponse.json({ error: 'Failed to create shipment in database', details: rpcError.message }, { status: 500 });
    }

    if (!shipmentResult || !Array.isArray(shipmentResult) || shipmentResult.length === 0) {
        console.error('API Error: RPC function returned no result');
        return NextResponse.json({ error: 'Failed to create shipment, function returned empty.' }, { status: 500 });
    }

    const newShipment = shipmentResult[0]; // RPC returns an array with one object
    console.log('Shipment and items created successfully via RPC:', newShipment);

    // 7. Deduct from Wallet (if applicable and AFTER successful creation)
    if (paymentMethod === 'wallet') {
        // Re-fetch wallet balance just before deduction for accuracy
        const { data: walletBeforeDeduct, error: fetchError } = await client
            .from('wallets')
            .select('balance')
            .eq('user_id', userId)
            .single();

        if (fetchError || !walletBeforeDeduct) {
             console.error(`CRITICAL ERROR: Failed to fetch wallet balance before deduction for shipment ${newShipment.shipment_id}!`, fetchError);
             // Return success to user, but flag internally.
             responseSent = true;
             return NextResponse.json({ 
                message: 'Shipment booked, but payment processing issue occurred. Contact support.', 
                shipmentId: newShipment.shipment_id, 
                trackingNumber: newShipment.tracking_number,
                warning: 'Payment deduction failed (fetch error)'
             }, { status: 207 });
        }
        
        const newBalance = walletBeforeDeduct.balance - totalAmount;
        if (newBalance < 0) {
            // This shouldn't happen if the initial check passed, but as a safeguard
            console.error(`CRITICAL ERROR: Calculated negative balance for user ${userId} during deduction!`);
             responseSent = true;
             return NextResponse.json({ 
                message: 'Shipment booked, but payment processing calculation error. Contact support.', 
                shipmentId: newShipment.shipment_id, 
                trackingNumber: newShipment.tracking_number,
                warning: 'Payment calculation error'
             }, { status: 207 });
        }

        console.log(`Attempting wallet deduction for user ${userId}. Old Balance: ${walletBeforeDeduct.balance}, Amount: ${totalAmount}, New Balance: ${newBalance}`);
        const { error: deductError } = await client
            .from('wallets')
            .update({ balance: newBalance }) // Update with the calculated balance
            .eq('user_id', userId);

        if (deductError) {
            // CRITICAL: Shipment created but payment failed. Log this for manual intervention!
            console.error(`CRITICAL ERROR: Shipment ${newShipment.shipment_id} created but wallet deduction failed!`, deductError);
            // Optionally, try to update shipment status to 'payment_failed'
            // Return success to user for now, but flag internally.
             responseSent = true;
             return NextResponse.json({ 
                message: 'Shipment booked, but payment processing issue occurred. Contact support.', 
                shipmentId: newShipment.shipment_id, 
                trackingNumber: newShipment.tracking_number,
                warning: 'Payment deduction failed'
             }, { status: 207 }); // Multi-Status
        }
         console.log(`Wallet deduction successful for user ${userId}`);
    }

    // 8. Return Success Response
    if (!responseSent) {
        return NextResponse.json({ 
            message: 'Shipment created successfully', 
            shipmentId: newShipment.shipment_id, 
            trackingNumber: newShipment.tracking_number 
        }, { status: 201 });
    }

  } catch (error: any) {
    console.error('API Error: Unexpected error', error);
     if (!responseSent) {
        return NextResponse.json({ error: 'An unexpected error occurred', details: error.message }, { status: 500 });
     }
     // If a response was already sent (like the 207), don't send another
     return; 
  }
}
