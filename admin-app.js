/* Montanino Admin — dashboard separata, login e dati autorizzati via Supabase. */
(async function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const conf=window.MONTANINO_SUPABASE||{};
  const list=x=>Array.isArray(x)?x:[];
  let client=null,deferredInstall=null,currentUser=null;
  function status(message,error=false){const el=$('aa-status');el.textContent=message;el.classList.toggle('error',error);el.hidden=false;}
  function authState(authorized){
    $('aa-login-wrap').hidden=authorized;
    $('aa-dashboard').hidden=!authorized;
    $('aa-tabs').hidden=!authorized;
    $('aa-logout').hidden=!authorized;
    $('aa-connection').classList.toggle('online',authorized);
    $('aa-connection').lastChild.textContent=authorized?' ONLINE':' ACCESSO';
  }
  function localDay(m){
    if(!m?.data)return Number.MAX_SAFE_INTEGER;
    const stamp=new Date(m.data+'T'+(m.ora||'15:00')+':00');
    return Number.isFinite(stamp.valueOf())?stamp.valueOf():Number.MAX_SAFE_INTEGER;
  }
  function formatDateTime(date){
    return new Intl.DateTimeFormat('it-IT',{weekday:'short',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(date);
  }
  function updateFixtureTiming(match){
    const countdown=$('aa-countdown-status'),reminder=$('aa-reminder-status');
    if(!match){countdown.textContent='Countdown: nessuna partita da programmare.';reminder.textContent='Promemoria: non previsto.';return;}
    if(!match.data||!match.ora){
      const missing=[!match.data?'data':'',!match.ora?'orario':''].filter(Boolean).join(' e ');
      countdown.textContent='Countdown: non attivo, manca '+missing+'.';
      reminder.textContent='Promemoria: non programmabile finché manca '+missing+'.';
      return;
    }
    const kickoff=new Date(match.data+'T'+match.ora+':00');
    if(!Number.isFinite(kickoff.valueOf())){
      countdown.textContent='Countdown: non attivo, data o orario non valido.';
      reminder.textContent='Promemoria: non programmabile, controlla data e orario.';
      return;
    }
    const now=new Date(),reminderAt=new Date(kickoff.valueOf()-2*60*60*1000);
    countdown.textContent=kickoff>now?'Countdown: attivo fino a '+formatDateTime(kickoff)+'.':'Countdown: orario della partita già passato.';
    reminder.textContent=kickoff<=now?'Promemoria: partita già iniziata o conclusa.':
      reminderAt>now?'Promemoria previsto '+formatDateTime(reminderAt)+' (2 ore prima).':
      'Promemoria: fascia delle 2 ore già trascorsa; invio non verificato.';
  }
  function renderScheduleWarnings(calendar,played){
    const section=$('aa-schedule-warning');
    const incomplete=calendar.filter(match=>!played(match)&&(!match.data||!match.ora))
      .sort((a,b)=>(Number(a.giornata)||999)-(Number(b.giornata)||999));
    section.hidden=false;
    $('aa-schedule-warning-count').textContent=String(incomplete.length);
    $('aa-schedule-warning-copy').textContent=incomplete.length
      ?'Senza data e orario il countdown non parte e il promemoria non può essere programmato.'
      :'Tutte le partite ancora da giocare hanno data e orario.';
    section.classList.toggle('is-complete',incomplete.length===0);
    const listEl=$('aa-incomplete-list');
    listEl.replaceChildren();
    for(const match of incomplete.slice(0,5)){
      const item=document.createElement('li');
      const title=document.createElement('strong');
      title.textContent=(match.giornata?'Giornata '+match.giornata+' · ':'')+(match.casa||'Casa')+' – '+(match.ospite||'Ospiti');
      const missing=document.createElement('small');
      missing.textContent='Manca '+[!match.data?'la data':'',!match.ora?'l’orario':''].filter(Boolean).join(' e ');
      item.append(title,missing);
      listEl.append(item);
    }
    if(incomplete.length>5){
      const more=document.createElement('li');
      more.className='aa-warning-more';
      more.textContent='E altre '+(incomplete.length-5)+' partite da programmare.';
      listEl.append(more);
    }
  }
  function updateDashboard(content){
    const calendar=list(content.calendario);
    const now=Date.now();
    const played=m=>Number.isInteger(m.golCasa)&&Number.isInteger(m.golOspite);
    const pending=calendar.filter(m=>!played(m));
    renderScheduleWarnings(calendar,played);
    const sortedPending=[...pending].sort((a,b)=>localDay(a)-localDay(b));
    const next=sortedPending.find(m=>localDay(m)>=now)||sortedPending[0];
    const last=[...calendar].filter(m=>played(m)).sort((a,b)=>localDay(b)-localDay(a))[0];
    $('aa-stat-players').textContent=list(content.giocatori).length;
    $('aa-stat-matches').textContent=calendar.filter(played).length;
    $('aa-stat-photos').textContent=list(content.fotoPartite).length;
    updateFixtureTiming(next);
    if(next){
      $('aa-next-home').textContent=next.casa||'DA DEFINIRE';
      $('aa-next-away').textContent=next.ospite||'DA DEFINIRE';
      const date=next.data?new Intl.DateTimeFormat('it-IT',{weekday:'short',day:'2-digit',month:'short',year:'numeric'}).format(new Date(next.data+'T12:00:00')):'DATA DA DEFINIRE';
      $('aa-next-details').textContent=[date,next.ora,next.campo].filter(Boolean).join(' · ').toUpperCase();
      $('aa-next-status').textContent=next.data?'DA GIOCARE':'DA PROGRAMMARE';
      $('aa-next-live').href='matchday.html?app=1&partita='+encodeURIComponent(next.id);
    }else{
      updateFixtureTiming(null);
      $('aa-next-home').textContent='STAGIONE';
      $('aa-next-away').textContent='IN CORSO';
      $('aa-next-details').textContent=calendar.length?'TUTTE LE PARTITE RISULTANO DISPUTATE.':'INSERISCI IL CALENDARIO DAL PANNELLO.';
      $('aa-next-status').textContent='CALENDARIO';
    }
    if(last){
      const date=last.data?new Intl.DateTimeFormat('it-IT',{day:'2-digit',month:'short'}).format(new Date(last.data+'T12:00:00')):'';
      $('aa-last-game').replaceChildren();
      const names=document.createElement('span');names.textContent=(last.casa||'CASA')+'  ';
      const score=document.createElement('strong');score.textContent=last.golCasa+' : '+last.golOspite;
      const away=document.createElement('span');away.textContent='  '+(last.ospite||'OSPITI')+(date?'  ·  '+date:'');
      $('aa-last-game').append(names,score,away);
    }else $('aa-last-game').textContent='In attesa del primo risultato registrato.';
  }
  async function loadUsageMetrics(){
    const topics=$('aa-usage-topics'),opens=$('aa-usage-pwa-7d');
    try{
      const {data,error}=await client.rpc('club_admin_usage_metrics');
      if(error)throw error;
      $('aa-usage-push-total').textContent=Number(data?.push_total)||0;
      topics.textContent='Calendario '+(Number(data?.push_calendar)||0)+' · Risultati '+(Number(data?.push_result)||0)+' · Foto '+(Number(data?.push_photos)||0);
      opens.textContent=Number(data?.pwa_7d)||0;
      $('aa-usage-pwa-note').textContent='Avvii anonimi in modalità app negli ultimi 7 giorni · non installazioni.';
    }catch(error){
      $('aa-usage-push-total').textContent='—';
      topics.textContent='Conteggio non disponibile al momento.';
      opens.textContent='—';
      $('aa-usage-pwa-note').textContent='Conteggio non disponibile al momento.';
    }
  }
  async function enter(){
    const {data:{session},error:authError}=await client.auth.getSession();
    if(authError)throw authError;
    if(!session?.user){authState(false);status('Accedi per visualizzare e gestire la Control Room.');return;}
    const {data:role,error:roleError}=await client.from('club_admins').select('user_id').eq('user_id',session.user.id).maybeSingle();
    if(roleError)throw roleError;
    if(!role){authState(false);status('Questo account non è autorizzato ad amministrare il Montanino.',true);return;}
    const {data:rows,error:readError}=await client.from('club_content').select('payload').eq('id','site').limit(1);
    if(readError)throw readError;
    currentUser=session.user;
    authState(true);
    updateDashboard(rows?.[0]?.payload||{});
    await loadUsageMetrics();
    $('aa-status').hidden=true;
    installButton();
  }
  function installButton(){
    const standalone=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
    $('aa-install').hidden=standalone;
  }
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredInstall=event;installButton();});
  window.addEventListener('appinstalled',()=>{$('aa-install').hidden=true;});
  $('aa-install').addEventListener('click',async()=>{
    const help=$('aa-install-help');
    if(deferredInstall){
      try{await deferredInstall.prompt();const result=await deferredInstall.userChoice;
        if(result?.outcome==='accepted'){$('aa-install').hidden=true;return;}}
      catch(e){}
      deferredInstall=null;
    }
    const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||
      (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
    help.textContent=ios?'Su iPhone: apri questa pagina in Safari, premi Condividi e poi “Aggiungi alla schermata Home”.':
      'Su Android: apri il menu ⋮ del browser e scegli “Installa app” oppure “Aggiungi alla schermata Home”.';
    help.hidden=false;
  });
  $('aa-login').addEventListener('submit',async e=>{
    e.preventDefault();const button=$('aa-login-submit');button.disabled=true;
    try{const {error}=await client.auth.signInWithPassword({email:$('aa-email').value.trim(),password:$('aa-password').value});
      if(error)throw error;await enter();
    }catch(error){status('Accesso non riuscito: '+error.message,true);}
    finally{button.disabled=false;$('aa-password').value='';}
  });
  $('aa-logout').addEventListener('click',async()=>{
    if(!confirm('Uscire dall’app amministratore?'))return;
    try{await client.auth.signOut();currentUser=null;authState(false);status('Accesso terminato.');}
    catch(error){status('Uscita non riuscita: '+error.message,true);}
  });
  // L'app usa lo stesso service worker della PWA pubblica: non competono per il controllo del sito.
  if('serviceWorker' in navigator&&location.protocol==='https:'){
    window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(()=>{}),{once:true});
  }
  try{
    if(!conf.url||!conf.anonKey||!/^https:\/\/[^/]+\.supabase\.co\/?$/.test(conf.url))throw Error('Supabase non configurato.');
    await new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      s.onload=resolve;s.onerror=()=>reject(Error('Connessione per il login non disponibile.'));
      document.head.append(s);
    });
    client=window.supabase.createClient(conf.url,conf.anonKey);
    await enter();
  }catch(error){status('Impossibile aprire la Control Room: '+error.message,true);authState(false);}
})();