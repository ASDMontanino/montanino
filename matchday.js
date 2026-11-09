/* A.S.D. Montanino - Matchday Control Room.
   Data remains a local draft until explicitly published by an authorized admin. */
(async function(){
'use strict';
const $=id=>document.getElementById(id);
const conf=window.MONTANINO_SUPABASE||{},bucket='montanino-matchday-draft-v1';
const copy=x=>JSON.parse(JSON.stringify(x));
const list=x=>Array.isArray(x)?x:[];
const norm=x=>String(x||'').trim().toLocaleLowerCase('it');
const types={gol:'⚽ GOL',gol_rigore:'⚽ GOL SU RIGORE',giallo:'🟨 AMMONIZIONE',rosso:'🟥 ESPULSIONE',sostituzione:'⇄ SOSTITUZIONE',rigore_parato:'🧤 RIGORE PARATO',rigore_sbagliato:'✕ RIGORE SBAGLIATO',autogol:'⚽ AUTOGOL'};
const goalTypes=['gol','gol_rigore','autogol'];
let sb=null,user=null,remote=null,gameId='',working=null,sourceSignature='',dirty=false,editing=-1,type='gol',history=[],busy=false,conflict=false;
function notice(message,error=false){const el=$('md-notice');el.hidden=false;el.textContent=message;el.classList.toggle('error',error);}
function gameFrom(data,id){return list(data?.calendario).find(x=>x.id===id);}
function detailFrom(data,id){return data?.dettagliPartite?.[id]||{};}
function signature(data,id){const m=gameFrom(data,id),d=detailFrom(data,id);return JSON.stringify({m:m?{casa:m.casa,ospite:m.ospite,goalHome:m.golCasa,goalAway:m.golOspite,data:m.data,ora:m.ora,luogo:m.campo}:null,d});}
function storageKey(id){return bucket+':'+user.id+':'+id;}
function saveDraft(){if(!working||!user)return;try{localStorage.setItem(storageKey(gameId),JSON.stringify({sourceSignature,working,savedAt:Date.now()}));}catch(e){notice('Memoria del dispositivo non disponibile: non chiudere la pagina finché non pubblichi.',true);}}
function removeDraft(){try{localStorage.removeItem(storageKey(gameId));}catch(e){}}
function setDirty(){dirty=true;saveDraft();$('md-draft').textContent='BOZZA DA PUBBLICARE';$('md-draft').classList.add('dirty');$('md-save-label').textContent='Modifiche salvate sul dispositivo';}
function remember(){history.push(copy(working));if(history.length>25)history.shift();$('md-undo').disabled=false;}
function roster(){const saved=list(remote?.giocatori);const seen=new Set();return [...saved,...list(detailFrom(remote,gameId).titolari),...list(detailFrom(remote,gameId).panchina)].filter(p=>{const key=norm(p.nome);if(!key||seen.has(key))return false;seen.add(key);return true;}).sort((a,b)=>(Number(a.numero)||999)-(Number(b.numero)||999)||String(a.nome).localeCompare(String(b.nome),'it'));}
function resultDefined(){return Number.isInteger(working?.scoreHome)&&Number.isInteger(working?.scoreAway);}
function scoreSide(own){const m=gameFrom(remote,gameId);const montHome=norm(m?.casa)==='montanino';return own?(montHome?'home':'away'):(montHome?'away':'home');}
function sideOfEvent(event){return norm(event.squadra)==='montanino'?'own':'opp';}
function contribution(event){if(!goalTypes.includes(event.tipo))return null;const own=sideOfEvent(event)==='own';return scoreSide(event.tipo==='autogol'?!own:own);}
function changeScore(side,delta){
  if(!resultDefined()){working.scoreHome=0;working.scoreAway=0;}
  const prop=side==='home'?'scoreHome':'scoreAway';
  working[prop]=Math.max(0,working[prop]+delta);
}
function showScore(){const m=gameFrom(remote,gameId);$('md-team-home').textContent=m?.casa||'—';$('md-team-away').textContent=m?.ospite||'—';$('md-goals-home').textContent=working.scoreHome??'–';$('md-goals-away').textContent=working.scoreAway??'–';$('md-game-detail').textContent=[m?.fase,m?.giornata?m.giornata+'ª GIORNATA':'',m?.data,m?.ora,m?.campo].filter(Boolean).join(' · ');}
function setSelect(el,players,placeholder,selected='',exclude=''){
  el.replaceChildren();
  const blank=document.createElement('option');blank.value='';blank.textContent=placeholder;el.append(blank);
  for(const p of players){
    if(exclude&&norm(p.nome)===norm(exclude))continue;
    const opt=document.createElement('option');opt.value=p.nome;opt.textContent=(p.numero??'–')+' · '+p.nome;el.append(opt);
  }
  if(selected&&!players.some(p=>norm(p.nome)===norm(selected))){const opt=document.createElement('option');opt.value=selected;opt.textContent=selected+' (da verificare)';el.append(opt);}
  el.value=selected||'';
}
function substitutionPools(){
  const d=detailFrom(remote,gameId),starters=list(d.titolari),bench=list(d.panchina);
  if(!starters.length||!bench.length)return {out:roster(),incoming:roster(),hint:'Compila prima formazione e panchina dal pannello admin per verificare automaticamente i cambi.'};
  const onField=new Set(starters.map(x=>norm(x.nome))),benchSet=new Set(bench.map(x=>norm(x.nome)));
  const entered=new Set();
  working.events.forEach((e,i)=>{
    if(i===editing||e.tipo!=='sostituzione'||sideOfEvent(e)!=='own')return;
    const out=norm(e.esce),incoming=norm(e.entra);
    if(onField.has(out)&&benchSet.has(incoming)){onField.delete(out);onField.add(incoming);entered.add(incoming);}
  });
  return {out:roster().filter(p=>onField.has(norm(p.nome))),incoming:roster().filter(p=>benchSet.has(norm(p.nome))&&!entered.has(norm(p.nome))),hint:'Scegli chi esce dal campo e chi entra dalla panchina.'};
}
function selectType(next){if(!types[next])return;type=next;document.querySelectorAll('[data-type]').forEach(b=>{b.classList.toggle('active',b.dataset.type===next);b.setAttribute('aria-pressed',String(b.dataset.type===next));});updateForm();}
function updateForm(values={}){
  const own=$('md-team').value==='own';
  const primary=$('md-person'),primaryFree=$('md-person-text'),secondary=$('md-second'),secondaryFree=$('md-second-text');
  const isSub=type==='sostituzione',isGoal=type==='gol',needSecond=isSub||isGoal;
  const primaryValue=values.primary??(own?primary.value:primaryFree.value);
  const secondValue=values.second??(own?secondary.value:secondaryFree.value);
  const pools=isSub&&own?substitutionPools():{out:roster(),incoming:roster(),hint:''};
  $('md-person-label').firstChild.textContent=isSub?'ESCE ':type==='rigore_parato'?'PORTIERE ':type==='rigore_sbagliato'?'TIRATORE ':'GIOCATORE ';
  $('md-second-label').firstChild.textContent=isSub?'ENTRA ':'ASSIST (FACOLTATIVO) ';
  $('md-second-label').hidden=!needSecond;
  primary.hidden=!own;primaryFree.hidden=own;secondary.hidden=!own;secondaryFree.hidden=own||!needSecond;
  if(own){
    setSelect(primary,pools.out,'— Seleziona giocatore —',primaryValue);
    setSelect(secondary,isSub?pools.incoming:roster(),isSub?'— Giocatore in entrata —':'— Nessun assist —',secondValue);
  }else{primaryFree.value=primaryValue;secondaryFree.value=secondValue;}
  $('md-field-hint').textContent=isSub&&own?pools.hint:isSub?'Inserisci i nomi dei giocatori che escono ed entrano.':isGoal?'L’assist è facoltativo. La rete aggiorna automaticamente il punteggio.':'Seleziona il giocatore e premi Registra episodio.';
}
function resetForm(){
  editing=-1;$('md-minute').value='';$('md-team').value='own';
  $('md-person').value='';$('md-second').value='';$('md-person-text').value='';$('md-second-text').value='';
  $('md-record').textContent='+ REGISTRA EPISODIO';$('md-cancel').hidden=true;
  selectType('gol');
}
function eventLabel(event){
  const minute=event.minuto?event.minuto+'′':'—';
  const player=event.tipo==='sostituzione'?((event.esce||'—')+' → '+(event.entra||'—')):(event.giocatore||'—');
  const extra=event.tipo==='gol'&&event.assist?' · ASSIST '+event.assist:'';
  return {minute,title:(types[event.tipo]||event.tipo)+' · '+player,extra:(sideOfEvent(event)==='own'?'MONTANINO':'AVVERSARI')+extra};
}
function showEvents(){
  const listEl=$('md-events-list');listEl.replaceChildren();
  $('md-event-empty').hidden=working.events.length>0;
  working.events.forEach((event,i)=>{
    const text=eventLabel(event),li=document.createElement('li');li.className='md-event';
    const minute=document.createElement('span');minute.className='md-event-minute';minute.textContent=text.minute;
    const description=document.createElement('div');description.className='md-event-description';
    const strong=document.createElement('strong');strong.textContent=text.title;
    const detail=document.createElement('small');detail.textContent=text.extra;
    description.append(strong,detail);
    const actions=document.createElement('div');actions.className='md-event-actions';
    const edit=document.createElement('button');edit.type='button';edit.textContent='MODIFICA';edit.addEventListener('click',()=>editEvent(i));
    const del=document.createElement('button');del.type='button';del.textContent='ELIMINA';del.className='delete';del.addEventListener('click',()=>deleteEvent(i));
    actions.append(edit,del);li.append(minute,description,actions);listEl.append(li);
  });
}
function showAll(){if(!working)return;showScore();showEvents();$('md-mvp').value=working.mvp||'';$('md-verified').checked=!!working.eventsComplete;$('md-undo').disabled=history.length===0;}
function currentEvent(){
  const minute=$('md-minute').value.trim();
  if(minute&&!/^(?:0|[1-9]\d?|1[01]\d|12\d|130)(?:\+(?:[1-9]\d?))?$/.test(minute))throw Error('Minuto non valido. Usa 23, 45+2 oppure lascia vuoto.');
  const own=$('md-team').value==='own';
  const first=(own?$('md-person').value:$('md-person-text').value).trim();
  const second=(own?$('md-second').value:$('md-second-text').value).trim();
  if(!first)throw Error('Seleziona o inserisci il giocatore coinvolto.');
  const team=own?'Montanino':'Avversario';
  const event={minuto:minute,tipo:type,squadra:team};
  if(type==='sostituzione'){
    if(!second||norm(first)===norm(second))throw Error('Indica due giocatori diversi per il cambio.');
    event.esce=first;event.entra=second;
  }else{
    event.giocatore=first;
    if(type==='gol'&&second){
      if(norm(first)===norm(second))throw Error('L’autore del gol non può essere anche l’assistman.');
      event.assist=second;
    }
  }
  return event;
}
function addEvent(){
  try{
    const event=currentEvent();remember();
    const old=editing>=0?working.events[editing]:null;
    if(old){const oldSide=contribution(old);if(oldSide)changeScore(oldSide,-1);working.events[editing]=event;}
    else working.events.push(event);
    const addedSide=contribution(event);if(addedSide)changeScore(addedSide,1);
    setDirty();showAll();resetForm();notice(old?'Episodio aggiornato nella bozza.':'Episodio registrato nella bozza locale.');
  }catch(e){notice(e.message,true);}
}
function editEvent(i){
  const e=working.events[i];if(!e)return;
  editing=i;selectType(e.tipo==='gol(rigore)'?'gol_rigore':e.tipo);
  $('md-team').value=sideOfEvent(e);$('md-minute').value=e.minuto||'';
  updateForm({primary:e.giocatore||e.esce||'',second:e.assist||e.entra||''});
  $('md-record').textContent='SALVA MODIFICA';$('md-cancel').hidden=false;
  $('md-record').scrollIntoView({behavior:'smooth',block:'center'});
}
function deleteEvent(i){if(!confirm('Eliminare questo episodio dalla bozza?'))return;remember();const [old]=working.events.splice(i,1);const oldSide=contribution(old);if(oldSide)changeScore(oldSide,-1);setDirty();showAll();resetForm();notice('Episodio rimosso. Puoi annullare l’ultima azione.');}
function makeWorking(m,d){return {scoreHome:Number.isInteger(m.golCasa)?m.golCasa:null,scoreAway:Number.isInteger(m.golOspite)?m.golOspite:null,events:copy(list(d.eventi)),mvp:d.mvp||'',eventsComplete:!!d.eventiCompleti};}
function loadMatch(id,ignoreDraft=false){
  if(!gameFrom(remote,id))return;
  gameId=id;history=[];editing=-1;conflict=false;$('md-conflict').hidden=true;
  sourceSignature=signature(remote,id);working=makeWorking(gameFrom(remote,id),detailFrom(remote,id));dirty=false;
  if(!ignoreDraft){
    let local=null;try{local=JSON.parse(localStorage.getItem(storageKey(id))||'null');}catch(e){}
    if(local&&local.working){
      if(local.sourceSignature===sourceSignature){working=local.working;dirty=true;}
      else{conflict=true;$('md-conflict').hidden=false;notice('Una bozza precedente non coincide più con i dati online. Ricarica i dati prima di modificare.',true);}
    }
  }else removeDraft();
  $('md-game').value=id;
  $('md-draft').textContent=dirty?'BOZZA RIPRISTINATA':'DATI ONLINE';$('md-draft').classList.toggle('dirty',dirty);
  $('md-save-label').textContent=dirty?'Bozza locale recuperata':'Pronto a registrare';
  const mv=$('md-mvp');setSelect(mv,roster(),'— MVP non assegnato —',working.mvp);
  showAll();resetForm();$('md-publish').disabled=conflict;
}
async function refreshDatabase(){
  const {data,error}=await sb.from('club_content').select('payload,revision').eq('id','site').maybeSingle();
  if(error)throw error;
  if(!data||!data.payload||!Array.isArray(data.payload.calendario))throw Error('Dati del sito non disponibili: apri prima il pannello amministratore.');
  return data;
}
function validate(){
  if(!working||conflict)throw Error('Risolvere prima il conflitto della bozza.');
  if((working.scoreHome===null)!==(working.scoreAway===null))throw Error('Completa entrambi i punteggi o lasciali entrambi non assegnati.');
  if(working.eventsComplete&&!resultDefined())throw Error('Per confermare tutti gli episodi occorre impostare il risultato finale.');
  if(working.mvp&&!resultDefined())throw Error('L’MVP si assegna soltanto dopo aver inserito il risultato finale.');
  const members=new Set(roster().map(p=>norm(p.nome)));
  if(working.mvp&&!members.has(norm(working.mvp)))throw Error('MVP non presente nella rosa.');
  for(const e of working.events){
    if(!types[e.tipo]&&e.tipo!=='rigore')continue;
    if(sideOfEvent(e)==='own'){
      const names=e.tipo==='sostituzione'?[e.esce,e.entra]:[e.giocatore,e.assist].filter(Boolean);
      if(names.some(name=>!members.has(norm(name))))throw Error('Un episodio del Montanino contiene giocatori non presenti nella rosa.');
    }
  }
  if(working.eventsComplete){
    const ownGoals=working.events.filter(e=>sideOfEvent(e)==='own'&&(e.tipo==='gol'||e.tipo==='gol_rigore'||e.tipo==='gol(rigore)')).length;
    const ownScore=scoreSide(true)==='home'?working.scoreHome:working.scoreAway;
    if(ownGoals>ownScore)throw Error('I gol registrati del Montanino superano il punteggio. Verifica gli episodi.');
  }
}
async function publish(){
  if(busy||!working)return;
  if(!dirty){notice('Nessuna modifica da pubblicare.');return;}
  try{
    validate();busy=true;$('md-publish').disabled=true;$('md-publish').textContent='PUBBLICAZIONE…';
    // Merge only this match against the freshest live payload. Never overwrite other admin changes.
    let result=null;
    for(let attempt=0;attempt<3;attempt++){
      const current=await refreshDatabase();
      if(signature(current.payload,gameId)!==sourceSignature){
        conflict=true;$('md-conflict').hidden=false;
        throw Error('La partita è cambiata online da un altro dispositivo. La bozza locale è salva, ma non verrà sovrascritta automaticamente.');
      }
      const payload=copy(current.payload),game=gameFrom(payload,gameId);
      game.golCasa=working.scoreHome;game.golOspite=working.scoreAway;
      if(!payload.dettagliPartite)payload.dettagliPartite={};
      payload.dettagliPartite[gameId]={...detailFrom(payload,gameId),eventi:copy(working.events),eventiCompleti:working.eventsComplete,mvp:working.mvp};
      delete payload._statsCoverage;
      const response=await sb.from('club_content').update({payload,revision:current.revision+1}).eq('id','site').eq('revision',current.revision).select('revision');
      if(response.error)throw response.error;
      if(response.data?.length){result=payload;break;}
    }
    if(!result)throw Error('Troppi aggiornamenti contemporanei; riprova senza chiudere la pagina.');
    remote=result;sourceSignature=signature(remote,gameId);dirty=false;history=[];removeDraft();
    $('md-draft').textContent='PUBBLICATO';$('md-draft').classList.remove('dirty');$('md-save-label').textContent='Dati pubblicati online';
    showAll();notice('Partita pubblicata su Supabase. Sito e app mostreranno gli episodi al prossimo caricamento.');
  }catch(e){notice(e.message||'Pubblicazione non riuscita.',true);}
  finally{busy=false;$('md-publish').disabled=conflict;$('md-publish').textContent='PUBBLICA SU SITO E APP →';}
}
function bind(){
  $('md-game').addEventListener('change',e=>loadMatch(e.target.value));
  document.querySelectorAll('[data-side-score]').forEach(btn=>btn.addEventListener('click',()=>{
    if(conflict)return;remember();changeScore(btn.dataset.sideScore,Number(btn.dataset.step));setDirty();showScore();
  }));
  document.querySelectorAll('[data-type]').forEach(btn=>btn.addEventListener('click',()=>selectType(btn.dataset.type)));
  $('md-team').addEventListener('change',()=>{ $('md-person').value='';$('md-second').value='';$('md-person-text').value='';$('md-second-text').value='';updateForm({primary:'',second:''}); });
  $('md-record').addEventListener('click',()=>{if(!conflict)addEvent();});
  $('md-cancel').addEventListener('click',resetForm);
  $('md-undo').addEventListener('click',()=>{if(!history.length||conflict)return;working=history.pop();setDirty();showAll();resetForm();notice('Ultima azione annullata.');});
  $('md-mvp').addEventListener('change',e=>{if(conflict)return;remember();working.mvp=e.target.value;setDirty();});
  $('md-verified').addEventListener('change',e=>{if(conflict)return;remember();working.eventsComplete=e.target.checked;setDirty();});
  $('md-publish').addEventListener('click',publish);
  $('md-discard').addEventListener('click',()=>{if(!confirm('Scartare la vecchia bozza locale per questa partita?'))return;loadMatch(gameId,true);notice('Bozza scartata. Sono caricati i dati online.');});
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
}
async function enter(){
  const session=await sb.auth.getSession(),userInfo=session.data?.session?.user;
  if(!userInfo){$('md-login-wrap').hidden=false;notice('Accedi per utilizzare la Control Room.');return;}
  const {data:role,error}=await sb.from('club_admins').select('user_id').eq('user_id',userInfo.id).maybeSingle();
  if(error||!role){$('md-login-wrap').hidden=false;notice('Questo account non è autorizzato come amministratore del club.',true);return;}
  user=userInfo;
  const record=await refreshDatabase();remote=record.payload;
  const selector=$('md-game');selector.replaceChildren();
  const ordered=[...remote.calendario].sort((a,b)=>(b.data||'').localeCompare(a.data||'')||(String(a.id)).localeCompare(String(b.id)));
  for(const m of ordered){
    const opt=document.createElement('option');opt.value=m.id;
    opt.textContent=[m.id,m.casa+' – '+m.ospite,m.data||'DATA DA CONFERMARE'].join(' · ');selector.append(opt);
  }
  if(!ordered.length)throw Error('Nessuna partita disponibile nel calendario.');
  $('md-login-wrap').hidden=true;$('md-app').hidden=false;
  bind();const query=new URLSearchParams(location.search).get('partita');
  loadMatch(ordered.some(m=>m.id===query)?query:ordered.find(m=>m.data&&!Number.isInteger(m.golCasa))?.id||ordered[0].id);
  notice('Control Room pronta. Le modifiche restano in bozza finché non premi Pubblica.');
}
try{
  if(!conf.url||!conf.anonKey)throw Error('Supabase non configurato.');
  await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';s.onload=resolve;s.onerror=()=>reject(Error('Connessione al sistema di accesso non disponibile.'));document.head.append(s);});
  sb=window.supabase.createClient(conf.url,conf.anonKey);
  $('md-login').addEventListener('submit',async e=>{
    e.preventDefault();const submit=e.currentTarget.querySelector('button');submit.disabled=true;
    try{const {error}=await sb.auth.signInWithPassword({email:$('md-email').value.trim(),password:$('md-password').value});
      if(error)throw error;await enter();}catch(ex){notice('Accesso non riuscito: '+ex.message,true);}
    finally{submit.disabled=false;$('md-password').value='';}
  });
  await enter();
}catch(e){notice('Matchday non disponibile: '+e.message,true);}
})();