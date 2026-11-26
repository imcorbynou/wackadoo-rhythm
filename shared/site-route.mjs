// Accept only this site's desktop screens; never load a supplied external URL.
export function resolveView(value, base) {
  const home = new URL('home/', base);
  try {
    const target = new URL(value || 'home/', base);
    if (target.origin !== base.origin || !target.pathname.startsWith(base.pathname)) return home;
    const route = target.pathname.slice(base.pathname.length);
    if (!route || route === 'index.html') return home;
    if (!/^(home|spinny-roundy|vest-connect|keepy-uppy)\/(?:index\.html|music-circle\/(?:index\.html)?)?$/.test(route)) return home;
    return target;
  } catch { return home; }
}
