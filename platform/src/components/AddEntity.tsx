import { useState } from 'react';
import { motion } from 'framer-motion';
import { store } from '../lib/api';
import { RelationPicker, type RelationOption } from './bits';

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <motion.div className="app-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="app-modal" onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }}>
        <div className="app-modal-head">
          <h2 className="app-modal-title">{title}</h2>
          <button className="app-icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

const classroomOptions = (): RelationOption[] => store.classrooms().map((c: any) => ({ id: c.id, label: c.name, sublabel: [c.subject, c.level].filter(Boolean).join(' · ') }));
const studentOptions = (classId: string | null): RelationOption[] =>
  store.students().filter((s: any) => !classId || s.classId === classId).map((s: any) => ({ id: s.id, label: s.name }));

/** Creates a bare classroom on the spot (used by RelationPicker's "create new" affordance). */
function createClassroom(name: string): RelationOption {
  const c = store.addClassroom({ name });
  return { id: c.id, label: c.name };
}

/* ---------------- Add classroom ---------------- */

export function AddClassroomModal({ onClose, onAdded }: { onClose: () => void; onAdded?: () => void }) {
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [level, setLevel] = useState('');
  const [term, setTerm] = useState('');
  const [description, setDescription] = useState('');

  const save = () => {
    if (!name.trim()) return;
    store.addClassroom({ name: name.trim(), subject: subject.trim(), level: level.trim(), term: term.trim(), description: description.trim() });
    onAdded?.();
    onClose();
  };

  return (
    <ModalShell title="Add a classroom" onClose={onClose}>
      <div className="app-form">
        <div className="app-field"><label className="el-label">Name</label><input className="el-input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. English B1 — Morning" /></div>
        <div className="app-form-row">
          <div className="app-field"><label className="el-label">Subject</label><input className="el-input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="English" /></div>
          <div className="app-field"><label className="el-label">Level</label><input className="el-input" value={level} onChange={(e) => setLevel(e.target.value)} placeholder="B1" /></div>
          <div className="app-field"><label className="el-label">Term</label><input className="el-input" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="2026 Spring" /></div>
        </div>
        <div className="app-field"><label className="el-label">Description <span className="app-muted">(optional)</span></label><textarea className="el-input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <div className="app-form-actions">
          <button className="el-button el-button--ghost" onClick={onClose}>Cancel</button>
          <span className="app-spacer" />
          <button className="el-button" disabled={!name.trim()} onClick={save}>Add classroom</button>
        </div>
      </div>
    </ModalShell>
  );
}

/* ---------------- Add student ---------------- */

export function AddStudentModal({ onClose, onAdded }: { onClose: () => void; onAdded?: () => void }) {
  const [name, setName] = useState('');
  const [classId, setClassId] = useState<string | null>(null);
  const [pronouns, setPronouns] = useState('');
  const [level, setLevel] = useState('');
  const [goals, setGoals] = useState('');
  const [needs, setNeeds] = useState('');
  const [, force] = useState(0); // re-render after inline classroom creation so the picker's option list refreshes

  const save = () => {
    if (!name.trim() || !classId) return;
    store.addStudent(classId, { name: name.trim(), pronouns: pronouns.trim(), level: level.trim(), goals: goals.trim(), needs: needs.trim() });
    onAdded?.();
    onClose();
  };

  return (
    <ModalShell title="Add a student" onClose={onClose}>
      <div className="app-form">
        <div className="app-field"><label className="el-label">Name</label><input className="el-input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" /></div>
        <div className="app-field">
          <label className="el-label">Classroom</label>
          <RelationPicker
            value={classId} onChange={(id) => { setClassId(id); force((n) => n + 1); }}
            options={classroomOptions()} placeholder="Search classrooms, or type to create one…"
            onCreate={(n) => { const opt = createClassroom(n); force((x) => x + 1); return opt; }}
          />
        </div>
        <div className="app-form-row">
          <div className="app-field"><label className="el-label">Pronouns</label><input className="el-input" value={pronouns} onChange={(e) => setPronouns(e.target.value)} placeholder="she/her" /></div>
          <div className="app-field"><label className="el-label">Level</label><input className="el-input" value={level} onChange={(e) => setLevel(e.target.value)} placeholder="B1" /></div>
        </div>
        <div className="app-field"><label className="el-label">Goals <span className="app-muted">(optional)</span></label><textarea className="el-input" rows={2} value={goals} onChange={(e) => setGoals(e.target.value)} /></div>
        <div className="app-field"><label className="el-label">Needs &amp; context <span className="app-muted">(optional)</span></label><textarea className="el-input" rows={2} value={needs} onChange={(e) => setNeeds(e.target.value)} /></div>
        <div className="app-form-actions">
          <button className="el-button el-button--ghost" onClick={onClose}>Cancel</button>
          <span className="app-spacer" />
          <button className="el-button" disabled={!name.trim() || !classId} onClick={save}>Add student</button>
        </div>
      </div>
    </ModalShell>
  );
}

