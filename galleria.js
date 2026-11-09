/* A.S.D. MONTANINO — Galleria autonoma V3.6, dati foto su Supabase. */
(async function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const el=(tag,cls='',value)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(value!==undefined)node.textContent=String(value);return node;};
  const list=value=>Array.isArray(value)?value:[];
  const safePhoto=file=>(/^sb:montanino-[0-9a-f]{32}\.webp$/.test(String(file||''))||(/^[\p{L}\p{N}][\p{L}\p{N} _().-]*\.(?:jpe?g|png|webp|avif)$/iu.test(String(file||''))&&!String(file).includes('..')));
  const photoSrc=file=>file.startsWith('sb:')&&conf.url
    ? conf.url.replace(/\/$/,'')+'/storage/v1/object/public/montanino-partite/'+encodeURIComponent(file.slice(3))
    : 'assets/img/partite/'+encodeURIComponent(file);
  const menu=$('menu-toggle'),nav=$('nav');
  if(menu&&nav){
    menu.addEventListener('click',()=>{const expanded=menu.getAttribute('aria-expanded')==='true';menu.setAttribute('aria-expanded',String(!expanded));menu.classList.toggle('active',!expanded);nav.classList.toggle('open',!expanded);});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&nav.classList.contains('open')){nav.classList.remove('open');menu.classList.remove('active');menu.setAttribute('aria-expanded','false');}});
  }
  let data=typeof SITE_DATA!=='undefined'?SITE_DATA:{};
  const conf=window.MONTANINO_SUPABASE||{};
  if(conf.url&&conf.anonKey&&/^https:\/\/[^/]+\.supabase\.co\/?$/.test(conf.url)){
    const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),9000);
    try{
      const response=await fetch(conf.url.replace(/\/$/,'')+'/rest/v1/club_content?select=payload&id=eq.site',{
        headers:{apikey:conf.anonKey},signal:abort.signal,cache:'no-store'
      });
      if(!response.ok)throw Error('Lettura temporaneamente non disponibile');
      const rows=await response.json();
      if(rows?.[0]?.payload)data=rows[0].payload;
    }catch(err){console.warn('Galleria: impossibile sincronizzare ora',err);}
    finally{clearTimeout(timer);}
  }else{
    try{const local=localStorage.getItem('montanino-demo-v3');if(local)data=JSON.parse(local);}catch(e){}
  }
  const calendar=list(data.calendario),map=new Map(calendar.map(m=>[String(m.id),m]));
  const photos=list(data.fotoPartite).filter(p=>p&&p.partita&&safePhoto(p.file)).map(p=>({
    partita:String(p.partita),file:String(p.file),didascalia:String(p.didascalia||'').trim()
  }));
  const order=new Map(calendar.map((m,i)=>[String(m.id),i]));
  const groupIds=[...new Set(photos.map(p=>p.partita))].sort((a,b)=>(order.get(b)??-1)-(order.get(a)??-1));
  const dateLabel=date=>{
    if(!date)return 'DATA DA CONFERMARE';
    const stamp=new Date(date+'T12:00:00');
    return isNaN(stamp.valueOf())?'DATA DA CONFERMARE':new Intl.DateTimeFormat('it-IT',{day:'2-digit',month:'long',year:'numeric',timeZone:'Europe/Rome'}).format(stamp).toUpperCase();
  };
  const matchTitle=id=>{
    const m=map.get(id);return m?m.casa+' — '+m.ospite:'PARTITA '+id;
  };
  const matchLabel=id=>{
    const m=map.get(id);return m?(m.fase+' / GIORNATA '+m.giornata+' · '+dateLabel(m.data)):id;
  };
  let displayed=[],currentIndex=0,lastFocus=null;
  const lightbox=$('gallery-lightbox');
  const lightImage=$('gallery-lightbox-img'),lightCaption=$('gallery-lightbox-caption');
  const closeBtn=$('gallery-lightbox-close'),prevBtn=$('gallery-lightbox-prev'),nextBtn=$('gallery-lightbox-next');
  function refreshLightbox(){
    if(!displayed.length)return;
    const item=displayed[currentIndex];
    lightImage.src=photoSrc(item.file);
    lightImage.alt=(item.didascalia||'Fotografia')+' · '+matchTitle(item.partita);
    lightCaption.textContent=matchTitle(item.partita)+(item.didascalia?' · '+item.didascalia:'')+' · '+(currentIndex+1)+' / '+displayed.length;
    prevBtn.hidden=nextBtn.hidden=displayed.length<2;
  }
  function openLightbox(index){
    currentIndex=index;lastFocus=document.activeElement;refreshLightbox();
    lightbox.hidden=false;document.body.classList.add('modal-open');closeBtn.focus();
  }
  function closeLightbox(){
    if(lightbox.hidden)return;
    lightbox.hidden=true;document.body.classList.remove('modal-open');
    lastFocus?.focus?.();
  }
  function shiftPhoto(offset){
    if(!displayed.length)return;
    currentIndex=(currentIndex+offset+displayed.length)%displayed.length;refreshLightbox();
  }
  closeBtn.addEventListener('click',closeLightbox);
  prevBtn.addEventListener('click',()=>shiftPhoto(-1));
  nextBtn.addEventListener('click',()=>shiftPhoto(1));
  lightbox.addEventListener('click',event=>{if(event.target===lightbox)closeLightbox();});
  document.addEventListener('keydown',event=>{
    if(lightbox.hidden)return;
    if(event.key==='Escape')closeLightbox();
    else if(event.key==='ArrowLeft')shiftPhoto(-1);
    else if(event.key==='ArrowRight')shiftPhoto(1);
  });
  function render(filter='tutte'){
    const root=$('gallery-items');root.replaceChildren();
    displayed=photos.filter(p=>filter==='tutte'||p.partita===filter);
    const shownGroups=filter==='tutte'?groupIds:groupIds.filter(id=>id===filter);
    $('gallery-empty').hidden=displayed.length>0;
    $('gallery-photo-total').textContent=photos.length+' '+(photos.length===1?'FOTOGRAFIA':'FOTOGRAFIE');
    for(const id of shownGroups){
      const items=photos.filter(p=>p.partita===id);
      if(!items.length)continue;
      const section=el('section','gallery-match-group');
      const heading=el('header','gallery-group-head');
      const left=el('div');
      left.append(el('span','gallery-group-kicker',matchLabel(id)),el('h3','gallery-group-title',matchTitle(id)));
      heading.append(left,el('span','gallery-group-date',items.length+' '+(items.length===1?'FOTO':'FOTO')));
      const grid=el('div','gallery-photo-grid');
      items.forEach(item=>{
        const button=el('button','gallery-photo-card');button.type='button';
        button.setAttribute('aria-label','Apri la foto: '+(item.didascalia||matchTitle(id)));
        const img=el('img');img.src=photoSrc(item.file);img.alt=item.didascalia||matchTitle(id);img.loading='lazy';
        const missing=el('span','gallery-photo-placeholder','IMMAGINE NON TROVATA · '+item.file);missing.hidden=true;
        img.onerror=()=>{img.hidden=true;missing.hidden=false;};
        button.append(img,missing);
        if(item.didascalia)button.append(el('span','gallery-photo-caption',item.didascalia));
        button.addEventListener('click',()=>openLightbox(displayed.indexOf(item)));
        grid.append(button);
      });
      section.append(heading,grid);root.append(section);
    }
  }
  const select=$('gallery-match-filter');
  groupIds.forEach(id=>{const opt=el('option','',matchTitle(id));opt.value=id;select.append(opt);});
  select.addEventListener('change',()=>{closeLightbox();render(select.value);});
  $('gallery-loading').hidden=true;
  render();
})();