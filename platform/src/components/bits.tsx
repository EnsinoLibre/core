import type { ReactNode } from 'react';

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
