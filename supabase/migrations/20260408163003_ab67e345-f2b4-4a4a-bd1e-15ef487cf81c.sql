-- Add status/exit fields to staff_profiles
ALTER TABLE public.staff_profiles
  ADD COLUMN IF NOT EXISTS employment_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS exit_date date,
  ADD COLUMN IF NOT EXISTS exit_reason text,
  ADD COLUMN IF NOT EXISTS leave_encashment_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS access_revoke_date date;

-- Create role_history table
CREATE TABLE public.role_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_profile_id uuid NOT NULL REFERENCES public.staff_profiles(id) ON DELETE CASCADE,
  old_role text NOT NULL,
  new_role text NOT NULL,
  old_rate numeric NOT NULL DEFAULT 0,
  new_rate numeric NOT NULL DEFAULT 0,
  effective_date date NOT NULL,
  reason text,
  action_type text NOT NULL DEFAULT 'conversion', -- conversion, resignation, termination, reactivation
  changed_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.role_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage role history"
  ON public.role_history FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can view own role history"
  ON public.role_history FOR SELECT TO authenticated
  USING (staff_profile_id IN (
    SELECT id FROM public.staff_profiles WHERE user_id = auth.uid()
  ));