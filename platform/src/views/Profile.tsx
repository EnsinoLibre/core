import { useState } from 'react';
import { store } from '../lib/api';
import { PageHead, Avatar } from '../components/bits';

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
        </div>
      </div>
    </div>
  );
}
