-- Promote staff who are flagged as Area-Manager employment_type to the area_manager role
UPDATE public.user_roles ur
SET role = 'area_manager'
FROM public.staff_profiles sp
WHERE sp.user_id = ur.user_id
  AND sp.employment_type = 'Area-Manager'
  AND ur.role = 'staff';

-- For any Area-Manager staff missing a user_roles entry entirely, insert one
INSERT INTO public.user_roles (user_id, role)
SELECT sp.user_id, 'area_manager'
FROM public.staff_profiles sp
WHERE sp.employment_type = 'Area-Manager'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = sp.user_id
  );