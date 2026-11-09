# montanino
Sito ufficiale A.S.D. Montanino

## Notifiche push

L’app pubblica offre cambi di calendario, risultati e nuove foto. Le preferenze
sono per dispositivo. Le notifiche partono solo dalle differenze tra due
pubblicazioni online. Le convocazioni richiedono una funzione separata.

### Attivazione su Supabase

1. Genera una coppia VAPID con `npx web-push@3.6.7 generate-vapid-keys` e un token
   per il worker con `openssl rand -hex 32`. Conserva la coppia VAPID tra i deploy.
2. Aggiungi i segreti Edge `CLUB_PUSH_VAPID_PUBLIC`, `CLUB_PUSH_VAPID_PRIVATE`,
   `CLUB_PUSH_VAPID_SUBJECT` (un recapito reale in formato `mailto:`) e
   `CLUB_PUSH_WORKER_SECRET`. Inserisci lo stesso token worker in Vault come
   `montanino_push_worker`. Le chiavi private e il token restano in Supabase.
3. Applica `supabase/migrations/20261109212500_club_push.sql` e distribuisci
   `club-push` con `supabase functions deploy club-push --no-verify-jwt`.
   Il worker verifica il token dedicato. Le chiamate del browser riguardano
   soltanto l’iscrizione corrente e non possono inviare avvisi.
4. Esegui `supabase/club_push_schedule.sql` nel progetto del club. Cron chiama
   il worker ogni minuto. Prima del rilascio prova l’iscrizione e la consegna
   su un dispositivo autorizzato, con una pubblicazione di test in un progetto
   separato o prima di aprire le iscrizioni al pubblico.

Per mettere in pausa la consegna, disattiva il job `montanino-club-push`.
I lavori non consegnati scadono dopo sei ore.
