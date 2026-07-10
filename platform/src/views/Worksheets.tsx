import { useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  store,
  exportAnalogPDF, exportMoodle, exportMarkdown, moodleQuestionCount,
} from '../lib/api';
import { PageHead, FilterBar } from '../components/bits';
import { DeployModal } from '../components/DeployModal';
import { CreateWorksheetModal } from '../components/CreateWorksheet';
import { useContent } from '../components/ContentPanel';

function unitCount(doc: any) {
  return doc.sections.reduce((n: number, s: any) => n + s.activities.length, 0);
}

const ALL = '__all__';

export function Worksheets() {
  const nav = useNavigate();
  const { open } = useContent();
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);
  const [adding, setAdding] = useState(false);
  const [deploy, setDeploy] = useState<string[] | null>(null); // preselected ids, or null = closed
  const [query, setQuery] = useState('');
  const [subject, setSubject] = useState(ALL);
  const [deployed, setDeployed] = useState(ALL);

  const all = store.worksheetsAll();
  const subjects = useMemo(() => ([...new Set(all.map((w: any) => w.subject).filter(Boolean))] as string[]).sort(), [all]);

  const q = query.trim().toLowerCase();
  const worksheets = all.filter((w: any) => {
    if (subject !== ALL && w.subject !== subject) return false;
    const isDeployed = store.aulas().some((a: any) => a.worksheetIds.includes(w.id));
    if (deployed === 'yes' && !isDeployed) return false;
    if (deployed === 'no' && isDeployed) return false;
    if (q && !w.title.toLowerCase().includes(q)) return false;
    return true;
  });

  return (
    <div>
      <PageHead title="Worksheets" subtitle="Your deployable materials. Deploy a set to a class as a live session students can join."
        actions={<>
          <button className="el-button el-button--ghost" onClick={() => setAdding(true)}>+ Create worksheet</button>
          <button className="el-button" onClick={() => setDeploy([])}>◉ Deploy to a class</button>
        </>} />
      <FilterBar
        query={query} onQuery={setQuery} placeholder="Search worksheets…"
        filters={[
          { label: 'Subject', value: subject, onChange: setSubject, options: [{ value: ALL, label: 'All subjects' }, ...subjects.map((s: string) => ({ value: s, label: s }))] },
          { label: 'Deployment', value: deployed, onChange: setDeployed, options: [{ value: ALL, label: 'All' }, { value: 'yes', label: 'Deployed' }, { value: 'no', label: 'Not deployed' }] },
        ]}
      />

      <div className="app-card-grid">
        {worksheets.map((w: any) => {
          const inAulas = store.aulas().filter((a: any) => a.worksheetIds.includes(w.id));
          const mq = moodleQuestionCount(w.doc);
          return (
            <div key={w.id} className="el-card app-ws-lib-card">
              <button className="app-cardlink" onClick={() => open('worksheet:' + w.id)} title="Open worksheet & progress">
                <h3 className="el-card__title">{w.title}</h3>
                <p className="app-muted">{w.subject} · {unitCount(w.doc)} activities · {mq} auto-graded</p>
              </button>
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
        {worksheets.length === 0 && all.length > 0 && (
          <div className="app-empty">
            <div className="app-empty-icon">▤</div>
            <h3>No worksheets match</h3>
            <p>Try a different search or clear the filters.</p>
          </div>
        )}
        {all.length === 0 && (
          <div className="app-empty">
            <div className="app-empty-icon">▤</div>
            <h3>No worksheets yet</h3>
            <p>Build one right here with the prompt builder — or connect your AI via MCP and let it create worksheets directly.</p>
            <button className="el-button" onClick={() => setAdding(true)}>+ Create worksheet</button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {adding && <CreateWorksheetModal onClose={() => setAdding(false)} onAdded={() => { setAdding(false); rerender(); }} />}
        {deploy !== null && <DeployModal preselect={deploy} onClose={() => setDeploy(null)} onDeployed={(a) => { setDeploy(null); nav('/live'); }} />}
      </AnimatePresence>
    </div>
  );
}
