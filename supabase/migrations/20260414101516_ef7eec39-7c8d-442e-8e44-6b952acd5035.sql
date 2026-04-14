-- Create a database webhook that calls the notify-attendance edge function
-- when a new attendance record is inserted

CREATE OR REPLACE FUNCTION public.notify_attendance_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payload jsonb;
  request_id bigint;
BEGIN
  payload := jsonb_build_object(
    'record', row_to_json(NEW)
  );

  SELECT net.http_post(
    url := (SELECT CONCAT(decrypted_secret, '/functions/v1/notify-attendance') FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', CONCAT('Bearer ', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_anon_key' LIMIT 1))
    ),
    body := payload
  ) INTO request_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_attendance_insert
AFTER INSERT ON public.attendance_logs
FOR EACH ROW
EXECUTE FUNCTION public.notify_attendance_webhook();
