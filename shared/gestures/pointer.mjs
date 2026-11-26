// This module is loaded only by desktop pages, never by /phone/.
import {openPalmPoint,hasFist,ClickGate,TUNING} from './input-core.mjs';
import {startCamera} from './camera-engine.mjs';
import {uiTargetAt} from './ui-target.mjs';
if(!location.pathname.startsWith('/phone/')) init();
function init() {
  const root=document.documentElement;
  const pointerNavigation=()=>root.classList.remove('bluey-keyboard-navigation');
  document.addEventListener('keydown',event=>{
    if(['Tab','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) root.classList.add('bluey-keyboard-navigation');
  },true);
  document.addEventListener('pointerdown',pointerNavigation,true);
  document.addEventListener('pointermove',event=>{if(event.isTrusted)pointerNavigation();},{passive:true,capture:true});
  const cursor=document.createElement('div');cursor.id='bluey-ui-cursor';cursor.setAttribute('aria-hidden','true');
  const open=new Image(),closed=new Image();open.src='/shared/cursor/open%20palm.png';closed.src='/shared/cursor/closed%20fist.png';
  open.alt=closed.alt='';closed.hidden=true;cursor.append(open,closed);document.body.append(cursor);
  const retry=document.createElement('button');retry.id='bluey-hand-retry';retry.type='button';retry.hidden=true;
  retry.onclick=()=>void startCamera();document.body.append(retry);
  let current={x:.5,y:.7},target={...current};
  try {const saved=JSON.parse(sessionStorage.getItem('bluey:pointer'));if(Number.isFinite(saved?.x)&&Number.isFinite(saved?.y))current=target={x:Math.max(.01,Math.min(.99,saved.x)),y:Math.max(.01,Math.min(.99,saved.y))};} catch{}
  const gate=new ClickGate();let observed=-Infinity,lastRender=0,hovered=null,chain=[],isFist=false,mode='ui',frameHandle=0,pressed=null,pressTimer=0,acceptedFist=false;
  const coords=()=>({x:current.x*innerWidth,y:current.y*innerHeight});
  const ancestors=el=>{const list=[];for(let n=el;n instanceof Element;n=n.parentElement)list.push(n);return list;};
  function event(el,type,related=null,bubbles=true) {
    const p=coords();const init={bubbles,cancelable:true,clientX:p.x,clientY:p.y,relatedTarget:related,button:0,buttons:type.endsWith('down')?1:0};
    el.dispatchEvent(type.startsWith('pointer')?new PointerEvent(type,{...init,pointerId:71,pointerType:'mouse',isPrimary:true}):new MouseEvent(type,init));
  }
  function hover(el) {
    if(el!==hovered) {
      const previous=hovered,old=chain,next=ancestors(el);
      if(previous) {event(previous,'pointerout',el);event(previous,'mouseout',el);}
      for(const n of old)if(!next.includes(n)){n.classList.remove('bluey-hover');event(n,'pointerleave',el,false);event(n,'mouseleave',el,false);}
      hovered=el;chain=next;
      if(el) {event(el,'pointerover',previous);event(el,'mouseover',previous);}
      for(const n of [...next].reverse())if(!old.includes(n)){n.classList.add('bluey-hover');event(n,'pointerenter',previous,false);event(n,'mouseenter',previous,false);}
    }
    if(el){event(el,'pointermove');event(el,'mousemove');}
  }
  function uiClick() {
    const p=coords(),target=uiTargetAt(p.x,p.y);
    if(!target)return false;
    const {control,hit:el}=target;
    event(el,'pointerdown');event(el,'mousedown');
    pointerNavigation();
    control.focus?.({preventScroll:true});
    event(el,'pointerup');event(el,'mouseup');
    pressed?.classList.remove('bluey-active');pressed=control;pressed.classList.add('bluey-active');
    clearTimeout(pressTimer);pressTimer=setTimeout(()=>{pressed?.classList.remove('bluey-active');pressed=null;},180);
    control.click();return true;
  }
  function updateMode() {
    const p=coords();const game=window.blueyBalloonInput;
    mode=game?.isGameArea(p.x,p.y)?'balloon':'ui';
    const live=performance.now()-observed<=350;
    cursor.hidden=mode==='balloon';
    root.classList.add('bluey-pointer');
    if(mode==='ui'&&live&&!document.hidden)hover(document.elementFromPoint(p.x,p.y));else if(!live||mode==='balloon')hover(null);
    game?.render({...p,mode,live});
  }
  window.addEventListener('bluey:gesture-frame',({detail:{result,now}})=>{
    const fist=hasFist(result),point=openPalmPoint(result);
    if(point||fist)pointerNavigation();
    if(point&&!fist){target=point;observed=now;}
    if(fist&&!isFist)target={...current}; // Hold aim steady while closing the hand.
    isFist=fist;
    const tracked=!!result.landmarks?.length;
    if(tracked)observed=now;
    updateMode();
    const click=gate.update(result,now,!document.hidden);
    window.blueyBalloonInput?.recognition(result);
    if(click){
      if(mode==='balloon') {window.blueyBalloonInput?.click();acceptedFist=true;}
      else acceptedFist=uiClick();
    }
    if(!gate.pressed)acceptedFist=false;
    // Closed artwork confirms an action was dispatched, not just a predicted
    // label. Pending, unarmed and off-target fists no longer imply a click.
    open.hidden=acceptedFist;closed.hidden=!acceptedFist;
    cursor.dataset.clickState=acceptedFist?'pressed':fist?'pending':gate.armed?'ready':'unarmed';
  });
  // A physical mouse can still move the same artwork when camera tracking is absent.
  document.addEventListener('pointermove',e=>{
    if(!e.isTrusted||e.pointerType==='touch'||performance.now()-observed<=350)return;
    current=target={x:e.clientX/innerWidth,y:e.clientY/innerHeight};
    hovered=null;chain.forEach(n=>n.classList.remove('bluey-hover'));chain=[];
  },{passive:true});
  function render(now) {
    const blend=1-Math.exp(-Math.min(100,now-lastRender)/TUNING.smoothingMs);lastRender=now;
    current={x:current.x+(target.x-current.x)*blend,y:current.y+(target.y-current.y)*blend};
    const p=coords();cursor.style.left=`${p.x}px`;cursor.style.top=`${p.y}px`;
    updateMode();frameHandle=requestAnimationFrame(render);
  }
  function clear(){gate.reset();acceptedFist=false;isFist=false;open.hidden=false;closed.hidden=true;observed=-Infinity;hover(null);window.blueyBalloonInput?.clear();}
  window.addEventListener('blur',clear);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
  window.addEventListener('bluey:camera-state',({detail})=>{
    clear();retry.hidden=detail.state!=='error' && detail.state!=='off';
    retry.textContent=detail.message||'Enable hand control';
    retry.title=detail.message||'Enable hand control';
  });
  window.addEventListener('bluey:recognition-state',({detail})=>{
    if(detail.state==='error'){clear();retry.hidden=false;retry.textContent=detail.message||'Enable hand control';}
    if(detail.state==='ready')retry.hidden=true;
  });
  window.addEventListener('pagehide',()=>{
    clear();cancelAnimationFrame(frameHandle);clearTimeout(pressTimer);
    try{sessionStorage.setItem('bluey:pointer',JSON.stringify(current));}catch{}
  });
  window.addEventListener('pageshow',e=>{if(e.persisted){gate.reset();frameHandle=requestAnimationFrame(render);}});
  // Reparent into the fullscreen subtree, so the custom pointer stays visible.
  document.addEventListener('fullscreenchange',()=>{(document.fullscreenElement||document.body).append(cursor,retry);});
  frameHandle=requestAnimationFrame(render);
  void startCamera();
}
