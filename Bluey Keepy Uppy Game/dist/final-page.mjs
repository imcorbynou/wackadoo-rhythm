import { resetPhotoSharing, publishPhoto } from './photo-share.mjs';
import { finalGrade } from './core.mjs';
export { finalGrade } from './core.mjs';
import { startFinalBackground, stopFinalBackground } from './final-background.mjs';
const stage = document.getElementById('stage');
const panel = document.getElementById('camera-panel');
const video = document.getElementById('camera-video');
const photoWindow = panel.querySelector('.camera-window');
const root = document.getElementById('final-page');
const countdown = document.getElementById('photo-countdown');
const photo = document.getElementById('final-photo');
const results = document.getElementById('final-results');
let revision = 0;
let replay = () => {}, home = () => {};
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
function capturePhoto() {
  const rect = photoWindow.getBoundingClientRect();
  const scale = Math.min(devicePixelRatio || 1, 2);
  photo.width = Math.max(1, Math.round(rect.width * scale));
  photo.height = Math.max(1, Math.round(rect.height * scale));
  const ctx = photo.getContext('2d');
  ctx.fillStyle = '#d9d9d9'; ctx.fillRect(0, 0, photo.width, photo.height);
  const hasCamera = panel.dataset.state === 'on' && video.readyState >= 2 && video.videoWidth > 0;
  if (hasCamera) {
    // Match the mirrored, object-fit:cover live preview exactly.
    const factor = Math.max(photo.width / video.videoWidth, photo.height / video.videoHeight);
    const sw = photo.width / factor, sh = photo.height / factor;
    ctx.save(); ctx.translate(photo.width, 0); ctx.scale(-1, 1);
    ctx.drawImage(video, (video.videoWidth-sw)/2, (video.videoHeight-sh)/2, sw, sh, 0, 0, photo.width, photo.height);
    ctx.restore();
  }
  photo.hidden = false;
  photo.dataset.captured = hasCamera ? 'camera' : 'placeholder';
  panel.classList.add('photo-taken');
}
export function resetFinalPage() {
  resetPhotoSharing();
  stopFinalBackground();
  ++revision;
  stage.classList.remove('final-active', 'final-background-in', 'final-characters-in', 'final-results-in');
  document.querySelector('.game-hud').append(panel);
  panel.classList.remove('final-camera', 'photo-taken');
  panel.querySelectorAll('.final-character').forEach(el => { el.hidden = true; });
  panel.getAnimations().forEach(a => a.cancel());
  photo.hidden = true;
  photo.width = 0; photo.height = 0;
  delete photo.dataset.captured;
  countdown.textContent = '';
  countdown.hidden = true;
  root.hidden = true;
  results.hidden = true;
  document.getElementById('final-replay').disabled = true;
  document.getElementById('final-home').disabled = true;
}
export async function showFinalPage({hits, total, onReplay, onHome}) {
  resetFinalPage();
  const token = revision;
  replay = onReplay; home = onHome;
  const from = panel.getBoundingClientRect();
  // Reserve the finished layout before measuring the animation destination.
  document.getElementById('final-grade').textContent = finalGrade(hits, total);
  document.getElementById('final-message').textContent = `Great job! You kept ${hits} balloons in the air!`;
  results.hidden = false;
  root.hidden = false;
  startFinalBackground();
  stage.classList.add('final-active');
  document.getElementById('final-camera-slot').append(panel);
  panel.classList.add('final-camera');
  const to = panel.getBoundingClientRect();
  const move = panel.animate([
    { transform: `translate(${from.left-to.left}px,${from.top-to.top}px) scale(${from.width/to.width})` },
    { transform: 'translate(0,0) scale(1)' },
  ], {duration: reduced ? 0 : 850, easing:'cubic-bezier(.22,.7,.25,1)', transformOrigin:'top left'});
  await move.finished.catch(() => {});
  if (token !== revision) return;
  stage.classList.add('final-background-in');
  await wait(reduced ? 0 : 750);
  if (token !== revision) return;
  panel.querySelectorAll('.final-character').forEach(el => { el.hidden = false; });
  stage.classList.add('final-characters-in');
  await wait(reduced ? 0 : 550);
  if (token !== revision) return;
  countdown.hidden = false;
  for (const number of ['3','2','1']) {
    if (token !== revision) return;
    countdown.textContent = number;
    countdown.animate([{transform:'scale(.65)',opacity:0},{transform:'scale(1.08)',opacity:1},{transform:'scale(1)',opacity:1}], {duration: reduced ? 0 : 350, fill:'both'});
    await wait(1000);
  }
  if (token !== revision) return;
  capturePhoto();
  countdown.textContent = '';
  countdown.hidden = true;
  document.getElementById('final-flash').animate([{opacity:.85},{opacity:0}], {duration:reduced ? 0 : 350});
  await wait(400);
  if (token !== revision) return;
  document.getElementById('final-grade').textContent = finalGrade(hits, total);
  document.getElementById('final-message').textContent = `Great job! You kept ${hits} balloons in the air!`;
  results.hidden = false;
  stage.classList.add('final-results-in');
  document.getElementById('final-replay').disabled = false;
  document.getElementById('final-home').disabled = false;
  void publishPhoto();
}
document.getElementById('final-replay').addEventListener('click', () => replay());
document.getElementById('final-home').addEventListener('click', () => home());
