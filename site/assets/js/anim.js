/**
 * EnsinoLibre — animation layer (vanilla Web Animations API).
 *
 * The four "visual grammar" activity types (grammar-forms, tense-shift,
 * word-transform, translation-compare) get the same animated treatment as
 * the English with Sara PWA, implemented on the browser's native
 * Web Animations API — no animation engine, nothing vendored. Every helper
 * is a graceful no-op when the user prefers reduced motion (or `animate` is
 * unavailable), and enter animations fill *backwards only*, so elements
 * always come to rest at their stylesheet state — content is NEVER left
 * invisible, even if an animation is interrupted.
 *
 * Timings/eases mirror the PWA (GrammarAnim.tsx): staggered enter with a
 * back-out overshoot, quick centre-out exit, elastic-style pop on emphasis.
 *
 * Browser-only module.
 */

const EASE = {
  outBack: 'cubic-bezier(0.34, 1.56, 0.64, 1)',      // ≈ outBack(1.2)
  outBackStrong: 'cubic-bezier(0.34, 1.80, 0.64, 1)', // ≈ outBack(1.6)
  inSine: 'cubic-bezier(0.12, 0, 0.39, 0)',
  inOutSine: 'cubic-bezier(0.37, 0, 0.63, 1)',
  inOutQuad: 'cubic-bezier(0.45, 0, 0.55, 1)',
};

function reduceMotion() {
  return typeof window !== 'undefined' && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function canAnimate(nodes) {
  return nodes.length > 0 && typeof nodes[0].animate === 'function' && !reduceMotion();
}

/** Kept for API compatibility — there is no engine to lazy-load any more. */
export function warmAnime() {}

/**
 * Await every animation, but never longer than `cap` ms. Hidden/throttled
 * tabs can hold animation timelines at 0 indefinitely, which would leave
 * elements stuck on their first keyframe (often opacity 0); the setTimeout
 * (which keeps firing in background tabs) force-finishes every animation so
 * elements always land on their resting state and an await here can never
 * wedge the UI.
 */
function settle(animations, cap) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      for (const a of animations) {
        try { if (a.playState !== 'finished') a.finish(); } catch { /* ignore */ }
      }
      resolve();
    };
    Promise.allSettled(animations.map((a) => a.finished)).then(finish);
    setTimeout(finish, cap);
  });
}

/** Staggered entrance for a set of tiles. Resolves when done. */
export async function enterTiles(nodes, { stagger = 70 } = {}) {
  if (!canAnimate(nodes)) return;
  // fill: 'backwards' hides each tile during its stagger delay; after the
  // animation the element reverts to the stylesheet resting state (visible).
  const anims = nodes.map((n, i) => n.animate(
    [
      { opacity: 0, transform: 'translateY(15px) scale(0.88)' },
      { opacity: 1, transform: 'translateY(0) scale(1)' },
    ],
    { duration: 330, delay: i * stagger, easing: EASE.outBack, fill: 'backwards' },
  ));
  await settle(anims, 330 + stagger * nodes.length + 150);
}

/** Quick centre-out exit; resolves when the tiles are hidden (or a timeout).
 *  Fills forwards — callers replace the nodes right after awaiting this. */
export async function exitTiles(nodes, { stagger = 40 } = {}) {
  if (!canAnimate(nodes)) return;
  const centre = (nodes.length - 1) / 2;
  const anims = nodes.map((n, i) => n.animate(
    [
      { opacity: 1, transform: 'translateY(0) scale(1)' },
      { opacity: 0, transform: 'translateY(-10px) scale(0.9)' },
    ],
    { duration: 175, delay: Math.abs(i - centre) * stagger, easing: EASE.inSine, fill: 'forwards' },
  ));
  await settle(anims, 175 + stagger * nodes.length + 200);
}

/** Springy "pop" of emphasis on the given nodes (e.g. the changing word).
 *  Keyframed overshoot-and-settle standing in for outElastic(1, 0.5). */
export async function popTiles(nodes) {
  if (!canAnimate(nodes)) return;
  for (const n of nodes) {
    n.animate(
      [
        { transform: 'scale(1)' },
        { transform: 'scale(1.14)', offset: 0.3 },
        { transform: 'scale(0.97)', offset: 0.62 },
        { transform: 'scale(1.02)', offset: 0.82 },
        { transform: 'scale(1)' },
      ],
      { duration: 460, easing: EASE.inOutSine },
    );
  }
}

/**
 * 3D card flip driven by the WAAPI: rotate the node to edge-on, run
 * `updateContent()` at the invisible midpoint to swap front/back, then rotate
 * the (new) face back to flat. Under reduced motion / no `animate`, the content
 * is swapped instantly — so the card is never left mid-flip or blank.
 */
