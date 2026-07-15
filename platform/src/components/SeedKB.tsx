import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { store, hydrate } from '../lib/api';
import { McpConnectTab } from './McpConnect';
// @ts-ignore - plain JS module
import {
  stageFiles, fmtSize, buildSeedPrompt, parseSeedResult, applySeedResult,
  buildClassroomImportPrompt, parseClassroomImport, applyClassroomImport,
} from '../lib/kbseed.js';

/* ---------------- shared bits ---------------- */

export function copyText(text: string) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const ta = document.createElement('textarea');
  ta.value = text; document.body.appendChild(ta); ta.select();
  document.execCommand('copy'); ta.remove();
  return Promise.resolve();
}

export function CopyButton({ text, label = '⧉ Copy prompt', small = false }: { text: string; label?: string; small?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button className={`el-button${small ? ' el-button--small' : ''}`} onClick={() => { copyText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); }}>
      {copied ? 'Copied ✓' : label}
    </button>
  );
}

function PromptStep({ prompt, hint }: { prompt: string; hint: string }) {
  return (
    <div className="app-field">
      <textarea className="el-input app-seed-prompt" readOnly rows={9} value={prompt} onFocus={(e) => e.currentTarget.select()} />
      <p className="app-muted app-seed-hint">{hint}</p>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <motion.div className="app-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="app-modal app-seed-modal" onClick={(e) => e.stopPropagation()}
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

/* ---------------- seed knowledge base (bulk files → summaries) ---------------- */

export interface SeedScope { kind?: string; classId?: string; studentId?: string }

/**
 * Three-step seeding flow, following the platform's copy-paste mechanic:
 * 1. pick files (bulk) → 2. copy prompt for the local agent → 3. paste the
 * agent's JSON back to create one front-facing summary note per file.
 */
export function SeedModal({ scope = {}, onClose, onApplied, initialTab = 'files' }: { scope?: SeedScope; onClose: () => void; onApplied?: () => void; initialTab?: 'files' | 'mcp' }) {
  const [tab, setTab] = useState<'files' | 'mcp'>(initialTab);
  const [staged, setStaged] = useState<any[]>([]);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ created: any[]; linked: number; unresolved: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const addFiles = async (list: FileList | File[] | null) => {
    if (!list || !(list as FileList).length) return;
    const next = await stageFiles(list);
    setStaged((prev) => {
      const seen = new Set(prev.map((f) => f.path));
      return [...prev, ...next.filter((f: any) => !seen.has(f.path))];
    });
    setPrompt(null); // staged set changed → prompt is stale
  };

  const integrate = () => {
    setError('');
    try {
      const entries = parseSeedResult(reply);
      const res = applySeedResult(entries, scope);
      setResult(res);
      onApplied?.();
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  };

  const fileNamesOnly = () => {
    // Fallback: register the files without summaries (agent step skipped).
    const res = applySeedResult(staged.map((f) => ({
      file: f.path, title: f.name.replace(/\.[^.]+$/, ''), kind: null, subject: '',
      tags: [], url: undefined, summary: `_Placeholder — no front-facing summary yet._\n\nOriginal file: \`${f.path}\` (${fmtSize(f.size)})`, links: [],
    })), scope);
    setResult(res);
    onApplied?.();
  };

  if (result) {
    return (
      <Modal title="Knowledge base seeded 🌱" onClose={onClose}>
        <p className="el-card__body">
          Created <strong>{result.created.length}</strong> knowledge note{result.created.length === 1 ? '' : 's'}
          {result.linked ? <> with <strong>{result.linked}</strong> wikilink{result.linked === 1 ? '' : 's'}</> : null}.
          They're live in your resources, the knowledge graph and the vault export.
        </p>
        {result.unresolved.length > 0 && (
          <p className="app-muted">Couldn't resolve these links to workspace entities (skipped): {result.unresolved.join(', ')}</p>
        )}
        <div className="app-form-actions"><span className="app-spacer" /><button className="el-button" onClick={onClose}>Done</button></div>
      </Modal>
    );
  }

  return (
    <Modal title="Seed knowledge base" onClose={onClose}>
      <div className="app-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'files'} className={`app-tab${tab === 'files' ? ' app-tab--active' : ''}`} onClick={() => setTab('files')}>📝 From files</button>
        <button role="tab" aria-selected={tab === 'mcp'} className={`app-tab${tab === 'mcp' ? ' app-tab--active' : ''}`} onClick={() => setTab('mcp')}>🔌 Connect via MCP</button>
      </div>
      {tab === 'mcp' ? (
        <McpConnectTab
          intro={<>
            Connect Claude (or any MCP client) straight to your workspace. Your AI reads the files on your
            machine and calls <code>add_resource</code> once per file — <strong>no staging, no copy-paste, and
            no size limit</strong>. This is the flow to reach for once a batch is too big for one prompt/reply
            round-trip (a large folder, a whole term's materials): the agent works through it turn by turn
            instead of needing it all to fit in one context window.
          </>}
          tools={['get_workspace_context', 'add_resource', 'upsert_classroom', 'upsert_student', 'list_worksheets']}
          checkLabel="↻ Check for new resources"
          onCheck={async () => {
            const before = store.resources().length;
            await hydrate();
            const after = store.resources().length;
            if (after !== before) onApplied?.();
            return after > before ? `✓ ${after - before} new resource${after - before === 1 ? '' : 's'} arrived!` : 'No new resources yet.';
          }}
          skillHint={<>
            <strong>Using Claude Code?</strong> The <code>seed-knowledge-base</code> skill in this repo's{' '}
            <code>skills/</code> folder encodes the whole procedure — install it with{' '}
            <code>npx skills add EnsinoLibre/core</code> and just point it at your folder.
          </>}
        />
      ) : (
      <div className="app-form">
        <div className="app-field">
          <label className="el-label">1 · Add files (bulk)</label>
          <div
            className="app-seed-drop"
            role="button" tabIndex={0}
            onClick={() => fileRef.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click(); } }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
          >
            {staged.length === 0
              ? <>Drop files here, or click to choose. Files stay on your machine — only names and short excerpts go into the prompt.</>
              : <>{staged.length} file{staged.length === 1 ? '' : 's'} staged — drop or click to add more.</>}
          </div>
          <input ref={fileRef} type="file" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          {staged.length > 0 && (
            <ul className="app-seed-files">
              {staged.map((f) => (
                <li key={f.path}>
                  <span className="app-seed-file-name">{f.path}</span>
                  <span className="app-muted">{fmtSize(f.size)}</span>
                  <button className="app-icon-btn" aria-label={`Remove ${f.name}`} title="Remove"
                    onClick={() => { setStaged((prev) => prev.filter((x) => x.path !== f.path)); setPrompt(null); }}>✕</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="app-field">
          <label className="el-label">2 · Hand the prompt to your local agent</label>
          {prompt
            ? <PromptStep prompt={prompt} hint="Paste this into the agent running on the machine where the files live (Claude Code, etc.). It reads each file and writes one front-facing summary note per file — the llm.wiki way." />
            : <p className="app-muted app-seed-hint">Stage your files above, then generate the integration prompt.</p>}
          <div className="app-form-actions">
            <button className="el-button el-button--ghost" disabled={staged.length === 0} onClick={() => setPrompt(buildSeedPrompt(staged, scope))}>
              {prompt ? '↻ Regenerate prompt' : '⚙ Generate prompt'}
            </button>
            {prompt && <CopyButton text={prompt} />}
            <span className="app-spacer" />
            {staged.length > 0 && <button className="el-button el-button--ghost el-button--small" onClick={fileNamesOnly} title="Skip the agent step and just register the file names">Add names only</button>}
          </div>
        </div>

        <div className="app-field">
          <label className="el-label">3 · Paste the agent's JSON reply</label>
          <textarea className="el-input app-seed-prompt" rows={5} value={reply} placeholder='{ "version": "el-kb-seed-1", "resources": [ … ] }'
            onChange={(e) => { setReply(e.target.value); setError(''); }} />
          {error && <p className="app-seed-error">{error}</p>}
          <div className="app-form-actions">
            <span className="app-spacer" />
            <button className="el-button" disabled={!reply.trim()} onClick={integrate}>Integrate into knowledge base →</button>
          </div>
        </div>
      </div>
      )}
    </Modal>
  );
}

/** Small trigger used on every upload surface (resource subcategories etc.). */
export function SeedButton({ scope, label = '⬆ Seed files', small = false, onApplied }: { scope?: SeedScope; label?: string; small?: boolean; onApplied?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={`el-button el-button--ghost${small ? ' el-button--small' : ''}`} onClick={() => setOpen(true)}>{label}</button>
      {open && <SeedModal scope={scope} onClose={() => setOpen(false)} onApplied={onApplied} />}
    </>
  );
}

/* ---------------- Google Classroom import ---------------- */

/**
 * Four-step Google Classroom import, following the same staged-files
 * mechanic as SeedModal: 1. get a real Google Takeout export → 2. select the
 * downloaded folder → 3. hand the prompt to your local agent → 4. paste its
 * JSON back. Step 1 links out to the docs page with the exact Takeout steps,
 * since most teachers have never used Takeout before.
 */
export function ClassroomImportModal({ onClose, onApplied, initialTab = 'files' }: { onClose: () => void; onApplied?: () => void; initialTab?: 'files' | 'mcp' }) {
  const [tab, setTab] = useState<'files' | 'mcp'>(initialTab);
  const [staged, setStaged] = useState<any[]>([]);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const [counts, setCounts] = useState<any | null>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  const addFiles = async (list: FileList | File[] | null) => {
    if (!list || !(list as FileList).length) return;
    const next = await stageFiles(list);
    setStaged((prev) => {
      const seen = new Set(prev.map((f) => f.path));
      return [...prev, ...next.filter((f: any) => !seen.has(f.path))];
    });
    setPrompt(null); // staged set changed → prompt is stale
  };

  const integrate = async () => {
    setError('');
    try {
      const classes = parseClassroomImport(reply);
      setCounts(await applyClassroomImport(classes));
      onApplied?.();
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  };

  if (counts) {
    return (
      <Modal title="Google Classroom imported 🏫" onClose={onClose}>
        <p className="el-card__body">
          {counts.classroomsCreated} classroom{counts.classroomsCreated === 1 ? '' : 's'} created, {counts.classroomsMerged} merged into existing ones, {counts.students} student{counts.students === 1 ? '' : 's'} enrolled and {counts.resources} material{counts.resources === 1 ? '' : 's'} filed as knowledge notes.
        </p>
        <div className="app-form-actions"><span className="app-spacer" /><button className="el-button" onClick={onClose}>Done</button></div>
      </Modal>
    );
  }

  return (
    <Modal title="Import from Google Classroom" onClose={onClose}>
      <div className="app-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'files'} className={`app-tab${tab === 'files' ? ' app-tab--active' : ''}`} onClick={() => setTab('files')}>📝 Copy-paste</button>
        <button role="tab" aria-selected={tab === 'mcp'} className={`app-tab${tab === 'mcp' ? ' app-tab--active' : ''}`} onClick={() => setTab('mcp')}>🔌 Connect via MCP</button>
      </div>
      {tab === 'mcp' ? (
        <McpConnectTab
          intro={<>
            A full Takeout export is often too big for one prompt/reply round-trip — a class with a term's
            worth of Classwork can blow past what fits in a single AI context window. An MCP-connected agent
            doesn't have that problem: point it at your unzipped export folder and it reads class by class,
            calling <code>upsert_classroom</code> and <code>upsert_student</code> once per class/roster entry
            and <code>add_resource</code> once per material — as many turns as it takes. Matching is by name,
            so re-running an import later only adds what's new.
          </>}
          tools={['get_workspace_context', 'upsert_classroom', 'upsert_student', 'add_resource']}
          checkLabel="↻ Check for new classrooms"
          onCheck={async () => {
            const before = store.classrooms().length;
            await hydrate();
            const after = store.classrooms().length;
            if (after !== before) onApplied?.();
            return after > before ? `✓ ${after - before} new classroom${after - before === 1 ? '' : 's'} arrived!` : 'No new classrooms yet — check your students and resources too.';
          }}
          skillHint={<>
            <strong>Using Claude Code?</strong> The <code>seed-knowledge-base</code> skill in this repo's{' '}
            <code>skills/</code> folder covers Google Classroom imports too — install it with{' '}
            <code>npx skills add EnsinoLibre/core</code>, point it at your unzipped export folder, and it
            handles the rest. Full walkthrough: <a className="knw-open-link" href="../docs.html?page=google-classroom-import" target="_blank" rel="noopener">Import from Google Classroom docs</a>.
          </>}
        />
      ) : (
      <div className="app-form">
        <div className="app-field">
          <label className="el-label">1 · Export your data from Google Classroom</label>
          <p className="app-muted app-seed-hint">
            Go to <a className="knw-open-link" href="https://takeout.google.com" target="_blank" rel="noopener">takeout.google.com</a>, select only <strong>Classroom</strong>, choose <strong>.zip</strong>, then <strong>Create export</strong>. Google emails you when it's ready — download and unzip it.
            {' '}Full walkthrough: <a className="knw-open-link" href="../docs.html?page=google-classroom-import" target="_blank" rel="noopener">Import from Google Classroom docs</a>.
          </p>
        </div>

        <div className="app-field">
          <label className="el-label">2 · Select the unzipped export folder</label>
          <div
            className="app-seed-drop"
            role="button" tabIndex={0}
            onClick={() => folderRef.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); folderRef.current?.click(); } }}
          >
            {staged.length === 0
              ? <>Click to choose the folder you unzipped from Takeout. Files stay on your machine — only names and short excerpts go into the prompt.</>
              : <>{staged.length} file{staged.length === 1 ? '' : 's'} staged from the export.</>}
          </div>
          {/* webkitdirectory: Takeout exports one folder per class, so teachers pick the whole tree at once, not file-by-file. */}
          <input ref={folderRef} type="file" multiple hidden {...{ webkitdirectory: '', directory: '' }}
            onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
        </div>

        <div className="app-field">
          <label className="el-label">3 · Hand the prompt to your local agent</label>
          {prompt
            ? <PromptStep prompt={prompt} hint="Paste this into the agent running on the machine where the export lives (Claude Code, etc.). It reads the real files and writes a front-facing summary note per class and material." />
            : <p className="app-muted app-seed-hint">{staged.length === 0 ? 'No export folder selected — you can still generate a prompt and paste details to the agent directly.' : 'Files staged above, then generate the prompt.'}</p>}
          <div className="app-form-actions">
            <button className="el-button el-button--ghost" onClick={() => setPrompt(buildClassroomImportPrompt(staged))}>
              {prompt ? '↻ Regenerate prompt' : '⚙ Generate prompt'}
            </button>
            {prompt && <CopyButton text={prompt} />}
          </div>
        </div>

        <div className="app-field">
          <label className="el-label">4 · Paste the agent's JSON reply</label>
          <textarea className="el-input app-seed-prompt" rows={5} value={reply} placeholder='{ "version": "el-gc-import-1", "classrooms": [ … ] }'
            onChange={(e) => { setReply(e.target.value); setError(''); }} />
          {error && <p className="app-seed-error">{error}</p>}
          <div className="app-form-actions">
            <span className="app-spacer" />
            <button className="el-button" disabled={!reply.trim()} onClick={integrate}>Import into workspace →</button>
          </div>
        </div>
      </div>
      )}
    </Modal>
  );
}

export function ClassroomImportButton({ label = '🏫 Import from Google Classroom', onApplied }: { label?: string; onApplied?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="el-button el-button--ghost" onClick={() => setOpen(true)}>{label}</button>
      {open && <ClassroomImportModal onClose={() => setOpen(false)} onApplied={onApplied} />}
    </>
  );
}

/* ---------------- profile cards ---------------- */

export function SeedKnowledgeBaseCard() {
  const [open, setOpen] = useState(false);
  const n = store.resources().length;
  return (
    <div className="el-card app-vault-card">
      <h3 className="el-card__title">🌱 Seed knowledge base</h3>
      <p className="el-card__body">
        Bulk-add your teaching files. EnsinoLibre builds a prompt for your local AI agent, which reads the
        originals on your machine and returns one front-facing summary note per file — the llm.wiki way:
        the knowledge base keeps token-efficient markdown, you keep the raw files. Big batch that won't fit
        in one prompt/reply? Use the <strong>Connect via MCP</strong> tab instead — no size limit.
      </p>
      <div className="app-form-actions">
        <button className="el-button" onClick={() => setOpen(true)}>Seed from files…</button>
        <span className="el-badge el-badge--neutral">{n} note{n === 1 ? '' : 's'} so far</span>
      </div>
      {open && <SeedModal onClose={() => setOpen(false)} />}
    </div>
  );
}

export function ClassroomImportCard() {
  const [open, setOpen] = useState(false);
  return (
    <div className="el-card app-vault-card">
      <h3 className="el-card__title">🏫 Import from Google Classroom</h3>
      <p className="el-card__body">
        Bring your Google Classroom classes, rosters and materials into the knowledge base. Your local agent
        gathers the data and summarizes each class and material into a front-facing markdown note. A full
        Takeout export is often too big for one prompt/reply — the <strong>Connect via MCP</strong> tab lets an
        agent import it class by class instead, with no size limit.
      </p>
      <button className="el-button" onClick={() => setOpen(true)}>Import from Classroom…</button>
      {open && <ClassroomImportModal onClose={() => setOpen(false)} />}
    </div>
  );
}
