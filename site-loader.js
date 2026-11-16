/* Il sito pubblico usa il database quando configurato; altrimenti la V2.2 originale.
   In modalità demo locale, legge le modifiche di prova dal solo browser. */
(async function(){
  'use strict';
  const conf=window.MONTANINO_SUPABASE||{};
  const ready=!!(conf.url && conf.anonKey && /^https:\/\/[^/]+\.supabase\.co\/?$/.test(conf.url));
  function addScript(src){return new Promise((resolve,reject)=>{const el=document.createElement('script');el.src=src;el.onload=resolve;el.onerror=reject;document.head.append(el);});}
  try{
    let d=null;
    if(ready){
      const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),7000);
      try{
        const res=await fetch(conf.url.replace(/\/$/,'')+'/rest/v1/club_content?select=payload&id=eq.site',{headers:{apikey:conf.anonKey},signal:controller.signal,cache:'no-store'});
        if(!res.ok)throw new Error('HTTP '+res.status);
        const rows=await res.json();if(rows.length)d=rows[0].payload;
      }finally{clearTimeout(timer);}
    } else {
      try{const cached=localStorage.getItem('montanino-demo-v3');if(cached)d=JSON.parse(cached);}catch(e){}
    }
    if(d && typeof d==='object' && Array.isArray(d.calendario))SITE_DATA=Object.assign({},SITE_DATA,d);
  }catch(error){
    console.warn('Dati online non disponibili; uso il backup locale.',error);
    if(ready){
      const banner=document.createElement('div');banner.className='sync-offline';banner.setAttribute('role','status');
      banner.textContent='DATI LIVE TEMPORANEAMENTE NON DISPONIBILI · STAI VEDENDO UNA COPIA DI RISERVA.';
      (document.querySelector('.header')||document.body).insertAdjacentElement('afterend',banner);
    }
  }

  // Legge la classifica pubblica ufficiale UISP; in caso di errore conserva l'ultima copia del sito.
  if(ready){
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),7000);
    try{
      const res=await fetch(conf.url.replace(/\/$/,'')+'/functions/v1/uisp-classifica',{
        headers:{apikey:conf.anonKey},
        signal:controller.signal,
        cache:'default'
      });
      if(!res.ok)throw new Error('HTTP '+res.status);
      const result=await res.json();
      if(!Array.isArray(result.classifica)||result.classifica.length<2)throw new Error('Dati classifica non validi');
      SITE_DATA.classifica=result.classifica;
      window.MONTANINO_STANDINGS_LIVE=true;
    }catch(error){
      console.warn('Classifica UISP non disponibile; uso l’ultima copia salvata.',error);
      window.MONTANINO_STANDINGS_LIVE=false;
    }finally{clearTimeout(timer);}
  }

  SITE_DATA=window.MontaninoCommon.prepare(SITE_DATA);
  // Mantiene i dati storici in Supabase ma li esclude dal renderer pubblico.
  for(const match of Object.values(SITE_DATA.dettagliPartite||{})){
    for(const player of [...(Array.isArray(match.titolari)?match.titolari:[]),...(Array.isArray(match.panchina)?match.panchina:[])]){
      if(player && typeof player==='object')delete player.voto;
    }
  }
  try{await addScript('main.js?v=20261116-uisp-classifica');}catch(e){console.error('Impossibile caricare main.js',e);}
})();
