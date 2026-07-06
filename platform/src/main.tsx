import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { marked } from 'marked';
import './styles/index.css';
import { App } from './App';

// exporters.js (shared with the public generator) uses window.marked for the
// Analog PDF; provide it in the bundled platform.
(window as any).marked = marked;

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);
