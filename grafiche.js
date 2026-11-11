(() => {
  'use strict';

  const get = id => document.getElementById(id);
  const fixture = get('fixture');
  const artwork = get('artwork');
  const canvas = get('poster');
  const context = canvas.getContext('2d');
  const crest = get('club-crest');
  const download = get('download');
  const share = get('share');
  const demo = window.MONTANINO_GRAPHICS_DEMO;
  const types = { pre: 'PREPARTITA', final: 'RISULTATO FINALE', scorers: 'MARCATORI', mvp: 'MVP' };
  const display = '"Barlow Condensed", "Arial Narrow", Arial, sans-serif';
  const body = '"DM Sans", Arial, sans-serif';
  const white = '#f4fbf5';
  const lime = '#a4f8b8';
  const subdued = '#abcab6';
  const ink = '#08170f';
  const seasonDate = new Intl.DateTimeFormat('it-IT', { dateStyle: 'full', timeZone: 'Europe/Rome' });
  let season;
  let revision = 0;
  let imageUrl;
  let file;

  const normalize = value => String(value ?? '').trim().toLocaleLowerCase('it');
  const ownTeam = team => normalize(team).replace(/^a\.?s\.?d\.?\s+/, '') === 'montanino';
  const hasScore = match => [match.golCasa, match.golOspite].every(score => Number.isInteger(score) && score >= 0);

  function readableDate(match) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(match.data ?? '')) return 'Data da definire';
    const date = new Date(match.data + 'T12:00:00Z');
    return Number.isNaN(date.getTime()) ? 'Data da definire' : seasonDate.format(date);
  }

  function scorers(match, details) {
    const teams = [new Map(), new Map()];
    const homeOwn = ownTeam(match.casa);
    for (const event of Array.isArray(details.eventi) ? details.eventi : []) {
      const type = normalize(event?.tipo);
      if (!['gol', 'gol_rigore', 'gol(rigore)', 'autogol'].includes(type)) continue;
      const isOwn = !event.squadra || ownTeam(event.squadra);
      const scorer = String(event.giocatore || '').trim();
      const name = scorer || (type === 'autogol' ? 'Autogol' : 'Nome non registrato');
      const minute = String(event.minuto ?? '').trim().replace(/['’]$/, '');
      const tag = type === 'autogol' && scorer ? 'aut.' : type.includes('rigore') ? 'rig.' : '';
      const suffix = [minute && minute + '′', tag && '(' + tag + ')'].filter(Boolean).join(' ');
      const ownGoal = type === 'autogol' ? !isOwn : isOwn;
      const column = teams[ownGoal === homeOwn ? 0 : 1];
      const record = column.get(name) || { name, count: 0, notes: [] };
      record.count++;
      if (suffix) record.notes.push(suffix);
      column.set(name, record);
    }
    return teams.map(team => [...team.values()].map(({ name, count, notes }) =>
      name + (count > 1 ? ' ×' + count : '') + (notes.length ? ' · ' + notes.join(', ') : '')));
  }

  function text(value, x, y, size, { color = white, max = 930, family = display, weight = 900, align = 'center' } = {}) {
    context.font = weight + ' ' + size + 'px ' + family;
    const measured = context.measureText(value).width;
    if (measured > max) context.font = weight + ' ' + Math.max(8, Math.floor(size * max / measured)) + 'px ' + family;
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'middle';
    context.fillText(value, x, y, max);
  }

  function line(x1, y1, x2, y2, color) {
    context.strokeStyle = color;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.stroke();
  }

  function background(height) {
    const gradient = context.createRadialGradient(870, height * .35, 30, 600, height * .48, height * .76);
    gradient.addColorStop(0, '#285a3b');
    gradient.addColorStop(.63, '#10271a');
    gradient.addColorStop(1, '#06110b');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 1080, height);

    context.fillStyle = '#86e3a80e';
    for (let i = 0; i < 5; i++) {
      const x = 710 + i * 128;
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x + 55, 0);
      context.lineTo(x - 375, height);
      context.lineTo(x - 430, height);
      context.fill();
    }

    context.strokeStyle = '#87d6a02c';
    context.lineWidth = 3;
    context.strokeRect(114, height * .24, 852, height * .49);
    context.strokeRect(339, height * .24, 402, height * .095);
    context.strokeRect(339, height * .635, 402, height * .095);
    line(114, height * .485, 966, height * .485, '#87d6a02c');
    context.beginPath();
    context.arc(540, height * .485, 103, 0, Math.PI * 2);
    context.stroke();

    context.fillStyle = lime;
    context.fillRect(64, 64, 5, height - 128);
    line(96, 250, 984, 250, '#83c99d66');
    line(96, height - 141, 984, height - 141, '#83c99d66');
  }

  function teamName(name, x, y, max = 430) {
    text(String(name).toLocaleUpperCase('it'), x, y, 63, { color: ownTeam(name) ? lime : white, max });
  }

  function draw(match, type, details, goals, height) {
    canvas.height = height;
    background(height);
    context.fillStyle = '#e4f5e7';
    context.fillRect(96, 95, 114, 114);
    if (crest.naturalWidth) {
      const width = 90 * crest.naturalWidth / crest.naturalHeight;
      context.drawImage(crest, 153 - width / 2, 107, width, 90);
    }
    text('A.S.D. MONTANINO', 235, 139, 48, { align: 'left', max: 725 });
    const round = match.giornata ? ' · ' + match.giornata + 'ª GIORNATA' : '';
    text('CAMPIONATO UISP' + round, 238, 184, 26, { align: 'left', max: 715, color: subdued, family: body, weight: 700 });
    text(types[type], 540, height * .287, type === 'mvp' ? 150 : 112, { color: lime, max: 890 });

    if (type === 'pre') {
      teamName(match.casa, 540, height * .435, 870);
      text('VS', 540, height * .505, 52, { color: subdued });
      teamName(match.ospite, 540, height * .575, 870);
      text(readableDate(match).toLocaleUpperCase('it') + (match.ora ? ' · ' + match.ora : ''), 540,
        height * .72, 37, { color: white, max: 870, family: body, weight: 700 });
      text(match.campo || 'Campo da definire', 540, height * .765, 28, { color: subdued, max: 850, family: body, weight: 600 });
    } else if (type === 'final') {
      teamName(match.casa, 305, height * .405);
      teamName(match.ospite, 775, height * .405);
      text(match.golCasa + ' – ' + match.golOspite, 540, height * .563, 268, { color: white, max: 870 });
      text(readableDate(match), 540, height * .738, 32, { color: subdued, family: body, weight: 600 });
    } else if (type === 'mvp') {
      const name = String(details.mvp).toLocaleUpperCase('it');
      const words = name.split(/\s+/);
      const split = Math.ceil(words.length / 2);
      if (words.length > 1) {
        text(words.slice(0, split).join(' '), 540, height * .468, 120, { max: 880 });
        text(words.slice(split).join(' '), 540, height * .555, 120, { color: lime, max: 880 });
      } else text(name, 540, height * .51, 145, { max: 880 });
      text(match.casa + ' ' + match.golCasa + ' – ' + match.golOspite + ' ' + match.ospite,
        540, height * .73, 43, { max: 870 });
    } else {
      teamName(match.casa, 306, height * .389);
      teamName(match.ospite, 774, height * .389);
      text(match.golCasa + ' – ' + match.golOspite, 540, height * .465, 86);
      line(540, height * .51, 540, height * .79, '#83c99d66');
      const step = Math.min(67, height * .25 / Math.max(1, ...goals.map(group => group.length)));
      goals.forEach((group, column) => {
        const rows = group.length ? group : ['Nessun marcatore registrato'];
        rows.forEach((name, index) => text(name, column ? 774 : 306, height * .548 + index * step,
          Math.min(28, step * .72), { max: 414, family: body, weight: 600, color: group.length ? white : subdued }));
      });
      if (!details.eventiCompleti) text('MARCATORI REGISTRATI NEL TABELLINO', 540, height * .82, 22,
        { color: subdued, family: body, weight: 700 });
    }
    text('@ASD_MONTANINO', 97, height - 95, 26, { align: 'left', family: body, weight: 700, color: lime });
    if (demo) text('ESEMPIO DIMOSTRATIVO', 982, height - 95, 24,
      { align: 'right', family: body, weight: 700, color: subdued });
  }

  function refresh() {
    const current = ++revision;
    const match = season.calendario.find(game => String(game.id) === fixture.value);
    if (!match) return;
    const details = season.dettagliPartite?.[match.id] || {};
    const goals = scorers(match, details);
    const valid = { pre: true, final: hasScore(match), scorers: hasScore(match) && goals.some(group => group.length),
      mvp: hasScore(match) && Boolean(String(details.mvp ?? '').trim()) };
    for (const option of artwork.options) option.disabled = !valid[option.value];
    if (!valid[artwork.value]) artwork.value = valid.final ? 'final' : 'pre';
    get('artwork-status').textContent = !valid.final ? 'Il risultato finale sarà disponibile a partita conclusa.' :
      !valid.scorers || !valid.mvp ? 'Marcatori e MVP si attivano quando sono presenti nel tabellino.' : '';
    get('share-status').textContent = '';

    const height = Number(document.querySelector('input[name="format"]:checked').value);
    const type = artwork.value;
    download.removeAttribute('href');
    download.setAttribute('aria-disabled', 'true');
    download.classList.add('disabled');
    share.hidden = true;
    file = undefined;
    if (imageUrl) URL.revokeObjectURL(imageUrl);

    draw(match, type, details, goals, height);
    canvas.toBlob(blob => {
      if (current !== revision) return;
      if (!blob) {
        get('artwork-status').textContent = 'Impossibile preparare il PNG. Riprova cambiando formato.';
        return;
      }
      const matchId = String(match.id).toLowerCase().replace(/[^a-z0-9_-]/g, '');
      const name = ['montanino', demo && 'prova', matchId, type, height === 1920 ? 'story' : 'post'].filter(Boolean).join('-') + '.png';
      imageUrl = URL.createObjectURL(blob);
      download.href = imageUrl;
      download.download = name;
      download.classList.remove('disabled');
      download.setAttribute('aria-disabled', 'false');
      file = new File([blob], name, { type: 'image/png' });
      share.hidden = !navigator.canShare?.({ files: [file] });
    }, 'image/png');
  }

  async function load() {
    const config = window.MONTANINO_SUPABASE;
    try {
      if (demo) {
        season = demo;
        get('data-status').textContent = 'Prova con partite e dati dimostrativi.';
      } else {
        const endpoint = new URL('/rest/v1/club_content?select=payload&id=eq.site', config.url);
        const response = await fetch(endpoint, { cache: 'no-store', headers: { apikey: config.anonKey },
          signal: AbortSignal.timeout(9000) });
        if (!response.ok) throw new Error('fetch_failed');
        season = (await response.json())?.[0]?.payload;
        get('data-status').textContent = 'Partite e tabellini pubblicati sul sito.';
      }
      if (!Array.isArray(season?.calendario) || !season.calendario.length) throw new Error('empty_calendar');
      for (const match of season.calendario) {
        const label = (match.giornata ? match.giornata + 'ª · ' : '') + match.casa + ' – ' + match.ospite;
        fixture.append(new Option(label, match.id));
      }
      const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(new Date());
      const upcoming = season.calendario.filter(match => !hasScore(match) && match.data >= today)
        .sort((a, b) => a.data.localeCompare(b.data))[0];
      const last = season.calendario.filter(hasScore).sort((a, b) => String(b.data).localeCompare(String(a.data)))[0];
      const selected = (demo && last) || upcoming || last || season.calendario[0];
      fixture.value = String(selected.id);
      artwork.value = hasScore(selected) ? 'final' : 'pre';
      await Promise.allSettled([crest.decode(), document.fonts.load('900 100px ' + display), document.fonts.load('700 35px ' + body)]);
      fixture.disabled = artwork.disabled = false;
      refresh();
    } catch {
      get('data-status').textContent = 'Partite non disponibili. Ricarica la pagina per riprovare.';
    }
  }

  fixture.addEventListener('change', () => {
    const match = season.calendario.find(game => String(game.id) === fixture.value);
    artwork.value = hasScore(match) ? 'final' : 'pre';
    refresh();
  });
  artwork.addEventListener('change', refresh);
  document.querySelector('fieldset').addEventListener('change', () => { if (!fixture.disabled) refresh(); });
  share.addEventListener('click', async () => {
    if (!file) return;
    try {
      await navigator.share({ files: [file] });
    } catch (error) {
      if (error.name !== 'AbortError') get('share-status').textContent = 'Puoi scaricare il PNG e condividerlo dalla galleria.';
    }
  });
  load();
})();
