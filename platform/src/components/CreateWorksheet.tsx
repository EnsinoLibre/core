import { useState } from 'react';
import { motion } from 'framer-motion';
import { store, validateWorksheet, hydrate } from '../lib/api';
import { CopyButton } from './SeedKB';
import { McpConnectTab } from './McpConnect';
// Shared worksheet engine — the same prompt template the public generator uses.
// @ts-ignore - plain JS module from the zero-build site
import { buildPrompt, ACTIVITY_TYPES } from '../../../site/assets/js/prompt-builder.js';

/**
 * Create-worksheet modal — the platform's own builder, no landing page needed.
 * Tab 1 "Prompt builder": the copy-paste mechanic, enriched with workspace
 *   context (pick a class and its level/context flow into the prompt).
 * Tab 2 "Connect via MCP": real AI integration — agent keys + config snippets
 *   for the `mcp` edge function, so Claude (or any MCP client) can create
 *   worksheets directly in the workspace.
 */
export function CreateWorksheetModal({ onClose, onAdded, initialTab = 'prompt' }: { onClose: () => void; onAdded: () => void; initialTab?: 'prompt' | 'mcp' }) {
  const [tab, setTab] = useState<'prompt' | 'mcp'>(initialTab);
  return (
    <motion.div className="app-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="app-modal app-seed-modal" onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }}>
        <div className="app-modal-head">
          <h2 className="app-modal-title">Create worksheet</h2>
          <button className="app-icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="app-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'prompt'} className={`app-tab${tab === 'prompt' ? ' app-tab--active' : ''}`} onClick={() => setTab('prompt')}>✨ Prompt builder</button>
          <button role="tab" aria-selected={tab === 'mcp'} className={`app-tab${tab === 'mcp' ? ' app-tab--active' : ''}`} onClick={() => setTab('mcp')}>🔌 Connect via MCP</button>
        </div>
        {tab === 'prompt' ? <PromptBuilderTab onAdded={onAdded} onClose={onClose} /> : <McpTab onAdded={onAdded} />}
      </motion.div>
    </motion.div>
  );
}

/* ---------------- tab 1: prompt builder (copy-paste mechanic) ---------------- */

const GROUPS: string[] = [...new Set(ACTIVITY_TYPES.map((t: any) => t.group))] as string[];

