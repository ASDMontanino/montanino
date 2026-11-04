/* A.S.D. MONTANINO — funzioni condivise V3.4.
   Compatibile con i JSON V3.0 già salvati su Supabase. */
(function(){
  'use strict';
  const copy=o=>JSON.parse(JSON.stringify(o));
  const list=o=>Array.isArray(o)?o:[];
  const normalize=v=>String(v||'').trim().toLocaleLowerCase('it');
  const played=m=>Number.isInteger(m.golCasa)&&Number.isInteger(m.golOspite);
  const parseDate=m=>new Date(`${m.data}T${m.ora||'23:59'}:00`).getTime();
  const roleCode=value=>{const x=normalize(value);if(x==='p'||x.includes('portier'))return 'P';if(x==='d'||x.includes('difensor'))return 'D';if(x==='a'||x.includes('attacc'))return 'A';return 'C';};
  const isValidModule=value=>/^\d(?:-\d){2,4}$/.test(value)&&value.split('-').reduce((a,x)=>a+Number(x),0)===10;
  function formationSlots(module='4-3-3'){
    const selected=isValidModule(String(module||'').trim())?String(module).trim():'4-3-3';
    const parts=selected.split('-').map(Number);
    const back=[];const forward=[];let middleIndex=1;
    const makeLine=(n,code,label,counter)=>({label,code,slots:Array.from({length:n},(_,i)=>({id:code+(counter+i),code,label}))});
    back.push(makeLine(1,'P','PORTIERE',1));
    back.push(makeLine(parts[0],'D','DIFESA',1));
    let center=1;
    parts.slice(1,-1).forEach((n,i)=>{back.push(makeLine(n,'C',parts.length>3?(i===0?'MEDIANA':'TREQUARTI'):'CENTROCAMPO',center));center+=n;});
    forward.push(makeLine(parts[parts.length-1],'A','ATTACCO',1));
    const fromBack=[...back,...forward];
    return {module:selected,slots:fromBack.flatMap(x=>x.slots),rows:[...fromBack].reverse()};
  }
  function assignFormation(module,players,roster=[],keepExisting=true){
    const layout=formationSlots(module),slots=layout.slots,used=new Set();
    const rosterMap=new Map(list(roster).map(p=>[normalize(p.nome),p]));
    const input=list(players).map(p=>({...p}));
    const code=p=>roleCode(rosterMap.get(normalize(p.nome))?.ruolo||p.reparto||p.ruolo);
    const chosen=new Map();
    const put=(i,slot)=>{if(i===undefined||!slot||used.has(slot.id)||chosen.has(i))return false;chosen.set(i,slot);used.add(slot.id);return true;};
    const keeperSlot=slots.find(s=>s.code==='P');
    let keeper=input.findIndex(p=>rosterMap.has(normalize(p.nome))&&code(p)==='P');
    if(keeper<0)keeper=input.findIndex(p=>roleCode(p.reparto||p.ruolo)==='P');
    if(keeper<0)keeper=input.findIndex(p=>p.posizione==='P1');
    if(keeper<0 && input.length)keeper=0;
    if(keeper>=0)put(keeper,keeperSlot);
    if(keepExisting){
      input.forEach((p,i)=>{if(chosen.has(i))return;const slot=slots.find(s=>s.id===p.posizione&&s.code!=='P');put(i,slot);});
    }
    for(const group of ['D','C','A']){
      input.forEach((p,i)=>{if(chosen.has(i)||code(p)!==group)return;put(i,slots.find(s=>s.code===group&&!used.has(s.id)));});
    }
    input.forEach((p,i)=>{if(!chosen.has(i))put(i,slots.find(s=>!used.has(s.id)));});
    return input.map((p,i)=>{
      const slot=chosen.get(i);
      return slot?{...p,posizione:slot.id,reparto:slot.code}:p;
    });
  }
  function recalc(d){
    // Presenze e voti: formazioni verificate. Gol, assist e cartellini: eventi verificati.
    // Le due verifiche sono indipendenti; le gare parziali non alterano gli altri conteggi.
    const calendar=list(d.calendario),records=d.dettagliPartite||{},playedGames=calendar.filter(played);
    const players=new Map();
    list(d.giocatori).forEach(p=>{const key=normalize(p.nome);if(key&&!players.has(key))players.set(key,{...p,presenze:0,gol:0,assist:0,gialli:0,rossi:0,mediaVoto:null,_votes:[]});});
    const ensure=(name,extra={})=>{
      const key=normalize(name);if(!key)return null;
      if(!players.has(key))players.set(key,{nome:String(name).trim(),numero:extra.numero??null,ruolo:extra.ruolo||extra.reparto||'',presenze:0,gol:0,assist:0,gialli:0,rossi:0,mediaVoto:null,_votes:[]});
      return players.get(key);
    };
    let formations=0,eventsComplete=0,both=0;
    for(const m of playedGames){
      const detail=records[m.id]||{};
      const starters=list(detail.titolari),bench=list(detail.panchina),events=list(detail.eventi);
      const hasLineup=detail.datiCompleti===true&&starters.length===11;
      const hasEvents=detail.eventiCompleti===true;
      if(hasLineup){
        formations++;
        const participating=new Set(starters.map(p=>normalize(p.nome)));
        // I cambi registrati contano anche senza minuto scritto accanto alla riserva.
        events.filter(e=>normalize(e.tipo)==='sostituzione'&&(!e.squadra||normalize(e.squadra)==='montanino')).forEach(e=>{if(e.entra)participating.add(normalize(e.entra));});
        bench.forEach(p=>{if(p.entrato!==undefined&&p.entrato!==null&&p.entrato!=='')participating.add(normalize(p.nome));});
        for(const p of [...starters,...bench]){
          const s=ensure(p.nome,p);if(!s||!participating.has(normalize(p.nome)))continue;
          s.presenze++;
          if(p.voto!==''&&p.voto!==null&&p.voto!==undefined&&Number.isFinite(Number(p.voto))&&Number(p.voto)>=0&&Number(p.voto)<=10)s._votes.push(Number(p.voto));
        }
      }
      if(hasEvents){
        eventsComplete++;
        for(const e of events){
          if(e.squadra&&normalize(e.squadra)!=='montanino')continue;
          const t=normalize(e.tipo),p=ensure(e.giocatore);
          if(p&&['gol','gol_rigore','gol(rigore)'].includes(t))p.gol++;
          if(p&&t==='giallo')p.gialli++;
          if(p&&t==='rosso')p.rossi++;
          if(t==='gol'&&e.assist){const a=ensure(e.assist);if(a)a.assist++;}
        }
      }
      if(hasLineup&&hasEvents)both++;
    }
    d.giocatori=[...players.values()].map(({_votes,...p})=>({...p,mediaVoto:_votes.length?Math.round(_votes.reduce((a,b)=>a+b,0)/_votes.length*100)/100:null}));
    d._statsCoverage={complete:both,formations,events:eventsComplete,played:playedGames.length};
    return d;
  }
  function summary(d){
    const games=list(d.calendario);
    const completed=games.filter(m=>played(m)&&m.data).sort((a,b)=>parseDate(b)-parseDate(a));
    const future=games.filter(m=>!played(m));const now=Date.now();
    const scheduled=future.filter(m=>m.data&&parseDate(m)>=now).sort((a,b)=>parseDate(a)-parseDate(b));
    const upcoming=scheduled[0]||future.find(m=>!m.data)||future.find(m=>m.data);
    if(upcoming){
      const date=upcoming.data?new Intl.DateTimeFormat('it-IT',{weekday:'short',day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(upcoming.data+'T12:00:00Z')).toUpperCase():'DA DEFINIRE';
      d.prossimaPartita={casa:upcoming.casa,ospite:upcoming.ospite,data:date+(upcoming.ora?' · '+upcoming.ora:''),dataISO:upcoming.data&&upcoming.ora?upcoming.data+'T'+upcoming.ora+':00':null,competizione:`${upcoming.giornata}ª GIORNATA · CAMPIONATO`,campo:upcoming.campo||'CAMPO DA CONFERMARE',indirizzoMaps:upcoming.campo||''};
    }else d.prossimaPartita={casa:'Montanino',ospite:'Da definire',data:'DA CONFERMARE'};
    const last=completed[0];
    if(last)d.ultimoRisultato={idPartita:last.id,casa:last.casa,ospite:last.ospite,golCasa:last.golCasa,golOspite:last.golOspite,data:new Intl.DateTimeFormat('it-IT',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(last.data+'T12:00:00Z')).toUpperCase(),competizione:`${last.giornata}ª GIORNATA · CAMPIONATO`,nota:'DATO INSERITO DAL CLUB · VERIFICA UISP'};
    return d;
  }
  const prepare=data=>recalc(summary(copy(data)));
  window.MontaninoCommon={copy,played,prepare,list,normalize,roleCode,formationSlots,assignFormation,isValidModule};
})();
