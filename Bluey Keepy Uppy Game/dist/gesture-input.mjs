import {containsPoint} from './play-area.mjs';
import { game } from './game.mjs';
import { touchingBalloon,gestureSummary } from './gesture-core.mjs';
const stage=document.getElementById('stage'),panel=document.getElementById('camera-panel');
const hint=document.getElementById('gesture-status'),cursor=document.getElementById('gesture-cursor');
const still=document.getElementById('gesture-hold'),push=document.getElementById('gesture-push');
let pointer={x:innerWidth*.5,y:innerHeight*.7},hover=null,gifBlob=null,gifURL=null,animationTimer=0,animationId=0;
function clearHover(){hover?.element.classList.remove('gesture-hover');hover=null;}
function resetAnimation(){
  ++animationId;clearTimeout(animationTimer);push.onload=push.onerror=null;push.hidden=true;still.hidden=false;
  push.removeAttribute('src');if(gifURL)URL.revokeObjectURL(gifURL);gifURL=null;
}
function animateClick(){
  resetAnimation();if(!gifBlob)return;const id=animationId;gifURL=URL.createObjectURL(gifBlob);
  push.onload=()=>{if(id!==animationId)return;still.hidden=true;push.hidden=false;animationTimer=setTimeout(resetAnimation,720);};
  push.onerror=()=>{if(id===animationId)resetAnimation();};push.src=gifURL;
}
fetch(new URL('assets/push%20the%20ballon.gif',import.meta.url)).then(r=>{if(!r.ok)throw new Error('Missing balloon gesture GIF');return r.blob();}).then(blob=>{gifBlob=blob;}).catch(console.error);
function contact(){
  if(game.phase!=='reply'||game.paused)return null;
  return touchingBalloon(pointer,cursor.clientWidth,game.balloons.filter(b=>b.note.result===null&&!b.element.disabled)
    .map(b=>({balloon:b,rect:b.element.getBoundingClientRect()})))?.balloon??null;
}
function inRect(rect,x,y){return x>=rect.left&&x<=rect.right&&y>=rect.top&&y<=rect.bottom;}
export function isGameArea(x,y){
  if(game.paused||!['intro','listen','reply','result'].includes(game.phase)||!document.getElementById('overlay').hidden||stage.classList.contains('final-active'))return false;
  const bounds=stage.getBoundingClientRect();
  if(!inRect(bounds,x,y)||!containsPoint((x-bounds.left)/bounds.width*100,(y-bounds.top)/bounds.height*100))return false;
  // Header and camera preview have transparent/pointer-events:none artwork;
  // use their visual bounds as well as hit testing to keep ALL HUD areas UI.
  for(const el of stage.querySelectorAll('.phase-header,.camera-panel')) {
    if(getComputedStyle(el).visibility!=='hidden'&&inRect(el.getBoundingClientRect(),x,y))return false;
  }
  const el=document.elementFromPoint(x,y);
  return !el?.closest('button:not(.balloon),a,input,[role="dialog"],.final-results,#bluey-hand-retry');
}
window.blueyBalloonInput={
  isGameArea,
  render({x,y,mode,live}){
    pointer={x,y};const bounds=stage.getBoundingClientRect();
    cursor.style.left=`${x-bounds.left}px`;cursor.style.top=`${y-bounds.top}px`;
    cursor.hidden=mode!=='balloon';
    const next=mode==='balloon'&&live?contact():null;
    if(next!==hover){clearHover();hover=next;hover?.element.classList.add('gesture-hover');}
    if(mode!=='balloon'&&gifURL)resetAnimation();
  },
  recognition(result){
    panel.dataset.hands=String(result.landmarks?.length??0);hint.textContent=gestureSummary(result);
    window.dispatchEvent(new CustomEvent('keepy:gestures',{detail:result}));
  },
  click(){animateClick();const balloon=contact();if(balloon){game.hit(balloon.color,balloon.index);clearHover();}},
  clear(){clearHover();resetAnimation();},
};
cursor.hidden=true;
window.addEventListener('bluey:recognition-state',({detail})=>{
  panel.dataset.gesture=detail.state;stage.dataset.gestureInput=detail.state==='ready'?'on':'off';
  if(detail.state==='off'||detail.state==='error'){clearHover();resetAnimation();hint.textContent=detail.message||'';}
});
window.addEventListener('pagehide',()=>{clearHover();resetAnimation();});
