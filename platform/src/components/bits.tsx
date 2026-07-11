import { useEffect, useRef, useState, type ReactNode } from 'react';

export function initials(name: string) {
  const p = String(name || '').trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() || '?';
}

const AVATAR = [
  ['var(--color-teal-100)', 'var(--color-teal-900)'],
  ['var(--color-terracotta-100)', 'var(--color-terracotta-900)'],
  ['var(--color-gold-100)', 'var(--color-gold-900)'],
];

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  let h = 0;
  for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const [bg, fg] = AVATAR[h % AVATAR.length];
  return (
    <span className="app-avatar" style={{ width: size, height: size, background: bg, color: fg, fontSize: size * 0.4 }}>
      {initials(name)}
    </span>
  );
}

export function LevelBadge({ level }: { level?: string }) {
  if (!level) return null;
  const mod = ({ B1: 'el-badge--secondary', B2: 'el-badge--secondary', C1: 'el-badge--accent', C2: 'el-badge--accent' } as Record<string, string>)[level] ?? '';
  return <span className={`el-badge ${mod}`.trim()}>{level}</span>;
}

export function PageHead({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="app-page-head">
      <div>
        <h1 className="app-page-title">{title}</h1>
        {subtitle && <p className="app-page-sub">{subtitle}</p>}
      </div>
      {actions && <div className="app-page-actions">{actions}</div>}
    </div>
  );
}

export function Progress({ pct, label }: { pct: number; label?: string }) {
  return (
    <div className="app-progress">
      <div className="app-progress-track"><div className="app-progress-fill" style={{ width: `${Math.round(pct)}%` }} /></div>
      {label && <span className="app-progress-label">{label}</span>}
    </div>
  );
}

export function fmtDate(iso?: string) {
  try { return iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''; } catch { return ''; }
}

/** A list section that collapses to a one-line preview, expanding on click to show its full contents. */
export function SectionAccordion({
  icon, label, count, preview, actions, defaultOpen = true, children,
}: {
  icon?: string; label: string; count: number; preview?: string; actions?: ReactNode; defaultOpen?: boolean; children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="app-side-section app-accordion">
      <div className="app-accordion-head">
        <button className="app-accordion-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <span className={`app-accordion-chevron${open ? ' app-accordion-chevron--open' : ''}`}>▸</span>
          <h2 className="app-section-title">{icon} {label}<span className="el-badge el-badge--neutral">{count}</span></h2>
        </button>
        {actions && <span className="app-section-actions">{actions}</span>}
      </div>
      {!open && preview && <p className="app-muted app-accordion-preview">{preview}</p>}
      {open && children}
    </section>
  );
}

export interface FilterSelect { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }

/** A search input plus a row of facet dropdowns, shared across the list views. */
export function FilterBar({ query, onQuery, placeholder = 'Search…', filters }: {
  query: string; onQuery: (v: string) => void; placeholder?: string; filters?: FilterSelect[];
}) {
  return (
    <div className="app-filterbar">
      <input className="el-input app-filterbar-search" placeholder={placeholder} value={query} onChange={(e) => onQuery(e.target.value)} aria-label="Search" />
      {filters?.map((f) => (
        <select key={f.label} className="el-input app-filterbar-select" value={f.value} onChange={(e) => f.onChange(e.target.value)} aria-label={f.label}>
          {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ))}
    </div>
  );
}

/** First few names, "+N more" if truncated — the collapsed-accordion preview line. */
export function namePreview(items: any[], nameOf: (x: any) => string, max = 4) {
  const names = items.slice(0, max).map(nameOf);
  const rest = items.length - names.length;
  return names.join(', ') + (rest > 0 ? `, +${rest} more` : '');
}

export interface RelationOption { id: string; label: string; sublabel?: string }

/**
 * Notion-style relation field: search existing entities, pick one, or type a
 * name that doesn't match anything yet and create it on the spot (if
 * `onCreate` is given). Used wherever an "+Add" form needs to point at
 * another entity (a student's classroom, a resource's classroom/student).
 */
export function RelationPicker({
  value, onChange, options, placeholder = 'Search or type to create…', onCreate, allowClear = true,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  options: RelationOption[];
  placeholder?: string;
  onCreate?: (name: string) => RelationOption;
  allowClear?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.id === value) || null;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  const exactMatch = options.some((o) => o.label.toLowerCase() === q);

  const pick = (opt: RelationOption) => { onChange(opt.id); setQuery(''); setOpen(false); };
  const create = () => {
    if (!onCreate || !query.trim()) return;
    const opt = onCreate(query.trim());
    onChange(opt.id); setQuery(''); setOpen(false);
  };

  return (
    <div className="app-relation" ref={ref}>
      {selected && !open ? (
        <button type="button" className="app-relation-selected" onClick={() => { setOpen(true); setQuery(''); }}>
          <span>{selected.label}{selected.sublabel && <span className="app-muted"> · {selected.sublabel}</span>}</span>
          {allowClear && (
            <span className="app-relation-clear" role="button" tabIndex={0} aria-label="Clear"
              onClick={(e) => { e.stopPropagation(); onChange(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onChange(null); } }}>✕</span>
          )}
        </button>
      ) : (
        <input
          className="el-input" value={query} placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (filtered[0]) pick(filtered[0]); else create(); } }}
        />
      )}
      {open && (
        <div className="app-relation-menu" role="listbox">
          {filtered.map((o) => (
            <button type="button" key={o.id} className="app-relation-item" onClick={() => pick(o)} role="option">
              {o.label}{o.sublabel && <span className="app-muted"> · {o.sublabel}</span>}
            </button>
          ))}
          {onCreate && query.trim() && !exactMatch && (
            <button type="button" className="app-relation-item app-relation-item--create" onClick={create}>
              + Create "{query.trim()}"
            </button>
          )}
          {filtered.length === 0 && !query.trim() && !onCreate && <div className="app-muted app-relation-empty">No options yet.</div>}
        </div>
      )}
    </div>
  );
}

export interface KebabItem { label: string; onClick: () => void; danger?: boolean }

/** A "⋮" button that opens a small dropdown of secondary actions — keeps card footers to one primary action. */
export function KebabMenu({ items }: { items: KebabItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div className="app-kebab" ref={ref}>
      <button type="button" className="app-icon-btn" aria-label="More actions" aria-haspopup="menu" aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}>⋮</button>
      {open && (
        <div className="app-kebab-menu" role="menu">
          {items.map((it, i) => (
            <button type="button" key={i} role="menuitem"
              className={'app-kebab-item' + (it.danger ? ' app-kebab-item--danger' : '')}
              onClick={(e) => { e.stopPropagation(); setOpen(false); it.onClick(); }}>
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Flatten markdown to plain text for clamped card previews. */
export function stripMarkdown(md?: string) {
  return String(md || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_>#]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
