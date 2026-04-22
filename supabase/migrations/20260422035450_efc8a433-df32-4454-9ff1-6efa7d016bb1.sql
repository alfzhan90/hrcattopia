
-- 2. Helper: is the user an area manager assigned to a given branch?
CREATE TABLE IF NOT EXISTS public.area_manager_branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, branch_id)
);

ALTER TABLE public.area_manager_branches ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_area_manager_for_branch(_user_id uuid, _branch_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.area_manager_branches
    WHERE user_id = _user_id AND branch_id = _branch_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_area_manager_for_staff(_user_id uuid, _staff_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff_profiles sp
    JOIN public.area_manager_branches amb ON amb.branch_id = sp.branch_id
    WHERE sp.id = _staff_profile_id AND amb.user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_area_manager_for_attendance_user(_manager_id uuid, _attendance_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff_profiles sp
    JOIN public.area_manager_branches amb ON amb.branch_id = sp.branch_id
    WHERE sp.user_id = _attendance_user_id AND amb.user_id = _manager_id
  )
$$;

-- RLS for area_manager_branches
CREATE POLICY "Admins manage area manager assignments"
  ON public.area_manager_branches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers view own assignments"
  ON public.area_manager_branches FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 3. schedules table
CREATE TABLE IF NOT EXISTS public.schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_profile_id uuid NOT NULL REFERENCES public.staff_profiles(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schedules_staff_date ON public.schedules(staff_profile_id, date);
CREATE INDEX IF NOT EXISTS idx_schedules_branch_date ON public.schedules(branch_id, date);

ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all schedules"
  ON public.schedules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Area managers view branch schedules"
  ON public.schedules FOR SELECT TO authenticated
  USING (public.is_area_manager_for_branch(auth.uid(), branch_id));

CREATE POLICY "Area managers insert branch schedules"
  ON public.schedules FOR INSERT TO authenticated
  WITH CHECK (public.is_area_manager_for_branch(auth.uid(), branch_id));

CREATE POLICY "Area managers update branch schedules"
  ON public.schedules FOR UPDATE TO authenticated
  USING (public.is_area_manager_for_branch(auth.uid(), branch_id))
  WITH CHECK (public.is_area_manager_for_branch(auth.uid(), branch_id));

CREATE POLICY "Area managers delete branch schedules"
  ON public.schedules FOR DELETE TO authenticated
  USING (public.is_area_manager_for_branch(auth.uid(), branch_id));

CREATE POLICY "Staff view own schedules"
  ON public.schedules FOR SELECT TO authenticated
  USING (
    staff_profile_id IN (
      SELECT id FROM public.staff_profiles WHERE user_id = auth.uid()
    )
  );

CREATE TRIGGER update_schedules_updated_at
  BEFORE UPDATE ON public.schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. attendance_logs new fields
DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM ('automatic', 'pending_approval', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.attendance_logs
  ADD COLUMN IF NOT EXISTS payment_status public.payment_status NOT NULL DEFAULT 'automatic',
  ADD COLUMN IF NOT EXISTS manager_notes text;

-- Allow area managers to update payment_status / manager_notes for staff in their branches
CREATE POLICY "Area managers update branch attendance approvals"
  ON public.attendance_logs FOR UPDATE TO authenticated
  USING (public.is_area_manager_for_attendance_user(auth.uid(), user_id))
  WITH CHECK (public.is_area_manager_for_attendance_user(auth.uid(), user_id));

CREATE POLICY "Area managers view branch attendance"
  ON public.attendance_logs FOR SELECT TO authenticated
  USING (public.is_area_manager_for_attendance_user(auth.uid(), user_id));

-- Allow area managers to view staff profiles in their branches (needed for joins)
CREATE POLICY "Area managers view branch staff"
  ON public.staff_profiles FOR SELECT TO authenticated
  USING (
    branch_id IS NOT NULL AND public.is_area_manager_for_branch(auth.uid(), branch_id)
  );
