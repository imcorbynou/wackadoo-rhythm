import { resolveView } from './site-route.mjs';

const base = new URL('../', import.meta.url);
if (window.top !== window) {
  // A game's Home link navigates its frame to the root; avoid nesting players.
  location.replace(new URL('home/', base).href);
} else {
  const frame = document.getElementById('game-view');
  frame.src = resolveView(new URL(location.href).searchParams.get('view'), base).href;
  frame.addEventListener('load', () => {
    try {
      const current = new URL(frame.contentWindow.location.href);
      if (current.origin !== base.origin || !current.pathname.startsWith(base.pathname)) return;
      const route = current.pathname.slice(base.pathname.length) + current.search + current.hash;
      const address = new URL(base);
      if (route !== 'home/' && route !== 'home/index.html') address.searchParams.set('view', route);
      // Child navigation supplies the browser's Back/Forward history. Only sync its shareable address.
      history.replaceState(null, '', address);
      document.title = frame.contentDocument.title || document.title;
    } catch { /* Do not inspect a frame that has left this origin. */ }
  });
}
