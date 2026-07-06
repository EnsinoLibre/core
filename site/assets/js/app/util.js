/** EnsinoLibre teacher workspace — small DOM + format helpers (no framework). */

/** Create an element. children may be nodes or strings. */
export function el(tag, opts = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(opts)) {
    if (v == null) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v; // only used with trusted, code-authored strings
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (v === true) node.setAttribute(k, '');
    else if (v !== false) node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

export const clear = (node) => { while (node.firstChild) node.removeChild(node.firstChild); };

/** Two-letter initials for an avatar. */
export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

export function fmtDate(iso) {
  try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return ''; }
}

export function relTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 30) return `${d} days ago`;
  return fmtDate(iso);
}

/** Deterministic accent colour for an avatar, from the design-system palette. */
const AVATAR_COLORS = [
  ['var(--color-teal-100)', 'var(--color-teal-900)'],
  ['var(--color-terracotta-100)', 'var(--color-terracotta-900)'],
  ['var(--color-gold-100)', 'var(--color-gold-900)'],
];
export function avatarColors(key) {
  let h = 0;
  for (const ch of String(key)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/** A rounded avatar chip. */
export function avatar(name, size = 40) {
  const [bg, fg] = avatarColors(name);
  return el('span', {
    class: 'app-avatar',
    style: `width:${size}px;height:${size}px;background:${bg};color:${fg};font-size:${size * 0.4}px`,
    text: initials(name),
  });
}

/** Level → badge modifier. */
export function levelBadge(level) {
  if (!level) return null;
  const mod = { A1: '', A2: '', B1: 'el-badge--secondary', B2: 'el-badge--secondary', C1: 'el-badge--accent', C2: 'el-badge--accent' }[level] ?? 'el-badge--neutral';
  return el('span', { class: `el-badge ${mod}`.trim(), text: level });
}

/* ---------------- modal ---------------- */

/** Open a modal with a title and a body node. Returns { close }. */
export function modal(title, bodyNode) {
  const overlay = el('div', { class: 'app-modal-overlay' });
  const close = () => overlay.remove();
  const dialog = el('div', { class: 'app-modal', role: 'dialog', 'aria-modal': 'true' }, [
    el('div', { class: 'app-modal-head' }, [
      el('h2', { class: 'app-modal-title', text: title }),
      el('button', { class: 'app-icon-btn', 'aria-label': 'Close', text: '✕', onclick: close }),
    ]),
    bodyNode,
  ]);
  overlay.appendChild(dialog);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } });
  document.body.appendChild(overlay);
  const first = dialog.querySelector('input, textarea, select, button');
  if (first) first.focus();
  return { close, dialog };
}

/** Build a labelled field (label + input/textarea/select). */
export function field(label, control, help) {
  return el('div', { class: 'app-field' }, [
    el('label', { class: 'el-label', text: label }),
    control,
    help ? el('p', { class: 'el-help-text', text: help }) : null,
  ]);
}

export function input(attrs = {}) { return el('input', { class: 'el-input', ...attrs }); }
export function textarea(attrs = {}) { return el('textarea', { class: 'el-input', rows: 3, ...attrs }); }
export function select(options, attrs = {}) {
  return el('select', { class: 'el-input', ...attrs }, options.map((o) =>
    el('option', { value: typeof o === 'string' ? o : o.value, ...(o.selected ? { selected: true } : {}) }, typeof o === 'string' ? o : o.label)));
}

/** Empty-state block. */
export function emptyState(icon, title, body, action) {
  return el('div', { class: 'app-empty' }, [
    el('div', { class: 'app-empty-icon', text: icon }),
    el('h3', { text: title }),
    body ? el('p', { text: body }) : null,
    action || null,
  ]);
}
