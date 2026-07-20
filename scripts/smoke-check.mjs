/**
 * EnsinoLibre — post-deploy smoke check (issue #43).
 *
 * Verifies a deployed site actually serves what we just built. Two failure
 * modes this catches, both of which have bitten us before (HANDOFF.md §4):
 *
 *  1. A route stops resolving (e.g. a stray `site/app.html` file shadowing the
 *     built `site/app/` directory).
 *  2. The deploy "succeeded" but the old hashed bundle is still being served —
 *     so the new build never actually went live. We read the freshly built
 *     `site/app/index.html` from disk, extract its hashed `index-*.js` name,
 *     and assert the DEPLOYED page references that same file.
 *
 * Every request carries a cache-buster and no-cache headers so a CDN/browser
 * cache can't make a stale deploy look healthy.
 *
 * Usage:
 *   node scripts/smoke-check.mjs                        # checks the live site
 *   node scripts/smoke-check.mjs --base https://x.dev   # checks another origin
 *   node scripts/smoke-check.mjs --verify-fresh         # also assert the deployed
 *                                                       # bundle == the local build
 *
 * `--verify-fresh` is what the deploy workflow passes immediately after
 * building, when `site/app/` is guaranteed current. Don't use it on an ad-hoc
 * local run: `site/app/` is gitignored build output that is usually stale, so a
 * mismatch there tells you nothing about the health of the deploy.
 *
 * Exits non-zero (with a readable reason) on the first hard failure.
 * No dependencies — plain Node 22+ (global fetch).
 */
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_BASE = 'https://ensinolibre-app.netlify.app';

const args = process.argv.slice(2);
const argOf = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const base = String(argOf('--base', process.env.DEPLOY_URL || DEFAULT_BASE)).replace(/\/+$/, '');
const verifyFresh = args.includes('--verify-fresh');
const timeoutMs = Number(argOf('--timeout', '20000'));

let failures = 0;
const pass = (msg) => console.log(`  ok    ${msg}`);
const fail = (msg, detail) => {
  failures += 1;
  console.error(`  FAIL  ${msg}${detail ? `\n        ${detail}` : ''}`);
};

/** GET with a cache-buster + no-cache headers, so we never grade a cached response. */
async function get(path) {
  const url = `${base}${path}${path.includes('?') ? '&' : '?'}cb=${Date.now()}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'cache-control': 'no-cache', pragma: 'no-cache' },
    });
    const body = await res.text();
    return { ok: res.ok, status: res.status, body, url };
  } catch (err) {
    return { ok: false, status: 0, body: '', url, error: err.message };
  } finally {
    clearTimeout(timer);
  }
}

async function checkRoute(path, { contains } = {}) {
  const res = await get(path);
  if (!res.ok) {
    fail(`GET ${path} → ${res.status || 'network error'}`, res.error || res.url);
    return null;
  }
  if (contains && !res.body.includes(contains)) {
    fail(`GET ${path} returned 200 but is missing expected content`, `expected to find: ${contains}`);
    return res;
  }
  pass(`GET ${path} → 200${contains ? ` (contains "${contains}")` : ''}`);
  return res;
}

/** The hashed entry bundle the local build produced, e.g. "index-CgcHO5KI.js". */
async function localBundleName() {
  try {
    const html = await readFile(join(ROOT, 'site', 'app', 'index.html'), 'utf8');
    const m = html.match(/index-[A-Za-z0-9_-]+\.js/);
    return m ? m[0] : null;
  } catch {
    return null;
  }
}

console.log(`\nSmoke-checking ${base}\n`);

console.log('1) Public routes');
await checkRoute('/site/index.html', { contains: 'EnsinoLibre' });
await checkRoute('/site/aula.html');
await checkRoute('/site/docs.html');

console.log('\n2) Teacher platform');
const appRes = await checkRoute('/site/app/');
if (appRes) {
  const deployedBundle = (appRes.body.match(/index-[A-Za-z0-9_-]+\.js/) || [])[0];
  if (!deployedBundle) {
    fail('/site/app/ does not reference a hashed index-*.js bundle', 'the built app entry may not have been published');
  } else {
    pass(`/site/app/ references ${deployedBundle}`);
    const asset = await get(`/site/app/assets/${deployedBundle}`);
    if (asset.ok) pass(`bundle ${deployedBundle} is fetchable`);
    else fail(`bundle ${deployedBundle} is not fetchable`, `→ ${asset.status || asset.error}`);

    if (verifyFresh) {
      const expected = await localBundleName();
      if (!expected) {
        fail('--verify-fresh was requested but there is no local site/app/index.html', 'build the platform and run scripts/sync-app.mjs before deploying');
      } else if (expected !== deployedBundle) {
        fail(
          'the deployed app is serving a DIFFERENT bundle than the build we just published',
          `built ${expected} but ${base} serves ${deployedBundle} — the deploy did not go live (or a CDN cache is stale)`,
        );
      } else {
        pass(`deployed bundle matches the build we just published (${expected})`);
      }
    } else {
      console.log('  skip  bundle-freshness check (pass --verify-fresh right after a build)');
    }
  }
}

console.log(
  failures === 0
    ? `\n✅ smoke check passed — ${base} is serving the current build\n`
    : `\n❌ smoke check failed (${failures} problem${failures === 1 ? '' : 's'})\n`,
);
process.exit(failures === 0 ? 0 : 1);