export async function flipCard(node, updateContent) {
  if (!node || typeof node.animate !== 'function' || reduceMotion()) { updateContent(); return; }
  node.getAnimations?.().forEach((a) => a.cancel()); // don't stack rapid flips
  const half = 150;
  const out = node.animate(
    [{ transform: 'perspective(600px) rotateY(0deg)' }, { transform: 'perspective(600px) rotateY(90deg)' }],
    { duration: half, easing: EASE.inOutSine, fill: 'forwards' },
  );
  await settle([out], half + 120);
  updateContent();
  const inn = node.animate(
    [{ transform: 'perspective(600px) rotateY(-90deg)' }, { transform: 'perspective(600px) rotateY(0deg)' }],
    { duration: half, easing: EASE.inOutSine, fill: 'forwards' },
  );
  await settle([inn], half + 120);
  // Resting state is no transform; the forwards-filled `inn` holds rotateY(0),
  // which is visually identical, and the next flip cancels it.
}

/**
 * FLIP-style swap of two adjacent nodes that have just traded DOM positions
 * (e.g. an ordering list's ↑/↓ move). Call this AFTER the reorder has already
 * happened in the DOM: it measures where each node used to be relative to
 * where it now is (from the caller-supplied previous rects), applies the
 * inverse transform so nothing visually jumps, then animates both back to
 * identity. Graceful no-op under prefers-reduced-motion / no `animate` — the
 * caller's DOM reorder is already complete either way, so there is nothing
 * further to do. Never leaves a transform filled (fill: 'none' default), so
 * the nodes always end at their natural laid-out position.
 */
export function flipSwap(nodeA, prevRectA, nodeB, prevRectB) {
  if (!canAnimate([nodeA, nodeB])) return Promise.resolve();
  const newA = nodeA.getBoundingClientRect();
  const newB = nodeB.getBoundingClientRect();
  const dyA = prevRectA.top - newA.top;
  const dyB = prevRectB.top - newB.top;
  const anims = [];
  if (dyA) anims.push(nodeA.animate(
    [{ transform: `translateY(${dyA}px)` }, { transform: 'translateY(0)' }],
    { duration: 200, easing: EASE.inOutSine },
  ));
  if (dyB) anims.push(nodeB.animate(
    [{ transform: `translateY(${dyB}px)` }, { transform: 'translateY(0)' }],
    { duration: 200, easing: EASE.inOutSine },
  ));
  if (!anims.length) return Promise.resolve();
  return settle(anims, 200 + 150);
}

/** Soft scale-pop to affirm a correct answer (paired with shakeTiles for wrong). */
export async function flashCorrect(node) {
  if (!node || typeof node.animate !== 'function' || reduceMotion()) return;
  node.animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(1.03)', offset: 0.4 }, { transform: 'scale(1)' }],
    { duration: 320, easing: EASE.outBack },
  );
}

/** Quick horizontal shake to signal a wrong/mismatched action. No-op when reduced. */
export async function shakeTiles(nodes) {
  if (!canAnimate(nodes)) return;
  const anims = nodes.map((n) => n.animate(
    [
      { transform: 'translateX(0)' },
      { transform: 'translateX(-5px)', offset: 0.2 },
      { transform: 'translateX(5px)', offset: 0.4 },
      { transform: 'translateX(-4px)', offset: 0.6 },
      { transform: 'translateX(4px)', offset: 0.8 },
      { transform: 'translateX(0)' },
    ],
    { duration: 380, easing: EASE.inOutSine },
  ));
  await settle(anims, 380 + 150);
}

/** A left→right pulse wave over word blocks (used when reading a sentence aloud). */
export async function pulseWave(nodes) {
  if (!canAnimate(nodes)) return;
  nodes.forEach((n, i) => n.animate(
    [
      { transform: 'scale(1)' },
      { transform: 'scale(1.08)' },
      { transform: 'scale(1)' },
    ],
    { duration: 320, delay: i * 60, easing: EASE.inOutSine },
  ));
}

/** Morpheme tiles fly in from their side (prefix ← left, suffix → right, root pops). */
export async function flyInMorphemes(nodes) {
  if (!canAnimate(nodes)) return;
  const anims = nodes.map((n, i) => {
    const role = n.dataset.role;
    const fromX = role === 'prefix' ? -26 : role === 'suffix' ? 26 : 0;
    const fromScale = role === 'root' ? 0.6 : 0.9;
    return n.animate(
      [
        { opacity: 0, transform: `translateX(${fromX}px) scale(${fromScale})` },
        { opacity: 1, transform: 'translateX(0) scale(1)' },
      ],
      { duration: 420, delay: i * 90, easing: EASE.outBackStrong, fill: 'backwards' },
    );
  });
  await settle(anims, 420 + 90 * nodes.length + 150);
}

/** Draw SVG connector paths in (stroke dash reveal). */
export async function drawPaths(paths) {
  if (!paths.length) return;
  // The resting state is the fully drawn line; set it inline first so the
  // no-motion path and the post-animation state are identical.
  for (const p of paths) {
    p.style.strokeDasharray = String(p.getTotalLength());
    p.style.strokeDashoffset = '0';
  }
  if (!canAnimate(paths)) return;
  const anims = paths.map((p, i) => p.animate(
    [
      { strokeDashoffset: p.getTotalLength() },
      { strokeDashoffset: 0 },
    ],
    { duration: 620, delay: i * 120, easing: EASE.inOutQuad, fill: 'backwards' },
  ));
  await settle(anims, 620 + 120 * paths.length + 200);
}
