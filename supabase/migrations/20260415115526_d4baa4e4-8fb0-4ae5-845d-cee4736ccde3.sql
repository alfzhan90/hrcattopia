
-- Ensure pg_net extension
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Recreate the webhook function
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
  -- Get secrets from vault
  SELECT decrypted_secret INTO base_url FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1;
  SELECT decrypted_secret INTO anon_key FROM vault.decrypted_secrets WHERE name = 'supabase_anon_key' LIMIT 1;

  -- Skip silently if secrets not configured
  IF base_url IS NULL OR anon_key IS NULL THEN
    RAISE LOG 'notify_attendance_webhook: missing vault secrets (supabase_url or supabase_anon_key)';
    RETURN NEW;
  END IF;

  -- Build payload with full record
  payload := jsonb_build_object('record', row_to_json(NEW));

  -- Fire async HTTP POST to edge function
  SELECT net.http_post(
    url := base_url || '/functions/v1/notify-attendance',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key
    ),
    body := payload
  ) INTO request_id;

  RAISE LOG 'notify_attendance_webhook: fired request_id=%', request_id;

  RETURN NEW;
END;
$function$;

-- Drop and re-create trigger
DROP TRIGGER IF EXISTS on_attendance_insert ON public.attendance_logs;
CREATE TRIGGER on_attendance_insert
  AFTER INSERT ON public.attendance_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_attendance_webhook();
