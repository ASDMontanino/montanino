# montanino
Sito ufficiale A.S.D. Montanino

## Notifiche push

L’app pubblica offre cambi di calendario, risultati e nuove foto. Le preferenze
sono per dispositivo. Le notifiche partono solo dalle differenze tra due
pubblicazioni online. Le convocazioni richiedono una funzione separata.

### Attivazione su Supabase

1. Applica `supabase/migrations/20261109212500_club_push.sql` e distribuisci
   `club-push` con `supabase functions deploy club-push --no-verify-jwt`.
   Il worker autentica le chiamate con un token creato dalla migrazione e conservato in Vault.
2. Esegui `supabase/club_push_schedule.sql` nel progetto del club. Il worker genera
   la coppia VAPID al primo avvio e la conserva in Vault. Cron controlla la coda ogni minuto.
3. Per il collaudo, apri `notifiche.html?prova=1` dall’app pubblica installata.
   Recupera il codice `montanino_push_pilot` in Vault e condividilo con chi prova.
   La prima iscrizione di ogni dispositivo autorizzato riceve un avviso di prova.
4. Dopo aver verificato la consegna, aggiorna `montanino_push_pilot` in Vault al
   valore `off` per aprire le iscrizioni pubbliche.

Per mettere in pausa la consegna, disattiva il job `montanino-club-push`.
I lavori non consegnati scadono dopo sei ore.
