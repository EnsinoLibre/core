import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { marked } from 'marked';
// @ts-ignore - plain JS content model
import { entityContent, resolveWikilink } from '../lib/content.js';

/* ---------------- context ---------------- */

interface ContentCtx {
  current: string | null;
  canBack: boolean;
  open: (nodeId: string) => void;
  back: () => void;
  close: () => void;
}
const Ctx = createContext<ContentCtx>({ current: null, canBack: false, open: () => {}, back: () => {}, close: () => {} });

/** Open the content panel for any node id from anywhere in the app. */
export function useContent() { return useContext(Ctx); }

/* ---------------- responsive layout hook ---------------- */

/** True when the viewport is "mobile-shaped" — drives sheet-vs-sidepanel. */
export function useMobileLayout() {
  const query = '(max-width: 820px), (max-aspect-ratio: 3/4)';
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMobile(mq.matches);
    mq.addEventListener('change', on);
    window.addEventListener('resize', on);
    return () => { mq.removeEventListener('change', on); window.removeEventListener('resize', on); };
  }, []);
  return mobile;
}

/* ---------------- provider (state only; Shell places the panels) ---------------- */

export function ContentProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<string[]>([]);
  const current = stack[stack.length - 1] ?? null;

  const open = useCallback((nodeId: string) => {
    setStack((s) => (s[s.length - 1] === nodeId ? s : [...s, nodeId]));
  }, []);
  const back = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), []);
  const close = useCallback(() => setStack([]), []);

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, close]);

  const value = useMemo<ContentCtx>(() => ({ current, canBack: stack.length > 1, open, back, close }), [current, stack.length, open, back, close]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/* ---------------- desktop: in-layout, drag-resizable side panel ---------------- */

const WIDTH_KEY = 'ensinolibre.contentpanel.width';
const MIN_W = 320;
const maxW = () => Math.min(820, Math.round(window.innerWidth * 0.6));

/** Rendered as a flex sibling of the page content — it SHARES the row, so
 *  resizing it reflows the page (not an overlay). */
export function ContentSidePanel() {
  const { current, close } = useContent();
  const doc = useMemo(() => (current ? entityContent(current) : null), [current]);

  const [width, setWidth] = useState(() => {
    const saved = Number(localStorage.getItem(WIDTH_KEY));
    return saved && saved >= MIN_W ? Math.min(saved, maxW()) : 440;
  });
  const widthRef = useRef(width);
  const drag = useRef<{ x: number; w: number } | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!drag.current) return;
      const w = Math.max(MIN_W, Math.min(maxW(), drag.current.w + (drag.current.x - e.clientX)));
      widthRef.current = w;
      setWidth(w);
    };
    const onUp = () => {
      if (!drag.current) return;
      drag.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem(WIDTH_KEY, String(widthRef.current));
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const startResize = (e: React.MouseEvent) => {
    drag.current = { x: e.clientX, w: widthRef.current };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  };

  if (!doc) return null;
  return (
    <aside className="content-panel content-panel--side" style={{ flex: `0 0 ${width}px`, width }} aria-label="Content panel">
      <div className="content-resize" onMouseDown={startResize} title="Drag to resize" role="separator" aria-orientation="vertical" />
      <ContentBody doc={doc} onClose={close} />
    </aside>
  );
}

/* ---------------- mobile: bottom drawer (non-modal, real pointer-drag) ---------------- */

const INSET_VAR = '--content-bottom-inset';

