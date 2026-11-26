const panel = document.getElementById('camera-panel');
const button = document.getElementById('final-save');
const card = document.getElementById('photo-qr-card');
const status = document.getElementById('photo-share-status');
let generation = 0, session = '', sessionTask = Promise.resolve('');
let localURL = '', photoBlob = null;
const online = /^https?:$/.test(location.protocol);

export function resetPhotoSharing() {
  ++generation; session = '';
  if (localURL) URL.revokeObjectURL(localURL);
  localURL = ''; photoBlob = null;
  button.disabled = true; card.classList.remove('is-pinned');
  status.textContent = ''; button.setAttribute('aria-expanded','false');
  // Serialize resets so an old pending request cannot clear a newer session.
  sessionTask = sessionTask.catch(()=>'').then(async () => {
    if (!online) return '';
    try {
      const response = await fetch('/api/photo/session',{method:'POST',cache:'no-store'});
      if (!response.ok) return '';
      session = (await response.json()).session;
      return session;
    } catch { return ''; }
  });
}
function drawElement(ctx,element,base) {
  const rect = element.getBoundingClientRect();
  ctx.drawImage(element,rect.left-base.left,rect.top-base.top,rect.width,rect.height);
}
export async function publishPhoto() {
  const token = generation;
  const photo = document.getElementById('final-photo');
  if (photo.dataset.captured !== 'camera') {
    status.textContent = 'Turn on the camera before playing to save a photo.';
    return;
  }
  try {
    const artwork = [...panel.querySelectorAll('img')].filter(el=>!el.hidden);
    await Promise.all(artwork.map(img=>img.decode()));
    if (token !== generation) return;
    const base = panel.getBoundingClientRect();
    const windowElement = panel.querySelector('.camera-window');
    const windowRect = windowElement.getBoundingClientRect();
    const canvas = document.createElement('canvas');
    const scale = Math.min(3, 1600/base.width);
    canvas.width = Math.round(base.width*scale); canvas.height = Math.round(base.height*scale);
    const ctx = canvas.getContext('2d'); ctx.scale(scale,scale);
    drawElement(ctx,panel.querySelector('.camera-frame'),base);
    const x=windowRect.left-base.left,y=windowRect.top-base.top;
    ctx.save(); ctx.beginPath();
    ctx.roundRect(x,y,windowRect.width,windowRect.height,[windowRect.width*.0843]); ctx.clip();
    ctx.drawImage(photo,x,y,windowRect.width,windowRect.height);
    for (const character of panel.querySelectorAll('.final-character')) if(!character.hidden) drawElement(ctx,character,base);
    ctx.restore();
    const blob = await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if (token !== generation || !blob) return;
    photoBlob = blob; localURL = URL.createObjectURL(blob); button.disabled = false;
    status.textContent = 'Preparing your phone photo…';
    const writerSession = await sessionTask;
    if (token !== generation) return;
    if (!writerSession) throw new Error('no-service');
    const response = await fetch('/api/photo',{method:'PUT',headers:{'Content-Type':'image/png','X-Photo-Session':writerSession},body:blob});
    if (token !== generation) return;
    if (!response.ok) throw new Error('upload');
    status.textContent = 'Scan to save on your phone. Same Wi-Fi required.';
  } catch {
    if (token === generation) status.textContent = photoBlob ? 'Photo ready here. Phone connection is unavailable.' : 'Unable to prepare this photo. Please try playing again.';
  }
}
button.addEventListener('click', () => {
  card.classList.add('is-pinned'); button.setAttribute('aria-expanded','true');
  if (!localURL) return;
  const link = document.createElement('a'); link.href=localURL;link.download='Bluey-and-me.png';document.body.append(link);link.click();link.remove();
});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){card.classList.remove('is-pinned');button.setAttribute('aria-expanded','false');}});
window.addEventListener('pagehide',()=>{
  ++generation;
  if (online && session) navigator.sendBeacon('/api/photo/clear',new Blob([JSON.stringify({session})],{type:'application/json'}));
  if(localURL) URL.revokeObjectURL(localURL);
});
window.addEventListener('pageshow',event=>{if(event.persisted) resetPhotoSharing();});
resetPhotoSharing();
