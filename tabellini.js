/* =====================================================================
   A.S.D. MONTANINO / V3.4 — MATCH REPORT
   Nessun servizio esterno: legge SITE_DATA.dettagliPartite in data.js.
   Non inventa dati sportivi e non modifica i risultati del campionato.
   ===================================================================== */
(() => {
  'use strict';
  const $ = (sel, context=document) => context.querySelector(sel);
  const make = (tag, cls, text) => {
    const node=document.createElement(tag);
    if (cls) node.className=cls;
    if (text!==undefined && text!==null) node.textContent=String(text);
    return node;
  };
  const appendText = (node,cls,text) => node.appendChild(make('span',cls,text));
  const safeArray = (v) => Array.isArray(v)?v:[];
  const hasData = (v) => !!v && (safeArray(v.titolari).length>0 || safeArray(v.panchina).length>0 || safeArray(v.eventi).length>0 || !!v.modulo || !!v.note);
  const isPlayed = (m) => Number.isInteger(m.golCasa) && Number.isInteger(m.golOspite);
  const rate = v => v===null || v===undefined || v==='' ? '—' : (typeof v==='number' ? String(v).replace('.',',') : String(v));
  const normal = name => String(name||'').trim().toLocaleLowerCase('it');
  const minuteLabel = val => (val===undefined || val===null || val==='') ? '—' : (String(val).replace(/[′']/g,'') + '′');
  const repOf = player => {
    const explicit=String(player.reparto||'').trim().toUpperCase();
    if (['P','D','C','A'].includes(explicit)) return explicit;
    const role=String(player.ruolo||'').toLowerCase();
    if(role.includes('port'))return 'P';
    if(role.includes('dif'))return 'D';
    if(role.includes('att'))return 'A';
    return 'C';
  };
  const labelFor = ev => ({ gol:'GOL', gol_rigore:'GOL (RIGORE)', 'gol(rigore)':'GOL (RIGORE)', rigore_parato:'RIGORE PARATO', rigore_sbagliato:'RIGORE SBAGLIATO', giallo:'AMMONIZIONE', rosso:'ESPULSIONE', sostituzione:'CAMBIO', autogol:'AUTOGOL', rigore:'RIGORE' }[String(ev.tipo||'').toLowerCase()] || String(ev.tipo||'EPISODIO').toUpperCase());
  const markerFor = ev => ({gol:'⚽',gol_rigore:'⚽','gol(rigore)':'⚽',rigore_parato:'🧤',rigore_sbagliato:'✕',giallo:'▰',rosso:'▰',sostituzione:'⇄',autogol:'⚽',rigore:'⚽'})[String(ev.tipo||'').toLowerCase()]||'•';

  // DEMO VISIVA: persone ed eventi segnaposto, MAI salvati o mescolati con i risultati reali.
  function demoMatch(){
    const schema=['P','D','D','D','D','C','C','C','A','A','A'];
    return {
      modulo:'4-3-3', datiCompleti:false, eventiCompleti:false,
      titolari:schema.map((reparto,i)=>({numero:i+1,nome:'Giocatore '+String(i+1).padStart(2,'0'),reparto,voto:i%4===0?7:i%3===0?5.5:6.5,nota:i===0?'Esempio di commento alla prestazione.':''})),
      panchina:[{numero:12,nome:'Giocatore 12',reparto:'P'},{numero:13,nome:'Giocatore 13',reparto:'C',entrato:'67',voto:6}],
      eventi:[
        {minuto:'23',tipo:'gol',giocatore:'Giocatore 09',assist:'Giocatore 07',squadra:'Montanino'},
        {minuto:'51',tipo:'giallo',giocatore:'Giocatore 04',squadra:'Montanino'},
        {minuto:'67',tipo:'sostituzione',esce:'Giocatore 08',entra:'Giocatore 13',squadra:'Montanino'}
      ],
      note:'Questa è un’anteprima grafica con dati inventati, non il tabellino della partita.'
    };
  }

  function drawPitch(holder, v){
    const starters=safeArray(v.titolari);
    const section=make('section','md-block md-pitch-section');
    const head=make('div','md-block-head');
    head.append(make('h5','', 'FORMAZIONE TITOLARE'),make('span','md-mini-label',v.modulo ? 'MODULO '+v.modulo : 'MODULO DA INSERIRE'));
    section.append(head);
    if(!starters.length){
      section.append(make('p','md-empty-small','Formazione titolare non ancora disponibile.'));
    }else{
      const common=window.MontaninoCommon;
      const layout=common.formationSlots(v.modulo||'4-3-3');
      const positions=common.assignFormation(layout.module,starters,SITE_DATA.giocatori||[],true);
      const byPosition=new Map(positions.filter(p=>p.posizione).map(p=>[p.posizione,p]));
      const pitch=make('div','md-pitch');
      const lines=make('div','md-pitch-lines');lines.setAttribute('aria-hidden','true');pitch.append(lines);
      layout.rows.forEach(line=>{
        const row=make('div','md-pitch-row');row.setAttribute('aria-label',line.label);
        line.slots.forEach(slot=>{
          const p=byPosition.get(slot.id);
          // Non inventare i nomi: mostrare soltanto le posizioni effettivamente compilate.
          if(!p)return;
          const badge=make('div','md-pitch-player');
          badge.append(make('span','md-shirt',p.numero??'•'),make('span','md-player-name',p.nome||'Da inserire'));
          if(p.voto!==undefined&&p.voto!==null&&p.voto!=='')badge.append(make('span','md-pitch-vote',rate(p.voto)));
          row.append(badge);
        });
        pitch.append(row);
      });
      section.append(pitch);
    }
    const substitutes=safeArray(v.panchina);
    const bench=make('div','md-bench');
    bench.append(make('h5','',`PANCHINA · ${substitutes.length ? substitutes.length + ' GIOCATORI' : 'DA INSERIRE'}`));
    if(!substitutes.length)bench.append(make('p','md-empty-small','Nessun nominativo inserito.'));
    else{
      const chips=make('div','md-bench-grid');
      substitutes.forEach(p=>{
        const chip=make('div','md-bench-player');
        chip.append(make('span','md-bench-number',p.numero??'—'),make('span','',p.nome||'Da inserire'));
        if(p.entrato!==undefined&&p.entrato!==null&&p.entrato!=='')chip.append(make('small','',`IN CAMPO AL ${minuteLabel(p.entrato)}`));
        chips.append(chip);
      });
      bench.append(chips);
    }
    section.append(bench);holder.append(section);
  }

  function drawEvents(holder, v){
    const evs=safeArray(v.eventi);
    const section=make('section','md-block md-events');
    section.append(make('h5','', 'CRONOLOGIA EVENTI'));
    if(!evs.length){section.append(make('p','md-empty-small','Gol, assist, ammonizioni e sostituzioni da inserire.'));}
    else {
      const list=make('ol','md-event-list');
      [...evs].sort((a,b)=>(parseInt(a.minuto,10)||0)-(parseInt(b.minuto,10)||0)).forEach(ev=>{
        const type=String(ev.tipo||'').toLowerCase();
        const row=make('li','md-event md-event-'+(type==='giallo'?'yellow':type==='rosso'?'red':['gol','gol_rigore','gol(rigore)'].includes(type)?'goal':'neutral'));
        row.append(make('span','md-event-minute',minuteLabel(ev.minuto)),make('span','md-event-icon',markerFor(ev)));
        const detail=make('div','md-event-info');
        detail.append(make('strong','',labelFor(ev)));
        detail.append(make('span','',type==='sostituzione'
          ? `${ev.esce||'Uscita da inserire'}  →  ${ev.entra||'Entrata da inserire'}`
          : (ev.giocatore||'Giocatore da inserire')));
        if(type==='gol' && ev.assist) detail.append(make('small','',`ASSIST: ${ev.assist}`));
        if(ev.squadra && ev.squadra!=='Montanino')detail.append(make('small','',`SQUADRA: ${ev.squadra}`));
        row.append(detail);list.append(row);
      });
      section.append(list);
    }
    if(evs.length && v.eventiCompleti!==true)section.append(make('p','md-data-warning','Eventi in fase di compilazione: la cronologia potrebbe essere incompleta.'));
    holder.append(section);
  }

  function count(events, name, type){
    const key=normal(name);
    if(!key)return null;
    const own=events.filter(e=>!e.squadra || normal(e.squadra)==='montanino');
    const n=own.filter(e=>{const eventType=String(e.tipo||'').toLowerCase();return type==='assist' ? eventType==='gol'&&normal(e.assist)===key : (type==='gol'?['gol','gol_rigore','gol(rigore)'].includes(eventType):eventType===type)&&normal(e.giocatore)===key;}).length;
    return n;
  }
  function drawGrades(holder, v){
    const section=make('section','md-block md-grades');
    const starters=safeArray(v.titolari), subs=safeArray(v.panchina), people=[...starters,...subs];
    section.append(make('h5','', 'VOTI E STATISTICHE INDIVIDUALI'));
    if(!people.length){section.append(make('p','md-empty-small','In attesa di formazione e voti ufficiali.'));holder.append(section);return;}
    const tbl=make('div','md-table-scroller');
    const table=make('table','md-table');
    const thead=make('thead');const h=make('tr');
    ['#','GIOCATORE','GOL','ASSIST','GIAL.','ROSSI','VOTO'].forEach(k=>h.append(make('th','',k)));
    thead.append(h);table.append(thead);
    const body=make('tbody');const events=safeArray(v.eventi);
    people.forEach((p,i)=>{
      const tr=make('tr');
      const values=[p.numero??'—',p.nome||'—', ...['gol','assist','giallo','rosso'].map(type=>{
        const n=count(events,p.nome,type);
        return n>0?String(n):(v.eventiCompleti===true?'0':'—');
      }),rate(p.voto)];
      values.forEach((val,idx)=>{
        const td=make('td',idx===1?'md-grade-name':idx===6?'md-grade-score':'',val);
        if(idx===1){
          if(i>=starters.length)td.append(make('small','md-grade-status','PANCHINA'));
          if(p.nota)td.append(make('small','md-grade-note',p.nota));
        }
        tr.append(td);
      });
      body.append(tr);
    });
    table.append(body);tbl.append(table);section.append(tbl);
    section.append(make('p','md-stats-note','“—” indica dato non inserito. I conteggi derivano dagli eventi registrati in questo tabellino.'));
    holder.append(section);
  }
  function renderContent(panel, m, v, isDemo){
    panel.replaceChildren();
    const header=make('div','md-header');
    const left=make('div');
    left.append(make('p','md-kicker','MATCH REPORT / '+String(m.id||'').toUpperCase()));
    left.append(make('h4','md-title',`${m.casa}  ${isPlayed(m)?m.golCasa+' : '+m.golOspite:'VS'}  ${m.ospite}`));
    const descriptor=isDemo?'DEMO · DATI NON REALI':v.datiCompleti===true?'TABELLINO COMPLETO':'TABELLINO IN COMPILAZIONE';
    header.append(left,make('span','md-status'+(isDemo?' md-is-demo':''),descriptor));
    panel.append(header);
    if(!hasData(v) && !isDemo){
      const empty=make('div','md-report-empty');
      empty.append(make('strong','','FORMAZIONE E VOTI IN ARRIVO.'),make('p','','Il risultato è disponibile, ma i dati individuali non sono ancora stati forniti. Nessun nome, voto o cartellino è stato inventato.'));
      const show=make('button','md-demo-button','GUARDA UN ESEMPIO DI TABELLINO ↗');show.type='button';
      show.addEventListener('click',()=>renderContent(panel,m,demoMatch(),true));
      empty.append(show);panel.append(empty);return;
    }
    if(isDemo){
      const alert=make('div','md-demo-banner','ANTEPRIMA DIMOSTRATIVA: formazione, nomi, voti ed episodi qui sotto sono inventati e servono soltanto a mostrare la grafica.');
      const back=make('button','md-demo-back','← TORNA AI DATI DELLA PARTITA');back.type='button';
      back.addEventListener('click',()=>renderContent(panel,m,(SITE_DATA.dettagliPartite||{})[m.id]||{},false));
      panel.append(alert,back);
    } else if(v.datiCompleti!==true){
      panel.append(make('p','md-partial-disclaimer','Dati tecnici parziali: l’assenza di un episodio o di un voto non significa che non sia avvenuto.'));
    }
    const layout=make('div','md-report-grid');
    const colLeft=make('div','md-report-column');const colRight=make('div','md-report-column');
    drawPitch(colLeft,v);drawEvents(colRight,v);drawGrades(colRight,v);
    layout.append(colLeft,colRight);panel.append(layout);
    if(v.note){const foot=make('div','md-match-note');foot.append(make('strong','','NOTE DEL MATCH'),make('p','',v.note));panel.append(foot);}
  }
  function attach(card,m,side){
    if(!side || !card || !m || !m.id)return;
    const details=(SITE_DATA.dettagliPartite||{})[m.id]||{};
    if(!isPlayed(m) && !hasData(details)) return;
    card.id='partita-'+m.id;
    const panel=make('div','md-report'); panel.id='tabellino-'+m.id;
    panel.setAttribute('role','region');panel.setAttribute('aria-label','Tabellino '+m.casa+' contro '+m.ospite);
    panel.hidden=true;
    const toggle=make('button','md-toggle',isPlayed(m)?'TABELLINO E VOTI +':'FORMAZIONE +');
    toggle.type='button';toggle.setAttribute('aria-controls',panel.id);toggle.setAttribute('aria-expanded','false');
    toggle.addEventListener('click',()=>{
      const open=panel.hidden;panel.hidden=!open;card.classList.toggle('md-open',open);
      toggle.setAttribute('aria-expanded',String(open));toggle.textContent=(isPlayed(m)?'TABELLINO E VOTI ':'FORMAZIONE ')+(open?'−':'+');
      if(open)renderContent(panel,m,details,false);
    });
    side.append(toggle);card.append(panel);
  }
  function openFromHash(){
    let hash=''; try{hash=decodeURIComponent(window.location.hash.slice(1));}catch(e){return;}
    if(!/^partita-[AR]\d{2}$/.test(hash))return;
    let card=document.getElementById(hash);
    if(!card){
      // Un filtro potrebbe aver nascosto la partita; ripristina TUTTE prima di aprirla.
      const all=document.querySelector('[data-calendar-filter="tutte"]');
      if(all && !all.classList.contains('is-active'))all.click();
      card=document.getElementById(hash);
    }
    if(!card)return;
    const btn=$('.md-toggle',card);
    if(btn && btn.getAttribute('aria-expanded')!=='true')btn.click();
    card.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
  }
  window.MontaninoTabellini={attach,openFromHash};
})();
