/* Installazione PWA: nessuna dipendenza, nessuna modifica ai dati del sito. */
(() => {
  'use strict';
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { scope: './' })
        .catch(error => console.warn('PWA Montanino:', error));
    });
  }

  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (standalone) return;

  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(navigator.userAgent);
  if (!ios && !android) return;

  let deferredInstall = null;
  let banner = null;
  let help = null;

  function dismissed() {
    try { return sessionStorage.getItem('montanino-pwa-dismissed') === '1'; }
    catch (_) { return false; }
  }

  function closeBanner() {
    if (banner) banner.remove();
    banner = null;
    try { sessionStorage.setItem('montanino-pwa-dismissed', '1'); } catch (_) {}
  }

  function showBanner() {
    if (banner || dismissed() || window.matchMedia('(display-mode: standalone)').matches) return;

    banner = document.createElement('aside');
    banner.className = 'montanino-pwa-banner';
    banner.setAttribute('aria-label', "Installa l'app del Montanino");
    banner.innerHTML = '<img src="assets/icons/montanino-192.png" alt="" width="48" height="48">' +
      '<div class="montanino-pwa-text"><strong>IL MONTANINO, SEMPRE CON TE.</strong>' +
      '<span>Installa l’app sul tuo telefono.</span></div>' +
      '<button type="button" class="montanino-pwa-button">INSTALLA</button>' +
      '<button type="button" class="montanino-pwa-close" aria-label="Chiudi suggerimento">×</button>' +
      '<p class="montanino-pwa-help" hidden></p>';

    const action = banner.querySelector('.montanino-pwa-button');
    help = banner.querySelector('.montanino-pwa-help');
    banner.querySelector('.montanino-pwa-close').addEventListener('click', closeBanner);

    let helpShown = false;
    action.addEventListener('click', async () => {
      if (helpShown) { closeBanner(); return; }
      if (deferredInstall) {
        const prompt = deferredInstall;
        deferredInstall = null;
        try {
          await prompt.prompt();
          const result = await prompt.userChoice;
          if (result.outcome === 'accepted') { closeBanner(); return; }
        } catch (_) {}
      }
      help.textContent = ios ?
        'Su iPhone: apri il sito in Safari, tocca Condividi e scegli “Aggiungi alla schermata Home”.' :
        'Apri il menu ⋮ del browser e scegli “Installa app” o “Aggiungi alla schermata Home”.';
      help.hidden = false;
      helpShown = true;
      action.textContent = 'CAPITO';
    });

    document.body.appendChild(banner);
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstall = event;
    if (document.body) showBanner();
    else document.addEventListener('DOMContentLoaded', showBanner, { once: true });
  });
  window.addEventListener('appinstalled', closeBanner);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(showBanner, 3000);
    }, { once: true });
  } else {
    setTimeout(showBanner, 3000);
  }
})();
