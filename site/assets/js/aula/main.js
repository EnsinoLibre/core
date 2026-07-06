/** EnsinoLibre aula — student app entry: join guard + routes. */
import { studentAuth } from '../app/store.js';
import { route, setNotFound, startRouter, navigate } from '../app/router.js';
import { clear } from '../app/util.js';
import { joinView, homeView, worksheetView } from './views.js';

const root = document.getElementById('aula');

function render(node) { clear(root); root.appendChild(node); window.scrollTo(0, 0); }

function guard(factory) {
  return (params) => {
    if (!studentAuth.isJoined()) { navigate('/join'); return; }
    render(factory(params));
  };
}

route('/join', () => { if (studentAuth.isJoined()) { navigate('/'); return; } render(joinView()); });
route('/', guard(homeView));
route('/w/:id', guard((p) => worksheetView(p)));
setNotFound(() => navigate(studentAuth.isJoined() ? '/' : '/join'));

startRouter();
