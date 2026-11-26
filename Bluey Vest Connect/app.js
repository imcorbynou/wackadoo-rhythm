// Timed visual connection demo. No Bluetooth device is paired by this page.
const CONNECT_DELAY = 7000;
const SUCCESS_DELAY = 5000;
const panel = document.querySelector('.connection');
const button = document.querySelector('.connect-button');
const success = document.querySelector('.success-button');
const status = document.querySelector('[role="status"]');
const background = document.querySelector('.background');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let connectTimer;
let redirectTimer;

function gameURL() {
  return location.protocol === 'file:'
    ? new URL('../Bluey%20Keepy%20Uppy%20Game/dist/index.html', location.href).href
    : new URL('/keepy-uppy/', location.href).href;
}
function reset() {
  clearTimeout(connectTimer);
  clearTimeout(redirectTimer);
  panel.dataset.state = 'idle';
  button.disabled = false;
  button.setAttribute('aria-label', 'Connect vest');
  button.removeAttribute('aria-busy');
  success.setAttribute('aria-hidden', 'true');
  status.textContent = '';
}
button.addEventListener('click', () => {
  if (panel.dataset.state !== 'idle') return;
  panel.dataset.state = 'connecting';
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  button.setAttribute('aria-label', 'Connecting vest');
  status.textContent = 'Connecting vest.';
  connectTimer = setTimeout(() => {
    panel.dataset.state = 'connected';
    button.removeAttribute('aria-busy');
    success.removeAttribute('aria-hidden');
    status.textContent = 'Vest connected. Keepy Uppy will open in 5 seconds.';
    redirectTimer = setTimeout(() => location.assign(gameURL()), SUCCESS_DELAY);
  }, CONNECT_DELAY);
});
function updateBackground() {
  if (document.hidden || reducedMotion.matches) background.pause();
  else background.play().catch(() => {});
}
document.addEventListener('visibilitychange', updateBackground);
reducedMotion.addEventListener('change', updateBackground);
window.addEventListener('pagehide', () => { clearTimeout(connectTimer); clearTimeout(redirectTimer); });
window.addEventListener('pageshow', () => { reset(); updateBackground(); });
updateBackground();
