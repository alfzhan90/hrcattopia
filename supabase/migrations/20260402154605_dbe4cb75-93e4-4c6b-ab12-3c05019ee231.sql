
-- Add Area-Manager to employment_type enum
ALTER TYPE public.employment_type ADD VALUE IF NOT EXISTS 'Area-Manager';

-- Create branch_visits table for area manager travel logging
CREATE TABLE public.branch_visits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_profile_id UUID NOT NULL REFERENCES public.staff_profiles(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  visited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  check_in_lat DOUBLE PRECISION,
  check_in_long DOUBLE PRECISION,
  distance_from_previous_km NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.branch_visits ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage branch visits"
  ON public.branch_visits FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can view own visits"
  ON public.branch_visits FOR SELECT
  TO authenticated
  USING (staff_profile_id IN (
    SELECT id FROM public.staff_profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Staff can insert own visits"
  ON public.branch_visits FOR INSERT
  TO authenticated
  WITH CHECK (staff_profile_id IN (
    SELECT id FROM public.staff_profiles WHERE user_id = auth.uid()
  ));

-- Add mileage_claim to payroll_runs
ALTER TABLE public.payroll_runs ADD COLUMN IF NOT EXISTS mileage_claim NUMERIC NOT NULL DEFAULT 0;

-- Add privacy tracking toggle to staff_profiles
ALTER TABLE public.staff_profiles ADD COLUMN IF NOT EXISTS privacy_tracking_enabled BOOLEAN NOT NULL DEFAULT true;
