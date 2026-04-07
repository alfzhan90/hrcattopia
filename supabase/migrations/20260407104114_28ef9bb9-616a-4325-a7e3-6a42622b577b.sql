ALTER TABLE public.staff_profiles
  ADD COLUMN IF NOT EXISTS freelancer_ot_enabled boolean NOT NULL DEFAULT false;