/**
 * EnsinoLibre — worksheet exporters (shared by the generator and the teacher app).
 *
 * Exposes: JSON, Analog Markdown, Analog PDF (print), and Moodle XML question
 * import. All run client-side and are self-contained. NOT wired into the
 * student aula view — export is a teacher/author affordance only.
 */
import { emitAnalog } from './analog.js';

export function slugify(s) {
  return String(s || 'worksheet').trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'worksheet';
}

export function download(name, content, mime) {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

/* ---------- JSON ---------- */
export function exportJSON(ws) {
  download(`${slugify(ws.title)}.worksheet.json`, JSON.stringify(ws, null, 2), 'application/json');
}

/* ---------- Analog Markdown ---------- */
export function exportMarkdown(ws) {
  download(`${slugify(ws.title)}.worksheet.md`, emitAnalog(ws), 'text/markdown;charset=utf-8');
}

/* ---------- Analog PDF (print the rendered analog worksheet) ---------- */
export function exportAnalogPDF(ws) {
  const md = emitAnalog(ws);
  const body = (window.marked ? window.marked.parse(md) : `<pre>${escapeHtml(md)}</pre>`);
  const doc = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(ws.title)}</title>
<style>
  @page { margin: 18mm; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #111; line-height: 1.5; max-width: 720px; margin: 0 auto; }
  h1 { font-size: 22pt; margin: 0 0 4pt; }
  h2 { font-size: 15pt; border-bottom: 1px solid #999; padding-bottom: 3pt; margin-top: 20pt; }
  h3, h4 { font-size: 12pt; margin-top: 14pt; }
  table { border-collapse: collapse; width: 100%; margin: 8pt 0; }
  th, td { border: 1px solid #999; padding: 4pt 6pt; text-align: left; font-size: 10.5pt; }
  code, pre { font-family: 'Consolas', monospace; font-size: 10pt; }
  pre { background: #f5f5f5; padding: 8pt; border: 1px solid #ddd; white-space: pre; overflow: visible; }
  blockquote { border-left: 3px solid #ccc; margin: 6pt 0; padding: 2pt 0 2pt 10pt; color: #333; }
  ul, ol { margin: 6pt 0; }
  hr { border: none; border-top: 2px solid #333; margin: 20pt 0; }
  @media print { body { max-width: none; } }
</style></head><body>${body}
<script>window.onload=function(){setTimeout(function(){window.print();},250);};<\/script>
</body></html>`;
  const win = window.open('', '_blank');
  if (!win) { alert('Please allow pop-ups to export a PDF (then use your browser’s “Save as PDF”).'); return; }
  win.document.open();
  win.document.write(doc);
  win.document.close();
}

/* ---------- Moodle XML (question import) ---------- */

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
const cdata = (html) => `<![CDATA[${html}]]>`;
const txt = (s) => `<text>${escapeHtml(s)}</text>`;
const htmlText = (html) => `<text>${cdata(html)}</text>`;

function qName(s, i) {
  const clean = String(s).replace(/\s+/g, ' ').trim().slice(0, 60) || `Question ${i}`;
  return `<name>${txt(clean)}</name>`;
}

function mcqXML(q, i) {
  const answers = q.options.map((o, oi) =>
    `    <answer fraction="${oi === q.answer ? 100 : 0}" format="html"><text>${cdata(escapeHtml(o))}</text>${oi === q.answer && q.explanation ? `<feedback format="html">${htmlText('<p>' + escapeHtml(q.explanation) + '</p>')}</feedback>` : ''}</answer>`
  ).join('\n');
  return `  <question type="multichoice">
    ${qName(q.question, i)}
    <questiontext format="html">${htmlText('<p>' + escapeHtml(q.question) + '</p>')}</questiontext>
    <defaultgrade>1.0</defaultgrade><penalty>0.3333333</penalty>
    <single>true</single><shuffleanswers>true</shuffleanswers><answernumbering>abc</answernumbering>
${answers}
  </question>`;
}

function tfXML(q, i) {
  const t = q.answer;
  return `  <question type="truefalse">
    ${qName(q.statement, i)}
    <questiontext format="html">${htmlText('<p>' + escapeHtml(q.statement) + '</p>')}</questiontext>
    <defaultgrade>1.0</defaultgrade>
    <answer fraction="${t ? 100 : 0}"><text>true</text>${q.explanation ? `<feedback format="html">${htmlText('<p>' + escapeHtml(q.explanation) + '</p>')}</feedback>` : ''}</answer>
    <answer fraction="${t ? 0 : 100}"><text>false</text></answer>
  </question>`;
}

function clozeAnswer(answers) {
  // Escape Moodle cloze special chars inside answers.
  const esc = (a) => a.replace(/[\\{}~=#|]/g, (m) => '\\' + m);
  return answers.map((a, i) => (i === 0 ? '=' : '~=') + esc(a)).join('');
}
function gapXML(q, i, GAP_RE) {
  let body = q.text.replace(GAP_RE, (_, inner) => {
    const answers = inner.split('|').map((s) => s.trim()).filter(Boolean);
    return `{1:SHORTANSWER:${clozeAnswer(answers)}}`;
  });
  return `  <question type="cloze">
    ${qName(q.text, i)}
    <questiontext format="html">${htmlText('<p>' + escapeHtml(body).replace(/\{1:SHORTANSWER:[^}]*\}/g, (m) => m) + '</p>')}</questiontext>
    <generalfeedback format="html">${q.explanation ? htmlText('<p>' + escapeHtml(q.explanation) + '</p>') : '<text></text>'}</generalfeedback>
  </question>`;
}

function matchXML(q, i) {
  const subs = q.pairs.map((p) =>
    `    <subquestion format="html"><text>${cdata(escapeHtml(p.left))}</text><answer><text>${escapeHtml(p.right)}</text></answer></subquestion>`
  ).join('\n');
  return `  <question type="matching">
    ${qName(q.prompt, i)}
    <questiontext format="html">${htmlText('<p>' + escapeHtml(q.prompt) + '</p>')}</questiontext>
    <defaultgrade>1.0</defaultgrade><shuffleanswers>true</shuffleanswers>
${subs}
  </question>`;
}

/** Collect gradeable questions from a worksheet (flattening set/context types). */
function collectQuestions(ws) {
  const out = [];
  for (const section of ws.sections) {
    for (const a of section.activities) {
      switch (a.type) {
        case 'mcq': out.push({ kind: 'mcq', q: a }); break;
        case 'true-false': out.push({ kind: 'tf', q: a }); break;
        case 'gap-fill': out.push({ kind: 'gap', q: a }); break;
        case 'matching': out.push({ kind: 'match', q: a }); break;
        case 'quiz': case 'single-choice-set': a.questions.forEach((q) => out.push({ kind: 'mcq', q })); break;
        case 'question-set': a.questions.forEach((q) => out.push({ kind: q.subtype === 'true-false' ? 'tf' : q.subtype === 'gap-fill' ? 'gap' : 'mcq', q })); break;
        case 'reading-comp': a.questions.forEach((q) => {
          const kind = q.type === 'true-false' ? 'tf' : q.type === 'gap-fill' ? 'gap' : q.type === 'matching' ? 'match' : 'mcq';
          out.push({ kind, q, passage: a.passage });
        }); break;
        default: break; // ordering, open-response, flashdeck, etc. — no Moodle question type
      }
    }
  }
  return out;
}

export function toMoodleXML(ws) {
  const GAP_RE = /\{\{([^{}]+)\}\}/g;
  const items = collectQuestions(ws);
  const body = items.map((it, i) => {
    // For reading-comp questions, prepend the passage into the question text once handled per-item.
    let q = it.q;
    if (it.passage && (it.kind === 'mcq' || it.kind === 'tf')) {
      const field = it.kind === 'tf' ? 'statement' : 'question';
      q = { ...q, [field]: `Passage: ${it.passage}\n\n${q[field]}` };
    }
    if (it.kind === 'mcq') return mcqXML(q, i + 1);
    if (it.kind === 'tf') return tfXML(q, i + 1);
    if (it.kind === 'gap') return gapXML(q, i + 1, GAP_RE);
    if (it.kind === 'match') return matchXML(q, i + 1);
    return '';
  }).filter(Boolean).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Moodle question import generated by EnsinoLibre for "${escapeHtml(ws.title)}" -->
<quiz>
${body}
</quiz>
`;
}

export function exportMoodle(ws) {
  const xml = toMoodleXML(ws);
  const count = (xml.match(/<question type=/g) || []).length;
  if (count === 0) { alert('This worksheet has no auto-gradeable questions to import into Moodle.'); return; }
  download(`${slugify(ws.title)}.moodle.xml`, xml, 'application/xml');
}

/** Count of Moodle-importable questions (for UI hints). */
export function moodleQuestionCount(ws) {
  return collectQuestions(ws).length;
}
