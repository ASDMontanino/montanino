-- Montanino · FOTO_STORAGE_SETUP.sql · Eseguire nel SQL Editor di Supabase.
-- Creazione del bucket pubblico (per la lettura delle foto sul sito).
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('montanino-partite','montanino-partite',true,10485760,array['image/webp'])
on conflict (id) do update set
  public=excluded.public,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

-- Solo gli utenti esplicitamente autorizzati in club_admins possono caricare.
drop policy if exists "montanino admin upload fotografie" on storage.objects;
create policy "montanino admin upload fotografie"
on storage.objects for insert to authenticated
with check (
  bucket_id='montanino-partite'
  and name ~ '^montanino-[0-9a-f]{32}[.]webp$'
  and exists(
    select 1 from public.club_admins a where a.user_id=(select auth.uid())
  )
);
-- Nessuna policy di scrittura per i visitatori. Le foto sono pubbliche in lettura.
