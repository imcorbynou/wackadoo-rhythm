// One silent decoder supplies both sliding halves, keeping the pattern in sync.
const video = document.getElementById('final-background-video');
const canvases = [...document.querySelectorAll('.final-background canvas')];
const contexts = canvases.map(canvas => canvas.getContext('2d', { alpha: false }));
const probe = document.createElement('canvas');
probe.width = 24; probe.height = 14;
const pixels = probe.getContext('2d', { willReadFrequently: true });
let active = false, running = false, callback = null;
function mute() {
  video.defaultMuted = true; video.muted = true; video.volume = 0; video.controls = false;
}
mute(); video.loop = true;
video.addEventListener('volumechange', () => { if (!video.muted || video.volume !== 0) mute(); });
video.addEventListener('contextmenu', event => event.preventDefault());
function draw() {
  if (video.readyState < 2 || video.seeking || !video.videoWidth) return;
  pixels.drawImage(video, 0, 0, 24, 14);
  const data = pixels.getImageData(0, 0, 24, 14).data;
  let visible = 0;
  for (let i = 0; i < data.length; i += 4) if (Math.max(data[i], data[i+1], data[i+2]) > 20) visible++;
  // Never clear a good frame at a loop boundary or replace it with a black frame.
  if (visible < 3) return;
  canvases.forEach((canvas, index) => {
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    }
    contexts[index].drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.dataset.ready = 'true';
  });
}
function next() {
  if (!running) return;
  callback = video.requestVideoFrameCallback ? video.requestVideoFrameCallback(frame) : requestAnimationFrame(frame);
}
function frame() { if (running) { draw(); next(); } }
function pause() {
  running = false;
  if (callback !== null) {
    if (video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(callback);
    else cancelAnimationFrame(callback);
    callback = null;
  }
  video.pause();
}
export function startFinalBackground() {
  active = true;
  if (document.hidden) return;
  mute(); draw();
  if (!running) { running = true; next(); }
  void video.play().catch(() => { /* Retain the previous frame until playback is allowed. */ });
}
export function stopFinalBackground() { active = false; pause(); }
video.addEventListener('loadeddata', () => { draw(); if (active) startFinalBackground(); });
video.addEventListener('ended', () => { if (active) { video.currentTime = 0; startFinalBackground(); } });
window.addEventListener('pointerdown', () => { if (active && video.paused) startFinalBackground(); }, {passive:true});
window.addEventListener('pagehide', pause);
window.addEventListener('pageshow', () => { if (active) startFinalBackground(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause(); else if (active) startFinalBackground();
});
