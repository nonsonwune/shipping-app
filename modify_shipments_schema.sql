-- 1. Create the shipment_items table
CREATE TABLE public.shipment_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    shipment_id uuid NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE, -- Link to the main shipment
    description text NOT NULL,
    weight numeric NOT NULL,
    quantity integer NOT NULL DEFAULT 1,
    category text,
    dimensions text, -- Optional: store as text "LxWxH" or separate numeric cols
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Add comments for clarity
COMMENT ON TABLE public.shipment_items IS 'Stores individual items belonging to a single shipment.';
COMMENT ON COLUMN public.shipment_items.shipment_id IS 'Foreign key referencing the main shipment record in the shipments table.';
COMMENT ON COLUMN public.shipment_items.dimensions IS 'Optional dimensions, format like LxWxH in cm.';

-- 2. Enable RLS for the new table
ALTER TABLE public.shipment_items ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policy: Users can view items belonging to their own shipments
DROP POLICY IF EXISTS "Users can view items for their own shipments" ON public.shipment_items;
CREATE POLICY "Users can view items for their own shipments" ON public.shipment_items
FOR SELECT USING (
  auth.uid() = (SELECT user_id FROM public.shipments WHERE id = shipment_id)
);

-- 4. RLS Policy: Users can insert items for their own shipments (primarily for backend use)
DROP POLICY IF EXISTS "Users can insert items for their own shipments" ON public.shipment_items;
CREATE POLICY "Users can insert items for their own shipments" ON public.shipment_items
FOR INSERT WITH CHECK (
  auth.uid() = (SELECT user_id FROM public.shipments WHERE id = shipment_id)
);

-- Allow service_role to bypass RLS (important for backend operations)
-- Policies for UPDATE and DELETE can be added if needed, but likely handled by backend logic


-- 5. Add Indexes
CREATE INDEX IF NOT EXISTS idx_shipment_items_shipment_id ON public.shipment_items(shipment_id);

-- 6. Remove redundant columns from the shipments table
-- WARNING: This assumes you no longer need these columns directly on the shipments table.
-- Backup your data before running this in production.
ALTER TABLE public.shipments
DROP COLUMN IF EXISTS weight,
DROP COLUMN IF EXISTS dimensions,
DROP COLUMN IF EXISTS description;

-- 7. (Optional but Recommended) Add total_weight back to shipments if useful for quick lookups
-- ALTER TABLE public.shipments
-- ADD COLUMN IF NOT EXISTS total_weight numeric;
-- COMMENT ON COLUMN public.shipments.total_weight IS 'Calculated total weight of all items in the shipment (kg). Might require a trigger or backend logic to keep updated.';

-- 8. (Optional but Recommended) Rename 'amount' to 'total_amount' on shipments for clarity
-- ALTER TABLE public.shipments
-- RENAME COLUMN amount TO total_amount;

-- Grant usage permissions on the new table
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.shipment_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.shipment_items TO service_role; -- Ensure service role can operate


SELECT 'Schema modification script complete.';
