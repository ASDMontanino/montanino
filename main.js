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
  [...list].sort((a,b) => Number(b.punti||0) - Number(a.punti||0)).forEach((team, i) => {
    const tr = document.createElement('tr');
    if ((team.squadra || '').toLocaleLowerCase('it') === 'montanino') tr.classList.add('highlight');
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
  const calendarNode = $('calendar-list');
  const isPlayed = (m) => Number.isInteger(m.golCasa) && Number.isInteger(m.golOspite);
  const dateLabel = (m) => m.data ? `${formatDate(m.data)}${m.ora ? ' · '+m.ora : ''}` : 'DATA DA DEFINIRE';
  const create = (tag,cls,txt) => {
    const el=document.createElement(tag); if(cls)el.className=cls;if(txt!==undefined)el.textContent=txt;return el;
  };
  const addLink = (parent,label,url,cls) => {
    const a=create('a',cls,label); a.href=url;a.target='_blank';a.rel='noopener noreferrer';parent.appendChild(a);return a;
  };
  function renderCalendar(filter='tutte'){
    if (!calendarNode) return;
    calendarNode.replaceChildren();
    const rows=calendar.filter(m=>filter==='tutte'||(filter==='giocate'&&isPlayed(m))||m.fase===filter);
    rows.forEach(m=>{
      const card=create('article','fixture-card reveal');
      const left=create('div','fixture-count');left.append(create('span','fixture-round',`${m.fase.toUpperCase()} / ${String(m.giornata).padStart(2,'0')}`),create('span','fixture-id',m.id));
      const middle=create('div','fixture-main');
      middle.appendChild(create('p','fixture-when',dateLabel(m)));
      const names=create('div','fixture-names');
      const h=create('strong',m.casa==='Montanino'?'is-ours':'',m.casa);
      const separator=create('span',isPlayed(m)?'fixture-score':'fixture-versus',isPlayed(m)?`${m.golCasa} : ${m.golOspite}`:'VS');
      const a=create('strong',m.ospite==='Montanino'?'is-ours':'',m.ospite);
      names.append(h,separator,a);middle.appendChild(names);
      const loc=create('div','fixture-field',m.campo || 'CAMPO DA CONFERMARE');middle.appendChild(loc);
      const side=create('div','fixture-side');
      side.appendChild(create('span','fixture-state '+(isPlayed(m)?'played':'upcoming'),isPlayed(m)?'FINALE':m.data?'PROGRAMMATA':'DA DEFINIRE'));
      if(m.campo){ addLink(side,'DOVE SI GIOCA ↗','https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(m.campo),'fixture-map'); }
      if(m.data&&m.ora&&!isPlayed(m)){
        const b=create('button','fixture-ics','+ CALENDARIO');b.type='button';
        b.addEventListener('click',()=>downloadICS(m));side.appendChild(b);
      }
      card.append(left,middle,side);
      // Tabellino completo associato all'ID della partita (anche dopo i filtri).
      if (window.MontaninoTabellini) window.MontaninoTabellini.attach(card,m,side);
      calendarNode.appendChild(card);
    });
    if(!rows.length)calendarNode.appendChild(create('p','editorial-empty','NESSUNA PARTITA IN QUESTA SEZIONE.'));
    // Gli elementi inseriti dopo il caricamento devono diventare visibili anche con l’effetto reveal.
    calendarNode.querySelectorAll('.reveal').forEach(el=>el.classList.add('is-visible'));
  }
  function downloadICS(m){
    const safe=s=>String(s).replace(/[\\;,\n]/g,' ');
    const isoLocal=m.data.replace(/-/g,'')+'T'+m.ora.replace(':','')+'00';
    // TZID usa Europe/Rome affinché l'ora locale resti corretta al cambio ora legale.
    const ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Montanino//Calendario 2026-27//IT','BEGIN:VEVENT',
      `UID:${m.id}-montanino-2026-27@montanino.local`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')}`,
      `DTSTART;TZID=Europe/Rome:${isoLocal}`,
      `DTEND;TZID=Europe/Rome:${isoLocal.slice(0,9)+String((Number(m.ora.slice(0,2))+2)%24).padStart(2,'0')+isoLocal.slice(11)}`,
      `SUMMARY:${safe(m.casa+' - '+m.ospite)}`,`LOCATION:${safe(m.campo||'Da definire')}`,
      'DESCRIPTION:Orario soggetto a variazioni. Verificare i comunicati ufficiali UISP.','END:VEVENT','END:VCALENDAR'].join('\r\n');
    const url=URL.createObjectURL(new Blob([ics],{type:'text/calendar;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download=`Montanino-${m.id}.ics`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  document.querySelectorAll('[data-calendar-filter]').forEach(btn=>btn.addEventListener('click',()=>{
    document.querySelectorAll('[data-calendar-filter]').forEach(b=>{const on=b===btn;b.classList.toggle('is-active',on);b.setAttribute('aria-pressed',String(on));});
    renderCalendar(btn.dataset.calendarFilter);
  }));
  renderCalendar();
  // Attiva un tabellino raggiunto da un link diretto (anche dall'ultimo risultato).
  window.addEventListener('hashchange', () => window.MontaninoTabellini?.openFromHash());
  requestAnimationFrame(() => window.MontaninoTabellini?.openFromHash());

  const coverage=SITE_DATA._statsCoverage||{formations:0,events:0,played:0};
  const coverageEl=$('stats-coverage');
  const formations=coverage.formations??coverage.complete??0;
  const events=coverage.events??coverage.complete??0;
  if(coverageEl&&coverage.played>0){
    coverageEl.hidden=false;
    coverageEl.textContent=`STATISTICHE SU ${coverage.played} GARE GIOCATE · PRESENZE E VOTI: ${formations} FORMAZIONI VERIFICATE · GOL, ASSIST E CARTELLINI: ${events} CRONOLOGIE VERIFICATE. I DATI ASSENTI NON SONO CONTEGGIATI.`;
  }
  const players=Array.isArray(SITE_DATA.giocatori)?SITE_DATA.giocatori:[];
  const intVal=x=>Math.max(0,Number(x)||0);
  const sum=k=>players.reduce((n,p)=>n+intVal(p[k]),0);
  set('stat-players-total',players.length);
  set('stat-goals-total',events||!coverage.played?sum('gol'):'—');
  set('stat-assists-total',events||!coverage.played?sum('assist'):'—');
  set('stat-apps-total',formations||!coverage.played?sum('presenze'):'—');
  const statsBody=$('player-stats');
  function renderStats(order='gol'){
    if(!statsBody)return;
    statsBody.replaceChildren();
    $('stats-empty').hidden=players.length>0;
    document.querySelector('.player-stat-table').hidden=players.length===0;
    [...players].sort((a,b)=>intVal(b[order])-intVal(a[order])||String(a.nome).localeCompare(String(b.nome),'it'))
      .forEach(p=>{
        const tr=create('tr');const showLineups=formations||!coverage.played,showEvents=events||!coverage.played;
        const values=[p.numero??'—',p.nome||'—',p.ruolo||'—',showLineups?(p.presenze??0):'—',showEvents?(p.gol??0):'—',showEvents?(p.assist??0):'—',showEvents?(p.gialli??0):'—',showEvents?(p.rossi??0):'—',showLineups?(p.mediaVoto??'—'):'—'];
        values.forEach((v,i)=>{const td=create('td',i===1?'player-name-cell':'',String(v));tr.appendChild(td)});statsBody.appendChild(tr);
      });
  }
  document.querySelectorAll('[data-stats-sort]').forEach(btn=>btn.addEventListener('click',()=>{
    document.querySelectorAll('[data-stats-sort]').forEach(b=>{const on=b===btn;b.classList.toggle('is-active',on);b.setAttribute('aria-pressed',String(on));});
    renderStats(btn.dataset.statsSort);
  }));
  renderStats();

  const staff=Array.isArray(SITE_DATA.staff)?SITE_DATA.staff:[];
  $('staff-empty').hidden=staff.length>0;
  const staffRoot=$('staff-list');staffRoot.replaceChildren();
  const normalizeStaffGroup=s=>String(s||'').trim().replace(/\s+/g,' ');
  const groupId=s=>normalizeStaffGroup(s).toLocaleLowerCase('it');
  const groupedStaff=new Map();
  const availableGroups=[
    'Dirigenza','Staff tecnico','Comunicazione',
    ...(Array.isArray(SITE_DATA.staffGruppi)?SITE_DATA.staffGruppi:[]),
    ...staff.map(s=>s.gruppo||'Altro staff')
  ];
  const labels=new Map();
  availableGroups.forEach(name=>{
    const clean=normalizeStaffGroup(name);if(clean&&!labels.has(groupId(clean)))labels.set(groupId(clean),clean);
  });
  staff.forEach(member=>{
    const key=groupId(member.gruppo||'Altro staff');
    if(!groupedStaff.has(key))groupedStaff.set(key,[]);
    groupedStaff.get(key).push(member);
  });
  let visibleGroupNumber=0;
  for(const [key,label] of labels){
    const members=groupedStaff.get(key)||[];if(!members.length)continue;
    visibleGroupNumber++;
    const section=create('section','staff-group');
    section.setAttribute('aria-label',label);
    const heading=create('div','staff-group-heading');
    const number=create('span','staff-group-number',String(visibleGroupNumber).padStart(2,'0'));
    const title=create('h3','staff-group-title',label);
    const count=create('span','staff-group-count',members.length===1?'01 PERSONA':String(members.length).padStart(2,'0')+' PERSONE');
    heading.append(number,title,count);
    const cards=create('div','staff-grid');
    for(const s of members){
      const card=create('article','staff-card reveal');
      const media=create('div','staff-card-media');
      if(s.foto){
        const im=document.createElement('img');
        im.src='assets/img/'+encodeURIComponent(s.foto);im.alt='Ritratto di '+(s.nome||'membro staff');im.loading='lazy';
        im.onerror=()=>{im.remove();media.appendChild(create('span','staff-initial',String(s.nome||'M').split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase()));};
        media.appendChild(im);
      } else media.appendChild(create('span','staff-initial',String(s.nome||'M').split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase()));
      const details=create('div','staff-details');
      details.append(create('small','','A.S.D. MONTANINO'),create('strong','',s.nome||'NOME DA INSERIRE'),create('span','',s.ruolo||''));
      card.append(media,details);cards.appendChild(card);
    }
    section.append(heading,cards);staffRoot.appendChild(section);
  }

  const sponsors=Array.isArray(SITE_DATA.sponsor)?SITE_DATA.sponsor:[];
  $('sponsors-empty').hidden=sponsors.length>0;
  sponsors.forEach(s=>{
    const node=create('div','sponsor-tile reveal');
    const container=(s.sito&&/^https?:\/\//.test(s.sito))?create('a','sponsor-inner'):create('div','sponsor-inner');
    if(container.tagName==='A'){container.href=s.sito;container.target='_blank';container.rel='noopener noreferrer';}
    if(s.logo){const im=document.createElement('img');im.src='assets/img/'+encodeURIComponent(s.logo);im.alt='Logo '+(s.nome||'sponsor');im.loading='lazy';container.appendChild(im);}
    else container.append(create('strong','sponsor-wordmark',s.nome||''));
    container.append(create('small','sponsor-tier',s.categoria||'PARTNER UFFICIALE'));
    node.appendChild(container);$('sponsors-list').appendChild(node);
  });

  const socials=SITE_DATA.social||{};
  const channelNames=[['instagram','INSTAGRAM','IG'],['facebook','FACEBOOK','FB'],['tiktok','TIKTOK','TT']];
  channelNames.forEach(([key,name,abbr])=>{
    const url=socials[key];const li=create('div','social-channel '+(!url?'social-channel-disabled':''));
    if(url && /^https?:\/\//.test(url)){
      const a=addLink(li,'',url,'social-channel-link');
      a.append(create('span','social-channel-icon',abbr),create('strong','',name),create('span','','↗'));
    } else {
      li.append(create('span','social-channel-icon',abbr),create('strong','',name),create('small','','LINK IN ARRIVO'));
    }
    $('social-links').appendChild(li);
  });

  const photos = Array.isArray(SITE_DATA.galleria) ? SITE_DATA.galleria : [];
  const gallery = $('roster');
  photos.forEach((item, i) => {
    const button = document.createElement('button');
    button.className = 'roster-card reveal'; button.type = 'button';
    button.setAttribute('aria-label', 'Apri fotografia: ' + (item.titolo || `Gruppo ${i + 1}`));
    const photo = document.createElement('img');
    photo.src = 'assets/img/' + encodeURIComponent(item.foto || '') + '?v=20261103';
    photo.alt = item.titolo || `Foto di gruppo ${i+1} del Montanino`;
    photo.loading = 'lazy'; photo.decoding = 'async';
    const overlay = document.createElement('span'); overlay.className='roster-overlay';
    const counter=document.createElement('small');counter.textContent=`0${i+1} / 0${photos.length}`;
    const title=document.createElement('strong'); title.textContent=item.titolo || `GRUPPO ${i+1}`;
    const sub=document.createElement('em');sub.textContent=item.sottotitolo || 'LA NOSTRA ROSA';
    overlay.append(counter,title,sub);
    const arrow=document.createElement('span');arrow.className='roster-arrow';arrow.textContent='↗';arrow.setAttribute('aria-hidden','true');
    button.append(photo,overlay,arrow);
    button.addEventListener('click',()=>openLightbox(i));
    gallery.appendChild(button);
  });

  const dialog = $('lightbox'), big = $('lightbox-img'), label = $('lightbox-caption');
  let active = -1, before = null;
  function showPhoto(i) {
    if (!photos.length) return;
    active = (i + photos.length) % photos.length;
    big.src = 'assets/img/' + encodeURIComponent(photos[active].foto) + '?v=20261103';
    big.alt = photos[active].titolo || 'Foto della rosa';
    label.textContent = `${photos[active].titolo || 'ROSA'} — ${active+1} / ${photos.length}`;
  }
  function openLightbox(i) {
    before = document.activeElement;
    showPhoto(i); dialog.hidden=false; document.body.classList.add('modal-open');
    dialog.querySelector('.lightbox-close').focus();
  }
  function closeLightbox() {
    if (dialog.hidden) return;
    dialog.hidden=true; document.body.classList.remove('modal-open');
    big.removeAttribute('src'); if (before && before.focus) before.focus();
  }
  dialog.querySelector('.lightbox-close').addEventListener('click',closeLightbox);
  dialog.querySelector('.lightbox-prev').addEventListener('click',()=>showPhoto(active-1));
  dialog.querySelector('.lightbox-next').addEventListener('click',()=>showPhoto(active+1));
  dialog.addEventListener('click',e=>{if(e.target===dialog) closeLightbox();});
  document.addEventListener('keydown',e=>{
    if (dialog.hidden) return;
    if (e.key==='Escape') closeLightbox();
    if (e.key==='ArrowLeft') showPhoto(active-1);
    if (e.key==='ArrowRight') showPhoto(active+1);
    if (e.key==='Tab') {
      const focusables=[...dialog.querySelectorAll('button:not([disabled])')];
      const ix=focusables.indexOf(document.activeElement);
      if(e.shiftKey && ix===0){e.preventDefault();focusables[focusables.length-1].focus();}
      if(!e.shiftKey && ix===focusables.length-1){e.preventDefault();focusables[0].focus();}
    }
  });

  // I contenuti caricati dal database vengono inseriti dopo l'avvio degli
  // effetti: non lasciarli invisibili perché l'IntersectionObserver è già partito.
  document.querySelectorAll('.roster-card.reveal, .staff-card.reveal, .sponsor-tile.reveal').forEach(node => node.classList.add('is-visible'));

  const toggle = $('menu-toggle'), nav = $('nav');
  function closeMenu(){nav.classList.remove('open');toggle.classList.remove('active');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Apri menu');}
  toggle.addEventListener('click',()=>{
    const open=nav.classList.toggle('open');toggle.classList.toggle('active',open);
    toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Chiudi menu':'Apri menu');
  });
  nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});
  document.addEventListener('click',e=>{if(!nav.contains(e.target) && !toggle.contains(e.target))closeMenu();});

  /* Countdown solo quando è stata inserita una data confermata. */
  const cd = $('countdown');
  if (next.dataISO) {
    const kickoff = new Date(next.dataISO).getTime();
    if (Number.isFinite(kickoff) && kickoff > Date.now()) {
      cd.hidden = false;
      const labels = [['giorni',86400000],['ore',3600000],['minuti',60000],['secondi',1000]];
      labels.forEach(([name])=>{const part=document.createElement('span');part.className='count-unit';
        const val=document.createElement('strong');val.dataset.unit=name;val.textContent='00';
        const caption=document.createElement('small');caption.textContent=name;part.append(val,caption);cd.appendChild(part);
      });
      const tick=()=>{
        let d=kickoff-Date.now();if(d<=0){cd.hidden=true;clearInterval(timer);return;}
        labels.forEach(([name,ms])=>{const n=Math.floor(d/ms);d%=ms;cd.querySelector(`[data-unit="${name}"]`).textContent=String(n).padStart(2,'0');});
      };
      tick(); const timer=setInterval(tick,1000);
    }
  }
})();
