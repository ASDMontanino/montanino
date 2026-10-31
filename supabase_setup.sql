-- A.S.D. MONTANINO V3.0 — Esegui questo script nel SQL Editor di Supabase.
-- 1. Crea i due tavoli; 2. abilita RLS; 3. concede solo lettura anonima
--    e scrittura autenticata esclusivamente a un club_admin autorizzato.
-- IMPORTANTE: crea il tuo utente in Authentication > Users, poi autorizzalo
-- con il comando separato che trovi in GUIDA_V3.txt.

create table if not exists public.club_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table if not exists public.club_content (
  id text primary key check (id='site'),
  payload jsonb not null,
  revision bigint not null default 1 check (revision>0),
  updated_at timestamptz not null default now()
);

create or replace function public.club_set_updated_at()
returns trigger language plpgsql set search_path=public as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists club_content_updated_at on public.club_content;
create trigger club_content_updated_at before update on public.club_content
for each row execute function public.club_set_updated_at();

alter table public.club_admins enable row level security;
alter table public.club_content enable row level security;

-- Rimuove eventuali policy omonime se si riesegue questo script.
drop policy if exists "admin sees own role" on public.club_admins;
drop policy if exists "anyone reads published club site" on public.club_content;
drop policy if exists "admin creates club site" on public.club_content;
drop policy if exists "admin edits club site" on public.club_content;

create policy "admin sees own role" on public.club_admins
for select to authenticated using (user_id = auth.uid());

create policy "anyone reads published club site" on public.club_content
for select to anon, authenticated using (id='site');

create policy "admin creates club site" on public.club_content
for insert to authenticated with check (
  id='site' and exists(
    select 1 from public.club_admins a where a.user_id=auth.uid()
  )
);

create policy "admin edits club site" on public.club_content
for update to authenticated
using (id='site' and exists(
  select 1 from public.club_admins a where a.user_id=auth.uid()
))
with check (id='site' and exists(
  select 1 from public.club_admins a where a.user_id=auth.uid()
));

revoke all on public.club_admins from anon, authenticated;
revoke all on public.club_content from anon, authenticated;
grant select on public.club_admins to authenticated;
grant select on public.club_content to anon, authenticated;
grant insert, update on public.club_content to authenticated;

-- Non esiste alcuna policy che consenta agli utenti di diventare admin
-- da soli: il ruolo viene assegnato manualmente dal proprietario in SQL Editor.
-- Le password e le chiavi segrete NON devono mai essere messe su GitHub.
