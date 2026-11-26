const image = document.getElementById('photo');
const placeholder = document.getElementById('photo-placeholder');
const button = document.getElementById('save-photo');
const status = document.getElementById('photo-status');
let blob = null, objectURL = '', currentId = '', pending = false;
function clear() {
  image.hidden = true; image.removeAttribute('src'); placeholder.hidden = false;
  button.disabled = true; blob = null; currentId = '';
  if (objectURL) URL.revokeObjectURL(objectURL);
  objectURL = '';
}
async function refresh() {
  if (pending || document.hidden || !/^https?:$/.test(location.protocol)) return;
  pending = true;
  try {
    const response = await fetch('/api/photo', {cache:'no-store'});
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error();
    const data = await response.json();
    if (!data.id) { clear(); status.textContent = 'Waiting for your photo…'; return; }
    if (data.id === currentId) return;
    const download = await fetch(data.imageUrl,{cache:'no-store'});
    if (!download.ok) { clear(); return; }
    const nextBlob = await download.blob();
    const nextURL = URL.createObjectURL(nextBlob);
    const probe = new Image(); probe.src = nextURL;
    try { await probe.decode(); } catch (error) { URL.revokeObjectURL(nextURL); throw error; }
    clear(); blob = nextBlob; objectURL = nextURL; currentId = data.id;
    image.src = objectURL; image.hidden = false; placeholder.hidden = true;
    button.disabled = false; status.textContent = 'Your photo is ready!';
  } catch { clear(); status.textContent = 'Reconnecting to your photo…'; }
  finally { pending = false; }
}
button.addEventListener('click', async () => {
  if (!blob) return;
  const file = new File([blob], 'Bluey-and-me.png', {type:'image/png'});
  // On phones, the share sheet includes the platform's Save Image action.
  if (navigator.canShare?.({files:[file]})) {
    try { await navigator.share({files:[file],title:'My Bluey photo'}); return; }
    catch (error) { if (error.name === 'AbortError') return; }
  }
  const link = document.createElement('a');
  link.href = objectURL; link.download = 'Bluey-and-me.png'; document.body.append(link); link.click(); link.remove();
  status.textContent = 'If the photo opens, touch and hold it to save.';
});
let timer;
function start() { clearInterval(timer); timer = setInterval(refresh,1500); refresh(); }
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
window.addEventListener('pagehide', () => { clearInterval(timer); clear(); });
window.addEventListener('pageshow',start);
start();
