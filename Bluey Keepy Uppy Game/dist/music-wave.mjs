import {game} from './game.mjs';
const audio=document.getElementById('music'),canvas=document.getElementById('music-wave');
const ctx=canvas.getContext('2d');
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const idle=[.52,.72,.42,.84,.47,.64,.84,.46,.70,.51,.84,.72,.44,.70,.55,.42];
const levels=[...idle];
let width=0,height=0,frame=0,last=0,frequency,timeDomain;
export function getWaveLevels(){return [...levels];}
function paint(now){
  frame=0;
  const dt=Math.max(0,Math.min((now-last)/1000||.016,.05));last=now;
  const analyser=game.musicAnalyser;
  const moving=!audio.paused&&!audio.ended&&!document.hidden&&!reducedMotion.matches&&analyser?.context.state==='running';
  if(moving){
    if(!frequency||frequency.length!==analyser.frequencyBinCount){frequency=new Uint8Array(analyser.frequencyBinCount);timeDomain=new Float32Array(analyser.fftSize);}
    analyser.getByteFrequencyData(frequency);analyser.getFloatTimeDomainData(timeDomain);
    let rms=0;for(const sample of timeDomain)rms+=sample*sample;
    rms=Math.min(1,Math.sqrt(rms/timeDomain.length)*3.2);
    const hz=analyser.context.sampleRate/analyser.fftSize;
    for(let i=0;i<levels.length;i++){
      const low=45*Math.pow(12000/45,i/levels.length),high=45*Math.pow(12000/45,(i+1)/levels.length);
      const a=Math.max(1,Math.floor(low/hz)),b=Math.min(frequency.length-1,Math.ceil(high/hz));
      let energy=0;for(let bin=a;bin<=b;bin++)energy+=frequency[bin]/255;
      energy=b>=a?Math.min(1,energy/(b-a+1)*1.35):0;
      const target=.1+Math.min(1,energy*.78+rms*.3)*.84;
      levels[i]+=(target-levels[i])*(1-Math.exp(-dt*(target>levels[i]?22:9)));
    }
  }else{levels.splice(0,levels.length,...idle);}
  ctx.clearRect(0,0,width,height);ctx.fillStyle='#fff';
  const step=width/levels.length,barWidth=step*.70;
  levels.forEach((level,i)=>{
    const h=Math.max(barWidth,level*height),x=i*step+(step-barWidth)/2;
    ctx.beginPath();ctx.roundRect(x,(height-h)/2,barWidth,h,barWidth/2);ctx.fill();
  });
  if(moving)frame=requestAnimationFrame(paint);
}
function refresh(){cancelAnimationFrame(frame);last=performance.now();paint(last);}
function resize(){
  const r=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
  width=r.width;height=r.height;canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);refresh();
}
new ResizeObserver(resize).observe(canvas);
for(const event of ['play','playing','pause','ended','seeked','loadeddata'])audio.addEventListener(event,refresh);
document.addEventListener('visibilitychange',refresh);
reducedMotion.addEventListener('change',refresh);
window.addEventListener('pageshow',refresh);
window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);frame=0;});
resize();
