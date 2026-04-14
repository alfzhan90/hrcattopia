-- Add toggle for device binding requirement
ALTER TABLE public.staff_profiles
ADD COLUMN is_device_binding_required boolean NOT NULL DEFAULT true;

-- Set to false for existing freelancers
UPDATE public.staff_profiles
SET is_device_binding_required = false
WHERE employment_type = 'Freelancer';