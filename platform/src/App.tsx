import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { auth } from './lib/api';
import { Shell } from './components/Shell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Login } from './views/Login';
import { Dashboard } from './views/Dashboard';
import { Knowledge } from './views/Knowledge';
import { Classrooms } from './views/Classrooms';
import { Students } from './views/Students';
import { Resources } from './views/Resources';
import { Worksheets } from './views/Worksheets';
import { Live } from './views/Live';
import { Profile } from './views/Profile';

function RequireAuth({ children }: { children: JSX.Element }) {
  const loc = useLocation();
  if (!auth.isAuthed()) return <Navigate to="/login" state={{ from: loc }} replace />;
  return children;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <Shell>
              <ErrorBoundary>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/knowledge" element={<Knowledge />} />
                  <Route path="/classrooms" element={<Classrooms />} />
                  <Route path="/students" element={<Students />} />
                  <Route path="/resources" element={<Resources />} />
                  <Route path="/worksheets" element={<Worksheets />} />
                  <Route path="/live" element={<Live />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </ErrorBoundary>
            </Shell>
          </RequireAuth>
        }
      />
    </Routes>
  );
}
