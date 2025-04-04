import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from '@/types/supabase'; // Assuming you have this types file

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
  // console.log('[API Route] Entering POST handler.'); // REMOVED LOG

  // console.log('[API Route] Before cookies() call.'); // REMOVED LOG
  // Explicitly get the cookie store instance first
  const cookieStore = cookies();
  // Corrected log: await cookieStore if it's a promise, then map getAll result
  // const resolvedCookieStore = await (cookieStore instanceof Promise ? cookieStore : Promise.resolve(cookieStore));
  // console.log('[API Route] After cookies() call. Type:', typeof resolvedCookieStore, 'Content:', JSON.stringify(resolvedCookieStore.getAll().map(c => ({ name: c.name, value: c.value })))); // REMOVED LOG

  // console.log('[API Route] Before createRouteHandlerClient call.'); // REMOVED LOG
  // Pass a function that returns the instance to the client creator
  const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });
  // console.log('[API Route] After createRouteHandlerClient call.'); // REMOVED LOG

  let responseSent = false; // Flag to prevent multiple responses

  try {
    // 1. Get User Session
    // console.log('[API Route] Before first supabase.auth.getSession() call.'); // REMOVED LOG
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    // console.log('[API Route] After first supabase.auth.getSession() call. Session exists:', !!session); // REMOVED LOG

    if (sessionError || !session) {
      console.error('API Error: No user session', sessionError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    // 2. Parse Request Body
    const body: CreateShipmentRequestBody = await request.json();
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
    // Add more specific validation for items array content if needed

    // 4. Calculate Total Price
    const totalAmount = calculateTotalPrice(items, serviceType);

    // 5. Handle Payment (Wallet Example)
    if (paymentMethod === 'wallet') {
      // Fetch current balance
      const { data: wallet, error: walletError } = await supabase
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

      // *** IMPORTANT: Wallet deduction should happen AFTER successful shipment creation ***
      // We'll handle this deduction after calling the DB function.
    } else {
      // Handle other payment methods (e.g., initiate Paystack)
      // This part needs implementation based on your chosen provider
      return NextResponse.json({ error: 'Selected payment method not implemented yet' }, { status: 501 });
    }

    // 6. Call the Database Function to Create Shipment and Items
    console.log(`Calling create_shipment_with_items for user ${userId}`);
    const { data: shipmentResult, error: rpcError } = await supabase.rpc('create_shipment_with_items', {
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
        p_items: items // Pass the items array as JSONB
    });

    if (rpcError) {
      console.error('API Error: RPC function failed', rpcError);
      return NextResponse.json({ error: 'Failed to create shipment in database', details: rpcError.message }, { status: 500 });
    }

    if (!shipmentResult || shipmentResult.length === 0) {
        console.error('API Error: RPC function returned no result');
        return NextResponse.json({ error: 'Failed to create shipment, function returned empty.' }, { status: 500 });
    }

    const newShipment = shipmentResult[0]; // RPC returns an array with one object
    console.log('Shipment and items created successfully via RPC:', newShipment);

    // 7. Deduct from Wallet (if applicable and AFTER successful creation)
    if (paymentMethod === 'wallet') {
        // Re-fetch wallet balance just before deduction for accuracy
        const { data: walletBeforeDeduct, error: fetchError } = await supabase
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
        const { error: deductError } = await supabase
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
