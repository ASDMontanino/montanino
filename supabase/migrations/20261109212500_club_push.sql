begin;

create table public.club_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text unique not null,
  p256dh text not null,
  auth_secret text not null,
  topics text[] not null check (
    cardinality(topics) > 0 and topics <@ array['calendar', 'result', 'photos']::text[]
  )
);

create table public.club_push_jobs (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.club_push_subscriptions(id) on delete cascade,
  topic text not null,
  match_id text not null,
  message jsonb not null,
  expires_at timestamptz not null,
  next_attempt timestamptz not null default now(),
  attempts integer not null default 0,
  claim uuid,
  unique (subscription_id, topic, match_id)
);
create index club_push_jobs_ready on public.club_push_jobs (next_attempt);
create index club_push_jobs_topic_match on public.club_push_jobs (topic, match_id);

alter table public.club_push_subscriptions enable row level security;
alter table public.club_push_jobs enable row level security;
revoke all on public.club_push_subscriptions, public.club_push_jobs from public, anon, authenticated;
grant select, insert, update, delete on public.club_push_subscriptions, public.club_push_jobs to service_role;

create function public.club_push_save(p_endpoint text, p_p256dh text, p_auth text, p_topics text[])
returns boolean language plpgsql set search_path = '' as $$
declare
  subscription uuid;
begin
  insert into public.club_push_subscriptions as saved (endpoint, p256dh, auth_secret, topics)
  values (p_endpoint, p_p256dh, p_auth, p_topics)
  on conflict (endpoint) do update set p256dh = excluded.p256dh, topics = excluded.topics
  where saved.auth_secret = excluded.auth_secret
  returning id into subscription;

  if subscription is null then return false; end if;
  delete from public.club_push_jobs
  where subscription_id = subscription and not (topic = any (p_topics));
  return true;
end;
$$;

create function public.club_push_preferences(p_endpoint text, p_auth text, p_remove boolean)
returns text[] language plpgsql set search_path = '' as $$
begin
  if p_remove then
    delete from public.club_push_subscriptions where endpoint = p_endpoint and auth_secret = p_auth;
    return '{}'::text[];
  end if;
  return coalesce(
    (select topics from public.club_push_subscriptions where endpoint = p_endpoint and auth_secret = p_auth),
    '{}'::text[]
  );
end;
$$;

create function public.club_push_claim(p_limit integer)
returns table (
  job_id uuid, lease uuid, subscription_id uuid, endpoint text, p256dh text,
  auth_secret text, message jsonb, attempts integer, ttl integer
) language plpgsql set search_path = '' as $$
begin
  delete from public.club_push_jobs where expires_at <= now();
  return query
  with ready as (
    select j.id from public.club_push_jobs j
    join public.club_push_subscriptions s on s.id = j.subscription_id
    where j.next_attempt <= now() and j.topic = any (s.topics)
    order by j.next_attempt, j.id
    limit greatest(1, least(p_limit, 24))
    for update of j skip locked
  ), claimed as (
    update public.club_push_jobs j
    set next_attempt = now() + interval '2 minutes', attempts = j.attempts + 1, claim = gen_random_uuid()
    from ready where j.id = ready.id
    returning j.*
  )
  select j.id, j.claim, s.id, s.endpoint, s.p256dh, s.auth_secret, j.message, j.attempts,
    greatest(1, floor(extract(epoch from j.expires_at - now()))::integer)
  from claimed j join public.club_push_subscriptions s on s.id = j.subscription_id;
end;
$$;

create function public.club_push_enqueue(p_topic text, p_match text, p_title text, p_body text, p_url text)
returns void language sql set search_path = '' as $$
  with interested as (
    select id from public.club_push_subscriptions where p_topic = any (topics) for key share
  )
  insert into public.club_push_jobs (subscription_id, topic, match_id, message, expires_at)
  select id, p_topic, p_match,
    jsonb_build_object('title', p_title, 'body', left(p_body, 250), 'url', p_url, 'tag', p_topic || '-' || p_match),
    now() + interval '6 hours'
  from interested
  on conflict (subscription_id, topic, match_id) do update set
    id = gen_random_uuid(), message = excluded.message, expires_at = excluded.expires_at,
    next_attempt = now(), attempts = 0, claim = null;
$$;

create function public.club_push_content_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  match record;
  teams text;
  match_url text;
  match_day text;
  played boolean;
  previously_played boolean;
