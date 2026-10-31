/* A.S.D. MONTANINO — amministrazione V3.0
   Modalità prova: localStorage, NON pubblica. Modalità online: Supabase Auth + RLS. */
(async function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const C=window.MontaninoCommon;
  const conf=window.MONTANINO_SUPABASE||{};
  const configured=!!(conf.url && conf.anonKey && /^https:\/\/[^/]+\.supabase\.co\/?$/.test(conf.url));
  let sb=null,online=false,rev=0,hasRow=false,draft=C.copy(SITE_DATA),activeMatchId='',dirty=false,busy=false;
  const msg=(s,error=false)=>{const el=$('alert');el.hidden=false;el.textContent=s;el.classList.toggle('error',error);};
  const el=(tag,cls='',text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;};
  const inp=(value='',kind='text',field='',placeholder='')=>{const n=el('input');n.type=kind;n.value=value??'';n.placeholder=placeholder;n.dataset.field=field;return n;};
  const pick=(value,items,field)=>{const s=el('select');s.dataset.field=field;items.forEach(([val,label])=>{const o=el('option','',label);o.value=val;s.append(o)});s.value=value||'';return s;};
  const del=()=>{const b=el('button','delete-row','×');b.type='button';b.setAttribute('aria-label','Rimuovi riga');b.title='Rimuovi riga';b.onclick=()=>{if(confirm('Rimuovere questa riga?')){b.closest('.editor-row')?.remove();markDirty();updateCounts();}};return b;};
  const read=(row,field)=>row.querySelector(`[data-field="${field}"]`)?.value?.trim()||'';
  const arr=selector=>[...$(selector).querySelectorAll('.editor-row')];
  const markDirty=()=>{dirty=true;$('save-status').textContent='Modifiche non salvate';$('save-note').textContent='Premi Salva per aggiornare i dati.';};
  function synced(){dirty=false;$('save-status').textContent='Dati salvati';$('save-note').textContent=online?'Pubblicati online: ricarica il sito per vederli.':'Salvati in questo browser: modalità prova, NON online.';}
  function makeRow(parent,klass='',number=''){
    const row=el('div','editor-row '+klass);if(number!=='')row.append(el('span','row-number',number));parent.append(row);return row;
  }
  function lineupRow(parent,p={},bench=false){
    const row=makeRow(parent,bench?'bench-row lineup-row':'lineup-row','◦');
    const name=inp(p.nome,'text','nome','Nome e cognome');name.setAttribute('list','player-names');name.setAttribute('aria-label','Nome giocatore');row.append(name);
    const number=inp(p.numero??'','number','numero','#');number.min='0';number.max='99';number.setAttribute('aria-label','Numero maglia');row.append(number);
    row.append(pick(p.reparto||'C',[['P','P · Portiere'],['D','D · Difensore'],['C','C · Centrocampo'],['A','A · Attaccante']],'reparto'));
    const vote=inp(p.voto??'','number','voto','Voto');vote.min='0';vote.max='10';vote.step='.5';vote.setAttribute('aria-label','Voto');row.append(vote);
    if(bench){const entrance=inp(p.entrato??'','text','entrato','Entrato al min.');entrance.setAttribute('aria-label','Minuto ingresso');row.append(entrance);}
    const note=inp(p.nota||'','text','nota','Commento facoltativo');note.setAttribute('aria-label','Nota pagella');row.append(note,del());updateCounts();return row;
  }
  function eventRow(parent,e={}){
    const row=makeRow(parent,'event-row');
    const min=inp(e.minuto??'','text','minuto','45+2');min.setAttribute('aria-label','Minuto');row.append(min);
    row.append(pick(e.tipo||'gol',[['gol','⚽ Gol'],['giallo','🟨 Ammonizione'],['rosso','🟥 Espulsione'],['sostituzione','⇄ Cambio'],['autogol','Autogol']],'tipo'));
    const player=inp(e.giocatore||e.esce||'','text','giocatore','Marcatore / Esce');player.setAttribute('list','player-names');player.setAttribute('aria-label','Giocatore oppure esce');row.append(player);
    const second=inp(e.assist||e.entra||'','text','secondo','Assist / Entra');second.setAttribute('list','player-names');second.setAttribute('aria-label','Assist oppure entra');row.append(second);
    row.append(pick(e.squadra||'Montanino',[['Montanino','Montanino'],['Avversario','Avversario']],'squadra'));row.append(del());
  }
  function rowDataLineup(row,bench){
    const name=read(row,'nome');if(!name)return null;
    const rawNumber=read(row,'numero'), rawVote=read(row,'voto');
    const p={nome:name,numero:rawNumber===''?null:Number(rawNumber),reparto:read(row,'reparto'),voto:rawVote===''?null:Number(rawVote),nota:read(row,'nota')};
    if(bench){const entrato=read(row,'entrato');if(entrato)p.entrato=entrato;}
    return p;
  }
  function updateCounts(){$('starter-count').textContent=arr('starters-list').length+'/11';}
  function showMatch(id){
    activeMatchId=id;const m=draft.calendario.find(x=>x.id===id);if(!m)return;
    $('match-select').value=id;
    [['match-date',m.data||''],['match-time',m.ora||''],['match-field',m.campo||''],['match-home',m.casa||''],['match-away',m.ospite||''],['match-goals-home',m.golCasa??''],['match-goals-away',m.golOspite??'']].forEach(([id,v])=>$(id).value=v);
    const d=(draft.dettagliPartite||{})[id]||{};
    $('match-module').value=d.modulo||'';$('match-notes').value=d.note||'';
    $('match-complete').checked=!!d.datiCompleti;$('events-complete').checked=!!d.eventiCompleti;
    $('starters-list').replaceChildren();C.list(d.titolari).forEach(p=>lineupRow($('starters-list'),p));
    $('bench-list').replaceChildren();C.list(d.panchina).forEach(p=>lineupRow($('bench-list'),p,true));
    $('events-list').replaceChildren();C.list(d.eventi).forEach(e=>eventRow($('events-list'),e));
    updateCounts();
  }
  function captureMatch(){
    if(!activeMatchId)return;
    const m=draft.calendario.find(x=>x.id===activeMatchId);if(!m)return;
    const home=$('match-goals-home').value,away=$('match-goals-away').value;
    if((home==='') !== (away===''))throw Error('Inserisci entrambi i punteggi oppure lasciali entrambi vuoti.');
    for(const x of [home,away])if(x!==''&&(!Number.isInteger(Number(x))||Number(x)<0))throw Error('I gol devono essere numeri interi non negativi.');
    m.data=$('match-date').value||null;m.ora=$('match-time').value||null;m.campo=$('match-field').value.trim()||null;
    m.casa=$('match-home').value.trim();m.ospite=$('match-away').value.trim();
    if(!m.casa||!m.ospite)throw Error('Inserisci entrambe le squadre.');
    m.golCasa=home===''?null:Number(home);m.golOspite=away===''?null:Number(away);
    const titolari=arr('starters-list').map(r=>rowDataLineup(r,false)).filter(Boolean);
    const panchina=arr('bench-list').map(r=>rowDataLineup(r,true)).filter(Boolean);
    const events=arr('events-list').map(r=>{
      const tipo=read(r,'tipo'),p=read(r,'giocatore'),secondo=read(r,'secondo');
      const ev={minuto:read(r,'minuto'),tipo,squadra:read(r,'squadra')};
      if(tipo==='sostituzione'){ev.esce=p;ev.entra=secondo;}else{ev.giocatore=p;if(tipo==='gol'&&secondo)ev.assist=secondo;}
      return ev;
    }).filter(x=>x.tipo);
    const names=[...titolari,...panchina].map(p=>C.normalize(p.nome));
    if(new Set(names).size!==names.length)throw Error('Un giocatore compare due volte tra titolari e panchina.');
    if(titolari.length>11)throw Error('Non puoi inserire più di 11 titolari.');
    for(const p of [...titolari,...panchina]){
      if(p.voto!==null && (!Number.isFinite(p.voto)||p.voto<0||p.voto>10))throw Error('I voti devono essere compresi tra 0 e 10.');
      if(p.numero!==null&&(!Number.isInteger(p.numero)||p.numero<0||p.numero>99))throw Error('Numero maglia non valido.');
    }
    const complete=$('match-complete').checked,eventsComplete=$('events-complete').checked;
    if((complete||eventsComplete) && (titolari.length!==11 || !C.played(m)))throw Error('Per confermare la completezza servono 11 titolari e un risultato finale.');
    if(complete && titolari.some(p=>p.voto===null))throw Error('Per completare le pagelle assegna un voto a tutti gli 11 titolari.');
    if(eventsComplete && events.some(e=>e.tipo==='sostituzione' ? !e.esce||!e.entra : !e.giocatore))throw Error('Ci sono episodi incompleti: inserisci i nomi dei giocatori.');
    const base=draft.dettagliPartite ||= {};
    base[activeMatchId]={modulo:$('match-module').value.trim()||null,titolari,panchina,eventi:events,note:$('match-notes').value.trim(),datiCompleti:complete,eventiCompleti:eventsComplete};
    if(complete&&eventsComplete){
      const ownCount=events.filter(e=>e.tipo==='gol'&&C.normalize(e.squadra)==='montanino').length;
      const ownScore=m.casa==='Montanino'?m.golCasa:m.golOspite;
      if(ownCount>ownScore)throw Error('Hai registrato più gol del Montanino rispetto al risultato finale.');
    }
  }
  function fillPlayers(){
    const node=$('players-list');node.replaceChildren();
    C.list(draft.giocatori).forEach(p=>playerRow(p));
    const dl=$('player-names');dl.replaceChildren();
    C.list(draft.giocatori).forEach(p=>{const op=el('option');op.value=p.nome;dl.append(op);});
    if(!node.childElementCount)node.append(el('p','hint','Nessun giocatore ancora inserito: clicca + GIOCATORE.'));
  }
  function playerRow(p={}){
    const node=$('players-list');node.querySelector('p.hint')?.remove();const r=makeRow(node);
    const name=inp(p.nome||'','text','nome','Nome e cognome');name.setAttribute('aria-label','Nome giocatore');r.append(name);
    const number=inp(p.numero??'','number','numero','Numero');number.min=0;number.max=99;number.setAttribute('aria-label','Numero maglia');r.append(number);
    r.append(pick(p.ruolo||'Centrocampista',[['Portiere','Portiere'],['Difensore','Difensore'],['Centrocampista','Centrocampista'],['Attaccante','Attaccante']],'ruolo'),del());
  }
  function fillStandings(){const node=$('standings-list');node.replaceChildren();C.list(draft.classifica).forEach(t=>{
    const r=makeRow(node,'standing-entity');const name=inp(t.squadra,'text','squadra');name.setAttribute('aria-label','Squadra');
    const pg=inp(t.giocate??0,'number','giocate');pg.min=0;pg.setAttribute('aria-label','Partite giocate');
    const pt=inp(t.punti??0,'number','punti');pt.min=0;pt.setAttribute('aria-label','Punti');r.append(name,pg,pt);
  });}
  function fillStaff(){const node=$('staff-editor-list');node.replaceChildren();C.list(draft.staff).forEach(x=>staffRow(x));}
  function staffRow(s={}){const r=makeRow($('staff-editor-list'),'staff-entity');
    r.append(inp(s.gruppo||'Staff tecnico','text','gruppo','Gruppo'),inp(s.nome||'','text','nome','Nome cognome'),inp(s.ruolo||'','text','ruolo','Incarico'),inp(s.foto||'','text','foto','foto.png (facoltativo)'),del());}
  function fillSponsors(){const node=$('sponsors-editor-list');node.replaceChildren();C.list(draft.sponsor).forEach(x=>sponsorRow(x));
    ['instagram','facebook','tiktok'].forEach(k=>$('social-'+k).value=(draft.social||{})[k]||'');}
  function sponsorRow(s={}){const r=makeRow($('sponsors-editor-list'),'sponsor-entity');
    r.append(inp(s.nome||'','text','nome','Nome sponsor'),inp(s.categoria||'Partner ufficiale','text','categoria','Categoria'),inp(s.logo||'','text','logo','logo.png (assets/img)'),inp(s.sito||'','url','sito','https://...'),del());}
  function captureOther(){
    draft.giocatori=arr('players-list').map(r=>({nome:read(r,'nome'),numero:read(r,'numero')===''?null:Number(read(r,'numero')),ruolo:read(r,'ruolo')})).filter(p=>p.nome);
    if(new Set(draft.giocatori.map(p=>C.normalize(p.nome))).size!==draft.giocatori.length)throw Error('La rosa contiene due giocatori con lo stesso nome.');
    draft.classifica=arr('standings-list').map(r=>({squadra:read(r,'squadra'),giocate:Number(read(r,'giocate')||0),punti:Number(read(r,'punti')||0)})).filter(t=>t.squadra);
    draft.staff=arr('staff-editor-list').map(r=>({gruppo:read(r,'gruppo'),nome:read(r,'nome'),ruolo:read(r,'ruolo'),...(read(r,'foto')?{foto:read(r,'foto')}:{})})).filter(s=>s.nome);
    draft.sponsor=arr('sponsors-editor-list').map(r=>({nome:read(r,'nome'),categoria:read(r,'categoria'),logo:read(r,'logo'),sito:read(r,'sito')})).filter(s=>s.nome);
    draft.social=Object.fromEntries(['instagram','facebook','tiktok'].map(k=>[k,$('social-'+k).value.trim()]));
    for(const item of draft.sponsor){if(item.sito && !/^https?:\/\//i.test(item.sito))throw Error('I link sponsor devono iniziare con https:// oppure essere vuoti.');}
    for(const [key,url] of Object.entries(draft.social))if(url&&!/^https:\/\//i.test(url))throw Error('Il link '+key+' deve iniziare con https://');
  }
  function captureAll(){captureMatch();captureOther();return C.copy(draft);}
  function render(){
    $('match-select').replaceChildren();C.list(draft.calendario).forEach(m=>{const o=el('option','',`${m.id} · ${m.fase} ${m.giornata} · ${m.casa} – ${m.ospite}`);o.value=m.id;$('match-select').append(o);});
    fillPlayers();fillStandings();fillStaff();fillSponsors();
    const id=activeMatchId&&draft.calendario.some(m=>m.id===activeMatchId)?activeMatchId:draft.calendario[0]?.id;
    if(id)showMatch(id);
  }
  async function setupOnline(){
    $('mode-label').textContent='ONLINE / ACCESSO RISERVATO';
    await new Promise((resolve,reject)=>{const s=el('script');s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';s.onload=resolve;s.onerror=reject;document.head.append(s);});
    sb=window.supabase.createClient(conf.url,conf.anonKey);online=true;
    $('login-panel').hidden=false;
    const {data:{session}}=await sb.auth.getSession();
    if(session)await enter(session.user);
  }
  async function enter(user){
    const {data:check,error:roleError}=await sb.from('club_admins').select('user_id').eq('user_id',user.id).maybeSingle();
    if(roleError||!check){msg('Account non autorizzato: aggiungi questo utente a club_admins seguendo GUIDA_V3.txt.',true);await sb.auth.signOut();return;}
    const {data:rows,error:readError}=await sb.from('club_content').select('payload,revision').eq('id','site').limit(1);
    if(readError){msg('Errore durante la lettura del database: '+readError.message,true);return;}
    if(rows?.length){draft=C.copy(rows[0].payload);rev=rows[0].revision;hasRow=true;}
    $('login-panel').hidden=true;$('editor').hidden=false;$('logout').hidden=false;$('demo-explanation').hidden=true;
    render();$('save-status').textContent=hasRow?'Connesso al database':'Database vuoto: premi Salva per pubblicare i dati iniziali';
    $('save-note').textContent='Utente autenticato e autorizzato.';
  }
  async function save(){
    if(busy)return;
    let value;try{value=captureAll();}catch(e){msg(e.message,true);return;}
    busy=true;$('save-all').disabled=$('save-bottom').disabled=true;
    try{
      if(online){
        const data=C.copy(value);delete data._statsCoverage;
        let query;
        if(!hasRow)query=sb.from('club_content').insert({id:'site',payload:data,revision:1}).select('revision');
        else query=sb.from('club_content').update({payload:data,revision:rev+1}).eq('id','site').eq('revision',rev).select('revision');
        const {data:rows,error}=await query;
        if(error)throw error;
        if(!rows?.length)throw Error('Il database è stato modificato da un altro amministratore. Ricarica il pannello prima di riprovare.');
        rev=rows[0].revision;hasRow=true;
      } else {
        localStorage.setItem('montanino-demo-v3',JSON.stringify(value));
      }
      synced();msg(online?'Modifiche salvate su Supabase. Apri il sito pubblico e ricaricalo.':'Modifiche salvate soltanto in questo browser. Per pubblicarle online configura Supabase.');
    }catch(err){msg('Salvataggio non riuscito: '+err.message,true);}finally{busy=false;$('save-all').disabled=$('save-bottom').disabled=false;}
  }
  function exportJSON(){let data;try{data=captureAll();}catch(e){msg(e.message,true);return;}
    const b=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(b),a=el('a');a.href=url;a.download='montanino-backup-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  $('login-form').addEventListener('submit',async e=>{
    e.preventDefault();const btn=e.currentTarget.querySelector('button');btn.disabled=true;
    try{const {data,error}=await sb.auth.signInWithPassword({email:$('login-email').value.trim(),password:$('login-password').value});if(error)throw error;await enter(data.user);}catch(err){msg('Accesso non riuscito: '+err.message,true);}finally{btn.disabled=false;$('login-password').value='';}
  });
  $('logout').addEventListener('click',async()=>{if(dirty&&!confirm('Hai modifiche non salvate. Vuoi uscire?'))return;await sb.auth.signOut();location.reload();});
  $('editor').addEventListener('input',markDirty);$('editor').addEventListener('change',markDirty);
  $('match-select').addEventListener('change',e=>{
    const previous=activeMatchId;
    try{captureMatch();showMatch(e.target.value);}catch(err){msg(err.message,true);$('match-select').value=previous;}
  });
  document.querySelectorAll('[data-panel]').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('[data-panel]').forEach(n=>n.classList.toggle('active',n===b));
    document.querySelectorAll('[data-editor-panel]').forEach(n=>n.hidden=n.dataset.editorPanel!==b.dataset.panel);
  }));
  $('add-starter').addEventListener('click',()=>{if(arr('starters-list').length>=11){msg('Massimo 11 titolari.',true);return;}lineupRow($('starters-list'));markDirty();});
  $('add-bench').addEventListener('click',()=>{lineupRow($('bench-list'),{},true);markDirty();});
  $('add-event').addEventListener('click',()=>{eventRow($('events-list'));markDirty();});
  $('add-player').addEventListener('click',()=>{playerRow();markDirty();});
  $('add-staff').addEventListener('click',()=>{staffRow();markDirty();});
  $('add-sponsor').addEventListener('click',()=>{sponsorRow();markDirty();});
  $('save-all').addEventListener('click',save);$('save-bottom').addEventListener('click',save);$('export-json').addEventListener('click',exportJSON);
  $('import-json').addEventListener('click',()=>$('import-file').click());
  $('import-file').addEventListener('change',async e=>{
    const f=e.target.files?.[0];if(!f)return;
    try{
      const obj=JSON.parse(await f.text());
      if(!obj || !Array.isArray(obj.calendario)||!Array.isArray(obj.classifica)||!obj.dettagliPartite||!Array.isArray(obj.giocatori))throw Error('Il file non contiene un backup Montanino valido.');
      if(!confirm('Sostituire la bozza corrente con questo backup? Le modifiche non salvate andranno perse.'))return;
      draft=C.copy(obj);activeMatchId='';render();markDirty();
      msg('Backup importato nella bozza. Premi Salva per confermarlo; non è ancora stato pubblicato.');
    }catch(err){msg('Importazione non riuscita: '+err.message,true);}
    finally{e.target.value='';}
  });
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  if(configured){try{await setupOnline();}catch(err){msg('Impossibile caricare Supabase: '+err.message+'. Controlla internet, URL e chiave.',true);$('mode-label').textContent='CONNESSIONE NON RIUSCITA';}}
  else{
    $('mode-label').textContent='DEMO · SOLO QUESTO BROWSER';
    try{const existing=localStorage.getItem('montanino-demo-v3');if(existing){const parsed=JSON.parse(existing);if(Array.isArray(parsed.calendario))draft=parsed;}}catch(e){}
    $('editor').hidden=false;$('demo-explanation').hidden=false;render();$('save-status').textContent='Modalità demo locale';$('save-note').textContent='Le modifiche non sono condivise con altri dispositivi.';
  }
})();
