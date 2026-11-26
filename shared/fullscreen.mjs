// Fullscreen belongs to the persistent outer page, so game navigation cannot end it.
export function fullscreenDocument(view = window) {
  try {
    if (view.parent !== view && view.parent.document.documentElement.dataset.blueyShell === 'true') {
      return view.parent.document;
    }
  } catch { /* Standalone pages and cross-origin embeds use their own document. */ }
  return view.document;
}

export function isFullscreen() {
  return Boolean(fullscreenDocument().fullscreenElement);
}

export function toggleFullscreen() {
  const owner = fullscreenDocument();
  // Called directly from the click handler to retain the browser's user activation.
  return owner.fullscreenElement ? owner.exitFullscreen() : owner.documentElement.requestFullscreen();
}

export function observeFullscreen(callback) {
  const owner = fullscreenDocument();
  const notify = () => callback(Boolean(owner.fullscreenElement));
  const subscribe = () => { owner.addEventListener('fullscreenchange', notify); notify(); };
  subscribe();
  window.addEventListener('pagehide', () => owner.removeEventListener('fullscreenchange', notify));
  window.addEventListener('pageshow', subscribe);
}
