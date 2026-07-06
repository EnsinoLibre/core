import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../lib/api';

export function Login() {
  const nav = useNavigate();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('teacher@ensinolibre.org');

  return (
    <div className="app-auth">
      <div className="app-auth-brand"><img src="./brand/wordmark-primary-light.svg" alt="EnsinoLibre" height={30} /></div>
      <form
        className="el-card app-auth-card app-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (mode === 'signup') auth.signup(name.trim(), email.trim());
          else auth.login(email.trim());
          nav('/');
        }}
      >
        <h1 className="app-auth-title">{mode === 'login' ? 'Teacher sign in' : 'Create your teacher account'}</h1>
        <p className="app-auth-sub">Prototype — any details work; nothing is sent anywhere.</p>
        {mode === 'signup' && (
          <div className="app-field"><label className="el-label">Name</label><input className="el-input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        )}
        <div className="app-field"><label className="el-label">Email</label><input className="el-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="app-field"><label className="el-label">Password</label><input className="el-input" type="password" defaultValue="demo" /></div>
        <button className="el-button app-auth-submit" type="submit">{mode === 'login' ? 'Sign in' : 'Create account'}</button>
        <p className="app-auth-switch">
          {mode === 'login' ? 'New here? ' : 'Already have an account? '}
          <a href="#" onClick={(e) => { e.preventDefault(); setMode(mode === 'login' ? 'signup' : 'login'); }}>
            {mode === 'login' ? 'Create an account' : 'Sign in'}
          </a>
        </p>
        <p className="app-auth-back"><a href="../index.html">← Back to the worksheet generator</a></p>
      </form>
    </div>
  );
}
