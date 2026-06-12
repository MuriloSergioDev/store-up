-- Fix infinite recursion in RLS policies caused by policies on `profiles`
-- querying `profiles` itself (triggering themselves recursively).
--
-- Solution: a SECURITY DEFINER function that bypasses RLS when checking
-- whether the current user is an admin.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Re-create the recursive policies using the safe function instead

DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;
CREATE POLICY "Admins can manage all profiles" ON profiles
  FOR ALL TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage categories" ON categories;
CREATE POLICY "Admins can manage categories" ON categories
  FOR ALL TO authenticated
  USING (public.is_admin());

-- Fix any other policies that use the same recursive pattern
DROP POLICY IF EXISTS "Admins can delete items" ON items;
CREATE POLICY "Admins can delete items" ON items
  FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update/delete sales" ON sales;
CREATE POLICY "Admins can update/delete sales" ON sales
  FOR UPDATE TO authenticated
  USING (public.is_admin());
