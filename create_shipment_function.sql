-- Function to create a shipment and its items atomically
CREATE OR REPLACE FUNCTION public.create_shipment_with_items(
    p_user_id uuid,
    p_service_type text,
    p_origin text,
    p_destination text,
    p_recipient_name text,
    p_recipient_phone text,
    p_delivery_address text,
    p_delivery_instructions text,
    p_payment_method text,
    p_total_amount numeric,
    p_items jsonb -- Array of items: [{description, weight, quantity, category, dimensions}]
)
RETURNS TABLE (shipment_id uuid, tracking_number text)
LANGUAGE plpgsql
SECURITY DEFINER -- Allows function to run with elevated privileges to insert across tables
SET search_path = public
AS $$
DECLARE
    new_shipment_id uuid;
    new_tracking_number text;
    item_data jsonb;
BEGIN
    -- Generate tracking number
    new_tracking_number := 'SHP' || TO_CHAR(NOW(), 'YYMMDDHH24MISS') || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');

    -- 1. Insert into the main shipments table
    INSERT INTO public.shipments (
        user_id,
        service_type,
        origin_text,
        destination_text,
        recipient_name,
        recipient_phone,
        delivery_address,
        delivery_instructions,
        payment_method,
        amount,
        status,
        tracking_number
    )
    VALUES (
        p_user_id,
        p_service_type,
        p_origin,
        p_destination,
        p_recipient_name,
        p_recipient_phone,
        p_delivery_address,
        p_delivery_instructions,
        p_payment_method,
        p_total_amount,
        'pending',
        new_tracking_number
    )
    RETURNING id INTO new_shipment_id;

    -- Check if shipment insertion was successful
    IF new_shipment_id IS NULL THEN
        RAISE EXCEPTION 'Failed to insert shipment record.';
    END IF;

    -- 2. Loop through the items array and insert into shipment_items
    FOR item_data IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.shipment_items (
            shipment_id,
            description,
            weight,
            quantity,
            category,
            dimensions
        )
        VALUES (
            new_shipment_id,
            item_data->>'description',
            (item_data->>'weight')::numeric,
            (item_data->>'quantity')::integer,
            item_data->>'category',
            item_data->>'dimensions'
        );
    END LOOP;

    -- Return the new shipment ID and tracking number
    RETURN QUERY SELECT new_shipment_id, new_tracking_number;

END;
$$;

-- Grant execute permission to authenticated users (or service_role if called only from backend)
GRANT EXECUTE ON FUNCTION public.create_shipment_with_items(uuid, text, text, text, text, text, text, text, text, numeric, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_shipment_with_items(uuid, text, text, text, text, text, text, text, text, numeric, jsonb) TO service_role;
