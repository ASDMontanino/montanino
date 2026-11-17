CREATE TABLE IF NOT EXISTS public.uisp_sync_state (
  id text PRIMARY KEY CHECK (id = 'site'),
  token_hash text NOT NULL,
  last_attempt_at timestamptz,
  last_synced_at timestamptz,
  last_error text
);

ALTER TABLE public.uisp_sync_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.uisp_sync_state FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.uisp_sync_state TO service_role;

DO $$
DECLARE
  sync_token text;
BEGIN
  SELECT decrypted_secret
    INTO sync_token
    FROM vault.decrypted_secrets
   WHERE name = 'uisp_sync_token';

  IF sync_token IS NULL THEN
    sync_token := lower(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''));
    PERFORM vault.create_secret(sync_token, 'uisp_sync_token', 'Private authorization token for the UISP calendar sync job');
  END IF;

  INSERT INTO public.uisp_sync_state (id, token_hash)
  VALUES ('site', encode(extensions.digest(convert_to(sync_token, 'UTF8'), 'sha256'), 'hex'))
  ON CONFLICT (id) DO UPDATE
    SET token_hash = EXCLUDED.token_hash;
END
$$;

CREATE OR REPLACE FUNCTION public.claim_uisp_sync()
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  claimed boolean;
BEGIN
  UPDATE public.uisp_sync_state
     SET last_attempt_at = pg_catalog.now(),
         last_error = NULL
   WHERE id = 'site'
     AND (last_synced_at IS NULL OR last_synced_at < pg_catalog.now() - interval '5 hours')
     AND (last_attempt_at IS NULL OR last_attempt_at < pg_catalog.now() - interval '10 minutes')
  RETURNING true INTO claimed;

  RETURN pg_catalog.coalesce(claimed, false);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_uisp_sync() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_uisp_sync() TO service_role;

CREATE OR REPLACE FUNCTION public.sync_uisp_official_data(
  p_classifica jsonb,
  p_calendario jsonb,
  p_expected_revision bigint
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF p_classifica IS NULL OR p_calendario IS NULL
     OR pg_catalog.jsonb_typeof(p_classifica) <> 'array'
     OR pg_catalog.jsonb_array_length(p_classifica) < 2
     OR pg_catalog.jsonb_typeof(p_calendario) <> 'array'
     OR pg_catalog.jsonb_array_length(p_calendario) < 26 THEN
    RETURN false;
  END IF;

  UPDATE public.club_content
     SET payload = pg_catalog.jsonb_set(
           pg_catalog.jsonb_set(payload, '{classifica}', p_classifica, true),
           '{calendario}', p_calendario, true
         ),
         revision = revision + 1,
         updated_at = pg_catalog.now()
   WHERE id = 'site'
     AND revision = p_expected_revision;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_uisp_official_data(jsonb, jsonb, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_uisp_official_data(jsonb, jsonb, bigint) TO service_role;

DO $$
BEGIN
  PERFORM cron.unschedule(jobid)
    FROM cron.job
   WHERE jobname = 'uisp-sync-every-six-hours';

  PERFORM cron.schedule(
    'uisp-sync-every-six-hours',
    '0 */6 * * *',
    $job$
      SELECT net.http_post(
        url := 'https://hotspqpkmoyxddmalqti.supabase.co/functions/v1/uisp-sync',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            SELECT decrypted_secret
              FROM vault.decrypted_secrets
             WHERE name = 'uisp_sync_token'
          )
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 120000
      );
    $job$
  );
END
$$;

SELECT net.http_post(
  url := 'https://hotspqpkmoyxddmalqti.supabase.co/functions/v1/uisp-sync',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || (
      SELECT decrypted_secret
        FROM vault.decrypted_secrets
       WHERE name = 'uisp_sync_token'
    )
  ),
  body := '{}'::jsonb,
  timeout_milliseconds := 120000
);