begin
  -- An ordinary publication updates the existing snapshot. The initial import is silent.
  if new.payload is not distinct from old.payload then return new; end if;

  for match in
    with current_matches as (
      select value as item from jsonb_array_elements(
        case when jsonb_typeof(new.payload->'calendario') = 'array' then new.payload->'calendario' else '[]'::jsonb end
      )
    ), previous_matches as (
      select value as item from jsonb_array_elements(
        case when jsonb_typeof(old.payload->'calendario') = 'array' then old.payload->'calendario' else '[]'::jsonb end
      )
    )
    select c.item->>'id' as id, c.item as current, p.item as previous
    from current_matches c left join previous_matches p on p.item->>'id' = c.item->>'id'
    where c.item->>'id' ~ '^[AR][0-9]{2}$'
  loop
    teams := concat_ws(' – ', match.current->>'casa', match.current->>'ospite');
    match_url := 'index.html#partita-' || match.id;
    match_day := coalesce(match.current->>'data', '');
    played := coalesce(
      jsonb_typeof(match.current->'golCasa') = 'number' and
      jsonb_typeof(match.current->'golOspite') = 'number' and
      match.current->>'golCasa' ~ '^[0-9]+$' and match.current->>'golOspite' ~ '^[0-9]+$', false
    );
    previously_played := coalesce(
      jsonb_typeof(match.previous->'golCasa') = 'number' and
      jsonb_typeof(match.previous->'golOspite') = 'number' and
      match.previous->>'golCasa' ~ '^[0-9]+$' and match.previous->>'golOspite' ~ '^[0-9]+$', false
    );

    if played then
      delete from public.club_push_jobs where topic = 'calendar' and match_id = match.id;
      if not previously_played or
        (match.current->>'golCasa', match.current->>'golOspite')
          is distinct from (match.previous->>'golCasa', match.previous->>'golOspite')
      then
        perform public.club_push_enqueue('result', match.id,
          case when previously_played then 'Risultato aggiornato' else 'Risultato pubblicato' end,
          format('%s %s–%s %s', match.current->>'casa', match.current->>'golCasa',
            match.current->>'golOspite', match.current->>'ospite'), match_url);
      end if;
    else
      if previously_played then
        delete from public.club_push_jobs where topic = 'result' and match_id = match.id;
      elsif match.previous is not null and
        (match_day = '' or match_day >= to_char(now() at time zone 'Europe/Rome', 'YYYY-MM-DD') or
          coalesce(match.previous->>'data', '') >= to_char(now() at time zone 'Europe/Rome', 'YYYY-MM-DD')) and
        (match_day, coalesce(match.current->>'ora', ''), coalesce(match.current->>'campo', ''))
          is distinct from
        (coalesce(match.previous->>'data', ''), coalesce(match.previous->>'ora', ''), coalesce(match.previous->>'campo', ''))
      then
        perform public.club_push_enqueue('calendar', match.id, 'Cambio di calendario',
          concat_ws(' · ', teams,
            case when match_day ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
              then substring(match_day, 9, 2) || '/' || substring(match_day, 6, 2)
              else 'Data da confermare' end,
            nullif(match.current->>'ora', ''), nullif(match.current->>'campo', '')),
          match_url);
      end if;
    end if;

    if exists (
      select 1
      from jsonb_array_elements(
        case when jsonb_typeof(new.payload->'fotoPartite') = 'array' then new.payload->'fotoPartite' else '[]'::jsonb end
      ) as photo
      where photo->>'partita' = match.id and nullif(photo->>'file', '') is not null
      and not exists (
        select 1
        from jsonb_array_elements(
          case when jsonb_typeof(old.payload->'fotoPartite') = 'array' then old.payload->'fotoPartite' else '[]'::jsonb end
        ) as previous_photo
        where previous_photo->>'partita' = match.id and lower(previous_photo->>'file') = lower(photo->>'file')
      )
    ) then
      perform public.club_push_enqueue('photos', match.id, 'Nuove foto della partita',
        teams || ' · Apri la galleria', 'galleria.html?partita=' || match.id);
    end if;
  end loop;

  return new;
end;
$$;

revoke execute on function public.club_push_save(text, text, text, text[]),
  public.club_push_preferences(text, text, boolean), public.club_push_claim(integer), public.club_push_enqueue(text, text, text, text, text),
  public.club_push_content_changed() from public, anon, authenticated;
grant execute on function public.club_push_save(text, text, text, text[]),
  public.club_push_preferences(text, text, boolean), public.club_push_claim(integer) to service_role;

create trigger club_push_after_publish
after update of payload on public.club_content
for each row when (new.id = 'site') execute function public.club_push_content_changed();

commit;