/* ---------------- Add resource ---------------- */

const KIND_OPTIONS = [
  { value: 'material', label: 'Teaching material' },
  { value: 'guideline', label: 'Guideline' },
  { value: 'external', label: 'External resource' },
  { value: 'context', label: 'Context' },
];

export function AddResourceModal({ onClose, onAdded }: { onClose: () => void; onAdded?: () => void }) {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('material');
  const [subject, setSubject] = useState('');
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [classId, setClassId] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [, force] = useState(0);

  const save = () => {
    if (!title.trim()) return;
    const tags = tagsText.split(',').map((t) => t.trim()).filter(Boolean);
    store.addResource({ title: title.trim(), kind, subject: subject.trim(), url: url.trim() || undefined, note: note.trim(), tags, classId, studentId });
    onAdded?.();
    onClose();
  };

  return (
    <ModalShell title="Add a resource" onClose={onClose}>
      <div className="app-form">
        <div className="app-field"><label className="el-label">Title</label><input className="el-input" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. CEFR B1 descriptors" /></div>
        <div className="app-form-row">
          <div className="app-field">
            <label className="el-label">Kind</label>
            <select className="el-input" value={kind} onChange={(e) => setKind(e.target.value)}>
              {KIND_OPTIONS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </div>
          <div className="app-field"><label className="el-label">Subject</label><input className="el-input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="English" /></div>
        </div>
        <div className="app-field"><label className="el-label">Link <span className="app-muted">(optional)</span></label><input className="el-input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" /></div>

        <div className="app-form-row">
          <div className="app-field">
            <label className="el-label">Classroom <span className="app-muted">(optional)</span></label>
            <RelationPicker
              value={classId} onChange={(id) => { setClassId(id); if (!id) setStudentId(null); force((n) => n + 1); }}
              options={classroomOptions()} placeholder="Search or type to create…"
              onCreate={(n) => { const opt = createClassroom(n); force((x) => x + 1); return opt; }}
            />
          </div>
          <div className="app-field">
            <label className="el-label">Student <span className="app-muted">(optional)</span></label>
            <RelationPicker
              value={studentId} onChange={(id) => { setStudentId(id); force((n) => n + 1); }}
              options={studentOptions(classId)} placeholder={classId ? 'Search students…' : 'Pick a classroom first, or search all…'}
            />
          </div>
        </div>

        <div className="app-field"><label className="el-label">Tags <span className="app-muted">(comma-separated, optional)</span></label><input className="el-input" value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="writing, assessment" /></div>
        <div className="app-field"><label className="el-label">Note <span className="app-muted">(optional, markdown)</span></label><textarea className="el-input" rows={4} value={note} onChange={(e) => setNote(e.target.value)} /></div>

        <div className="app-form-actions">
          <button className="el-button el-button--ghost" onClick={onClose}>Cancel</button>
          <span className="app-spacer" />
          <button className="el-button" disabled={!title.trim()} onClick={save}>Add resource</button>
        </div>
      </div>
    </ModalShell>
  );
}
