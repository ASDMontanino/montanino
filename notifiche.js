(() => {
  'use strict';
  const form = document.getElementById('push-form');
  const fieldset = document.getElementById('push-topics');
  const save = document.getElementById('push-save');
  const stop = document.getElementById('push-stop');
  const retry = document.getElementById('push-retry');
  const pilotLabel = document.getElementById('push-pilot-label');
  const pilotLink = document.getElementById('push-pilot-link');
  const pilotInput = document.getElementById('push-pilot');
  const pilotPage = new URLSearchParams(location.search).get('prova') === '1';
  const status = document.getElementById('push-status');
  const inputs = [...fieldset.querySelectorAll('input')];
  const config = window.MONTANINO_SUPABASE || {};
  const apiUrl = config.url?.replace(/\/$/, '') + '/functions/v1/club-push';
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  let registration, publicKey, subscription, pilot = false, enabled = false, busy = false;

  function selectedTopics() {
    return inputs.filter(input => input.checked).map(input => input.value);
  }

  function render() {
    const ready = Boolean(registration && publicKey && (!pilot || pilotPage) && Notification.permission !== 'denied');
    fieldset.disabled = busy || !ready;
    const pilotCodeReady = /^[0-9a-f]{16}$/i.test(pilotInput.value.trim());
    pilotLabel.hidden = !pilot || !pilotPage;
    pilotLink.hidden = !pilot || pilotPage;
    save.disabled = busy || !ready || !selectedTopics().length || (pilot && !pilotCodeReady);
    save.textContent = enabled ? 'Salva preferenze' : 'Attiva notifiche';
    stop.hidden = !subscription;
    stop.disabled = busy;
  }

  async function api(action, current, topics) {
    const headers = { apikey: config.anonKey };
    const options = { headers, cache: 'no-store', signal: AbortSignal.timeout(9000) };
    if (action) {
      const { endpoint, keys } = current.toJSON();
      headers['Content-Type'] = 'application/json';
      options.method = 'POST';
      options.body = JSON.stringify({ action, endpoint, auth: keys.auth, p256dh: keys.p256dh, topics,
        pilot: action === 'save' && pilot ? pilotInput.value.trim().toLowerCase() : undefined
      });
    }
    const response = await fetch(apiUrl, options);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'push_service');
    return result;
  }

  async function load() {
    retry.hidden = true;
    publicKey = null;
    if (ios && !standalone) {
      status.textContent = 'Su iPhone o iPad, usa Safari → Condividi → Aggiungi alla schermata Home. Poi apri Montanino dall’icona e torna a Notifiche.';
      return;
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      status.textContent = 'Questo browser non supporta le notifiche push del Montanino.';
      return;
    }

    busy = true;
    status.textContent = 'Caricamento delle preferenze…';
    render();
    let timeout;
    try {
      await navigator.serviceWorker.register('./sw.js', { scope: './' });
      registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('worker_timeout')), 9000); })
      ]);
      subscription = await registration.pushManager.getSubscription();
      const settings = await api();
      pilot = settings.pilot === true;
      const preferences = subscription ? await api('get', subscription) : null;
      enabled = Boolean(preferences?.topics.length);
      if (enabled) {
        inputs.forEach(input => { input.checked = preferences.topics.includes(input.value); });
      }
      publicKey = Uint8Array.from(atob(settings.publicKey.replace(/-/g, '+').replace(/_/g, '/')),
        character => character.charCodeAt(0));
      if (pilot && !pilotPage) {
        status.textContent = 'Le notifiche sono in prova. Potrai attivarle dopo il collaudo.';
      } else if (pilot && !enabled && Notification.permission !== 'denied') {
        status.textContent = 'Inserisci il codice e attiva le notifiche. La prima iscrizione invia un avviso di prova.';
      } else {
        status.textContent = Notification.permission === 'denied'
        ? 'Le notifiche sono bloccate. Puoi consentirle dalle impostazioni del browser o del dispositivo.'
          : enabled ? 'Notifiche attive su questo dispositivo.' : 'Scegli le categorie e tocca Attiva notifiche.';
      }
    } catch {
      status.textContent = 'Il servizio notifiche non è raggiungibile. Riprova tra poco.';
      retry.hidden = false;
    } finally {
      clearTimeout(timeout);
      busy = false;
      render();
    }
  }

  fieldset.addEventListener('change', render);
  pilotInput.addEventListener('input', render);
  retry.addEventListener('click', load);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const topics = selectedTopics();
    if (save.disabled) return;
    busy = true;
    render();
    try {
      // Su iOS l'iscrizione deve partire direttamente dal gesto.
      subscription ||= await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKey
      });
      const first = !enabled;
      await api('save', subscription, topics);
      enabled = true;
      status.textContent = pilot && first
        ? 'Avviso di prova in coda. Puoi chiudere l’app e controllare il Centro notifiche.'
        : 'Preferenze salvate. Le notifiche sono attive su questo dispositivo.';
    } catch (error) {
      if (error.message === 'pilot_code') {
        status.textContent = 'Codice di prova non valido. Controllalo e riprova.';
        return;
      }
      status.textContent = Notification.permission === 'denied'
        ? 'Permesso negato. Puoi consentire le notifiche dalle impostazioni del browser o del dispositivo.'
        : 'Salvataggio non riuscito. Riprova.';
    } finally {
      busy = false;
      render();
    }
  });
  stop.addEventListener('click', async () => {
    if (busy || !subscription) return;
    busy = true;
    render();
    try {
      const current = subscription;
      await current.unsubscribe();
      subscription = null;
      enabled = false;
      status.textContent = 'Notifiche disattivate su questo dispositivo.';
      // Il browser ha già revocato la consegna. Il server rimuove anche i lavori in coda.
      await api('delete', current);
    } catch {
      if (subscription) status.textContent = 'Disattivazione non riuscita. Riprova.';
    } finally {
      busy = false;
      render();
    }
  });

  load();
})();