function PromptBuilderTab({ onAdded, onClose }: { onAdded: () => void; onClose: () => void }) {
  const t = store.teacher();
  const classrooms = store.classrooms();
  const [classId, setClassId] = useState('');
  const cls = classId ? store.classroom(classId) : null;
  const [spec, setSpec] = useState({
    subject: t.subjects || '', topic: '', audience: '', language: '',
    difficulty: 'introductory', activityCount: 8, extras: '',
  });
  const [types, setTypes] = useState<Set<string>>(new Set(ACTIVITY_TYPES.filter((x: any) => x.group === 'Core').map((x: any) => x.id)));
  const [prompt, setPrompt] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const set = (k: string, v: any) => { setSpec((s) => ({ ...s, [k]: v })); setPrompt(null); };

  const pickClass = (id: string) => {
    setClassId(id);
    const c = id ? store.classroom(id) : null;
    setSpec((s) => ({ ...s, audience: c ? `${c.level ? c.level + ' ' : ''}students in "${c.name}"` : s.audience, subject: c?.subject || s.subject }));
    setPrompt(null);
  };

  const toggleType = (id: string) => {
    setTypes((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    setPrompt(null);
  };

  const generate = () => {
    setErrors([]);
    try {
      // The platform's edge over the public builder: the class's captured
      // context rides along in the prompt.
      const extras = [spec.extras.trim(), cls?.context ? `Class context from the teacher's workspace (adapt the material to it): ${cls.context}` : '']
        .filter(Boolean).join('\n');
      setPrompt(buildPrompt({ ...spec, extras, activityTypes: [...types] }));
    } catch (e: any) { setErrors([e.message]); }
  };

  const add = () => {
    let doc: any;
    try {
      const s = reply.trim(); const a = s.indexOf('{'); const b = s.lastIndexOf('}');
      doc = JSON.parse(s.slice(a, b + 1));
    } catch (e: any) { setErrors(['That is not valid JSON: ' + e.message]); return; }
    const problems = validateWorksheet(doc);
    if (problems.length) { setErrors(problems.slice(0, 6)); return; }
    store.addWorksheet(doc);
    onAdded();
  };

  return (
    <div className="app-form">
      <div className="app-field-row">
        <div className="app-field"><label className="el-label">Topic</label>
          <input className="el-input" value={spec.topic} placeholder="e.g. Present perfect vs past simple" onChange={(e) => set('topic', e.target.value)} /></div>
        <div className="app-field"><label className="el-label">Subject</label>
          <input className="el-input" value={spec.subject} onChange={(e) => set('subject', e.target.value)} /></div>
      </div>
      <div className="app-field-row">
        <div className="app-field"><label className="el-label">For class <span className="app-muted">(brings its context along)</span></label>
          <select className="el-input" value={classId} onChange={(e) => pickClass(e.target.value)}>
            <option value="">— none —</option>
            {classrooms.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></div>
        <div className="app-field"><label className="el-label">Audience</label>
          <input className="el-input" value={spec.audience} placeholder="e.g. adult B1 learners" onChange={(e) => set('audience', e.target.value)} /></div>
      </div>
      <div className="app-field-row">
        <div className="app-field"><label className="el-label">Difficulty</label>
          <select className="el-input" value={spec.difficulty} onChange={(e) => set('difficulty', e.target.value)}>
            {['introductory', 'intermediate', 'advanced'].map((d) => <option key={d} value={d}>{d}</option>)}
          </select></div>
        <div className="app-field"><label className="el-label">Activities (about)</label>
          <input className="el-input" type="number" min={1} max={30} value={spec.activityCount} onChange={(e) => set('activityCount', Number(e.target.value) || 8)} /></div>
      </div>
      <div className="app-field">
        <label className="el-label">Activity types ({types.size} selected)</label>
        <div className="app-typegrid">
          {GROUPS.map((g) => (
            <div key={g} className="app-typegroup">
              <span className="app-typegroup-name">{g}</span>
              {ACTIVITY_TYPES.filter((x: any) => x.group === g).map((x: any) => (
                <label key={x.id} className="app-check" title={x.blurb}>
                  <input type="checkbox" checked={types.has(x.id)} onChange={() => toggleType(x.id)} /><span>{x.label}</span>
                </label>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="app-field"><label className="el-label">Anything else? <span className="app-muted">(optional)</span></label>
        <input className="el-input" value={spec.extras} placeholder="e.g. use vocabulary from our restaurant unit" onChange={(e) => set('extras', e.target.value)} /></div>

      <div className="app-form-actions">
        <button className="el-button el-button--ghost" onClick={generate} disabled={!spec.topic.trim() || !spec.subject.trim() || !spec.audience.trim() || types.size === 0}>
          {prompt ? '↻ Regenerate prompt' : '⚙ Generate prompt'}
        </button>
        {prompt && <CopyButton text={prompt} />}
      </div>
      {prompt && (
        <div className="app-field">
          <textarea className="el-input app-seed-prompt" readOnly rows={6} value={prompt} onFocus={(e) => e.currentTarget.select()} />
          <p className="app-muted app-seed-hint">Paste this into any capable AI, then paste its JSON reply below. (Or skip the copy-paste entirely — see the MCP tab.)</p>
        </div>
      )}
      <div className="app-field">
        <label className="el-label">Paste the worksheet JSON</label>
        <textarea className="el-input app-seed-prompt" rows={5} value={reply}
          placeholder='{ "$schemaVersion": "2.0", "title": "…", "sections": [ … ] }'
          onChange={(e) => { setReply(e.target.value); setErrors([]); }} />
        {errors.length > 0 && (
          <div className="oc-errors"><strong>{errors.length === 1 ? 'One problem:' : 'Problems to fix:'}</strong>
            <ul>{errors.map((er, i) => <li key={i}>{er}</li>)}</ul></div>
        )}
      </div>
      <div className="app-form-actions">
        <button className="el-button el-button--ghost" onClick={onClose}>Cancel</button>
        <span className="app-spacer" />
        <button className="el-button" disabled={!reply.trim()} onClick={add}>Validate &amp; add →</button>
      </div>
    </div>
  );
}

/* ---------------- tab 2: MCP (real AI integration) ---------------- */

function McpTab({ onAdded }: { onAdded: () => void }) {
  return (
    <McpConnectTab
      intro={<>
        Connect Claude (or any MCP client) straight to your workspace. Your AI gets tools to read your
        classes and context, fetch the worksheet contract, and <strong>create worksheets and knowledge notes
        directly</strong> — no copy-paste.
      </>}
      tools={['get_workspace_context', 'get_worksheet_contract', 'create_worksheet', 'update_worksheet', 'list_worksheets', 'deploy_worksheets', 'add_resource']}
      checkLabel="↻ Check for new worksheets"
      onCheck={async () => {
        const before = store.worksheetsAll().length;
        await hydrate();
        const after = store.worksheetsAll().length;
        if (after !== before) onAdded();
        return after > before ? `✓ ${after - before} new worksheet${after - before === 1 ? '' : 's'} arrived!` : 'No new worksheets yet.';
      }}
      skillHint={<>
        <strong>Using Claude Code?</strong> The <code>make-worksheet</code> skill in this repo's{' '}
        <code>skills/</code> folder encodes the whole procedure — grounding on your class, picking
        activity types deliberately, validate-and-retry, deploy on request. Install it with{' '}
        <code>npx skills add EnsinoLibre/core</code> and just describe the worksheet you want.
      </>}
    />
  );
}
