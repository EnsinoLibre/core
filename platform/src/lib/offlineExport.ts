/**
 * Export a worksheet as a single, self-contained, FULLY OFFLINE .html file.
 *
 * Everything is inlined — the worksheet JSON, the bundled exercise engine
 * (vendor/player.bundle.js), and the stylesheets — so a student can open the
 * file in any browser with no internet, no account and no install, do the
 * exercises, and download a small "answers" file to send back. The teacher
 * imports that answers file for validation (see store.importSubmission).
 */
// @ts-ignore - ?raw string imports (bundled by Vite)
import playerJs from '../../../site/assets/vendor/player.bundle.js?raw';
// @ts-ignore
import tokensCss from '../../../site/assets/vendor/tokens.css?raw';
// @ts-ignore
import buttonCss from '../../../site/assets/vendor/primitives/button.css?raw';
// @ts-ignore
import cardCss from '../../../site/assets/vendor/primitives/card.css?raw';
// @ts-ignore
import inputCss from '../../../site/assets/vendor/primitives/input.css?raw';
// @ts-ignore
import badgeCss from '../../../site/assets/vendor/primitives/badge.css?raw';
// @ts-ignore
import stylesCss from '../../../site/assets/styles.css?raw';

const PLAYER_CSS = `
body { margin: 0; background: var(--color-surface); color: var(--color-text); font-family: var(--font-body); line-height: 1.6; }
* { box-sizing: border-box; }
.elp-top { position: sticky; top: 0; z-index: 10; display: flex; align-items: baseline; gap: 12px; padding: 9px 20px; background: var(--color-surface); border-bottom: 1px solid var(--color-border); }
.elp-brand { font-family: var(--font-display); font-weight: 700; color: var(--color-primary); }
.elp-top-title { color: var(--color-text-muted); font-size: 0.88rem; }
.elp-main { max-width: 820px; margin: 0 auto; padding: 24px 20px 72px; }
.elp-gate { max-width: 460px; margin: 48px auto; padding: 28px; }
.elp-h1 { font-family: var(--font-display); font-size: 1.5rem; line-height: 1.2; margin: 0 0 6px; }
.elp-sub { color: var(--color-text-muted); margin: 0 0 16px; }
.elp-gate .el-input { margin-bottom: 4px; }
.elp-start { margin-top: 16px; width: 100%; }
.elp-err { color: var(--color-danger-fg); font-size: 0.85rem; margin: 6px 0 0; min-height: 1.1em; }
.elp-foot { position: sticky; bottom: 0; margin-top: 32px; padding: 16px 0 12px; background: linear-gradient(transparent, var(--color-surface) 45%); text-align: center; }
.elp-finish { font-size: 1rem; }
.elp-foot-note { color: var(--color-text-muted); font-size: 0.8rem; margin: 8px 0 0; }
.elp-done { margin: 0 0 24px; padding: 20px; border-left: 4px solid var(--color-primary); }
.elp-done-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
`;

const stripImports = (css: string) => String(css).replace(/@import[^;]+;/g, '');
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const sanitizeFile = (s: string) => String(s).replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function exportInteractiveHTML(worksheet: { id: string; title?: string; doc: any }) {
  const title = worksheet.title || worksheet.doc?.title || 'Worksheet';
  const css = [tokensCss, buttonCss, cardCss, inputCss, badgeCss, stripImports(stylesCss), PLAYER_CSS].join('\n');

  // Escape "<" / ">" / "&" in the JSON so worksheet content (e.g. inline SVG in
  // image-hotspots) can't break out of the <script> tag; JSON.parse restores it.
  const payload = JSON.stringify({ doc: worksheet.doc, worksheetId: worksheet.id, worksheetTitle: title })
    .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
  // A "</script>" inside the minified bundle (only ever inside a string literal)
  // would otherwise close our tag early.
  const player = String(playerJs).replace(/<\/(script)/gi, '<\\/$1');
  const lang = (worksheet.doc?.language || 'en').slice(0, 2);

  const html = `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} — EnsinoLibre</title>
<style>${css}</style>
</head>
<body>
<div id="el-player"></div>
<script>window.__EL__ = ${payload};</script>
<script>${player}</script>
</body>
</html>`;

  download(`${sanitizeFile(title)} (offline).html`, html, 'text/html');
}
