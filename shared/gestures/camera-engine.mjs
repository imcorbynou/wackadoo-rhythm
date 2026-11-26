import { TUNING } from './input-core.mjs';
let stream=null, opening=null, generation=0, recognizer=null, loop=0, lastTime=-1, lastInference=-Infinity;
let video=null, canvas=null, context=null;
let state={state:'off',stream:null,message:''};
export const cameraState=()=>state;
const emit=(name,detail)=>window.dispatchEvent(new CustomEvent(name,{detail}));
function publish(value,message='') { state={state:value,stream,message};emit('bluey:camera-state',state); }
function supportsCamera() { return window.isSecureContext && !!navigator.mediaDevices?.getUserMedia; }
function stopTracks(media) { media?.getTracks().forEach(t=>t.stop()); }
export function stopCamera() {
  ++generation; opening=null; cancelAnimationFrame(loop);
  stopTracks(stream);stream=null;
  if(video) { video.pause();video.srcObject=null; }
  publish('off');emit('bluey:recognition-state',{state:'off'});
}
function errorMessage(error) {
  if (['NotAllowedError','SecurityError'].includes(error.name)) return 'Allow camera access, then enable hand control. Use localhost or HTTPS.';
  if(error.name==='NotFoundError') return 'Connect a camera, then enable hand control.';
  return 'Hand control is unavailable. Try enabling it again.';
}
function infer(now) {
  if(!stream || !recognizer) return;
  if(!document.hidden && video.readyState>=2 && video.currentTime!==lastTime && now-lastInference>=TUNING.inferenceIntervalMs) {
    lastTime=video.currentTime;lastInference=now;
    try {
      const size=Math.min(video.videoWidth,video.videoHeight);
      context.save();context.translate(400,0);context.scale(-1,1);
      context.drawImage(video,(video.videoWidth-size)/2,(video.videoHeight-size)/2,size,size,0,0,400,400);context.restore();
      const result=recognizer.recognizeForVideo(canvas,now);
      emit('bluey:gesture-frame',{result,now:performance.now()});
    } catch(error) {
      stopCamera();publish('error',errorMessage(error));emit('bluey:recognition-state',{state:'error',message:errorMessage(error)});return;
    }
  }
  loop=requestAnimationFrame(infer);
}
export function startCamera() {
  if(opening) return opening;
  if(stream && state.state==='on') return Promise.resolve(stream);
  const token=++generation;
  publish('opening');
  opening=(async()=>{
    let candidate=null;
    try {
      if(!supportsCamera()) throw Object.assign(new Error(),{name:'SecurityError'});
      candidate=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:'user',width:{ideal:1280},height:{ideal:720}}});
      if(token!==generation) {stopTracks(candidate);return null;}
      stream=candidate;
      if(!video) {
        video=document.createElement('video');video.muted=true;video.playsInline=true;
        video.setAttribute('aria-hidden','true');video.style.cssText='position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;bottom:0';
        document.body.append(video);
        canvas=document.createElement('canvas');canvas.width=canvas.height=400;context=canvas.getContext('2d');
      }
      video.srcObject=stream;await video.play();
      if(token!==generation) {stopTracks(candidate);return null;}
      candidate.getVideoTracks().forEach(track=>track.addEventListener('ended',()=>{if(stream===candidate)stopCamera();},{once:true}));
      publish('on');emit('bluey:recognition-state',{state:'loading'});
      const {loadGestureModel}=await import('/keepy-uppy/gesture-model.mjs');
      const loaded=await loadGestureModel();
      if(token!==generation)return null;
      recognizer=loaded.model;lastTime=-1;lastInference=-Infinity;
      emit('bluey:recognition-state',{state:'ready'});
      cancelAnimationFrame(loop);loop=requestAnimationFrame(infer);
      return stream;
    } catch(error) {
      if(token===generation) {
        stopTracks(candidate);stream=null;if(video)video.srcObject=null;
        publish('error',errorMessage(error));emit('bluey:recognition-state',{state:'error',message:errorMessage(error)});
        console.error('Bluey hand control:',error);
      } else stopTracks(candidate);
      return null;
    } finally { if(token===generation) opening=null; }
  })();
  return opening;
}
window.addEventListener('pagehide',stopCamera);
window.addEventListener('pageshow',event=>{if(event.persisted)void startCamera();});
