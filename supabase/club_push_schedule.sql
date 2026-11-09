-- Run after storing the worker secret in Vault as montanino_push_worker.
-- Set the same value in the Edge Function as CLUB_PUSH_WORKER_SECRET.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'montanino-club-push',
  '* * * * *',
  $job$
    select net.http_post(
      url := 'https://hotspqpkmoyxddmalqti.supabase.co/functions/v1/club-push',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-club-push-worker', decrypted_secret),
      body := '{}'::jsonb,
      timeout_milliseconds := 45000
    )
    from vault.decrypted_secrets where name = 'montanino_push_worker';
  $job$
);
