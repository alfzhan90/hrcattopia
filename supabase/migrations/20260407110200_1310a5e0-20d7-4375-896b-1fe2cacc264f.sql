ALTER TABLE public.staff_profiles
  ADD COLUMN IF NOT EXISTS tax_reference_number text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS passport_number text DEFAULT NULL;