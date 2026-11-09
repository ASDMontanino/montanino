/* Montanino Admin: navigazione mobile contestuale solo in ?app=1.
   Non modifica il pannello desktop e non accede a dati o credenziali. */
(() => {
  'use strict';
  const params=new URLSearchParams(location.search);
  if(params.get('app')!=='1')return;
  const inEditor=/\/admin\.html$/i.test(location.pathname);
  const onMatchday=/\/matchday\.html$/i.test(location.pathname);
  if(!inEditor&&!onMatchday)return;
  document.documentElement.classList.add('montanino-admin-shell');

  const panelTypes=new Set(['partite','rosa','classifica','staff','sponsor','galleria']);
  const selectedPanel=panelTypes.has(params.get('panel'))?params.get('panel'):'partite';

  function newEl(tag,className,text){
    const e=document.createElement(tag);if(className)e.className=className;
    if(text!==undefined)e.textContent=text;return e;
  }
  function navLink(url,icon,title,active){
    const a=newEl('a','ma-tab'+(active?' is-current':''));a.href=url;
    a.append(newEl('span','ma-tab-icon',icon),newEl('small','',title));
    if(active)a.setAttribute('aria-current','page');
    return a;
  }
  function scrollTop(){
    window.scrollTo({top:0,behavior:'auto'});
  }
  function selectPanel(name){
    if(!inEditor||!panelTypes.has(name))return;
    const button=document.querySelector('.admin-tabs [data-panel="'+name+'"]');
    if(!button)return;
    button.click();
    const next=new URL(location.href);
    next.searchParams.set('panel',name);
    history.replaceState(null,'',next.pathname+next.search+next.hash);
    document.querySelectorAll('.ma-tab').forEach(link=>{
      const active=link.dataset.tab==='partite'?name==='partite':
        link.dataset.tab==='more'?name!=='partite':false;
      link.classList.toggle('is-current',active);
      if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
    });
    scrollTop();
  }
  function init(){
    // Back to the separate Admin app rather than the public site.
    const brand=document.querySelector(inEditor?'.admin-brand':'.md-brand');
    if(brand)brand.href='admin-app.html';
    const oldBack=document.querySelector(inEditor?'.header-actions .link-back':'.md-back');
    if(oldBack){oldBack.href='admin-app.html';oldBack.textContent='⌂ HOME';}
    if(inEditor){
      const live=document.querySelector('a[href="matchday.html"]');
      if(live)live.href='matchday.html?app=1';
    }

    const nav=newEl('nav','ma-bottom-tabs');
    nav.setAttribute('aria-label','Navigazione dell’app Montanino Admin');
    const home=navLink('admin-app.html','⌂','HOME',false);
    const live=navLink('matchday.html?app=1','⚡','LIVE',onMatchday);
    const games=navLink('admin.html?app=1&panel=partite','⚽','PARTITE',inEditor&&selectedPanel==='partite');
    games.dataset.tab='partite';
    const more=newEl('button','ma-tab'+(inEditor&&selectedPanel!=='partite'?' is-current':''));
    more.type='button';more.dataset.tab='more';
    more.append(newEl('span','ma-tab-icon','☰'),newEl('small','','ALTRO'));
    more.setAttribute('aria-haspopup','dialog');more.setAttribute('aria-expanded','false');
    nav.append(home,live,games,more);

    const overlay=newEl('div','ma-sheet-overlay');overlay.hidden=true;
    const sheet=newEl('div','ma-sheet');
    sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');
    sheet.setAttribute('aria-label','Altre funzioni amministrative');
    sheet.hidden=true;
    const heading=newEl('div','ma-sheet-heading');
    heading.append(newEl('strong','','GESTIONE DEL CLUB'));
    const close=newEl('button','ma-close','×');close.type='button';close.setAttribute('aria-label','Chiudi menu');
    heading.append(close);sheet.append(heading);
    for(const [name,label,icon] of [
      ['rosa','ROSA GIOCATORI','👥'],
      ['classifica','CLASSIFICA','🏆'],
      ['galleria','FOTOGRAFIE','📷'],
      ['staff','STAFF E DIRIGENZA','🛡'],
      ['sponsor','SPONSOR & SOCIAL','🤝']
    ]){
      const item=newEl('button','ma-sheet-item');
      item.type='button';item.append(newEl('span','',icon),newEl('strong','',label),newEl('span','ma-sheet-arrow','↗'));
      item.addEventListener('click',()=>{
        hideSheet();
        if(inEditor)selectPanel(name);
        else location.href='admin.html?app=1&panel='+encodeURIComponent(name);
      });
      sheet.append(item);
    }
    const backup=navLink('admin-app.html','⌂','TORNA ALLA HOME',false);
    backup.className='ma-sheet-bottom';sheet.append(backup);
    document.body.append(nav,overlay,sheet);
    function hideSheet(){
      sheet.hidden=true;overlay.hidden=true;more.setAttribute('aria-expanded','false');
    }
    function showSheet(){
      sheet.hidden=false;overlay.hidden=false;more.setAttribute('aria-expanded','true');close.focus();
    }
    more.addEventListener('click',()=>sheet.hidden?showSheet():hideSheet());
    overlay.addEventListener('click',hideSheet);
    close.addEventListener('click',hideSheet);
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!sheet.hidden)hideSheet();});

    if(inEditor){
      // Existing admin.js populates panels after async login. Wait for authenticated UI.
      const editor=document.getElementById('editor');
      if(editor){
        const applyOnce=()=>{
          if(editor.hidden)return;
          selectPanel(selectedPanel);
          observer.disconnect();
        };
        const observer=new MutationObserver(applyOnce);
        observer.observe(editor,{attributes:true,attributeFilter:['hidden']});
        applyOnce();
      }
      document.querySelectorAll('.admin-tabs [data-panel]').forEach(button=>{
        button.addEventListener('click',()=>{
          const name=button.dataset.panel;
          if(!panelTypes.has(name))return;
          const url=new URL(location.href);url.searchParams.set('panel',name);
          history.replaceState(null,'',url.pathname+url.search+url.hash);
          games.classList.toggle('is-current',name==='partite');
          more.classList.toggle('is-current',name!=='partite');
        });
      });
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();