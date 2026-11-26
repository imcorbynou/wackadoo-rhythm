import { toggleFullscreen, observeFullscreen } from '/shared/fullscreen.mjs';

const introduction = document.querySelector('#introduction');
const homepage = document.querySelector('#homepage');
const closeIntroduction = document.querySelector('#closeIntroduction');
const fullscreen = document.querySelector('#fullscreen');
const fullscreenStatus = document.querySelector('#fullscreenStatus');
const introKey='bluey:homepage-instructions-dismissed';
try {
  if(sessionStorage.getItem(introKey)==='yes'){
    introduction.hidden=true;
    homepage.inert=false;
  }
}catch{}


closeIntroduction.addEventListener('click', () => {
  try{sessionStorage.setItem(introKey,'yes');}catch{}
  introduction.hidden = true;
  homepage.inert = false;
  document.querySelector('.game-card').focus({ preventScroll: true });
  document.dispatchEvent(new Event('bluey:introduction-dismissed'));
});
// Keep the introductory gate open until its close button is activated.
document.addEventListener('keydown', event => {
  if (!introduction.hidden && event.key === 'Tab') {
    event.preventDefault();
    closeIntroduction.focus({ preventScroll: true });
  }
});
if(!introduction.hidden)closeIntroduction.focus({ preventScroll: true });

fullscreen.addEventListener('click', async () => {
  try {
    fullscreenStatus.hidden = true;
    await toggleFullscreen();
  } catch {
    fullscreenStatus.textContent = 'Use your mouse to click the fullscreen button.';
    fullscreenStatus.hidden = false;
  }
});
observeFullscreen(active => {
  fullscreen.setAttribute('aria-label', active ? 'Exit fullscreen' : 'Enter fullscreen');
  fullscreen.setAttribute('aria-pressed', String(active));
});

// Local server routes; file:// also retains working relative links in the HTML.
if (location.protocol !== 'file:') {
  document.querySelectorAll('[data-route]').forEach(link => { link.href = link.dataset.route; });
}

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

// Two decoders alternate. The outgoing frame stays visible until the incoming
// decoder presents a real frame; seeking the hidden decoder never flashes black.
function createLoop(windowElement) {
  const videos = [...windowElement.querySelectorAll('video')];
  let active = 0;
  let switching = false;
  let generation = 0;
  let frameHandle;
  let timer;
  let swaps = 0;
  const running = () => introduction.hidden && !document.hidden && !reducedMotion.matches;

  for (const video of videos) {
    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;
    video.src = windowElement.dataset.loop;
    video.load();
  }

  function schedule() {
    const video = videos[active];
    if (!running()) return;
    if ('requestVideoFrameCallback' in video) {
      frameHandle = video.requestVideoFrameCallback((_now, metadata) => {
        if (video !== videos[active]) return;
        if (video.duration - metadata.mediaTime <= .055) swap();
        else schedule();
      });
    } else {
      timer = setTimeout(() => {
        if (video.duration - video.currentTime <= .055) swap();
        else schedule();
      }, 20);
    }
  }

  async function swap() {
    if (switching || !running()) return;
    switching = true;
    const token = generation;
    const old = videos[active];
    const next = videos[1 - active];
    // If buffering is slow, retain the previous visible frame until ready.
    try {
      await next.play();
      if (token !== generation || !running()) { next.pause(); switching = false; return; }
      const present = () => {
        if (token !== generation || !running()) { next.pause(); switching = false; return; }
        next.classList.add('is-active');
        old.classList.remove('is-active');
        old.pause();
        old.currentTime = 0;
        active = 1 - active;
        windowElement.dataset.loops = String(++swaps);
        switching = false;
        schedule();
      };
      if ('requestVideoFrameCallback' in next) next.requestVideoFrameCallback(present);
      else requestAnimationFrame(() => requestAnimationFrame(present));
    } catch { switching = false; }
  }

  videos.forEach(video => video.addEventListener('ended', () => {
    if (video === videos[active]) swap();
  }));

  async function resume() {
    if (!running()) return;
    try { await videos[active].play(); schedule(); } catch { /* Poster remains available. */ }
  }
  function update() {
    generation++;
    switching = false;
    clearTimeout(timer);
    if (frameHandle !== undefined) videos[active].cancelVideoFrameCallback?.(frameHandle);
    videos.forEach(video => video.pause());
    // A paused tab must not leave the standby decoder halfway through a loop.
    videos[1 - active].currentTime = 0;
    resume();
  }
  document.addEventListener('bluey:introduction-dismissed', update);
  document.addEventListener('visibilitychange', update);
  reducedMotion.addEventListener('change', update);
  window.addEventListener('pageshow', update);
  // Recover muted autoplay on browsers that require an initial interaction.
  document.addEventListener('pointerdown', () => {
    if (videos[active].paused && running()) resume();
  }, { passive: true });
  resume();
}

document.querySelectorAll('[data-loop]').forEach(createLoop);
