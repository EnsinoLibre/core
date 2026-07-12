// Copies the platform's Vite build output (platform/dist) into site/app, the
// path the published site serves the teacher platform from. Run after
// `npm run build` in platform/ — used both by the Netlify build command and
// for manual local deploys.
import { cpSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(root, 'platform', 'dist');
const dest = path.join(root, 'site', 'app');

if (!existsSync(dist)) {
  console.error(`sync-app: ${dist} does not exist — run "npm run build" in platform/ first`);
  process.exit(1);
}

rmSync(path.join(dest, 'assets'), { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(dist, dest, { recursive: true });

console.log(`sync-app: copied ${dist} -> ${dest}`);
