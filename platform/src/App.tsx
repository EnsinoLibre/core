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

type Phase = 'loading' | 'authed' | 'anon' | 'error';

function Splash() {
  return (
    <div className="app-auth">
      <div className="app-auth-brand"><img src="./brand/wordmark-primary-light.svg" alt="EnsinoLibre" height={30} /></div>
      <p className="app-muted">Loading your workspace…</p>
    </div>
  );
}

/** Session exists but the initial workspace fetch failed (e.g. flaky network)
 *  — a transient error, not a logout, so retry in place rather than routing
 *  to /login (issue #31: that used to masquerade as a random sign-out). */
function HydrateError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="app-auth">
      <div className="app-auth-brand"><img src="./brand/wordmark-primary-light.svg" alt="EnsinoLibre" height={30} /></div>
      <p className="app-muted">Couldn't load your workspace — check your connection.</p>
      <button className="el-button" onClick={onRetry}>Retry</button>
    </div>
  );
}

export function App() {
  const [phase, setPhase] = useState<Phase>('loading');
  // The user id we've already hydrated for. Supabase re-emits SIGNED_IN /
  // TOKEN_REFRESHED on tab focus and hourly refreshes; we must NOT blank the
  // app and re-fetch each time — only (re)hydrate when the user actually changes.
  const hydratedFor = useRef<string | null>(null);
  const lastSession = useRef<any>(null);

  const tryHydrate = async (session: any) => {
    setPhase('loading');
    try { await hydrate(); hydratedFor.current = session.user.id; setPhase('authed'); }
    catch (e) { console.error('hydrate failed', e); setPhase('error'); }
  };

  useEffect(() => {
    let alive = true;
    // onAuthStateChange fires INITIAL_SESSION on load (with or without a
    // persisted session), then SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED.
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event: string, session: any) => {
      if (!alive) return;
      lastSession.current = session;
      if (!session) { hydratedFor.current = null; setPhase('anon'); return; }
      if (hydratedFor.current === session.user.id) { setPhase('authed'); return; }
      await tryHydrate(session);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  if (phase === 'loading') return <Splash />;
  if (phase === 'error') return <HydrateError onRetry={() => tryHydrate(lastSession.current)} />;

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
