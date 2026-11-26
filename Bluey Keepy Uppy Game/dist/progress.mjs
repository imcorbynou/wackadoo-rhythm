const audio=document.getElementById('music');
const progress=document.querySelector('.song-progress');
const fill=document.getElementById('song-progress-fill');
const gecko=progress.querySelector('.progress-gecko');
let frame=0;
export function updateProgress(){
  const ratio=Number.isFinite(audio.duration)&&audio.duration>0?Math.max(0,Math.min(1,audio.currentTime/audio.duration)):0;
  fill.style.width=`${ratio*100}%`;
  const width=progress.clientWidth,marker=gecko.getBoundingClientRect().width;
  gecko.style.left=`${Math.max(0,Math.min(width-marker,ratio*width-marker/2))}px`;
  progress.setAttribute('aria-valuenow',String(Math.round(ratio*100)));
}
function tick(){updateProgress();frame=audio.paused||audio.ended?0:requestAnimationFrame(tick);}
function refresh(){updateProgress();if(!frame&&!audio.paused&&!audio.ended)frame=requestAnimationFrame(tick);}
for(const event of ['loadedmetadata','durationchange','timeupdate','seeking','seeked','play','pause','ended','emptied'])audio.addEventListener(event,refresh);
new ResizeObserver(updateProgress).observe(progress);
gecko.addEventListener('load',updateProgress);
window.addEventListener('pageshow',refresh);
window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);frame=0;});
updateProgress();
