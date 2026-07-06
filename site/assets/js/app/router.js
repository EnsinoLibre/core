/** EnsinoLibre teacher workspace — tiny hash router. */

const routes = [];
let notFound = null;

/** Register a route. Pattern segments: literals or ":param". */
export function route(pattern, handler) {
  const parts = pattern.split('/').filter(Boolean);
  routes.push({ parts, handler });
}

export function setNotFound(handler) { notFound = handler; }

function match(path) {
  const segs = path.split('/').filter(Boolean);
  for (const r of routes) {
    if (r.parts.length !== segs.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < r.parts.length; i++) {
      const p = r.parts[i];
      if (p.startsWith(':')) params[p.slice(1)] = decodeURIComponent(segs[i]);
      else if (p !== segs[i]) { ok = false; break; }
    }
    if (ok) return { handler: r.handler, params };
  }
  return null;
}

export function current() {
  return (location.hash.replace(/^#/, '') || '/');
}

export function navigate(path) {
  if (current() === path) resolve();
  else location.hash = path;
}

function resolve() {
  const path = current();
  const m = match(path);
  if (m) m.handler(m.params);
  else if (notFound) notFound(path);
}

export function startRouter() {
  window.addEventListener('hashchange', resolve);
  resolve();
}
