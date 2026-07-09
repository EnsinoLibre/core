import { useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { supabase, hydrate } from './lib/api';
import { Shell } from './components/Shell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Login } from './views/Login';
import { Dashboard } from './views/Dashboard';
import { Knowledge } from './views/Knowledge';
import { Classrooms } from './views/Classrooms';
import { Students } from './views/Students';
import { Resources } from './views/Resources';
import { Worksheets } from './views/Worksheets';
import { WorksheetDetail } from './views/WorksheetDetail';
import { Live } from './views/Live';
import { Profile } from './views/Profile';

type Phase = 'loading' | 'authed' | 'anon';

function Splash() {
  return (
    <div className="app-auth">
      <div className="app-auth-brand"><img src="./brand/wordmark-primary-light.svg" alt="EnsinoLibre" height={30} /></div>
      <p className="app-muted">Loading your workspace…</p>
    </div>
  );
}

export function App() {
  const [phase, setPhase] = useState<Phase>('loading');
  // The user id we've already hydrated for. Supabase re-emits SIGNED_IN /
  // TOKEN_REFRESHED on tab focus and hourly refreshes; we must NOT blank the
  // app and re-fetch each time — only (re)hydrate when the user actually changes.
  const hydratedFor = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    // onAuthStateChange fires INITIAL_SESSION on load (with or without a
    // persisted session), then SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED.
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event: string, session: any) => {
      if (!alive) return;
      if (!session) { hydratedFor.current = null; setPhase('anon'); return; }
      if (hydratedFor.current === session.user.id) { setPhase('authed'); return; }
      setPhase('loading');
      try { await hydrate(); hydratedFor.current = session.user.id; if (alive) setPhase('authed'); }
      catch (e) { console.error('hydrate failed', e); if (alive) setPhase('anon'); }
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  if (phase === 'loading') return <Splash />;

  return (
    <Routes>
      <Route path="/login" element={phase === 'authed' ? <Navigate to="/" replace /> : <Login />} />
      <Route
        path="/*"
        element={
          phase !== 'authed' ? (
            <Navigate to="/login" replace />
          ) : (
            <Shell>
              <ErrorBoundary>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/knowledge" element={<Knowledge />} />
                  <Route path="/classrooms" element={<Classrooms />} />
                  <Route path="/students" element={<Students />} />
                  <Route path="/resources" element={<Resources />} />
                  <Route path="/worksheets" element={<Worksheets />} />
                  <Route path="/worksheets/:id" element={<WorksheetDetail />} />
                  <Route path="/live" element={<Live />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </ErrorBoundary>
            </Shell>
          )
        }
      />
    </Routes>
  );
}
