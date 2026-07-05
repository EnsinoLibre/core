/**
 * EnsinoLibre — animation layer (Anime.js v4, vendored locally).
 *
 * The four "visual grammar" activity types (grammar-forms, tense-shift,
 * word-transform, translation-compare) get the same animated treatment as
 * the English with Sara PWA. Anime.js is loaded lazily and every helper is
 * a graceful no-op if it cannot load or the user prefers reduced motion —
 * so the renderer never depends on animation for correctness.
 *
 * Timings/eases mirror the PWA (GrammarAnim.tsx): staggered enter with
 * outBack, quick centre-out exit with inSine, spring pop on emphasis.
 *
 * Browser-only module.
 */

let animePromise = null;
const reduceMotion = typeof window !== 'undefined'
  && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Lazily import the vendored Anime.js; resolves to null if unavailable. */
function loadAnime() {
  if (reduceMotion) return Promise.resolve(null);
  if (!animePromise) {
    animePromise = import('../vendor/anime.esm.min.js').catch(() => null);
  }
  return animePromise;
}

/** Prime the import so the first interaction is instant. */
export function warmAnime() { loadAnime(); }

/**
 * Safety net: whatever the animation engine does, force the nodes to their
 * visible resting state after `after` ms via setTimeout (which keeps firing
 * even when requestAnimationFrame is throttled, e.g. a background tab).
 * The instance is paused first so a slow-running animation cannot re-write
 * the styles we just cleared; clearing the inline styles then reverts to the
 * stylesheet — opacity 1, no transform — so content is NEVER left invisible.
 */
function settleVisible(nodes, after, inst) {
  setTimeout(() => {
    try { inst && inst.pause && inst.pause(); } catch { /* ignore */ }
    for (const n of nodes) { n.style.opacity = ''; n.style.transform = ''; }
  }, after);
}

/** Staggered entrance for a set of tiles. Returns a promise that resolves when done. */
export async function enterTiles(nodes, { stagger: st = 70 } = {}) {
  const a = await loadAnime();
  if (!a || !nodes.length) return;
  const inst = a.animate(nodes, {
    opacity: [0, 1],
    translateY: [15, 0],
    scale: [0.88, 1],
    delay: a.stagger(st),
    ease: 'outBack(1.2)',
    duration: 330,
  });
  settleVisible(nodes, 330 + st * nodes.length + 150, inst);
}

/** Quick centre-out exit; resolves when the tiles are hidden (or a timeout, so
 *  a throttled rAF can never wedge a tab switch). */
export function exitTiles(nodes, { stagger: st = 40 } = {}) {
  return loadAnime().then((a) => new Promise((resolve) => {
    if (!a || !nodes.length) return resolve();
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    a.animate(nodes, {
      opacity: [1, 0],
      translateY: [0, -10],
      scale: [1, 0.9],
      delay: a.stagger(st, { from: 'center' }),
      ease: 'inSine',
      duration: 175,
      complete: finish,
    });
    setTimeout(finish, 175 + st * nodes.length + 200);
  }));
}

/** Spring "pop" of emphasis on the given nodes (e.g. the changing word). */
export async function popTiles(nodes) {
  const a = await loadAnime();
  if (!a || !nodes.length) return;
  a.animate(nodes, { scale: [1, 1.14, 1], duration: 460, ease: 'outElastic(1, 0.5)' });
}

/** A left→right pulse wave over word blocks (used when reading a sentence aloud). */
export async function pulseWave(nodes) {
  const a = await loadAnime();
  if (!a || !nodes.length) return;
  a.animate(nodes, {
    scale: [1, 1.08, 1],
    delay: a.stagger(60),
    duration: 320,
    ease: 'inOutSine',
  });
}

/** Morpheme tiles fly in from their side (prefix ← left, suffix → right, root pops). */
export async function flyInMorphemes(nodes) {
  const a = await loadAnime();
  if (!a || !nodes.length) return;
  const inst = a.animate(nodes, {
    opacity: [0, 1],
    translateX: (el) => {
      const role = el.dataset.role;
      return role === 'prefix' ? [-26, 0] : role === 'suffix' ? [26, 0] : [0, 0];
    },
    scale: (el) => (el.dataset.role === 'root' ? [0.6, 1] : [0.9, 1]),
    delay: a.stagger(90),
    ease: 'outBack(1.6)',
    duration: 420,
  });
  settleVisible(nodes, 420 + 90 * nodes.length + 150, inst);
}

/** Draw SVG connector paths in (stroke dash reveal). */
export async function drawPaths(paths) {
  const a = await loadAnime();
  if (!a || !paths.length) {
    // Without anime, just show the lines immediately.
    for (const p of paths) p.style.strokeDashoffset = '0';
    return;
  }
  for (const p of paths) {
    const len = p.getTotalLength();
    p.style.strokeDasharray = String(len);
    p.style.strokeDashoffset = String(len);
  }
  a.animate(paths, {
    strokeDashoffset: [(el) => el.getTotalLength(), 0],
    delay: a.stagger(120),
    ease: 'inOutQuad',
    duration: 620,
  });
}
