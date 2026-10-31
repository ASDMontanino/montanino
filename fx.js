/* Animazioni leggere, accessibili e funzionanti anche offline. */
(() => {
  'use strict';
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine=window.matchMedia('(hover:hover) and (pointer:fine)').matches;
  const header=document.getElementById('header');
  const progress=document.querySelector('.scroll-progress');
  const toTop=document.getElementById('to-top');
  let scheduled=false;
  function onScroll(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{
      scheduled=false;
      const y=window.scrollY, max=Math.max(1,document.documentElement.scrollHeight-innerHeight);
      header.classList.toggle('is-scrolled',y>18);
      progress.style.transform=`scaleX(${Math.min(1,y/max)})`;
      toTop.classList.toggle('show',y>540);
      if(!reduced && y<1100)document.documentElement.style.setProperty('--scrollY',String(y));
    });
  }
  window.addEventListener('scroll',onScroll,{passive:true});
  window.addEventListener('resize',onScroll,{passive:true});
  onScroll();
  toTop.addEventListener('click',()=>window.scrollTo({top:0,behavior:reduced?'instant':'smooth'}));

  /* Intro: viene mostrata soltanto alla prima apertura della scheda. */
  const intro=document.getElementById('intro');
  let seen=false;
  try{seen=sessionStorage.getItem('montanino-intro-v2')==='1';sessionStorage.setItem('montanino-intro-v2','1');}catch(e){}
  if(seen||reduced){intro.remove();}
  else {
    let closed=false;
    function closeIntro(){if(closed)return;closed=true;intro.classList.add('leaving');setTimeout(()=>intro.remove(),760);}
    intro.addEventListener('click',closeIntro);
    intro.addEventListener('keydown',e=>{if(e.key==='Escape')closeIntro();});
    setTimeout(closeIntro,1950);
  }

  /* Comparsa progressiva allo scroll. Fallback: contenuti sempre visibili. */
  if(!reduced && 'IntersectionObserver' in window){
    document.documentElement.classList.add('has-reveal');
    const observer=new IntersectionObserver(entries=>{
      entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible');observer.unobserve(e.target);}});
    },{threshold:.1,rootMargin:'0px 0px -25px 0px'});
    document.querySelectorAll('.reveal').forEach((el,i)=>{el.style.setProperty('--reveal-delay',`${Math.min(i%3,2)*75}ms`);observer.observe(el);});
  }

  /* Evidenzia la sezione attiva del menu. */
  if('IntersectionObserver' in window){
    const links=[...document.querySelectorAll('.nav-link')];
    const byId=new Map(links.map(a=>[a.getAttribute('href').slice(1),a]));
    const navObserver=new IntersectionObserver(entries=>{
      const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio);
      if(visible.length){links.forEach(a=>a.classList.remove('is-current'));byId.get(visible[0].target.id)?.classList.add('is-current');}
    },{rootMargin:'-17% 0px -65% 0px',threshold:0});
    ['home','partite','classifica','rosa','identita'].forEach(id=>{const el=document.getElementById(id);if(el)navObserver.observe(el);});
  }

  /* Interazione con la luce verde nell'hero. */
  const hero=document.querySelector('.hero');
  if(fine && !reduced){
    let raf=0, lastX=0,lastY=0;
    hero.addEventListener('pointermove',e=>{
      lastX=(e.clientX/innerWidth)*100;lastY=(e.clientY/innerHeight)*100;
      if(raf)return;raf=requestAnimationFrame(()=>{raf=0;hero.style.setProperty('--mouseX',lastX+'%');hero.style.setProperty('--mouseY',lastY+'%');});
    },{passive:true});
  }

  /* Canvas: punti connessi molto leggeri dietro il titolo, stop quando la pagina è nascosta. */
  const canvas=document.getElementById('hero-particles');
  if(!reduced && canvas?.getContext){
    const ctx=canvas.getContext('2d');let pts=[],w=0,h=0,raf=0,visible=true,frame=0;
    const random=(a,b)=>a+Math.random()*(b-a);
    function size(){
      const r=hero.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,1.5);
      w=Math.max(1,r.width);h=Math.max(1,r.height);
      canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
      ctx.setTransform(dpr,0,0,dpr,0,0);
      const count=Math.max(14,Math.min(33,Math.floor(w*h/28000)));
      pts=Array.from({length:count},()=>({x:random(0,w),y:random(0,h),vx:random(-.2,.2),vy:random(-.2,.2),r:random(.6,1.5)}));
    }
    function draw(){raf=0;if(!visible||document.hidden)return;raf=requestAnimationFrame(draw);if(++frame%2)return;
      ctx.clearRect(0,0,w,h);
      for(const p of pts){p.x+=p.vx;p.y+=p.vy;if(p.x<-8)p.x=w+8;if(p.x>w+8)p.x=-8;if(p.y<-8)p.y=h+8;if(p.y>h+8)p.y=-8;}
      for(let i=0;i<pts.length;i++)for(let j=i+1;j<pts.length;j++){
        const a=pts[i],b=pts[j],d=Math.hypot(a.x-b.x,a.y-b.y);
        if(d<125){ctx.strokeStyle=`rgba(110,233,161,${((1-d/125)*.16).toFixed(3)})`;ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
      }
      ctx.fillStyle='rgba(154,241,187,.5)';for(const p of pts){ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();}
    }
    function resume(){if(visible&&!document.hidden&&!raf)raf=requestAnimationFrame(draw);}
    size();resume();window.addEventListener('resize',()=>{size();resume();},{passive:true});
    document.addEventListener('visibilitychange',resume);
    if('IntersectionObserver' in window)new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;resume();}).observe(hero);
  }
})();
