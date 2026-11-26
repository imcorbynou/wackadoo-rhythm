import {setPlayArea} from './play-area.mjs';
const stage=document.getElementById('stage'),zone=document.getElementById('play-zone');
let previous='';
function update(){
  const stageRect=stage.getBoundingClientRect(),rect=zone.getBoundingClientRect();
  if(!stageRect.width||!stageRect.height)return;
  const bounds={left:(rect.left-stageRect.left)/stageRect.width*100,right:(rect.right-stageRect.left)/stageRect.width*100,
    top:(rect.top-stageRect.top)/stageRect.height*100,bottom:(rect.bottom-stageRect.top)/stageRect.height*100};
  const key=JSON.stringify(bounds);if(key===previous)return;previous=key;
  setPlayArea(bounds,stageRect.width/stageRect.height);
  window.dispatchEvent(new CustomEvent('keepy:layout'));
}
new ResizeObserver(update).observe(stage);
new ResizeObserver(update).observe(zone);
window.addEventListener('fullscreenchange',update);update();
