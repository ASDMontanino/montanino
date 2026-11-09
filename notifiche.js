(() => {
  'use strict';
  const form = document.getElementById('push-form');
  const fieldset = document.getElementById('push-topics');
  const save = document.getElementById('push-save');
  const stop = document.getElementById('push-stop');
  const retry = document.getElementById('push-retry');
  const status = document.getElementById('push-status');
  const inputs = [...fieldset.querySelectorAll('input')];
  const config = window.MONTANINO_SUPABASE || {};
  const apiUrl = config.url?.replace(/\/$/, '') + '/functions/v1/club-push';
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  let registration, publicKey, subscription, enabled = false, busy = false;

  function selectedTopics() {
    return inputs.filter(input => input.checked).map(input => input.value);
  }

  function render() {
    const ready = Boolean(registration && publicKey && Notification.permission !== 'denied');
    fieldset.disabled = busy || !ready;
    save.disabled = busy || !ready || !selectedTopics().length;
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
      options.body = JSON.stringify({ action, endpoint, auth: keys.auth, p256dh: keys.p256dh, topics });
    }
    const response = await fetch(apiUrl, options);
    if (!response.ok) throw new Error('push_service');
    return response.json();
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
      const preferences = subscription ? await api('get', subscription) : null;
      enabled = Boolean(preferences?.topics.length);
      if (enabled) {
        inputs.forEach(input => { input.checked = preferences.topics.includes(input.value); });
      }
      publicKey = Uint8Array.from(atob(settings.publicKey.replace(/-/g, '+').replace(/_/g, '/')),
        character => character.charCodeAt(0));
      status.textContent = Notification.permission === 'denied'
        ? 'Le notifiche sono bloccate. Puoi consentirle dalle impostazioni del browser o del dispositivo.'
        : enabled ? 'Notifiche attive su questo dispositivo.' : 'Scegli le categorie e tocca Attiva notifiche.';
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
  retry.addEventListener('click', load);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const topics = selectedTopics();
    if (busy || !registration || !publicKey || !topics.length) return;
    busy = true;
    render();
    try {
      // Su iOS l'iscrizione deve partire direttamente dal gesto.
      subscription ||= await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKey
      });
      await api('save', subscription, topics);
      enabled = true;
      status.textContent = 'Preferenze salvate. Le notifiche sono attive su questo dispositivo.';
    } catch {
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
