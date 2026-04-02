-- Replace the generate_staff_id function with new CT format
CREATE OR REPLACE FUNCTION public.generate_staff_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  next_num INT;
BEGIN
  next_num := nextval('staff_id_seq');
  NEW.staff_id := 'CT' || TO_CHAR(now(), 'YY') || LPAD(next_num::TEXT, 2, '0');
  RETURN NEW;
END;
$function$;