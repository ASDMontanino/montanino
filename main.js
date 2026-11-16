/* Dati e interazioni reali. Nessun backend, nessuna dipendenza a pagamento. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const set = (id, value) => { const el = $(id); if (el) el.textContent = value ?? '—'; };
  set('year', new Date().getFullYear());
  if (typeof SITE_DATA === 'undefined') { console.warn('data.js non è stato caricato'); return; }

  const next = SITE_DATA.prossimaPartita || {};
  set('next-home', next.casa || 'MONTANINO');
  set('next-away', next.ospite || 'DA DEFINIRE');
  set('next-date', next.data || 'DA CONFERMARE');
  set('next-competition', next.competizione || 'CAMPIONATO');
  set('next-place', next.campo || 'CAMPO DA CONFERMARE');
  if (next.indirizzoMaps) {
    const a = $('next-maps');
    a.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(next.indirizzoMaps);
    a.hidden = false;
  }

  const last = SITE_DATA.ultimoRisultato || {};
  set('last-home', last.casa || 'MONTANINO');
  set('last-away', last.ospite || 'DA DEFINIRE');
  set('last-date', last.data || 'DA AGGIORNARE');
  set('last-competition', last.competizione || 'RISULTATI');
  set('last-score', `${last.golCasa ?? '—'} : ${last.golOspite ?? '—'}`);
  set('last-status', last.nota || 'RISULTATO IN AGGIORNAMENTO');
  const lastReport = $('last-report-link');
  if (lastReport && last.idPartita) {
    lastReport.href = '#partita-' + encodeURIComponent(last.idPartita);
    lastReport.hidden = false;
  }

  const standings = $('standings');
  const list = Array.isArray(SITE_DATA.classifica) ? SITE_DATA.classifica : [];
  // La UISP ordina la tabella ufficiale; si conserva quell'ordine anche a pari punti.
  list.forEach((team, i) => {
    const tr = document.createElement('tr');
    if (/\bmontanino\b/i.test(team.squadra || '')) tr.classList.add('highlight');
    const columns = [String(i+1).padStart(2,'0'), team.squadra, team.giocate, team.punti];
    columns.forEach((value,j) => {
      const td = document.createElement('td'); td.textContent = value ?? '—';
      if (j===1) td.className='team-cell';
      tr.appendChild(td);
    });
    standings.appendChild(tr);
  });

  const formatDate = (iso) => {
    if (!iso) return 'DATA DA DEFINIRE';
    const d = new Date(iso + 'T12:00:00');
    return new Intl.DateTimeFormat('it-IT',{day:'2-digit',month:'short',year:'numeric',timeZone:'Europe/Rome'}).format(d).toUpperCase();
  };
  const calendar = Array.isArray(SITE_DATA.calendario) ? SITE_DATA.calendario : [];
