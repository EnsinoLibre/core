import { useState } from 'react';
import { store, buildVault, makeZip } from '../lib/api';
import { PageHead, Avatar } from '../components/bits';
import { SeedKnowledgeBaseCard, ClassroomImportCard } from '../components/SeedKB';
import { AgentActivityCard } from '../components/AgentActivity';

function downloadVault() {
  const blob = makeZip(buildVault());
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ensinolibre-workspace.zip';
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
}

export function Profile() {
  const t = store.teacher();
  const [form, setForm] = useState({ name: t.name, email: t.email, school: t.school, subjects: t.subjects, bio: t.bio });
  const [saved, setSaved] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div>
      <PageHead title="Teacher profile" subtitle="How you appear across the platform." />
      <div className="app-grid-2">
        <form className="el-card app-form" onSubmit={(e) => { e.preventDefault(); store.updateTeacher(form); setSaved(true); setTimeout(() => setSaved(false), 2500); }}>
          {([['name', 'Full name'], ['email', 'Email'], ['school', 'School / institution'], ['subjects', 'Subjects']] as const).map(([k, label]) => (
            <div className="app-field" key={k}><label className="el-label">{label}</label><input className="el-input" value={(form as any)[k]} onChange={(e) => set(k, e.target.value)} /></div>
          ))}
          <div className="app-field"><label className="el-label">Bio</label><textarea className="el-input" rows={4} value={form.bio} onChange={(e) => set('bio', e.target.value)} /></div>
          <div className="app-form-actions"><button className="el-button" type="submit">Save changes</button>{saved && <span className="app-saved">Saved ✓</span>}</div>
        </form>
        <div>
          <div className="el-card app-profile-card">
            <Avatar name={form.name} size={72} />
            <h3 className="el-card__title app-profile-name">{form.name}</h3>
            <p className="app-muted">{form.school}</p>
            <p className="el-card__body">{form.subjects}</p>
          </div>
          <SeedKnowledgeBaseCard />
          <ClassroomImportCard />
          <AgentActivityCard />
          <div className="el-card app-vault-card">
            <h3 className="el-card__title">🗂️ Obsidian vault export</h3>
            <p className="el-card__body">Download your whole workspace — classrooms, students, worksheets, resources and live classes — as linked Markdown notes with frontmatter and [[wikilinks]]. Open it in Obsidian, or hand it to an AI agent for token-efficient access.</p>
            <button className="el-button" onClick={downloadVault}>⬇ Download vault (.zip)</button>
          </div>
          <div className="el-card app-danger-card">
            <h3 className="el-card__title">Workspace data</h3>
            <p className="el-card__body">Your workspace is stored in your EnsinoLibre account (Supabase), synced across devices. Refresh to re-pull the latest from the server.</p>
            <button className="el-button el-button--ghost el-button--small" onClick={() => location.reload()}>Refresh from server</button>
          </div>
        </div>
      </div>
    </div>
  );
}
