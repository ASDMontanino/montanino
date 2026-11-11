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
  const display = '"Barlow Condensed", "Arial Narrow", Arial, sans-serif';
  const body = '"DM Sans", Arial, sans-serif';
  const white = '#f4fbf5';
  const lime = '#a4f8b8';
  const subdued = '#abcab6';
  const ink = '#08170f';
  const seasonDate = new Intl.DateTimeFormat('it-IT', { dateStyle: 'full', timeZone: 'Europe/Rome' });
  let season;
  let teamPhoto;
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

  function line(x1, y1, x2, y2, color, width = 2) {
    context.strokeStyle = color;
    context.lineWidth = width;
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.stroke();
  }

  function rect(x, y, width, height, color) {
    context.fillStyle = color;
    context.fillRect(x, y, width, height);
  }

  function polygon(points, color) {
    context.fillStyle = color;
    context.beginPath();
    for (const [index, [x, y]] of points.entries()) {
      if (index) context.lineTo(x, y);
      else context.moveTo(x, y);
    }
    context.closePath();
    context.fill();
  }

  function shade(x, y, width, height, stops) {
    const gradient = context.createLinearGradient(x, y, x, y + height);
    for (const [point, color] of stops) gradient.addColorStop(point, color);
    rect(x, y, width, height, gradient);
  }

  function cover(image, x, y, width, height, focusY = .5) {
    if (!image) return;
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const sourceWidth = width / scale;
    const sourceHeight = height / scale;
    context.drawImage(image, (image.naturalWidth - sourceWidth) / 2,
      (image.naturalHeight - sourceHeight) * focusY, sourceWidth, sourceHeight, x, y, width, height);
  }

  function logo(x, y, size) {
    if (!crest.naturalWidth) return;
    const width = size * crest.naturalWidth / crest.naturalHeight;
    context.drawImage(crest, x + (size - width) / 2, y, width, size);
  }

  function topAndBottom(match, top, bottom, light = false) {
    const color = light ? '#153725' : white;
    const muted = light ? '#3a634a' : subdued;
    rect(68, top, 76, 80, light ? '#dbeae0' : '#e5f4e8');
    logo(73, top + 6, 67);
    text('A.S.D. MONTANINO', 164, top + 24, 38, { align: 'left', color });
    text('CAMPIONATO UISP', 166, top + 58, 20, { align: 'left', color: muted, family: body, weight: 700 });
    if (match.giornata) text(match.giornata + 'ª GIORNATA', 1010, top + 40, 27,
      { align: 'right', color: muted, family: body, weight: 700 });
    line(69, bottom - 29, 1011, bottom - 29, light ? '#91ac9a' : '#63947a');
    text('@ASD_MONTANINO', 69, bottom, 22, { align: 'left', family: body, weight: 700, color: muted });
    if (demo) text('ESEMPIO DIMOSTRATIVO', 1010, bottom, 22,
      { align: 'right', family: body, weight: 700, color: muted });
  }

  function strokes(height, color) {
    for (let i = 0; i < 5; i++) {
      const x = 709 + i * 83;
      line(x, 0, x - 485, height, color, i === 0 ? 3 : 1);
    }
  }

  function team(name, x, y, size, max, color, align = 'center') {
    text(String(name).toLocaleUpperCase('it'), x, y, size,
      { color: color || (ownTeam(name) ? lime : white), max, align });
  }

  function fixtureLine(match) {
    return match.casa + '  ' + match.golCasa + ' – ' + match.golOspite + '  ' + match.ospite;
  }

  function prepartita(match, height, top, bottom, at) {
    rect(0, 0, 1080, height, '#0a1b11');
    cover(teamPhoto, 0, at(-.14), 1080, at(.73) - at(-.14), .74);
    shade(0, 0, 1080, height, [[0, '#050f0bea'], [.32, '#10291a00'], [.49, '#07150d08'], [.67, '#07150df7'], [1, '#07150d']]);
    strokes(height, '#a5e6b734');
    polygon([[0, at(.555)], [1080, at(.495)], [1080, at(.92)], [0, at(.92)]], '#07170ef0');
    line(68, at(.575), 1012, at(.53), '#83e6a36c', 2);
    text('MATCH DAY', 66, at(.075), 137, { align: 'left', max: 940 });
    rect(69, at(.147), 186, 8, lime);
    team(match.casa, 70, at(.65), 109, 942, null, 'left');
    text('VS', 72, at(.725), 30, { align: 'left', color: subdued, family: body, weight: 700 });
    team(match.ospite, 70, at(.797), 109, 942, null, 'left');
    rect(68, at(.877), 944, 114, '#a4f8b8');
    text(readableDate(match).toLocaleUpperCase('it') + (match.ora ? ' · ORE ' + match.ora : ''),
      94, at(.877) + 32, 29, { align: 'left', max: 882, color: ink, family: body, weight: 700 });
    text(match.campo || 'Campo da definire', 94, at(.877) + 77, 26,
      { align: 'left', max: 882, color: '#234431', family: body, weight: 700 });
    topAndBottom(match, top, bottom);
  }

  function risultato(match, photo, height, top, bottom, at) {
    rect(0, 0, 1080, height, '#08170e');
    cover(photo || teamPhoto, 0, 0, 1080, height, .62);
    shade(0, 0, 1080, height, [[0, '#040e08f5'], [.23, '#08180d46'], [.4, '#091a0f08'], [.63, '#07150dcf'], [1, '#07150d']]);
    strokes(height, '#9af1ad38');
    text('FULL TIME', 540, at(.12), 145, { max: 920 });
    rect(450, at(.21), 180, 7, lime);
    line(68, at(.565), 1012, at(.508), '#b4f7c66c', 2);
    polygon([[0, at(.615)], [1080, at(.552)], [1080, at(.815)], [0, at(.878)]], '#07170ee3');
    text(match.golCasa + ' – ' + match.golOspite, 540, at(.655), 270, { max: 850 });
    line(540, at(.773), 540, at(.842), '#63947a');
    team(match.casa, 299, at(.805), 65, 420);
    team(match.ospite, 781, at(.805), 65, 420);
    text(readableDate(match).toLocaleUpperCase('it'), 540, at(.945), 29,
      { max: 900, color: subdued, family: body, weight: 700 });
    topAndBottom(match, top, bottom);
  }

  function marcatori(match, details, goals, height, top, bottom, at) {
    rect(0, 0, 1080, height, '#eaf1e8');
    strokes(height, '#427b5350');
    rect(0, at(.026), 1080, at(.255) - at(.026), '#123c27');
    polygon([[750, at(.026)], [1080, at(.026)], [1080, at(.255)], [632, at(.255)]], '#205837');
    text('MARCATORI', 68, at(.134), 125, { align: 'left', max: 690 });
    text(match.golCasa + ' – ' + match.golOspite, 1009, at(.134), 94,
      { align: 'right', max: 229, color: lime });
    const maxRows = Math.max(1, ...goals.map(group => group.length));
    const spacing = Math.min(76, (at(.84) - at(.45)) / maxRows);
    goals.forEach((group, column) => {
      const x = column ? 552 : 68;
      const name = column ? match.ospite : match.casa;
      rect(x, at(.31), 460, at(.867) - at(.31), '#f9fcf7');
      rect(x, at(.31), 460, 75, ownTeam(name) ? '#a4f8b8' : '#d5e5d8');
      team(name, x + 22, at(.31) + 37, 58, 418, '#153725', 'left');
      const rows = group.length ? group : ['Nessun marcatore registrato'];
      rows.forEach((scorer, index) => {
        const y = at(.31) + 104 + spacing * index;
        rect(x + 20, y - 4, 8, 8, '#4d865e');
        text(scorer, x + 40, y, Math.min(29, spacing * .64),
          { align: 'left', max: 398, family: body, weight: 700, color: '#143522' });
        line(x + 20, y + spacing * .45, x + 438, y + spacing * .45, '#cddbcf', 1);
      });
    });
    if (!details.eventiCompleti) text('MARCATORI REGISTRATI NEL TABELLINO', 68, at(.944), 25,
      { align: 'left', color: '#39634a', family: body, weight: 700 });
    topAndBottom(match, top, bottom, true);
  }

  function mvp(match, details, portrait, height, top, bottom, at) {
    rect(0, 0, 1080, height, '#0b1d13');
    polygon([[545, 0], [1080, 0], [1080, height], [334, height]], '#1b4029');
    strokes(height, '#83d69c5c');
    if (portrait) {
      cover(portrait, 363, at(.075), 717, at(.69) - at(.075), .34);
      shade(363, at(.075), 717, at(.69) - at(.075), [[0, '#0c281818'], [.63, '#10291a08'], [1, '#10291af7']]);
    } else {
      context.save();
      context.globalAlpha = .17;
      logo(549, at(.12), 425);
      context.restore();
    }
    text('MVP', 64, at(.25), 258, { align: 'left', color: lime, max: 585 });
    rect(69, at(.405), 100, 7, lime);
    text('GIOCATORE DELLA PARTITA', 70, at(.452), 27, { align: 'left', color: white, family: body, weight: 700 });
    polygon([[0, at(.625)], [1080, at(.572)], [1080, at(.842)], [0, at(.895)]], '#a4f8b8');
    const words = String(details.mvp).trim().toLocaleUpperCase('it').split(/\s+/);
    const split = Math.ceil(words.length / 2);
    if (words.length > 1) {
      text(words.slice(0, split).join(' '), 67, at(.681), 123, { align: 'left', color: ink, max: 942 });
      text(words.slice(split).join(' '), 67, at(.797), 123, { align: 'left', color: ink, max: 942 });
    } else text(words[0], 67, at(.744), 146, { align: 'left', color: ink, max: 942 });
    text(fixtureLine(match).toLocaleUpperCase('it'), 69, at(.95), 42, { align: 'left', max: 940 });
    topAndBottom(match, top, bottom);
  }

  function draw(match, type, details, goals, height, photo) {
    canvas.height = height;
    const story = height === 1920;
    const top = story ? 176 : 69;
    const bottom = story ? 1672 : 1274;
    const at = fraction => (story ? 340 : 183) + fraction * (story ? 1220 : 984);
    if (type === 'pre') prepartita(match, height, top, bottom, at);
    else if (type === 'final') risultato(match, photo, height, top, bottom, at);
    else if (type === 'scorers') marcatori(match, details, goals, height, top, bottom, at);
    else mvp(match, details, photo, height, top, bottom, at);
  }

  async function imageFrom(source, crossOrigin = false) {
    if (!source) return null;
    const image = new Image();
    if (crossOrigin) image.crossOrigin = 'anonymous';
    image.src = source;
    let timeout;
    try {
      await Promise.race([image.decode(), new Promise((_, reject) => { timeout = setTimeout(reject, 4500); })]);
      return image;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  function imageFileName(value) {
    const name = String(value ?? '');
    return /^[\p{L}\p{N}][\p{L}\p{N} _().-]*\.(?:jpe?g|png|webp|avif)$/iu.test(name) && !name.includes('..') ? name : '';
  }

  function mvpImage(fileName) {
    const name = imageFileName(fileName);
    return name ? imageFrom('assets/img/' + encodeURIComponent(name)) : null;
  }

  function resultPhoto(match) {
    if (demo) return imageFrom(window.MONTANINO_GRAPHICS_MATCH_PHOTO);
    const photos = Array.isArray(season.fotoPartite) ? season.fotoPartite : [];
    const photo = photos.find(item => item && String(item.partita) === String(match.id));
    const file = String(photo?.file ?? '');
    if (/^sb:montanino-[0-9a-f]{32}\.webp$/.test(file)) {
      const url = new URL('/storage/v1/object/public/montanino-partite/' + encodeURIComponent(file.slice(3)),
        window.MONTANINO_SUPABASE.url);
      return imageFrom(url.href, true);
    }
    const name = imageFileName(file);
    return name ? imageFrom('assets/img/partite/' + encodeURIComponent(name)) : null;
  }

  async function refresh() {
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

    let photo;
    if (type === 'mvp') photo = await mvpImage(details.mvpFoto);
    if (type === 'final') photo = await resultPhoto(match);
    if (current !== revision) return;
    draw(match, type, details, goals, height, photo);
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
      await Promise.allSettled([imageFrom(demo ? window.MONTANINO_GRAPHICS_PHOTO : 'assets/img/identita-hero.webp').then(image => { teamPhoto = image; }),
        crest.decode(), document.fonts.load('900 100px ' + display), document.fonts.load('700 35px ' + body)]);
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
