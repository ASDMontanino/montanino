create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

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
    from vault.decrypted_secrets
    where name = 'montanino_push_worker'
      and (
        not exists (select 1 from vault.secrets where name = 'montanino_push_vapid') or
        exists (select 1 from public.club_push_jobs where next_attempt <= now())
      );
  $job$
);
