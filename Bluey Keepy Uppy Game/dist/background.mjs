// Decorative video only. Its playback is independent of the game's music/transport.
const video = document.getElementById('background-video');
const canvas = document.getElementById('background-canvas');
const context = canvas.getContext('2d', { alpha: false });
const probe = document.createElement('canvas');
probe.width = 24;
probe.height = 14;
const probeContext = probe.getContext('2d', { willReadFrequently: true });
let callback = null;
let running = false;

function mute() {
  video.defaultMuted = true;
  video.muted = true;
  video.volume = 0;
  video.controls = false;
}
mute();
video.loop = true;
video.disablePictureInPicture = true;
video.disableRemotePlayback = true;
video.addEventListener('volumechange', () => { if (!video.muted || video.volume !== 0) mute(); });
video.addEventListener('contextmenu', event => event.preventDefault());

function draw() {
  if (video.readyState < 2 || video.seeking || !video.videoWidth) return;
  // Skip empty/black decoder frames at the seam, retaining the previous image.
  probeContext.drawImage(video, 0, 0, probe.width, probe.height);
  const pixels = probeContext.getImageData(0, 0, probe.width, probe.height).data;
  let visible = 0;
  for (let i = 0; i < pixels.length; i += 4) if (Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) > 20) visible++;
  if (visible < 3) return;
  if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  canvas.dataset.ready = 'true';
}
function next() {
  if (!running) return;
  callback = video.requestVideoFrameCallback ? video.requestVideoFrameCallback(frame) : requestAnimationFrame(frame);
}
function frame() { if (!running) return; draw(); next(); }
function start() {
  if (!running) { running = true; next(); }
  mute();
  void video.play().catch(() => { /* Keep the last frame/poster until playback is permitted. */ });
}
function stop() {
  running = false;
  if (callback !== null) {
    if (video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(callback);
    else cancelAnimationFrame(callback);
  }
  video.pause();
}
video.addEventListener('ended', () => { video.currentTime = 0; start(); });
video.addEventListener('loadeddata', start);
window.addEventListener('pointerdown', () => { if (video.paused) start(); }, { passive: true });
window.addEventListener('pagehide', stop);
window.addEventListener('pageshow', start);
document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });
start();
