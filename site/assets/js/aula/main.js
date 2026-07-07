/** EnsinoLibre — student aula app entry (Supabase-backed, code-gated). */
import { session } from './api.js';
import { route, setNotFound, startRouter, navigate } from '../app/router.js';
import { renderJoin, renderHome, renderWorksheet } from './views.js';

const root = document.getElementById('aula');

route('/join', () => renderJoin(root));
route('/', () => { if (!session.get()) return navigate('/join'); renderHome(root); });
route('/w/:id', (p) => { if (!session.get()) return navigate('/join'); renderWorksheet(root, p.id); });
setNotFound(() => navigate(session.get() ? '/' : '/join'));

startRouter();
