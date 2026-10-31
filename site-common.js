/* Condivisione tra sito pubblico e pannello admin: dati e aggregazioni. */
(function(){
  'use strict';
  const copy = o => JSON.parse(JSON.stringify(o));
  const list = o => Array.isArray(o) ? o : [];
  const normalize = v => String(v||'').trim().toLocaleLowerCase('it');
  const played = m => Number.isInteger(m.golCasa) && Number.isInteger(m.golOspite);
  const complete = d => d?.datiCompleti === true && d?.eventiCompleti === true;
  const parseDate = m => new Date(`${m.data}T${m.ora||'23:59'}:00`).getTime();
  function recalc(d){
    // Presenze, gol, assist, disciplina e media voto SOLO per tabellini completi.
    // La classifica del campionato intero si aggiorna separatamente: non abbiamo gli altri match.
    const calendar=list(d.calendario);
    const records=d.dettagliPartite||{};
    const matches=calendar.filter(m=>played(m) && complete(records[m.id]));
    const total=calendar.filter(played).length;
    const players=new Map();
    const roster=list(d.giocatori);
    roster.forEach(p=>{
      const key=normalize(p.nome);
      if(!key || players.has(key))return;
      players.set(key,{...p,presenze:0,gol:0,assist:0,gialli:0,rossi:0,mediaVoto:null,_votes:[]});
    });
    const ensure=(name,extra={})=>{
      const key=normalize(name);if(!key)return null;
      if(!players.has(key))players.set(key,{nome:String(name).trim(),numero:extra.numero??null,ruolo:extra.ruolo||extra.reparto||'',presenze:0,gol:0,assist:0,gialli:0,rossi:0,mediaVoto:null,_votes:[]});
      return players.get(key);
    };
    for(const m of matches){
      const detail=records[m.id];
      const starters=list(detail.titolari), bench=list(detail.panchina), evs=list(detail.eventi);
      const participates=new Set(starters.map(p=>normalize(p.nome)));
      for(const ev of evs){if(normalize(ev.tipo)==='sostituzione')participates.add(normalize(ev.entra));}
      for(const p of bench){if(p.entrato !== '' && p.entrato !== null && p.entrato !== undefined)participates.add(normalize(p.nome));}
      for(const p of [...starters,...bench]){
        const s=ensure(p.nome,p);if(!s)continue;
        if(participates.has(normalize(p.nome)))s.presenze++;
        if(participates.has(normalize(p.nome)) && p.voto !== '' && p.voto !== null && p.voto !== undefined && Number.isFinite(Number(p.voto)))s._votes.push(Number(p.voto));
      }
      for(const ev of evs){
        if(ev.squadra && normalize(ev.squadra)!=='montanino')continue;
        const type=normalize(ev.tipo);
        const scorer=ensure(ev.giocatore);
        if(scorer && type==='gol')scorer.gol++;
        if(scorer && type==='giallo')scorer.gialli++;
        if(scorer && type==='rosso')scorer.rossi++;
        if(type==='gol' && ev.assist){const assist=ensure(ev.assist);if(assist)assist.assist++;}
      }
    }
    const result=[...players.values()].map(({_votes,...p})=>({...p,mediaVoto:_votes.length?Math.round((_votes.reduce((s,x)=>s+x,0)/_votes.length)*100)/100:null}));
    d.giocatori=result;
    d._statsCoverage={complete:matches.length,played:total};
    return d;
  }
  function summary(d){
    const games=list(d.calendario);
    const completed=games.filter(m=>played(m) && m.data).sort((a,b)=>parseDate(b)-parseDate(a));
    const future=games.filter(m=>!played(m));
    const now=Date.now();
    const scheduled=future.filter(m=>m.data && parseDate(m)>=now).sort((a,b)=>parseDate(a)-parseDate(b));
    const upcoming=scheduled[0]||future.find(m=>!m.data)||future.find(m=>m.data);
    if(upcoming){
      const date=upcoming.data ? new Intl.DateTimeFormat('it-IT',{weekday:'short',day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(upcoming.data+'T12:00:00Z')).toUpperCase() : 'DA DEFINIRE';
      d.prossimaPartita={casa:upcoming.casa,ospite:upcoming.ospite,data:date+(upcoming.ora?' · '+upcoming.ora:''),dataISO:upcoming.data&&upcoming.ora?upcoming.data+'T'+upcoming.ora+':00':null,competizione:`${upcoming.giornata}ª GIORNATA · CAMPIONATO`,campo:upcoming.campo||'CAMPO DA CONFERMARE',indirizzoMaps:upcoming.campo||''};
    }else d.prossimaPartita={casa:'Montanino',ospite:'Da definire',data:'DA CONFERMARE'};
    const last=completed[0];
    if(last)d.ultimoRisultato={idPartita:last.id,casa:last.casa,ospite:last.ospite,golCasa:last.golCasa,golOspite:last.golOspite,data:new Intl.DateTimeFormat('it-IT',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(last.data+'T12:00:00Z')).toUpperCase(),competizione:`${last.giornata}ª GIORNATA · CAMPIONATO`,nota:'DATO INSERITO DAL CLUB · VERIFICA UISP'};
    return d;
  }
  function prepare(data){return recalc(summary(copy(data)));}
  window.MontaninoCommon={copy,played,prepare,list,normalize};
})();
