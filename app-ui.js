/* A.S.D. Montanino — App Shell V4.0.
   Si attiva solo nella PWA mobile installata. Non tocca Supabase o il pannello admin. */
(() => {
  'use strict';
  const installed = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const mobile = window.matchMedia('(max-width: 850px)').matches;
  if (!installed || !mobile) return;

  const gallery = /(?:^|\/)galleria\.html$/i.test(location.pathname);
  const sectionLink = id => gallery ? 'index.html#' + id : '#' + id;
  const svg = body => '<svg viewBox="0 0 24 24" aria-hidden="true">' + body + '</svg>';
  const icons = {
    home: svg('<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>'),
    match: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 15h3"/>'),
    trophy: svg('<path d="M8 21h8M12 17v4M7 4h10v6a5 5 0 0 1-10 0zM7 6H4v3a3 3 0 0 0 3 3M17 6h3v3a3 3 0 0 1-3 3"/>'),
    users: svg('<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2zM16 5a3 3 0 0 1 0 6M17 15a5 5 0 0 1 4 5"/>'),
    photos: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>'),
    menu: svg('<path d="M4 7h16M4 12h16M4 17h16"/>'),
    chart: svg('<path d="M4 20V12M10 20V5M16 20v-8M22 20V9"/>'),
    calendar: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>'),
    person: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
    heart: svg('<path d="M20.5 5.8a5.5 5.5 0 0 0-7.8 0L12 6.5l-.7-.7a5.5 5.5 0 0 0-7.8 7.8l8.5 8 8.5-8a5.5 5.5 0 0 0 0-7.8z"/>'),
    bell: svg('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>'),
    star: svg('<path d="m12 2 3 7 7 .6-5.4 4.6 1.7 7-6.3-3.8L5.7 21l1.7-7L2 9.6 9 9z"/>')
  };
  const tabs = [
    ['home', 'Home', sectionLink('home'), icons.home],
    ['partite', 'Partite', sectionLink('partite'), icons.match],
    ['classifica', 'Classifica', sectionLink('classifica'), icons.trophy],
    ['rosa', 'Rosa', sectionLink('rosa'), icons.users],
    ['galleria', 'Foto', 'galleria.html', icons.photos]
  ];
  const menuLinks = [
    ['CALENDARIO', sectionLink('calendario'), icons.calendar],
    ['STATISTICHE', sectionLink('statistiche'), icons.chart],
    ['STAFF', sectionLink('staff'), icons.person],
    ['SPONSOR', sectionLink('sponsor'), icons.heart],
    ['GALLERIA', 'galleria.html', icons.photos],
    ['MATCH CENTER', sectionLink('partite'), icons.match],
    ['NOTIFICHE', 'notifiche.html', icons.bell]
  ];

  document.documentElement.classList.add('club-app-mode');
  const pageHeader = document.getElementById('header');
  if (!pageHeader) return;

  const top = document.createElement('header');
  top.className = 'club-app-bar';
  top.innerHTML =
    '<a class="club-app-brand" href="' + sectionLink('home') + '" aria-label="A.S.D. Montanino, homepage">' +
    '<img src="assets/img/stemma.webp" width="41" height="45" alt="">' +
    '<span class="club-app-brand-text"><strong>MONTANINO</strong><small>APP UFFICIALE</small></span></a>' +
    '<span class="club-app-season">26 / 27</span>' +
    '<button type="button" id="club-app-menu" class="club-app-menu-button" aria-controls="club-app-sheet" aria-expanded="false" aria-label="Apri tutte le sezioni">' + icons.menu + '</button>';
  pageHeader.parentNode.insertBefore(top, pageHeader);

  const bar = document.createElement('nav');
  bar.className = 'club-app-tabs';
  bar.setAttribute('aria-label', "Navigazione dell'app");
  bar.innerHTML = tabs.map(item =>
    '<a class="club-app-tab" data-app-tab="' + item[0] + '" href="' + item[2] + '">' +
    item[3] + '<span>' + item[1] + '</span></a>'
  ).join('');
  document.body.appendChild(bar);

  const backdrop = document.createElement('div');
  backdrop.className = 'club-app-backdrop';
  backdrop.hidden = true;
  const sheet = document.createElement('section');
  sheet.id = 'club-app-sheet';
  sheet.className = 'club-app-sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-labelledby', 'club-app-sheet-title');
  sheet.hidden = true;
  sheet.innerHTML =
    '<div class="club-app-sheet-top"><div><p class="club-app-sheet-kicker">A.S.D. MONTANINO / 26—27</p>' +
    '<h2 id="club-app-sheet-title">IL NOSTRO CLUB.</h2></div>' +
    '<button class="club-app-sheet-close" type="button" aria-label="Chiudi menu">×</button></div>' +
    '<div class="club-app-sheet-grid">' +
    menuLinks.map(item => '<a class="club-app-sheet-link" href="' + item[1] + '">' + item[2] + '<span>' + item[0] + '</span></a>').join('') +
    '</div><div class="club-app-sheet-foot"><a href="admin.html">Area amministratore</a>' +
    '<a href="https://www.instagram.com/asd_montanino/" target="_blank" rel="noopener noreferrer">Instagram ↗</a></div>';
  document.body.append(backdrop, sheet);

  const menuButton = document.getElementById('club-app-menu');
  const closeButton = sheet.querySelector('.club-app-sheet-close');
  let previousFocus = null;
  function closeSheet() {
    if (sheet.hidden) return;
    sheet.hidden = true; backdrop.hidden = true;
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Apri tutte le sezioni');
    document.body.classList.remove('club-app-sheet-open');
    if (previousFocus && previousFocus.isConnected) previousFocus.focus();
  }
  function openSheet() {
    previousFocus = document.activeElement;
    sheet.hidden = false; backdrop.hidden = false;
    menuButton.setAttribute('aria-expanded', 'true');
    menuButton.setAttribute('aria-label', 'Chiudi tutte le sezioni');
    document.body.classList.add('club-app-sheet-open');
    closeButton.focus();
  }
  menuButton.addEventListener('click', () => sheet.hidden ? openSheet() : closeSheet());
  closeButton.addEventListener('click', closeSheet);
  backdrop.addEventListener('click', closeSheet);
  sheet.querySelectorAll('a').forEach(a => a.addEventListener('click', closeSheet));
  document.addEventListener('keydown', event => {
    if (sheet.hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); closeSheet(); return; }
    if (event.key !== 'Tab') return;
    const focusables = [...sheet.querySelectorAll('a[href],button:not([disabled])')];
    if (!focusables.length) return;
    const first = focusables[0], last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });

  if (!gallery) {
    const hero = document.getElementById('home');
    if (hero) {
      hero.setAttribute('aria-labelledby', 'club-app-home-title');
      hero.insertAdjacentHTML('afterbegin',
        '<div class="club-app-home">' +
        '<div class="club-app-home-photo" aria-hidden="true"><img src="assets/img/rosa-01.webp" alt=""></div>' +
        '<p class="club-app-eyebrow">IL TUO CLUB / LA TUA STAGIONE</p>' +
        '<h1 id="club-app-home-title">NOI SIAMO<br><span>MONTANINO.</span></h1>' +
        '<p class="club-app-home-intro">Risultati, emozioni e tutta la stagione biancoverde. Sempre con te.</p>' +
        '<div class="club-app-match-grid">' +
        '<a class="club-app-match-card club-app-match-card--next" href="#partite"><small>● PROSSIMA PARTITA</small>' +
        '<strong id="club-app-next-match">MONTANINO · VS</strong><span id="club-app-next-date">DATA DA CONFERMARE</span></a>' +
        '<a class="club-app-match-card" href="#partite"><small>ULTIMO RISULTATO</small>' +
        '<strong id="club-app-last-score">— : —</strong><span id="club-app-last-match">ULTIMO INCONTRO</span></a>' +
        '</div><div class="club-app-links">' +
        '<a href="#calendario">CALENDARIO <span aria-hidden="true">↗</span></a>' +
        '<a href="#statistiche">STATISTICHE <span aria-hidden="true">↗</span></a>' +
        '<a href="galleria.html">LE FOTO <span aria-hidden="true">↗</span></a>' +
        '</div></div>'
      );

      const matches = document.getElementById('partite');
      function mirror(id, source, fallback) {
        const el = document.getElementById(id);
        const text = document.getElementById(source)?.textContent.trim();
        if (el) el.textContent = text || fallback;
      }
      function updateDashboard() {
        const home = document.getElementById('next-home')?.textContent.trim() || 'MONTANINO';
        const away = document.getElementById('next-away')?.textContent.trim() || 'DA DEFINIRE';
        document.getElementById('club-app-next-match').textContent = home + ' · ' + away;
        mirror('club-app-next-date', 'next-date', 'DATA DA CONFERMARE');
        mirror('club-app-last-score', 'last-score', '— : —');
        const lastHome = document.getElementById('last-home')?.textContent.trim() || 'MONTANINO';
        const lastAway = document.getElementById('last-away')?.textContent.trim() || 'DA DEFINIRE';
        document.getElementById('club-app-last-match').textContent = lastHome + ' · ' + lastAway;
      }
      updateDashboard();
      if (matches && 'MutationObserver' in window) {
        const observer = new MutationObserver(updateDashboard);
        observer.observe(matches, { subtree: true, childList: true, characterData: true });
      }
    }
  }

  /* Navigazione PWA: ancoraggio all'intestazione per evitare l'ampio padding
     tra il bordo della sezione e il titolo. */
  const navigableSections = new Set(['home', 'partite', 'foto', 'calendario', 'identita',
    'classifica', 'rosa', 'statistiche', 'staff', 'sponsor']);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function scrollToSection(id, animated) {
    if (gallery || !navigableSections.has(id)) return false;
    const target = document.getElementById(id);
    if (!target || target.hidden || window.getComputedStyle(target).display === 'none') return false;
    const headerHeight = Math.ceil(top.getBoundingClientRect().height);
    // Allinea l'intestazione visibile, non il bordo esterno della sezione:
    // il padding superiore della sezione lasciava i titoli troppo in basso.
    const heading = target.querySelector(':scope > .section-heading') || target;
    const y = Math.max(0, Math.round(
      window.scrollY + heading.getBoundingClientRect().top - headerHeight - 12
    ));
    window.scrollTo({ top: y, behavior: animated && !reducedMotion ? 'smooth' : 'instant' });
    return true;
  }

  /* Valido per tab inferiori, menu Altro e scorciatoie nella dashboard. */
  document.addEventListener('click', event => {
    const anchor = event.target.closest?.('a[href]');
    if (!anchor || event.defaultPrevented || event.button !== 0 ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
        (anchor.target && anchor.target !== '_self')) return;
    let url;
    try { url = new URL(anchor.href, location.href); } catch (_) { return; }
    if (url.origin !== location.origin || url.pathname !== location.pathname || !url.hash) return;
    let id;
    try { id = decodeURIComponent(url.hash.slice(1)); } catch (_) { return; }
    if (!scrollToSection(id, true)) return;
    event.preventDefault();
    if (location.hash !== url.hash) history.pushState(null, '', url.hash);
    refreshActive();
  });

  /* Se si apre una sezione direttamente dalla galleria, riallinea l'arrivo
     dopo il rendering della schermata app, senza scatti animati. */
  const initialAnchor = location.hash;
  if (!gallery && initialAnchor) {
    const realignInitial = () => {
      if (location.hash !== initialAnchor) return;
      let id;
      try { id = decodeURIComponent(initialAnchor.slice(1)); } catch (_) { return; }
      requestAnimationFrame(() => requestAnimationFrame(() => scrollToSection(id, false)));
    };
    window.addEventListener('load', realignInitial, { once: true });
    if (document.readyState === 'complete') realignInitial();
  }

  const tabEls = [...bar.querySelectorAll('[data-app-tab]')];
  const sectionIds = ['home', 'partite', 'foto', 'calendario', 'identita', 'classifica', 'rosa', 'statistiche', 'staff', 'sponsor'];
  function selectedTab() {
    if (gallery) return 'galleria';
    let section = location.hash.replace(/^#/, '').split(/[/?]/)[0] || 'home';
    const offset = window.scrollY + Math.ceil(top.getBoundingClientRect().height) + 28;
    for (const id of sectionIds) {
      const element = document.getElementById(id);
      if (element && !element.hidden && element.getBoundingClientRect().top + window.scrollY <= offset) section = id;
    }
    if (section === 'calendario' || section === 'foto') return 'partite';
    if (section === 'statistiche') return 'classifica';
    if (section === 'staff' || section === 'sponsor' || section === 'identita') return 'home';
    return ['home', 'partite', 'classifica', 'rosa'].includes(section) ? section : 'home';
  }
  function markActive() {
    const active = selectedTab();
    for (const el of tabEls) {
      if (el.dataset.appTab === active) el.setAttribute('aria-current', 'page');
      else el.removeAttribute('aria-current');
    }
  }
  let scheduled = false;
  function refreshActive() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; markActive(); });
  }
  window.addEventListener('scroll', refreshActive, { passive: true });
  window.addEventListener('hashchange', refreshActive);
  window.addEventListener('pageshow', refreshActive);
  markActive();
})();
