-- Allow area managers to manage schedules across all branches (not only assigned ones)
DROP POLICY IF EXISTS "Area managers view branch schedules" ON public.schedules;
DROP POLICY IF EXISTS "Area managers insert branch schedules" ON public.schedules;
DROP POLICY IF EXISTS "Area managers update branch schedules" ON public.schedules;
DROP POLICY IF EXISTS "Area managers delete branch schedules" ON public.schedules;

CREATE POLICY "Area managers view all schedules"
ON public.schedules FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'area_manager'::app_role));

CREATE POLICY "Area managers insert any schedule"
ON public.schedules FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'area_manager'::app_role));

CREATE POLICY "Area managers update any schedule"
ON public.schedules FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'area_manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'area_manager'::app_role));

CREATE POLICY "Area managers delete any schedule"
ON public.schedules FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'area_manager'::app_role));

-- Also allow area managers to view all active staff profiles (needed to populate planner picker)
DROP POLICY IF EXISTS "Area managers view branch staff" ON public.staff_profiles;
CREATE POLICY "Area managers view all staff"
ON public.staff_profiles FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'area_manager'::app_role));