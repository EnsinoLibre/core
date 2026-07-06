/**
 * Open Curriculum — zero-dependency static dev server.
 * Serves open-curriculum/ so the site can fetch ../docs/*.md.
 *
 *   node open-curriculum/server.mjs [port]   (default 3210)
 *
 * / redirects to /site/index.html.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.argv[2]) || 3210;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

createServer(async (req, res) => {
  try {
    let urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (urlPath === '/' || urlPath === '/site' || urlPath === '/site/') {
      res.writeHead(302, { Location: '/site/index.html' });
      return res.end();
    }
    let filePath = normalize(join(ROOT, urlPath));
    if (!filePath.startsWith(normalize(ROOT))) {
      res.writeHead(403);
      return res.end('Forbidden');
    }
    // Directory index: serve index.html for "/foo/" or a bare directory.
    if (urlPath.endsWith('/') || !extname(filePath)) {
      try { const b = await readFile(join(filePath, 'index.html')); filePath = join(filePath, 'index.html'); res.writeHead(200, { 'Content-Type': MIME['.html'] }); return res.end(b); } catch { /* fall through to file read */ }
    }
    const body = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath).toLowerCase()] || 'application/octet-stream' });
    res.end(body);
  } catch (e) {
    res.writeHead(e.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain' });
    res.end(e.code === 'ENOENT' ? 'Not found' : 'Server error');
  }
}).listen(PORT, () => {
  console.log(`Open Curriculum dev server: http://localhost:${PORT}/site/index.html`);
});
