/** EnsinoLibre — landing page wiring: form → prompt → paste JSON → rendered worksheet. */

import { ACTIVITY_TYPES, buildPrompt, validateSpec } from './prompt-builder.js';
import { validateWorksheet } from './validator.js';
import { renderWorksheet } from './renderer.js';
import { emitAnalog } from './analog.js';

const $ = (sel) => document.querySelector(sel);

/* ---- activity-type checkboxes, grouped; core six ticked by default ---- */
const typesHost = $('#f-types');
const groups = [...new Set(ACTIVITY_TYPES.map((t) => t.group))];
for (const group of groups) {
  const heading = document.createElement('div');
  heading.className = 'oc-help';
  heading.style.width = '100%';
  heading.style.marginTop = '0.4rem';
  heading.textContent = group;
  typesHost.appendChild(heading);
  for (const t of ACTIVITY_TYPES.filter((x) => x.group === group)) {
    const label = document.createElement('label');
    label.className = 'oc-check';
    label.title = t.blurb;
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = 'activityTypes';
    input.value = t.id;
    input.checked = t.group === 'Core';
    label.appendChild(input);
    const span = document.createElement('span');
    span.textContent = t.label;
    label.appendChild(span);
    typesHost.appendChild(label);
  }
}

/* ---- step 1: build the prompt ---- */
function showErrors(host, errors) {
  if (!errors.length) {
    host.classList.add('oc-hidden');
    host.textContent = '';
    return;
  }
  host.classList.remove('oc-hidden');
  host.textContent = '';
  const strong = document.createElement('strong');
  strong.textContent = errors.length === 1 ? 'One thing to fix:' : 'A few things to fix:';
  host.appendChild(strong);
  const ul = document.createElement('ul');
  for (const e of errors) {
    const li = document.createElement('li');
    li.textContent = e;
    ul.appendChild(li);
  }
  host.appendChild(ul);
}

$('#oc-spec-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const form = ev.target;
  const spec = {
    subject: form.subject.value,
    topic: form.topic.value,
    audience: form.audience.value,
    language: form.language.value,
    difficulty: form.difficulty.value,
    activityCount: Number(form.activityCount.value),
    activityTypes: [...form.querySelectorAll('input[name="activityTypes"]:checked')].map((i) => i.value),
    extras: form.extras.value,
  };
  const errors = validateSpec(spec);
  if (spec.activityTypes.length === 0) errors.push('Tick at least one activity type.');
  showErrors($('#oc-spec-errors'), errors);
  if (errors.length) return;
  $('#oc-prompt-output').value = buildPrompt(spec);
  $('#oc-prompt-panel').classList.remove('oc-hidden');
  $('#oc-prompt-panel').scrollIntoView({ behavior: 'smooth' });
});

/* ---- step 2: copy ---- */
$('#oc-copy-btn').addEventListener('click', async () => {
  const text = $('#oc-prompt-output').value;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    $('#oc-prompt-output').select();
    document.execCommand('copy');
  }
  const done = $('#oc-copy-done');
  done.classList.remove('oc-hidden');
  setTimeout(() => done.classList.add('oc-hidden'), 2500);
});

/* ---- step 3: paste + render ---- */
function extractJson(raw) {
  // Tolerate assistants that wrap the JSON in ``` fences or add prose around it.
  const text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence ? fence[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) throw new Error('No JSON object found in the pasted text.');
  return JSON.parse(candidate.slice(start, end + 1));
}

let currentWorksheet = null;

function renderFromText(raw) {
  const errHost = $('#oc-json-errors');
  let ws;
  try {
    ws = extractJson(raw);
  } catch (e) {
    showErrors(errHost, [`That doesn't look like valid JSON: ${e.message}`]);
    $('#oc-render-panel').classList.add('oc-hidden');
    return;
  }
  const errors = validateWorksheet(ws);
  showErrors(errHost, errors);
  if (errors.length) {
    $('#oc-render-panel').classList.add('oc-hidden');
    return;
  }
  currentWorksheet = ws;
  renderWorksheet(ws, $('#oc-worksheet-host'));
  $('#oc-render-panel').classList.remove('oc-hidden');
  $('#oc-render-panel').scrollIntoView({ behavior: 'smooth' });
}

$('#oc-render-btn').addEventListener('click', () => renderFromText($('#oc-json-input').value));

/* ---- analog (Markdown) export: the offline translation of the worksheet ---- */
$('#oc-analog-btn').addEventListener('click', () => {
  if (!currentWorksheet) return;
  const md = emitAnalog(currentWorksheet);
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${currentWorksheet.title.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}.worksheet.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
});

$('#oc-demo-btn').addEventListener('click', async () => {
  const res = await fetch('examples/demo-worksheet.json');
  const text = await res.text();
  $('#oc-json-input').value = text;
  renderFromText(text);
});

$('#oc-print-btn').addEventListener('click', () => window.print());
