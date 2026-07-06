import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  store, validateWorksheet,
  exportAnalogPDF, exportMoodle, exportMarkdown, moodleQuestionCount,
} from '../lib/api';
import { PageHead } from '../components/bits';
import { DeployModal } from '../components/DeployModal';

function unitCount(doc: any) {
  return doc.sections.reduce((n: number, s: any) => n + s.activities.length, 0);
}

export function Worksheets() {
  const nav = useNavigate();
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);
  const [adding, setAdding] = useState(false);
  const [deploy, setDeploy] = useState<string[] | null>(null); // preselected ids, or null = closed

  const worksheets = store.worksheetsAll();

  return (
    <div>
      <PageHead title="Worksheets" subtitle="Your deployable materials. Deploy a set to a class as a live session students can join."
        actions={<>
          <button className="el-button el-button--ghost" onClick={() => setAdding(true)}>+ Add worksheet</button>
          <button className="el-button" onClick={() => setDeploy([])}>◉ Deploy to a class</button>
        </>} />

      <div className="app-card-grid">
        {worksheets.map((w: any) => {
          const inAulas = store.aulas().filter((a: any) => a.worksheetIds.includes(w.id));
          const mq = moodleQuestionCount(w.doc);
          return (
            <div key={w.id} className="el-card app-ws-lib-card">
              <div>
                <h3 className="el-card__title">{w.title}</h3>
                <p className="app-muted">{w.subject} · {unitCount(w.doc)} activities · {mq} auto-graded</p>
              </div>
              {inAulas.length > 0 && (
                <div className="app-tags">
                  {inAulas.map((a: any) => (
                    <button key={a.id} className={'el-badge ' + (a.status === 'live' ? '' : 'el-badge--neutral')} onClick={() => nav(`/live`)} title="Open the live classroom">
                      {a.status === 'live' ? '● ' : ''}{a.code}
                    </button>
                  ))}
                </div>
              )}
              <div className="el-card__footer app-ws-lib-actions">
                <button className="el-button el-button--small" onClick={() => setDeploy([w.id])}>◉ Deploy</button>
                <button className="el-button el-button--ghost el-button--small" onClick={() => exportAnalogPDF(w.doc)}>📄 PDF</button>
                <button className="el-button el-button--ghost el-button--small" title={`${mq} Moodle questions`} onClick={() => exportMoodle(w.doc)}>🎓 Moodle</button>
                <button className="el-button el-button--ghost el-button--small" onClick={() => exportMarkdown(w.doc)}>⬇ MD</button>
                <span className="app-spacer" />
                <button className="el-button el-button--ghost el-button--small" onClick={() => {
                  if (inAulas.length) { alert('This worksheet is deployed in a live class. Remove it there first.'); return; }
                  if (confirm(`Remove "${w.title}" from your library?`)) { store.removeWorksheet(w.id); rerender(); }
                }}>Remove</button>
              </div>
            </div>
          );
        })}
        {worksheets.length === 0 && (
          <div className="app-empty">
            <div className="app-empty-icon">▤</div>
            <h3>No worksheets yet</h3>
            <p>Generate one in the worksheet builder, then paste its JSON here — or add one directly.</p>
            <button className="el-button" onClick={() => setAdding(true)}>+ Add worksheet</button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {adding && <AddWorksheetModal onClose={() => setAdding(false)} onAdded={() => { setAdding(false); rerender(); }} />}
        {deploy !== null && <DeployModal preselect={deploy} onClose={() => setDeploy(null)} onDeployed={(a) => { setDeploy(null); nav('/live'); }} />}
      </AnimatePresence>
    </div>
  );
}

function AddWorksheetModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const add = () => {
    let doc: any;
    try {
      const t = text.trim();
      const start = t.indexOf('{'); const end = t.lastIndexOf('}');
      doc = JSON.parse(t.slice(start, end + 1));
    } catch (e: any) { setErrors(['That is not valid JSON: ' + e.message]); return; }
    const problems = validateWorksheet(doc);
    if (problems.length) { setErrors(problems.slice(0, 6)); return; }
    store.addWorksheet(doc);
    onAdded();
  };

  return (
    <motion.div className="app-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="app-modal" onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }}>
        <div className="app-modal-head">
          <h2 className="app-modal-title">Add a worksheet</h2>
          <button className="app-icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="app-form">
          <p className="app-muted" style={{ marginTop: 0 }}>Paste the worksheet JSON from the <a className="knw-open-link" href="../index.html" target="_blank" rel="noopener">worksheet builder</a>. It is validated before it is added.</p>
          <textarea className="el-input" rows={9} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}
            placeholder='{ "title": "…", "subject": "…", "audience": "…", "language": "en-GB", "sections": [ … ] }'
            value={text} onChange={(e) => { setText(e.target.value); setErrors([]); }} />
          {errors.length > 0 && (
            <div className="oc-errors">
              <strong>{errors.length === 1 ? 'One problem:' : 'Problems to fix:'}</strong>
              <ul>{errors.map((er, i) => <li key={i}>{er}</li>)}</ul>
            </div>
          )}
          <div className="app-form-actions">
            <button className="el-button el-button--ghost" onClick={onClose}>Cancel</button>
            <span className="app-spacer" />
            <button className="el-button" onClick={add}>Validate &amp; add</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
