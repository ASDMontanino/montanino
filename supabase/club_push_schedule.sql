create extension if not exists pg_cron;
create extension if not exists http with schema extensions;

select cron.schedule(
  'montanino-club-push',
  '* * * * *',
  $job$
    do $dispatch$
    declare
      worker_token text;
      response_status integer;
    begin
      if exists (select 1 from vault.secrets where name = 'montanino_push_vapid') and
         not exists (select 1 from public.club_push_jobs where next_attempt <= now())
      then
        return;
      end if;

      select decrypted_secret into strict worker_token
      from vault.decrypted_secrets where name = 'montanino_push_worker';
      -- Keep the worker token out of shared HTTP queue tables.
      perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '45000');
      select status into response_status
      from extensions.http((
        'POST', 'https://hotspqpkmoyxddmalqti.supabase.co/functions/v1/club-push',
        array[extensions.http_header('x-club-push-worker', worker_token)],
        'application/json', '{}'
      )::extensions.http_request);
      if response_status is distinct from 200 then
        raise exception 'Montanino push worker returned HTTP %', response_status;
      end if;
    end;
    $dispatch$;
  $job$
);
