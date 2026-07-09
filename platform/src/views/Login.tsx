import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/api';

export function Login() {
  const nav = useNavigate();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('teacher@ensinolibre.org');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setNotice(null); setBusy(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) { setError(error.message); return; }
        nav('/'); // App's onAuthStateChange hydrates and swaps to the workspace
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { data: { name: name.trim() } },
        });
        if (error) { setError(error.message); return; }
        if (data.session) nav('/'); // confirmation disabled → signed in immediately
        else { setNotice('Account created. Check your email to confirm, then sign in.'); setMode('login'); }
      }
    } finally { setBusy(false); }
  };

  return (
    <div className="app-auth">
      <div className="app-auth-brand"><img src="./brand/wordmark-primary-light.svg" alt="EnsinoLibre" height={30} /></div>
      <form className="el-card app-auth-card app-form" onSubmit={submit}>
        <h1 className="app-auth-title">{mode === 'login' ? 'Teacher sign in' : 'Create your teacher account'}</h1>
        <p className="app-auth-sub">Demo teacher: <strong>teacher@ensinolibre.org</strong> / <strong>ensinolibre</strong></p>
        {mode === 'signup' && (
          <div className="app-field"><label className="el-label">Name</label><input className="el-input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        )}
        <div className="app-field"><label className="el-label">Email</label><input className="el-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="app-field"><label className="el-label">Password</label><input className="el-input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === 'login' ? '' : 'At least 6 characters'} /></div>
        {error && <div className="oc-errors"><strong>{error}</strong></div>}
        {notice && <p className="app-saved">{notice}</p>}
        <button className="el-button app-auth-submit" type="submit" disabled={busy}>
          {busy ? 'Please wait…' : (mode === 'login' ? 'Sign in' : 'Create account')}
        </button>
        <p className="app-auth-switch">
          {mode === 'login' ? 'New here? ' : 'Already have an account? '}
          <a href="#" onClick={(e) => { e.preventDefault(); setError(null); setNotice(null); setMode(mode === 'login' ? 'signup' : 'login'); }}>
            {mode === 'login' ? 'Create an account' : 'Sign in'}
          </a>
        </p>
        <p className="app-auth-back"><a href="../index.html">← Back to the worksheet generator</a></p>
      </form>
    </div>
  );
}
