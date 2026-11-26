// Direct links also enter the persistent player. Normal iframe navigation stays put.
if (window.top === window) {
  const base = new URL('../', document.currentScript.src);
  const destination = new URL(base);
  destination.searchParams.set('view', location.pathname.slice(base.pathname.length) + location.search + location.hash);
  location.replace(destination.href);
}
