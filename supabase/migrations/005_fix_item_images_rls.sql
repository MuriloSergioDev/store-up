-- The FOR ALL USING (true) policy on item_images lacks an explicit WITH CHECK
-- clause. Supabase/PostgREST requires WITH CHECK for INSERT to pass RLS.
-- Replace with explicit per-operation policies matching the items table pattern.

DROP POLICY IF EXISTS "Authenticated users can manage images" ON item_images;
DROP POLICY IF EXISTS "Authenticated users can view images" ON item_images;

CREATE POLICY "Authenticated users can view images"   ON item_images FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert images" ON item_images FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update images" ON item_images FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete images" ON item_images FOR DELETE TO authenticated USING (true);
