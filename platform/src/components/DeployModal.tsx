import { useState } from 'react';
import { motion } from 'framer-motion';
import { store } from '../lib/api';

/** Deploy worksheets to a class as a new live aula. */
export function DeployModal({ preselect = [], onClose, onDeployed }: {
  preselect?: string[];
  onClose: () => void;
  onDeployed: (aula: any) => void;
}) {
  const classrooms = store.classrooms();
  const worksheets = store.worksheetsAll();
  const [classId, setClassId] = useState<string>(classrooms[0]?.id || '');
  const [picked, setPicked] = useState<Set<string>>(new Set(preselect.length ? preselect : []));
  const cls = store.classroom(classId);
  const [title, setTitle] = useState('');

  const toggle = (id: string) => setPicked((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const deploy = () => {
    if (!classId || picked.size === 0) return;
    const t = title.trim() || `${cls?.name} — live worksheets`;
    const a = store.createAula(classId, t, worksheets.filter((w: any) => picked.has(w.id)).map((w: any) => w.id));
    onDeployed(a);
  };

  return (
    <motion.div className="app-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="app-modal" onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }}>
        <div className="app-modal-head">
          <h2 className="app-modal-title">Deploy worksheets to a class</h2>
          <button className="app-icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="app-form">
          <div className="app-field">
            <label className="el-label">Class</label>
            <select className="el-input" value={classId} onChange={(e) => setClassId(e.target.value)}>
              {classrooms.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="app-field">
            <label className="el-label">Session title <span className="app-muted">(optional)</span></label>
            <input className="el-input" value={title} placeholder={cls ? `${cls.name} — live worksheets` : ''} onChange={(e) => setTitle(e.target.value)} />
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
            <button className="el-button" disabled={!classId || picked.size === 0} onClick={deploy}>Deploy &amp; open →</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
