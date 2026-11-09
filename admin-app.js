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
  function updateDashboard(content){
    const calendar=list(content.calendario);
    const now=Date.now();
    const played=m=>Number.isInteger(m.golCasa)&&Number.isInteger(m.golOspite);
    const pending=calendar.filter(m=>!played(m));
    const sortedPending=[...pending].sort((a,b)=>localDay(a)-localDay(b));
    const next=sortedPending.find(m=>localDay(m)>=now)||sortedPending[0];
    const last=[...calendar].filter(m=>played(m)).sort((a,b)=>localDay(b)-localDay(a))[0];
    $('aa-stat-players').textContent=list(content.giocatori).length;
    $('aa-stat-matches').textContent=calendar.filter(played).length;
    $('aa-stat-photos').textContent=list(content.fotoPartite).length;
    if(next){
      $('aa-next-home').textContent=next.casa||'DA DEFINIRE';
      $('aa-next-away').textContent=next.ospite||'DA DEFINIRE';
      const date=next.data?new Intl.DateTimeFormat('it-IT',{weekday:'short',day:'2-digit',month:'short',year:'numeric'}).format(new Date(next.data+'T12:00:00')):'DATA DA DEFINIRE';
      $('aa-next-details').textContent=[date,next.ora,next.campo].filter(Boolean).join(' · ').toUpperCase();
      $('aa-next-status').textContent=next.data?'DA GIOCARE':'DA PROGRAMMARE';
      $('aa-next-live').href='matchday.html?app=1&partita='+encodeURIComponent(next.id);
    }else{
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