// The preview, global UI pointer and balloon gestures share one camera stream.
import {startCamera,cameraState} from '/shared/gestures/camera-engine.mjs';
const panel=document.getElementById('camera-panel'),video=document.getElementById('camera-video');
const status=document.getElementById('camera-status');
function update({state,stream,message}){
  panel.dataset.state=state;status.textContent=message||(state==='opening'?'Allow camera access in your browser…':'Camera is off');
  status.hidden=state==='on';video.hidden=state!=='on';
  if(video.srcObject!==stream){video.srcObject=stream;if(stream)video.play().catch(console.error);}
  window.dispatchEvent(new CustomEvent('keepy:camera',{detail:{active:state==='on'}}));
}
window.addEventListener('bluey:camera-state',({detail})=>update(detail));
update(cameraState());
void startCamera();
