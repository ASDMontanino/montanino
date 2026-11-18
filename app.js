(() => {
  'use strict';
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const played = match => Number.isInteger(match?.golCasa) && Number.isInteger(match?.golOspite);
  let currentFilter = 'all';
  let roleFilter = 'Tutti';
  let activeData = {};
  let toastTimer;

  function toast(message) {
    const item = $('#toast');
    item.textContent = message;
    item.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => item.classList.remove('is-visible'), 2300);
  }

  function publicPhoto(file) {
    if (!file) return '';
    const source = String(file);
    if (/^sb:montanino-[0-9a-f]{32}\.webp$/.test(source) && window.MONTANINO_SUPABASE?.url) {
      return `${window.MONTANINO_SUPABASE.url.replace(/\/$/, '')}/storage/v1/object/public/montanino-partite/${encodeURIComponent(source.slice(3))}`;
    }
    if (/^assets\/img\/[\p{L}\p{N} _()./-]+\.(?:webp|png|jpe?g)$/iu.test(source) && !source.includes('..')) return source;
    return '';
  }

  async function loadData() {
    const status = $('#sync-state');
    status.textContent = 'AGGIORNO…';
    const fallback = typeof SITE_DATA === 'object' ? SITE_DATA : {};
    const config = window.MONTANINO_SUPABASE || {};
    if (!config.url || !config.anonKey) {
      status.textContent = 'DATI DEMO';
      render(fallback);
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const endpoint = `${config.url.replace(/\/$/, '')}/rest/v1/club_content?select=payload&id=eq.site`;
      const response = await fetch(endpoint, {headers:{apikey:config.anonKey},cache:'no-store',signal:controller.signal});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const rows = await response.json();
      const data = rows?.[0]?.payload;
      if (!data || !Array.isArray(data.calendario)) throw new Error('Dati club incompleti');
      status.textContent = 'AGGIORNATO ORA';
      render(data);
    } catch (error) {
      console.warn('Uso i dati salvati per la demo.', error);
      status.textContent = 'ULTIMO BACKUP';
      render(fallback);
    } finally {
      clearTimeout(timeout);
    }
  }

  function render(data) {
    activeData = data || {};
    const calendar = Array.isArray(data.calendario) ? data.calendario : [];
    const standings = Array.isArray(data.classifica) ? data.classifica : [];
    const players = Array.isArray(data.giocatori) ? data.giocatori : [];
    const montaninoRank = standings.findIndex(team => /montanino/i.test(team.squadra || ''));
    const montanino = montaninoRank >= 0 ? standings[montaninoRank] : null;
    $('#home-position').textContent = montanino ? `${montaninoRank + 1}°` : '—';
    $('#home-points').textContent = montanino ? `${montanino.punti ?? 0} punti · ${montanino.giocate ?? 0} gare` : 'Classifica in aggiornamento';
    $('#home-players').textContent = players.length || '—';
    $('#squad-count').textContent = players.length ? `${players.length} giocatori · stagione 2026/27` : 'La rosa biancoverde.';

    const future = calendar.filter(match => !played(match) && match.data && new Date(`${match.data}T${match.ora || '23:59'}:00`) >= new Date()).sort((a,b) => new Date(`${a.data}T${a.ora || '23:59'}:00`) - new Date(`${b.data}T${b.ora || '23:59'}:00`));
    const next = future[0] || (data.prossimaPartita?.dataISO && new Date(data.prossimaPartita.dataISO) >= new Date() ? data.prossimaPartita : null);
    renderNext(next);
    renderLast(data.ultimoRisultato, calendar);
    renderFixtures(calendar);
    renderStandings(standings, montaninoRank, montanino);
    renderPlayers(players);
  }

  function renderNext(match) {
    const container = $('#next-match-card');
    const home = match?.casa || 'PROSSIMA';
    const away = match?.ospite || 'PARTITA';
    const date = match?.data ? new Date(`${match.data}T${match.ora || '21:00'}:00`).toLocaleDateString('it-IT',{weekday:'short',day:'2-digit',month:'short'}).toUpperCase() + (match.ora ? ` · ${esc(match.ora)}` : '') : 'DATA DA DEFINIRE';
    const place = match?.campo || match?.indirizzoMaps || 'Appena disponibile la UISP aggiornerà il calendario';
    container.innerHTML = `<div class="match-topline"><span class="live-label">PROSSIMO APPUNTAMENTO</span><span class="competition-label">${esc(match?.competizione || 'CAMPIONATO')}</span></div><div class="teams-row"><strong class="team-name">${esc(home)}</strong><span class="versus">VS</span><strong class="team-name">${esc(away)}</strong></div><div class="match-date">${date}</div><div class="match-place">${esc(place)}</div>`;
  }

  function renderLast(last, calendar) {
    const match = last || [...calendar].reverse().find(played);
    const container = $('#last-result-card');
    if (!match) {
      container.innerHTML = '<span class="last-result-label">ULTIMO RISULTATO</span><span class="last-result-teams">I risultati compariranno qui.</span><span class="last-result-score">—</span>';
      return;
    }
    const home = match.casa || 'Montanino';
    const away = match.ospite || '';
    container.innerHTML = `<span class="last-result-label">ULTIMO RISULTATO · ${esc(match.data || '')}</span><span class="last-result-teams">${esc(home)} — ${esc(away)}</span><strong class="last-result-score">${esc(match.golCasa)} : ${esc(match.golOspite)}</strong>`;
  }

  function fixtureDate(match) {
    if (!match.data) return 'DATA DA DEFINIRE';
    const date = new Date(`${match.data}T${match.ora || '21:00'}:00`);
    return `${date.toLocaleDateString('it-IT',{day:'2-digit',month:'short'}).toUpperCase()}${match.ora ? ` · ${esc(match.ora)}` : ''}`;
  }

  function renderFixtures(calendar) {
    const filtered = calendar.filter(match => currentFilter === 'played' ? played(match) : currentFilter === 'upcoming' ? !played(match) : true);
    $('#fixture-list').innerHTML = filtered.length ? filtered.map(match => `<article class="fixture"><span class="fixture-round">${esc(match.giornata || '—')}ª<br>GIORN.</span><div class="fixture-main"><div class="fixture-teams">${esc(match.casa)} <span style="color:#879a8b">vs</span> ${esc(match.ospite)}</div><div class="fixture-meta">${fixtureDate(match)}${match.campo ? ` · ${esc(match.campo)}` : ''}</div></div><strong class="fixture-score ${played(match) ? '' : 'is-upcoming'}">${played(match) ? `${match.golCasa} : ${match.golOspite}` : 'DA GIOCARE'}</strong></article>`).join('') : '<div class="empty-state">Nessuna partita in questa sezione.</div>';
  }

  function renderStandings(standings, rank, club) {
    $('#standing-feature').innerHTML = club ? `<div><small>POSIZIONE MONTANINO</small><strong>${esc(club.punti ?? 0)} PUNTI · ${esc(club.giocate ?? 0)} GARE</strong></div><span class="position-badge">${rank + 1}°</span>` : '<div><small>CLASSIFICA</small><strong>In aggiornamento</strong></div><span class="position-badge">—</span>';
    $('#standings-list').innerHTML = standings.length ? standings.map((team,index) => `<li class="table-row ${/montanino/i.test(team.squadra || '') ? 'is-montanino' : ''}"><span class="rank">${String(index + 1).padStart(2,'0')}</span><span class="club">${esc(team.squadra)}</span><span class="games">${esc(team.giocate ?? '—')}</span><strong class="points">${esc(team.punti ?? '—')}</strong></li>`).join('') : '<li class="empty-state">La classifica non è ancora disponibile.</li>';
  }

  function renderPlayers(players) {
    const list = roleFilter === 'Tutti' ? players : players.filter(player => String(player.ruolo || '').toLocaleLowerCase('it').includes(roleFilter.toLocaleLowerCase('it')));
    $('#player-grid').innerHTML = list.length ? list.map(player => {
      const photo = publicPhoto(player.foto) || publicPhoto(player.carta);
      const initials = String(player.nome || 'M').split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase();
      return `<article class="player-card">${photo ? `<img src="${esc(photo)}" alt="" loading="lazy" onerror="this.remove()">` : ''}<span class="player-number">${esc(player.numero ?? '—')}</span><span class="player-fallback" aria-hidden="true">${esc(initials)}</span><div class="player-copy"><strong>${esc(player.nome || 'Giocatore')}</strong><span>${esc(player.ruolo || 'ROSA')}</span></div></article>`;
    }).join('') : '<div class="empty-state">La rosa sarà visibile qui appena i dati saranno caricati.</div>';
  }

  function openScreen(name) {
    document.querySelectorAll('.screen').forEach(screen => {
      const active = screen.id === `screen-${name}`;
      screen.classList.toggle('is-active', active);
      screen.hidden = !active;
    });
    document.querySelectorAll('.tab').forEach(tab => {
      const active = tab.dataset.tab === name;
      tab.classList.toggle('is-active', active);
      if (active) tab.setAttribute('aria-current','page'); else tab.removeAttribute('aria-current');
    });
    window.scrollTo({top:0,behavior:'smooth'});
  }

  document.querySelectorAll('[data-tab]').forEach(tab => tab.addEventListener('click', () => openScreen(tab.dataset.tab)));
  document.querySelectorAll('[data-open]').forEach(button => button.addEventListener('click', () => openScreen(button.dataset.open)));
  document.querySelectorAll('[data-match-filter]').forEach(button => button.addEventListener('click', () => {
    currentFilter = button.dataset.matchFilter;
    document.querySelectorAll('[data-match-filter]').forEach(item => item.classList.toggle('is-selected', item === button));
    renderFixtures(activeData.calendario || []);
  }));
  document.querySelectorAll('[data-role]').forEach(button => button.addEventListener('click', () => {
    roleFilter = button.dataset.role;
    document.querySelectorAll('[data-role]').forEach(item => item.classList.toggle('is-selected', item === button));
    renderPlayers(activeData.giocatori || []);
  }));
  $('#refresh').addEventListener('click', loadData);
  loadData();
})();
