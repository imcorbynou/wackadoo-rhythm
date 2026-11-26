const video = document.querySelector('#bluey');
const ambient = document.querySelector('#ambient');
const picture = document.querySelector('#picture');
const ctx = ambient.getContext('2d');
const pictureCtx = picture.getContext('2d');
const probe = document.createElement('canvas');
probe.width = 96;
probe.height = 96;
const sample = probe.getContext('2d', {willReadFrequently: true});
const SAMPLE_UNTIL = 40;
let frameId = null, frameKind = '', samplingFailed = false, edge = null;
ambient.width = 8;
ambient.height = 384;

// Reflow the cached palette on resize without reading any new video pixels.
function paintAmbient() {
  if (!ctx || !edge) return;
  const rect = video.getBoundingClientRect();
  if (!rect.height) return;
  for (let y = 0; y < ambient.height; y++) {
    const sourceY = Math.max(0, Math.min(95, ((y * window.innerHeight / ambient.height - rect.top) / rect.height) * 95));
    const lower = Math.floor(sourceY), upper = Math.min(95, lower + 1), mix = sourceY - lower;
    const rgb = edge[lower].map((v,c) => Math.round(v + (edge[upper][c] - v) * mix));
    ctx.fillStyle = `rgb(${rgb.join(',')})`;
    ctx.fillRect(0, y, ambient.width, 1);
  }
}

function renderFrame(mediaTime = video.currentTime) {
  if (video.readyState < 2) return;
  try {
    // Keep rendering the moving picture after 40 seconds. Only the background
    // sampling stops; freezing this foreground canvas would freeze the video.
    if (pictureCtx) {
      const width = Math.min(960, video.videoWidth);
      const height = Math.round(width * video.videoHeight / video.videoWidth);
      if (picture.width !== width || picture.height !== height) {picture.width = width; picture.height = height;}
      pictureCtx.drawImage(video, 0, 0, width, height);
      video.parentElement.classList.add('canvas-ready');
    }
    // mediaTime resets naturally on every loop, reopening the 0–40s window.
    const active = mediaTime < SAMPLE_UNTIL;
    ambient.dataset.sampling = active ? 'active' : 'frozen';
    if (!active || samplingFailed || !ctx || !sample) return;
    sample.drawImage(pictureCtx ? picture : video, 0, 0, 96, 96);
    const pixels = sample.getImageData(0, 0, 96, 96).data;
    edge = [];
    for (let y = 0; y < 96; y++) {
      edge.push([0, 1, 2].map(channel => {
        const values = [92, 93, 94, 95].map(x => pixels[(y * 96 + x) * 4 + channel]).sort((a,b) => a-b);
        return (values[1] + values[2]) / 2;
      }));
    }
    ambient.dataset.sampleTime = String(mediaTime);
    paintAmbient();
  } catch (error) {
    samplingFailed = true;
    video.parentElement.classList.remove('canvas-ready');
    console.warn('Video background sampling unavailable:', error);
  }
}
function cancelFrame() {
  if (frameId !== null) {
    if (frameKind === 'video') video.cancelVideoFrameCallback(frameId);
    else cancelAnimationFrame(frameId);
    frameId = null;
  }
}
function scheduleFrame() {
  cancelFrame();
  if (video.paused || document.hidden) return;
  if ('requestVideoFrameCallback' in video) {
    frameKind = 'video';
    frameId = video.requestVideoFrameCallback((now, metadata) => {frameId = null; renderFrame(metadata.mediaTime); scheduleFrame();});
  } else {
    frameKind = 'animation';
    frameId = requestAnimationFrame(() => {frameId = null; renderFrame(); scheduleFrame();});
  }
}
async function startPlayback() {
  try { await video.play(); }
  catch { /* Browser policy may require a click anywhere to start playback. */ }
}
video.addEventListener('loadeddata', () => {renderFrame(); startPlayback();});
video.addEventListener('play', scheduleFrame);
video.addEventListener('pause', () => {cancelFrame(); renderFrame();});
video.addEventListener('seeked', () => {renderFrame(); scheduleFrame();});
video.addEventListener('error', cancelFrame);
document.addEventListener('visibilitychange', () => document.hidden ? cancelFrame() : (renderFrame(), scheduleFrame()));
window.addEventListener('resize', paintAmbient);
window.addEventListener('pagehide', cancelFrame);
window.addEventListener('pageshow', () => {renderFrame(); scheduleFrame();});
// Background stays silent; song audio is owned by the music player.
video.parentElement.addEventListener('click', startPlayback);
video.muted = true;
if (video.readyState >= 2) {renderFrame(); startPlayback();}
