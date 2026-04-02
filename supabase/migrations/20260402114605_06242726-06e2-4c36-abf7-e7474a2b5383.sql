CREATE TRIGGER trg_generate_staff_id
  BEFORE INSERT ON public.staff_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_staff_id();