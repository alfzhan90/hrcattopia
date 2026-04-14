
-- Ensure pg_net extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Replace the broken function with one using net.http_post
CREATE OR REPLACE FUNCTION public.notify_attendance_webhook()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  payload jsonb;
  request_id bigint;
  base_url text;
  anon_key text;
BEGIN
  SELECT decrypted_secret INTO base_url FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1;
  SELECT decrypted_secret INTO anon_key FROM vault.decrypted_secrets WHERE name = 'supabase_anon_key' LIMIT 1;

  IF base_url IS NULL OR anon_key IS NULL THEN
    RETURN NEW;
  END IF;

  payload := jsonb_build_object('record', row_to_json(NEW));

  SELECT net.http_post(
    url := base_url || '/functions/v1/notify-attendance',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key
    ),
    body := payload
  ) INTO request_id;

  RETURN NEW;
END;
$function$;

-- Re-attach the trigger if not already present
DROP TRIGGER IF EXISTS on_attendance_insert ON public.attendance_logs;
CREATE TRIGGER on_attendance_insert
  AFTER INSERT ON public.attendance_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_attendance_webhook();