export function ContentSheet() {
  const { current, close } = useContent();
  const doc = useMemo(() => (current ? entityContent(current) : null), [current]);
  const [height, setHeight] = useState(() => Math.round(window.innerHeight * 0.5));
  const dragging = useRef(false);

  // Publish the drawer height so the page (e.g. the knowledge graph) can
  // reflow into the space ABOVE it instead of being covered.
  useEffect(() => {
    document.documentElement.style.setProperty(INSET_VAR, `${Math.round(height)}px`);
    window.dispatchEvent(new CustomEvent('el-content-inset', { detail: Math.round(height) }));
  }, [height]);
  useEffect(() => () => {
    document.documentElement.style.removeProperty(INSET_VAR);
    window.dispatchEvent(new CustomEvent('el-content-inset', { detail: 0 }));
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const h = window.innerHeight - e.clientY;
    setHeight(Math.max(72, Math.min(window.innerHeight * 0.94, h)));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (window.innerHeight - e.clientY < window.innerHeight * 0.16) close();
  };

  if (!doc) return null;
  return (
    <motion.aside
      className="content-panel content-panel--sheet"
      style={{ height }}
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 360, damping: 38 }}
      aria-label="Content panel"
    >
      <div
        className="content-grab"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        title="Drag to resize"
      >
        <span className="content-grab-bar" />
      </div>
      <ContentBody doc={doc} onClose={close} />
    </motion.aside>
  );
}

/* ---------------- shared body ---------------- */

const TYPE_VAR: Record<string, string> = {
  teacher: '--color-gold-700', class: '--color-teal-500', student: '--color-teal-400', aula: '--color-teal-700',
  worksheet: '--color-terracotta-500', 'resource-worksheet': '--color-terracotta-400', 'resource-material': '--color-terracotta-300',
  'resource-guideline': '--color-gold-500', 'resource-external': '--color-gold-400', 'resource-context': '--color-teal-300',
};

function escapeHtml(s: string) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

/** Markdown → HTML, with [[wikilinks]] turned into clickable spans. */
function renderMarkdown(md: string) {
  const withLinks = String(md || '').replace(/\[\[([^\]]+)\]\]/g, (_, name) => {
    const n = String(name).trim();
    return `<a class="content-wikilink" data-wikilink="${escapeHtml(n).replace(/"/g, '&quot;')}">${escapeHtml(n)}</a>`;
  });
  return marked.parse(withLinks, { async: false, breaks: false }) as string;
}

function ContentBody({ doc, onClose }: { doc: any; onClose: () => void }) {
  const { open, back, canBack } = useContent();
  const nav = useNavigate();
  const html = useMemo(() => renderMarkdown(doc.markdown), [doc.markdown]);

  const onBodyClick = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest('a.content-wikilink') as HTMLElement | null;
    if (!a) return;
    e.preventDefault();
    const target = resolveWikilink(a.getAttribute('data-wikilink') || '');
    if (target) open(target);
  };

  return (
    <div className="content-inner">
      <header className="content-head">
        {canBack && <button className="app-icon-btn" onClick={back} aria-label="Back" title="Back">←</button>}
        <span className="content-dot" style={{ background: `var(${TYPE_VAR[doc.type] || '--color-text-muted'})` }} />
        <div className="content-head-text">
          <div className="content-kind">{doc.typeLabel}</div>
          <h2 className="content-title">{doc.title}</h2>
          {doc.subtitle && <p className="content-subtitle">{doc.subtitle}</p>}
        </div>
        <button className="app-icon-btn" onClick={onClose} aria-label="Close" title="Close">✕</button>
      </header>

      <div className="content-scroll">
        {(doc.route || doc.url) && (
          <div className="content-actions">
            {doc.route && <button className="el-button el-button--small" onClick={() => { nav(doc.route); onClose(); }}>Open full page →</button>}
            {doc.url && <a className="el-button el-button--ghost el-button--small" href={doc.url} target="_blank" rel="noreferrer">Open link ↗</a>}
          </div>
        )}

        <div className="content-md" onClick={onBodyClick} dangerouslySetInnerHTML={{ __html: html }} />

        {doc.connections.length > 0 && (
          <div className="content-conn">
            <p className="content-conn-title">Connections ({doc.connections.length})</p>
            {doc.connections.map((c: any) => (
              <button key={c.id} className="content-conn-btn" onClick={() => open(c.id)}>
                <span className="content-dot" style={{ background: `var(${TYPE_VAR[c.type] || '--color-text-muted'})` }} />
                <span className="content-conn-label">{c.label}</span>
                <span className="content-conn-rel">{c.rel}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
