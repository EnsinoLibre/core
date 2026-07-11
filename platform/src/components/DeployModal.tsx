import { useState } from 'react';
import { motion } from 'framer-motion';
import { store } from '../lib/api';
import { CopyButton } from './SeedKB';

export function joinLink(code: string) {
  return new URL(`../aula.html?code=${code}`, window.location.href).href;
}

/** Deploy worksheets as a new live aula — to a class (roster-gated, password required) or a public link (password optional). */
export function DeployModal({ preselect = [], onClose, onDeployed }: {
  preselect?: string[];
  onClose: () => void;
  onDeployed: (aula: any) => void;
}) {
  const classrooms = store.classrooms();
  const worksheets = store.worksheetsAll();
  const [mode, setMode] = useState<'class' | 'public'>('class');
  const [classId, setClassId] = useState<string>(classrooms[0]?.id || '');
  const [picked, setPicked] = useState<Set<string>>(new Set(preselect.length ? preselect : []));
  const cls = store.classroom(classId);
  const [title, setTitle] = useState('');
  const [password, setPassword] = useState('');
  const [requirePassword, setRequirePassword] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployed, setDeployed] = useState<{ aula: any; password: string } | null>(null);

  const toggle = (id: string) => setPicked((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const needsPassword = mode === 'class' || requirePassword;
  const passwordOk = !needsPassword || password.trim().length >= 4;
  const canDeploy = picked.size > 0 && (mode === 'public' || !!classId) && passwordOk;

  const deploy = async () => {
    if (!canDeploy || deploying) return;
    setDeploying(true);
    const t = title.trim() || (mode === 'class' ? `${cls?.name} — live worksheets` : 'Public worksheets');
    const pw = needsPassword ? password.trim() : '';
    const a = await store.createAula(mode === 'class' ? classId : null, t, worksheets.filter((w: any) => picked.has(w.id)).map((w: any) => w.id), pw || undefined);
    setDeploying(false);
    setDeployed({ aula: a, password: pw });
  };

  if (deployed) {
    const link = joinLink(deployed.aula.code);
    return (
      <motion.div className="app-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
        <motion.div className="app-modal" onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }}>
          <div className="app-modal-head">
            <h2 className="app-modal-title">Deployed ✓</h2>
            <button className="app-icon-btn" onClick={() => onDeployed(deployed.aula)} aria-label="Close">✕</button>
          </div>
          <div className="app-form">
            <div className="app-field">
              <label className="el-label">Join link</label>
              <div className="app-field-row">
                <input className="el-input" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
                <CopyButton text={link} label="⧉ Copy" />
              </div>
            </div>
            {deployed.password && (
              <div className="app-field">
                <label className="el-label">Password <span className="app-muted">(shown once — copy it now)</span></label>
                <div className="app-field-row">
                  <input className="el-input" readOnly value={deployed.password} onFocus={(e) => e.currentTarget.select()} />
                  <CopyButton text={deployed.password} label="⧉ Copy" />
                </div>
              </div>
            )}
            <p className="app-muted">
              {mode === 'class' ? 'Share this link and password with your students.' : 'Anyone with this link can join' + (deployed.password ? ', with the password.' : ' — no password needed.')}
            </p>
            <div className="app-form-actions">
              <span className="app-spacer" />
              <button className="el-button" onClick={() => onDeployed(deployed.aula)}>Open live class →</button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div className="app-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="app-modal" onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }}>
        <div className="app-modal-head">
          <h2 className="app-modal-title">Deploy worksheets</h2>
          <button className="app-icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="app-tabs" role="tablist">
          <button role="tab" aria-selected={mode === 'class'} className={`app-tab${mode === 'class' ? ' app-tab--active' : ''}`} onClick={() => setMode('class')}>👥 To a class</button>
          <button role="tab" aria-selected={mode === 'public'} className={`app-tab${mode === 'public' ? ' app-tab--active' : ''}`} onClick={() => setMode('public')}>🔗 Public link</button>
        </div>
        <div className="app-form">
          {mode === 'class' ? (
            <div className="app-field">
              <label className="el-label">Class</label>
              <select className="el-input" value={classId} onChange={(e) => setClassId(e.target.value)}>
                {classrooms.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <p className="el-help-text">Students pick their name from the class roster and enter the password to join.</p>
            </div>
          ) : (
            <p className="el-help-text" style={{ marginTop: 0 }}>Anyone with the link can join under any name — no class or roster required.</p>
          )}
          <div className="app-field">
            <label className="el-label">Session title <span className="app-muted">(optional)</span></label>
            <input className="el-input" value={title} placeholder={mode === 'class' ? (cls ? `${cls.name} — live worksheets` : '') : 'Public worksheets'} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="app-field">
            {mode === 'public' && (
              <label className="app-check" style={{ marginBottom: 'var(--space-2)' }}>
                <input type="checkbox" checked={requirePassword} onChange={(e) => { setRequirePassword(e.target.checked); if (!e.target.checked) setPassword(''); }} />
                <span>Require a password to join</span>
              </label>
            )}
            {needsPassword && (
              <>
                <label className="el-label">Password {mode === 'class' && <span className="app-muted">(required)</span>}</label>
                <input className="el-input" type="text" value={password} placeholder="At least 4 characters" onChange={(e) => setPassword(e.target.value)} />
              </>
            )}
          </div>
          <div className="app-field">
            <label className="el-label">Worksheets to deploy ({picked.size} selected)</label>
            <div className="app-checks" style={{ flexDirection: 'column', maxHeight: 240, overflowY: 'auto' }}>
              {worksheets.map((w: any) => (
                <label key={w.id} className="app-check" style={{ width: '100%' }}>
                  <input type="checkbox" checked={picked.has(w.id)} onChange={() => toggle(w.id)} />
                  <span>{w.title} <span className="app-muted">· {w.subject}</span></span>
                </label>
              ))}
            </div>
          </div>
          <div className="app-form-actions">
            <button className="el-button el-button--ghost" onClick={onClose}>Cancel</button>
            <span className="app-spacer" />
            <button className="el-button" disabled={!canDeploy || deploying} onClick={deploy}>{deploying ? 'Deploying…' : 'Deploy →'}</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
