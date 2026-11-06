/* A.S.D. MONTANINO — amministrazione V3.6
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
  const del=()=>{const b=el('button','delete-row','×');b.type='button';b.setAttribute('aria-label','Rimuovi riga');b.title='Rimuovi riga';b.onclick=()=>{if(confirm('Rimuovere questa riga?')){b.closest('.editor-row')?.remove();markDirty();updateCounts();renderPitchPreview();refreshMatchSubstitutionChoices();}};return b;};
  const read=(row,field)=>row.querySelector(`[data-field="${field}"]`)?.value?.trim()||'';
  const arr=selector=>[...$(selector).querySelectorAll('.editor-row')];
  const markDirty=()=>{dirty=true;$('save-status').textContent='Modifiche non salvate';$('save-note').textContent='Premi Salva per aggiornare i dati.';};
  function synced(){dirty=false;$('save-status').textContent='Dati salvati';$('save-note').textContent=online?'Pubblicati online: ricarica il sito per vederli.':'Salvati in questo browser: modalità prova, NON online.';}
  function makeRow(parent,klass='',number=''){
    const row=el('div','editor-row '+klass);if(number!=='')row.append(el('span','row-number',number));parent.append(row);return row;
  }
  // La rosa del pannello è la fonte dei menu: include anche modifiche non ancora pubblicate.
  const rosterNow=()=>{
    const rows=$('players-list')?[...$('players-list').querySelectorAll('.editor-row')]:[];
    return rows.map(r=>({nome:read(r,'nome'),numero:read(r,'numero')===''?null:Number(read(r,'numero')),ruolo:read(r,'ruolo')})).filter(p=>p.nome);
  };
  const findPlayer=name=>rosterNow().find(p=>C.normalize(p.nome)===C.normalize(name));
  function rosterSelect(value='',field='nome',label='Seleziona dalla rosa'){
    const menu=el('select','roster-choice');menu.dataset.field=field;menu.setAttribute('aria-label',label);
    const blank=el('option','','— Seleziona dalla rosa —');blank.value='';menu.append(blank);
    const players=rosterNow().sort((a,b)=>(a.numero??999)-(b.numero??999)||a.nome.localeCompare(b.nome,'it'));
    players.forEach(p=>{const opt=el('option','',`${p.numero??'–'} · ${p.nome}`);opt.value=p.nome;menu.append(opt);});
    if(value&&!players.some(p=>C.normalize(p.nome)===C.normalize(value))){const missing=el('option','',`⚠ Fuori rosa: ${value}`);missing.value=value;menu.append(missing);}
    const match=players.find(p=>C.normalize(p.nome)===C.normalize(value));menu.value=match?.nome||value||'';
    menu.addEventListener('change',()=>{
      const row=menu.closest('.lineup-row');
      if(row){const player=findPlayer(menu.value);if(player){row.querySelector('[data-field="numero"]').value=player.numero??'';
        const role=row.querySelector('[data-field="reparto"]');if(role)role.value=C.roleCode(player.ruolo);}
        updateCounts();renderPitchPreview();}
    });
    return menu;
  }
  function lineupRow(parent,p={},bench=false){
    const row=makeRow(parent,bench?'bench-row lineup-row':'lineup-row',bench?'↳':'•');
    const name=rosterSelect(p.nome||'','nome','Giocatore della rosa');row.append(name);
    const number=inp(p.numero??'','number','numero','N°');number.min=0;number.max=99;number.setAttribute('aria-label','Numero di maglia');row.append(number);
    if(bench){
      row.append(pick(p.reparto||'C',[['P','P · Portiere'],['D','D · Difensore'],['C','C · Centrocampo'],['A','A · Attaccante']],'reparto'));
    }else{
      const slots=C.formationSlots($('match-module').value).slots;
      const choices=[['','— Posizione —'],...slots.map(t=>[t.id,t.id+' · '+t.label])];
      const position=pick(p.posizione||'',choices,'posizione');position.setAttribute('aria-label','Posizione in campo');
      row.append(position);
    }
    const vote=inp(p.voto??'','number','voto','Voto');vote.min=0;vote.max=10;vote.step='.5';vote.setAttribute('aria-label','Voto in pagella');row.append(vote);
    if(bench){const entrance=inp(p.entrato??'','text','entrato','Min. ingresso');entrance.setAttribute('aria-label','Minuto ingresso');row.append(entrance);}
    const note=inp(p.nota||'','text','nota','Nota facoltativa');note.setAttribute('aria-label','Nota pagella');row.append(note,del());
    updateCounts();return row;
  }
  // I cambi del Montanino accettano soltanto titolari in campo e riserve non ancora entrate.
  const eventMinuteValue=value=>{
    const m=/^(\d+)(?:\+(\d+))?$/.exec(String(value||'').trim());
    return m?Number(m[1])*100+Number(m[2]||0):Number.POSITIVE_INFINITY;
  };
  function orderedOwnSubRows(){
    return arr('events-list').map((row,index)=>({row,index})).filter(x=>read(x.row,'tipo')==='sostituzione'&&read(x.row,'squadra')==='Montanino')
      .sort((a,b)=>eventMinuteValue(read(a.row,'minuto'))-eventMinuteValue(read(b.row,'minuto'))||a.index-b.index).map(x=>x.row);
  }
  function availableSubPlayers(row,field){
    const fromList=id=>arr(id).map(r=>({nome:read(r,'nome'),numero:read(r,'numero')})).filter(p=>p.nome);
    const starters=fromList('starters-list'),bench=fromList('bench-list');
    const onPitch=new Set(starters.map(p=>C.normalize(p.nome)));
    const benchNames=new Set(bench.map(p=>C.normalize(p.nome)));
    const entered=new Set();
    for(const previous of orderedOwnSubRows()){
      if(previous===row)break;
      const out=C.normalize(read(previous,'giocatore')),incoming=C.normalize(read(previous,'secondo'));
      if(out&&incoming&&onPitch.has(out)&&benchNames.has(incoming)&&!entered.has(incoming)){
        onPitch.delete(out);onPitch.add(incoming);entered.add(incoming);
      }
    }
    const pool=field==='giocatore'?[...starters,...bench].filter(p=>onPitch.has(C.normalize(p.nome))):
      bench.filter(p=>!entered.has(C.normalize(p.nome))&&!onPitch.has(C.normalize(p.nome)));
    const unique=new Set();
    return pool.filter(p=>{const key=C.normalize(p.nome);if(unique.has(key))return false;unique.add(key);return true;});
  }
  function substitutionSelect(value='',field='giocatore',label='Giocatore del cambio',row){
    const menu=el('select','roster-choice match-sub-choice');menu.dataset.field=field;menu.setAttribute('aria-label',label);
    const candidates=availableSubPlayers(row,field);
    const blank=el('option','',field==='giocatore'?'— Esce (in campo) —':'— Entra (dalla panchina) —');
    blank.value='';menu.append(blank);
    for(const p of candidates){
      const option=el('option','',(p.numero||'–')+' · '+p.nome);option.value=p.nome;menu.append(option);
    }
    if(value&&!candidates.some(p=>C.normalize(p.nome)===C.normalize(value))){
      // Mantieni i vecchi dati incompleti visibili, senza rimpiazzarli silenziosamente.
      const invalid=el('option','', '⚠ Da verificare: '+value);invalid.value=value;menu.append(invalid);
    }
    const found=candidates.find(p=>C.normalize(p.nome)===C.normalize(value));
    menu.value=found?.nome||value||'';
    menu.title=field==='giocatore'?'Solo chi è attualmente in campo':'Solo riserve non ancora entrate';
    return menu;
  }
  function refreshMatchSubstitutionChoices(){
    for(const row of orderedOwnSubRows()){
      for(const field of ['giocatore','secondo']){
        const old=row.querySelector('select[data-field="'+field+'"]');if(!old)continue;
        const next=substitutionSelect(old.value,field,old.getAttribute('aria-label')||'Giocatore del cambio',row);
        old.replaceWith(next);
      }
    }
  }
  function eventRow(parent,event={}){
    const row=makeRow(parent,'event-row');
    const minute=inp(event.minuto??'','text','minuto','45+2');minute.setAttribute('aria-label','Minuto episodio');row.append(minute);
    const eventType=event.tipo==='gol(rigore)'?'gol_rigore':event.tipo;
    const type=pick(eventType||'gol',[
      ['gol','⚽ Gol'],['gol_rigore','⚽ Gol (rigore)'],
      ['rigore_parato','🧤 Rigore parato'],['rigore_sbagliato','✕ Rigore sbagliato'],
      ['giallo','🟨 Ammonizione'],['rosso','🟥 Espulsione'],
      ['sostituzione','⇄ Cambio'],['autogol','Autogol'],['rigore','Rigore (precedente)']
    ],'tipo');row.append(type);
    const person=el('div','event-picker');const second=el('div','event-picker');row.append(person,second);
    const team=pick(event.squadra||'Montanino',[['Montanino','Montanino'],['Avversario','Avversario']],'squadra');row.append(team,del());
    function makeField(holder,field,value,label,own){
      const current=holder.querySelector('[data-field]');if(current)value=current.value;
      holder.replaceChildren();
      const control=own?(type.value==='sostituzione'?substitutionSelect(value,field,label,row):rosterSelect(value,field,label)):inp(value,'text',field,label);
      control.setAttribute('aria-label',label);holder.append(control);
    }
    const update=()=>{
      const own=team.value==='Montanino';
      const oldA=person.querySelector('[data-field]')?.value??(event.giocatore||event.esce||'');
      const oldB=second.querySelector('[data-field]')?.value??(event.assist||event.entra||'');
      const label=type.value==='sostituzione'?'Giocatore che esce':
        type.value==='rigore_parato'?'Portiere che para':
        type.value==='rigore_sbagliato'?'Giocatore che sbaglia':'Giocatore coinvolto';
      makeField(person,'giocatore',oldA,label,own);
      if(['gol','sostituzione'].includes(type.value)){
        second.hidden=false;makeField(second,'secondo',oldB,type.value==='gol'?'Assist (facoltativo)':'Giocatore che entra',own);
      }else{second.hidden=true;second.replaceChildren();}
    };
    team.addEventListener('change',update);
    type.addEventListener('change',update);
    update();return row;
  }
  function refreshRosterChoices(){
    document.querySelectorAll('.lineup-row select[data-field="nome"],.event-row select[data-field="giocatore"],.event-row select[data-field="secondo"]').forEach(old=>{
      const row=old.closest('.event-row');
      const restricted=row&&read(row,'tipo')==='sostituzione'&&read(row,'squadra')==='Montanino';
      const next=restricted?substitutionSelect(old.value,old.dataset.field,old.getAttribute('aria-label')||'Giocatore del cambio',row):
        rosterSelect(old.value,old.dataset.field,old.getAttribute('aria-label')||'Seleziona giocatore');
      old.replaceWith(next);
    });
  }
  function renderPitchPreview(){
    const root=$('admin-pitch');if(!root)return;
    const layout=C.formationSlots($('match-module').value),players=arr('starters-list').map(r=>rowDataLineup(r,false)).filter(Boolean);
    const assigned=C.assignFormation(layout.module,players,rosterNow(),true),bySlot=new Map(assigned.map(p=>[p.posizione,p]));
    root.replaceChildren();
    const badge=el('div','preview-module','MODULO '+layout.module);root.append(badge);
    for(const line of layout.rows){
      const group=el('div','preview-line');group.setAttribute('aria-label',line.label);
      for(const slot of line.slots){
        const person=bySlot.get(slot.id),card=el('div','preview-player'+(!person?' empty':''));
        card.append(el('span','preview-shirt',person?.numero??'·'),el('span','preview-player-name',person?.nome||slot.id));group.append(card);
      }
      root.append(group);
    }
  }
  function organizeFormation(){
    const current=arr('starters-list').map(r=>rowDataLineup(r,false)).filter(Boolean);
    const organized=C.assignFormation($('match-module').value,current,rosterNow(),false);
    const slots=C.formationSlots($('match-module').value).slots;
    const assignments=new Map(organized.map(p=>[p.posizione,p]));
    $('starters-list').replaceChildren();
    slots.forEach(slot=>lineupRow($('starters-list'),assignments.get(slot.id)||{posizione:slot.id}));
    updateCounts();renderPitchPreview();refreshMatchSubstitutionChoices();markDirty();
  }
  function rowDataLineup(row,bench){
    const name=read(row,'nome');if(!name)return null;
    const rawNumber=read(row,'numero'),rawVote=read(row,'voto');
    const pos=read(row,'posizione');
    const role=bench?read(row,'reparto'):pos.startsWith('P')?'P':pos.startsWith('D')?'D':pos.startsWith('A')?'A':'C';
    const p={nome:name,numero:rawNumber===''?null:Number(rawNumber),reparto:role,voto:rawVote===''?null:Number(rawVote),nota:read(row,'nota')};
    if(!bench&&pos)p.posizione=pos;
    if(bench){const entrato=read(row,'entrato');if(entrato)p.entrato=entrato;}
    return p;
  }
  function updateCounts(){
    const filled=arr('starters-list').filter(r=>read(r,'nome')).length;
    $('starter-count').textContent=filled+'/11';
  }

  // MVP indipendente da pagelle ed episodi. Le foto sono facoltative.
  function refreshMvpChoices(selected){
    const menu=$('match-mvp');if(!menu)return;
    const current=selected===undefined?menu.value:selected;
    menu.replaceChildren();
    const blank=el('option','', '— Da assegnare —');blank.value='';menu.append(blank);
    const roster=rosterNow().sort((a,b)=>(a.numero??999)-(b.numero??999)||a.nome.localeCompare(b.nome,'it'));
    roster.forEach(p=>{const o=el('option','',(p.numero??'–')+' · '+p.nome);o.value=p.nome;menu.append(o);});
    const selectedPlayer=roster.find(p=>C.normalize(p.nome)===C.normalize(current));
    if(current&&!selectedPlayer){const old=el('option','', '⚠ Da verificare: '+current);old.value=current;menu.append(old);}
    menu.value=selectedPlayer?.nome||current||'';
  }
  function isSafePhotoFile(file){
    return /^[\p{L}\p{N}][\p{L}\p{N} _().-]*\.(?:jpe?g|png|webp|avif)$/iu.test(file)&&!file.includes('..');
  }
  function matchPhotoRow(data={}){
    const row=makeRow($('match-gallery-list'),'match-gallery-row');
    const games=C.list(draft.calendario).map(m=>[m.id,m.id+' · '+m.casa+' - '+m.ospite]);
    const game=pick(data.partita||games[0]?.[0]||'',games,'partita');game.setAttribute('aria-label','Partita della fotografia');
    const file=inp(data.file||'','text','file','foto-01.webp');file.setAttribute('aria-label','Nome del file assets/img/partite');
    const caption=inp(data.didascalia||'','text','didascalia','Didascalia facoltativa');caption.setAttribute('aria-label','Didascalia');
    row.append(game,file,caption,del());return row;
  }
  function fillMatchGallery(){
    const root=$('match-gallery-list');root.replaceChildren();
    C.list(draft.fotoPartite).forEach(x=>matchPhotoRow(x));
    const bulk=$('gallery-bulk-match');bulk.replaceChildren();
    C.list(draft.calendario).forEach(m=>{const o=el('option','',m.id+' · '+m.casa+' - '+m.ospite);o.value=m.id;bulk.append(o);});
  }
  function showMatch(id){
    activeMatchId=id;const m=draft.calendario.find(x=>x.id===id);if(!m)return;
    $('match-select').value=id;
    [['match-date',m.data||''],['match-time',m.ora||''],['match-field',m.campo||''],['match-home',m.casa||''],['match-away',m.ospite||''],['match-goals-home',m.golCasa??''],['match-goals-away',m.golOspite??'']].forEach(([k,v])=>$(k).value=v);
    const d=(draft.dettagliPartite||{})[id]||{};
    $('match-module').value=C.isValidModule(d.modulo||'')?d.modulo:'4-3-3';
    $('match-notes').value=d.note||'';
    refreshMvpChoices(d.mvp||'');
    $('match-mvp-photo').value=d.mvpFoto||'';
    $('match-complete').checked=!!d.datiCompleti;$('events-complete').checked=!!d.eventiCompleti;
    $('starters-list').replaceChildren();
    const assigned=C.assignFormation($('match-module').value,C.list(d.titolari),rosterNow(),true);
    assigned.forEach(p=>lineupRow($('starters-list'),p));
    $('bench-list').replaceChildren();C.list(d.panchina).forEach(p=>lineupRow($('bench-list'),p,true));
    $('events-list').replaceChildren();C.list(d.eventi).forEach(e=>eventRow($('events-list'),e));
    updateCounts();renderPitchPreview();refreshMatchSubstitutionChoices();updateStatsPreview();
  }
  function captureMatch(){
    if(!activeMatchId)return;
    const m=draft.calendario.find(x=>x.id===activeMatchId);if(!m)return;
    const home=$('match-goals-home').value,away=$('match-goals-away').value;
    if((home==='')!==(away===''))throw Error('Inserisci entrambi i punteggi oppure lasciali entrambi vuoti.');
    for(const n of [home,away])if(n!==''&&(!Number.isInteger(Number(n))||Number(n)<0))throw Error('I gol devono essere numeri interi non negativi.');
    const titolari=arr('starters-list').map(r=>rowDataLineup(r,false)).filter(Boolean);
    const panchina=arr('bench-list').map(r=>rowDataLineup(r,true)).filter(Boolean);
    const events=arr('events-list').map(r=>{
      const tipo=read(r,'tipo'),p=read(r,'giocatore'),secondo=read(r,'secondo');
      const ev={minuto:read(r,'minuto'),tipo,squadra:read(r,'squadra')};
      if(tipo==='sostituzione'){ev.esce=p;ev.entra=secondo;}else{ev.giocatore=p;if(tipo==='gol'&&secondo)ev.assist=secondo;}
      return ev;
    }).filter(e=>e.tipo);
    const names=[...titolari,...panchina].map(p=>C.normalize(p.nome));
    if(new Set(names).size!==names.length)throw Error('Un giocatore compare due volte tra titolari e panchina.');
    if(titolari.length>11)throw Error('Non puoi inserire più di 11 titolari.');
    const slots=C.formationSlots($('match-module').value).slots;
    const slotIds=slots.map(s=>s.id),chosen=titolari.map(p=>p.posizione);
    if(chosen.some(id=>!slotIds.includes(id))||new Set(chosen).size!==chosen.length)throw Error('Ogni titolare deve avere una posizione diversa del modulo. Premi “Prepara / riordina 11 posizioni”.');
    const available=new Set(rosterNow().map(p=>C.normalize(p.nome)));
    const mvp=$('match-mvp').value.trim(),mvpFoto=$('match-mvp-photo').value.trim();
    if(mvp&&!available.has(C.normalize(mvp)))throw Error('Scegli l’MVP dall’elenco della rosa.');
    if(mvp&&(home===''||away===''))throw Error('Puoi assegnare l’MVP soltanto a una partita conclusa.');
    if(mvpFoto&&!mvp)throw Error('Seleziona prima il giocatore MVP.');
    if(mvpFoto&&!isSafePhotoFile(mvpFoto))throw Error('Nome file foto MVP non valido: usa per esempio mvp-01.webp.');
    for(const p of [...titolari,...panchina]){
      if(!available.has(C.normalize(p.nome)))throw Error('Il giocatore '+p.nome+' non è presente nella rosa. Selezionalo dal menu.');
      if(p.voto!==null&&(!Number.isFinite(p.voto)||p.voto<0||p.voto>10||p.voto*2%1!==0))throw Error('I voti devono essere da 0 a 10, con incrementi di 0,5.');
      if(p.numero!==null&&(!Number.isInteger(p.numero)||p.numero<0||p.numero>99))throw Error('Numero maglia non valido.');
    }
    const complete=$('match-complete').checked,eventsComplete=$('events-complete').checked;
    const hasResult=home!==''&&away!=='';
    if((complete||eventsComplete)&&!hasResult)throw Error('Per confermare una sezione serve un risultato finale.');
    if(complete){
      if(titolari.length!==11)throw Error('Per confermare la formazione servono 11 titolari.');
      if(titolari.some(p=>p.voto===null))throw Error('Per completare le pagelle assegna un voto a tutti gli 11 titolari.');
      const keeper=titolari.find(p=>p.posizione==='P1');
      if(!keeper||C.roleCode(findPlayer(keeper.nome)?.ruolo)!=='P')throw Error('Nella posizione P1 devi selezionare un portiere presente nella rosa.');
    }
    if(eventsComplete){
      // Controlla che ogni cambio sia possibile al momento dell'episodio.
      const playing=new Set(titolari.map(p=>C.normalize(p.nome)));
      const reserves=new Set(panchina.map(p=>C.normalize(p.nome)));
      const entered=new Set();
      const orderedChanges=events.map((event,index)=>({event,index})).filter(x=>x.event.tipo==='sostituzione'&&x.event.squadra==='Montanino')
        .sort((a,b)=>eventMinuteValue(a.event.minuto)-eventMinuteValue(b.event.minuto)||a.index-b.index);
      for(const {event:e} of orderedChanges){
        const out=C.normalize(e.esce),incoming=C.normalize(e.entra);
        if(!playing.has(out))throw Error('Cambio non valido: '+(e.esce||'giocatore in uscita')+' non risulta in campo. Controlla i titolari e i cambi precedenti.');
        if(!reserves.has(incoming)||entered.has(incoming)||playing.has(incoming))throw Error('Cambio non valido: '+(e.entra||'giocatore in entrata')+' deve essere una riserva non ancora entrata.');
        playing.delete(out);playing.add(incoming);entered.add(incoming);
      }
      for(const e of events){
        const first=e.tipo==='sostituzione'?e.esce:e.giocatore;
        if(!first||(e.tipo==='sostituzione'&&!e.entra))throw Error('Completa i giocatori di ogni episodio prima di confermare gli eventi.');
        if(e.squadra==='Montanino'){
          if(!available.has(C.normalize(first))||(e.tipo==='sostituzione'&&!available.has(C.normalize(e.entra)))||(e.assist&&!available.has(C.normalize(e.assist))))throw Error('Un episodio del Montanino contiene un nome non presente in rosa.');
        }
      }
      const goals=events.filter(e=>['gol','gol_rigore','gol(rigore)'].includes(e.tipo)&&e.squadra==='Montanino').length;
      const ownScore=m.casa==='Montanino'?Number(home):Number(away);
      if(goals>ownScore)throw Error('I gol registrati per il Montanino superano quelli del risultato finale.');
    }
    m.data=$('match-date').value||null;m.ora=$('match-time').value||null;m.campo=$('match-field').value.trim()||null;
    m.casa=$('match-home').value.trim();m.ospite=$('match-away').value.trim();
    if(!m.casa||!m.ospite)throw Error('Inserisci entrambe le squadre.');
    m.golCasa=hasResult?Number(home):null;m.golOspite=hasResult?Number(away):null;
    (draft.dettagliPartite ||= {})[activeMatchId]={...((draft.dettagliPartite||{})[activeMatchId]||{}),modulo:$('match-module').value,titolari,panchina,eventi:events,note:$('match-notes').value.trim(),datiCompleti:complete,eventiCompleti:eventsComplete,mvp,mvpFoto};
  }
  function updateStatsPreview(){
    const box=$('admin-stats-preview');if(!box)return;
    const temp=C.copy(draft);
    try{
      const prepared=C.prepare(temp),c=prepared._statsCoverage;
      const parts=[`${c.formations}/${c.played} formazioni e pagelle verificate`,`${c.events}/${c.played} cronologie episodi verificate`];
      box.textContent=parts.join(' · ');
    }catch(e){box.textContent='Statistiche in attesa di dati validi.';}
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
  // I gruppi personalizzati sono salvati come staffGruppi nel payload JSON già esistente.
  // Nessuna nuova tabella SQL e nessuna migrazione del database.
  const DEFAULT_STAFF_GROUPS=['Dirigenza','Staff tecnico','Comunicazione'];
  const cleanGroup=value=>String(value||'').trim().replace(/\s+/g,' ');
  const groupKey=value=>cleanGroup(value).toLocaleLowerCase('it');
  function staffGroups(){
    const options=new Map();
    for(const name of [...DEFAULT_STAFF_GROUPS,...C.list(draft.staffGruppi),...C.list(draft.staff).map(s=>s.gruppo)]){
      const value=cleanGroup(name);if(value&&!options.has(groupKey(value)))options.set(groupKey(value),value);
    }
    // Gruppi modificati e non ancora salvati sono anch'essi validi.
    document.querySelectorAll('#staff-editor-list select[data-field="gruppo"]').forEach(s=>{
      const value=cleanGroup(s.value);if(value&&!options.has(groupKey(value)))options.set(groupKey(value),value);
    });
    return [...options.values()];
  }
  function groupPicker(value='Staff tecnico'){
    const choices=staffGroups();const selected=cleanGroup(value)||'Staff tecnico';
    if(!choices.some(g=>groupKey(g)===groupKey(selected)))choices.push(selected);
    const menu=pick(selected,choices.map(g=>[g,g]),'gruppo');
    menu.setAttribute('aria-label','Gruppo della persona');
    return menu;
  }
  function refreshStaffGroupMenus(){
    const options=staffGroups();
    for(const current of document.querySelectorAll('#staff-editor-list select[data-field="gruppo"]')){
      const previous=current.value;
      current.replaceChildren();
      for(const name of options){const option=el('option','',name);option.value=name;current.append(option);}
      current.value=options.find(x=>groupKey(x)===groupKey(previous))||options[0]||'';
    }
  }
  function renderStaffGroupTags(){
    const root=$('staff-group-tags');if(!root)return;
    root.replaceChildren();
    for(const name of staffGroups()){
      const chip=el('span','staff-group-chip',name);
      const count=C.list(draft.staff).filter(s=>groupKey(s.gruppo)===groupKey(name)).length;
      chip.title=count?`${count} persone attualmente salvate in questo gruppo`:'Gruppo disponibile';
      root.append(chip);
    }
  }
  function fillStaff(){
    const node=$('staff-editor-list');node.replaceChildren();
    C.list(draft.staff).forEach(x=>staffRow(x));
    refreshStaffGroupMenus();renderStaffGroupTags();
  }
  function staffRow(s={}){
    const r=makeRow($('staff-editor-list'),'staff-entity');
    const group=groupPicker(s.gruppo||'Staff tecnico');
    const name=inp(s.nome||'','text','nome','Nome cognome');name.setAttribute('aria-label','Nome della persona');
    const role=inp(s.ruolo||'','text','ruolo','Incarico');role.setAttribute('aria-label','Incarico');
    const photo=inp(s.foto||'','text','foto','staff-01.webp (file già caricato)');photo.setAttribute('aria-label','Nome file della foto');
    r.append(group,name,role,photo,del());
    return r;
  }
  function fillSponsors(){const node=$('sponsors-editor-list');node.replaceChildren();C.list(draft.sponsor).forEach(x=>sponsorRow(x));
    ['instagram','facebook','tiktok'].forEach(k=>$('social-'+k).value=(draft.social||{})[k]||'');}
  function sponsorRow(s={}){const r=makeRow($('sponsors-editor-list'),'sponsor-entity');
    r.append(inp(s.nome||'','text','nome','Nome sponsor'),inp(s.categoria||'Partner ufficiale','text','categoria','Categoria'),inp(s.logo||'','text','logo','logo.png (assets/img)'),inp(s.sito||'','url','sito','https://...'),del());}
  function captureOther(){
    draft.giocatori=arr('players-list').map(r=>({nome:read(r,'nome'),numero:read(r,'numero')===''?null:Number(read(r,'numero')),ruolo:read(r,'ruolo')})).filter(p=>p.nome);
    if(new Set(draft.giocatori.map(p=>C.normalize(p.nome))).size!==draft.giocatori.length)throw Error('La rosa contiene due giocatori con lo stesso nome.');
    draft.classifica=arr('standings-list').map(r=>({squadra:read(r,'squadra'),giocate:Number(read(r,'giocate')||0),punti:Number(read(r,'punti')||0)})).filter(t=>t.squadra);
    draft.staff=arr('staff-editor-list').map(r=>({gruppo:read(r,'gruppo')||'Staff tecnico',nome:read(r,'nome'),ruolo:read(r,'ruolo'),...(read(r,'foto')?{foto:read(r,'foto')}:{})})).filter(s=>s.nome);
    // L'elenco dedicato mantiene anche i gruppi creati che non hanno ancora membri.
    draft.staffGruppi=staffGroups();
    draft.sponsor=arr('sponsors-editor-list').map(r=>({nome:read(r,'nome'),categoria:read(r,'categoria'),logo:read(r,'logo'),sito:read(r,'sito')})).filter(s=>s.nome);
    draft.social=Object.fromEntries(['instagram','facebook','tiktok'].map(k=>[k,$('social-'+k).value.trim()]));
    draft.fotoPartite=arr('match-gallery-list').map(r=>({partita:read(r,'partita'),file:read(r,'file'),didascalia:read(r,'didascalia')})).filter(x=>x.file);
    const validMatches=new Set(C.list(draft.calendario).map(m=>m.id));
    const photoKeys=new Set();
    for(const photo of draft.fotoPartite){
      if(!validMatches.has(photo.partita))throw Error('Fotografia della Galleria con partita non valida.');
      if(!isSafePhotoFile(photo.file))throw Error('Nome file foto non valido: '+photo.file+'. Inserisci solo il nome, senza cartelle.');
      const key=photo.partita+'|'+photo.file.toLocaleLowerCase('it');
      if(photoKeys.has(key))throw Error('Foto duplicata per '+photo.partita+': '+photo.file);
      photoKeys.add(key);
    }
    for(const item of draft.sponsor){if(item.sito && !/^https?:\/\//i.test(item.sito))throw Error('I link sponsor devono iniziare con https:// oppure essere vuoti.');}
    for(const [key,url] of Object.entries(draft.social))if(url&&!/^https:\/\//i.test(url))throw Error('Il link '+key+' deve iniziare con https://');
  }
  function captureAll(){captureMatch();captureOther();return C.copy(draft);}
  function render(){
    $('match-select').replaceChildren();C.list(draft.calendario).forEach(m=>{const o=el('option','',`${m.id} · ${m.fase} ${m.giornata} · ${m.casa} – ${m.ospite}`);o.value=m.id;$('match-select').append(o);});
    fillPlayers();fillStandings();fillStaff();fillSponsors();fillMatchGallery();
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
      synced();updateStatsPreview();msg(online?'Modifiche salvate su Supabase. Apri il sito pubblico e ricaricalo.':'Modifiche salvate soltanto in questo browser. Per pubblicarle online configura Supabase.');
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
  $('match-module').addEventListener('change',organizeFormation);
  $('prepare-formation').addEventListener('click',organizeFormation);
  $('starters-list').addEventListener('change',()=>{renderPitchPreview();refreshMatchSubstitutionChoices();});
  $('starters-list').addEventListener('input',renderPitchPreview);
  $('bench-list').addEventListener('change',refreshMatchSubstitutionChoices);
  $('events-list').addEventListener('change',refreshMatchSubstitutionChoices);
  $('events-list').addEventListener('input',e=>{if(e.target.matches('[data-field="minuto"]'))refreshMatchSubstitutionChoices();});
  $('add-starter').addEventListener('click',()=>{
    if(arr('starters-list').length>=11){msg('Ci sono già 11 posizioni. Per cambiare il modulo usa “Prepara / riordina”.',true);return;}
    const occupied=new Set(arr('starters-list').map(r=>read(r,'posizione')));
    const slot=C.formationSlots($('match-module').value).slots.find(t=>!occupied.has(t.id));
    lineupRow($('starters-list'),{posizione:slot?.id||''});markDirty();renderPitchPreview();refreshMatchSubstitutionChoices();
  });
  $('add-bench').addEventListener('click',()=>{lineupRow($('bench-list'),{},true);markDirty();refreshMatchSubstitutionChoices();});
  $('add-event').addEventListener('click',()=>{eventRow($('events-list'));markDirty();});
  $('add-player').addEventListener('click',()=>{playerRow();markDirty();refreshRosterChoices();refreshMvpChoices();});
  $('players-list').addEventListener('input',()=>{refreshRosterChoices();refreshMvpChoices();});
  $('players-list').addEventListener('change',()=>{refreshRosterChoices();refreshMvpChoices();});
  $('players-list').addEventListener('click',e=>{if(e.target.closest('.delete-row'))setTimeout(()=>{refreshRosterChoices();refreshMvpChoices();},0);});
  $('add-staff').addEventListener('click',()=>{staffRow();markDirty();});
  $('add-staff-group-form').addEventListener('submit',e=>{
    e.preventDefault();
    const input=$('new-staff-group');const name=cleanGroup(input.value);
    if(!name){msg('Scrivi il nome del nuovo gruppo.',true);input.focus();return;}
    if(name.length>48){msg('Il nome del gruppo non può superare 48 caratteri.',true);return;}
    if(staffGroups().some(g=>groupKey(g)===groupKey(name))){
      msg('Il gruppo «'+name+'» è già presente.',true);input.focus();return;
    }
    draft.staffGruppi=[...C.list(draft.staffGruppi),name];
    refreshStaffGroupMenus();renderStaffGroupTags();
    input.value='';markDirty();msg('Gruppo «'+name+'» aggiunto ai menu. Premi Salva modifiche per pubblicarlo.');
  });
  $('staff-editor-list').addEventListener('change',e=>{
    if(e.target?.matches('select[data-field="gruppo"]'))renderStaffGroupTags();
  });
  $('add-sponsor').addEventListener('click',()=>{sponsorRow();markDirty();});
  $('add-match-photo').addEventListener('click',()=>{matchPhotoRow();markDirty();});
  $('add-match-photos-bulk').addEventListener('click',()=>{
    const partita=$('gallery-bulk-match').value;
    const files=$('gallery-bulk-files').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    if(!partita||!files.length){msg('Seleziona una partita e scrivi almeno un nome file.',true);return;}
    if(files.some(f=>!isSafePhotoFile(f))){msg('Uno dei nomi non è valido: usa solo nomi di immagini, senza cartelle.',true);return;}
    const known=new Set(arr('match-gallery-list').map(row=>read(row,'partita')+'|'+read(row,'file').toLocaleLowerCase('it')));
    let added=0;
    for(const file of files){
      const key=partita+'|'+file.toLocaleLowerCase('it');
      if(!known.has(key)){matchPhotoRow({partita,file});known.add(key);added++;}
    }
    $('gallery-bulk-files').value='';if(added)markDirty();
    msg(added+' foto aggiunte all’elenco. Per pubblicarle, premi Salva modifiche.');
  });
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
