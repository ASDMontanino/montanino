/* Caricamento fotografie Montanino — solo area admin autenticata. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const input=$('gallery-upload-files'),button=$('gallery-upload-start'),bar=$('gallery-upload-progress');
  const status=$('gallery-upload-status'),selection=$('gallery-upload-selection'),preview=$('gallery-upload-preview');
  const drop=$('gallery-upload-drop');
  if(!input||!button)return;
  let files=[],running=false;
  function choose(items){
    if(running)return;
    files=[...items];
    selection.textContent=files.length?files.length+' foto selezionate':'Nessuna foto selezionata';
    status.textContent=files.length?'Pronto per convertire e pubblicare.':'Pronto per il caricamento.';
  }
  input.addEventListener('change',()=>choose(input.files));
  drop.addEventListener('click',()=>{if(!running)input.click();});
  drop.addEventListener('keydown',event=>{if(!running&&(event.key==='Enter'||event.key===' ')){event.preventDefault();input.click();}});
  drop.addEventListener('dragover',event=>{event.preventDefault();drop.classList.add('dragging');});
  drop.addEventListener('dragleave',()=>drop.classList.remove('dragging'));
  drop.addEventListener('drop',event=>{event.preventDefault();drop.classList.remove('dragging');choose(event.dataTransfer.files);});

  async function webp(file){
    let source,objectURL;
    try{
      if(window.createImageBitmap)source=await createImageBitmap(file,{imageOrientation:'from-image'});
      else {
        objectURL=URL.createObjectURL(file);
        source=await new Promise((resolve,reject)=>{
          const img=new Image();
          img.onload=()=>resolve(img);
          img.onerror=()=>reject(Error('Foto non leggibile'));
          img.src=objectURL;
        });
      }
      const w=source.naturalWidth||source.width,h=source.naturalHeight||source.height;
      if(!w||!h)throw Error('Dimensioni non riconosciute');
      const ratio=Math.min(1,2560/Math.max(w,h));
      const canvas=document.createElement('canvas');
      canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);
      const ctx=canvas.getContext('2d');
      if(!ctx)throw Error('Impossibile elaborare questa immagine');
      ctx.imageSmoothingQuality='high';ctx.drawImage(source,0,0,canvas.width,canvas.height);
      const result=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.84));
      canvas.width=canvas.height=0;
      if(!result||result.type!=='image/webp')throw Error('Il browser non supporta la conversione WebP');
      if(result.size>10*1024*1024)throw Error('Foto ancora troppo grande dopo la compressione');
      return result;
    }finally{
      if(source?.close)source.close();
      if(objectURL)URL.revokeObjectURL(objectURL);
    }
  }
  async function fileHash(file){
    if(!crypto.subtle)throw Error('Browser non compatibile');
    const bytes=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());
    return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,32);
  }
  const duplicate=e=>e&&(/already.exists|duplicate/i.test(e.message||'')||String(e.code||'').toLowerCase()==='duplicate');
  function thumb(blob){
    if(preview.children.length>=24)return;
    const url=URL.createObjectURL(blob),cell=document.createElement('div'),img=document.createElement('img');
    cell.className='gallery-upload-thumb';img.src=url;img.alt='Foto pronta';img.loading='lazy';
    img.onload=img.onerror=()=>URL.revokeObjectURL(url);
    cell.append(img);preview.append(cell);
  }
  function notice(text,error){
    status.textContent=text;
    const alert=$('alert');alert.hidden=false;alert.textContent=text;alert.classList.toggle('error',!!error);
  }
  button.addEventListener('click',async()=>{
    const admin=window.MontaninoPhotoAdmin;
    if(running)return;
    if(!admin?.available()){notice('Accedi al pannello amministratore online prima di caricare.',true);return;}
    const match=$('gallery-upload-match').value;
    if(!match||!files.length){notice('Scegli la partita e almeno una foto.',true);return;}
    if(files.length>60){notice('Carica al massimo 60 foto per volta.',true);return;}
    if(files.some(f=>(!['image/jpeg','image/png','image/webp'].includes(f.type)&&!/\.(jpe?g|png|webp)$/i.test(f.name))||f.size>25*1024*1024||!f.size)){
      notice('Usa JPG, PNG o WebP con massimo 25 MB per foto. Per HEIC esporta in JPG.',true);return;
    }
    if(admin.dirty()&&!confirm('Ci sono modifiche non salvate: verranno pubblicate con le fotografie. Continuare?'))return;
    try{admin.validate();}catch(e){notice('Correggi prima le modifiche non valide: '+e.message,true);return;}
    running=true;button.disabled=true;$('save-all').disabled=$('save-bottom').disabled=true;
    preview.replaceChildren();bar.hidden=false;bar.value=0;
    let added=0,skipped=0,done=0;
    const errors=[];
    const existing=new Set(admin.current().map(p=>p.partita+'|'+p.file.toLowerCase()));
    try{
      for(const f of files){
        status.textContent='Foto '+(done+1)+' di '+files.length+': '+f.name;
        try{
          const name='montanino-'+await fileHash(f)+'.webp',ref='sb:'+name,key=match+'|'+ref;
          if(existing.has(key)){skipped++;continue;}
          const blob=await webp(f);
          const {error}=await admin.client().storage.from('montanino-partite').upload(name,blob,{contentType:'image/webp',cacheControl:'31536000',upsert:false});
          if(error&&!duplicate(error)){
            if(/bucket.not.found|does not exist|not found|row.level.security|permission.denied|unauthoriz/i.test(error.message||'')){
              throw Error('Completa prima la configurazione FOTO_STORAGE_SETUP.sql nel SQL Editor di Supabase.');
            }
            throw Error(error.message||'Errore caricamento');
          }
          admin.add({partita:match,file:ref,didascalia:''});
          existing.add(key);added++;thumb(blob);
        }catch(error){
          errors.push(f.name+': '+error.message);
          if(/configurazione FOTO_STORAGE_SETUP/.test(error.message||''))break;
        }finally{done++;bar.value=Math.round(done/files.length*100);}
      }
    }finally{
      running=false;button.disabled=false;
      $('save-all').disabled=$('save-bottom').disabled=false;
      files=[];input.value='';selection.textContent='Nessuna foto selezionata';
    }
    const saved=added?await admin.save():false;
    const tail=errors.length?' Errori: '+errors.slice(0,3).join('; ')+(errors.length>3?'…':''):'';
    if(saved)notice(added+' fotografie pubblicate. '+skipped+' duplicati saltati. Visibili in Galleria e Home.'+tail,errors.length>0);
    else if(added)notice(added+' foto caricate ma non ancora pubblicate. Premi SALVA MODIFICHE senza chiudere questa pagina.'+tail,true);
    else notice(errors.length?tail:'Nessuna nuova foto: '+skipped+' già presenti.',errors.length>0);
  });
})();
