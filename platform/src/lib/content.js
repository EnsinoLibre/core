/**
 * EnsinoLibre — per-entity "content" for the global content panel.
 *
 * The knowledge graph is only ONE way to look at the workspace. Every entity
 * (teacher, classroom, student, worksheet, resource, live class) also has a
 * markdown "note" behind it — the same content the Obsidian vault export and
 * the old graph focus-popup surfaced. `entityContent(nodeId)` returns that note
 * plus its typed connections, so any card or panel in the app can open it.
 *
 * Node id scheme (shared with graph.js + resource.links):
 *   "teacher" | "class:<id>" | "student:<id>" | "worksheet:<id>"
 *   "resource:<id>" | "aula:<id>"
 */
import { store } from './store.js';
import { deriveGraph, NODE_TYPES } from './graph.js';
import { DOC_PAGES, docBySlug, docGroup, docId, docGroupId, docUrl, worksheetsUsing } from './docslayer.js';

const wiki = (name) => `[[${String(name).replace(/[[\]]/g, '')}]]`;
const fmtDate = (iso) => { try { return iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''; } catch { return ''; } };

/** Human label for a node type (resource kinds included). */
export function typeLabel(type) {
  return NODE_TYPES[type] || (type || '').replace(/^resource-/, '').replace(/^\w/, (c) => c.toUpperCase()) || 'Note';
}

/* ---------------- wikilink resolution ---------------- */

function nameIndex() {
  const idx = new Map();
  const add = (name, id) => { if (name) idx.set(String(name).trim().toLowerCase(), id); };
  // docs first so workspace names win on collision
  add('EnsinoLibre docs', 'docs');
  for (const g of DOC_PAGES) { add(g.group, docGroupId(g.group)); for (const p of g.pages) add(p.title, docId(p.slug)); }
  add(store.teacher().name, 'teacher');
  for (const c of store.classrooms()) add(c.name, 'class:' + c.id);
  for (const s of store.students()) add(s.name, 'student:' + s.id);
  for (const w of store.worksheetsAll()) add(w.title, 'worksheet:' + w.id);
  for (const r of store.resources()) add(r.title, 'resource:' + r.id);
  for (const a of store.aulas()) add(a.title, 'aula:' + a.id);
  return idx;
}

/** Resolve a [[wikilink]] display name to a node id, or null. */
export function resolveWikilink(name) {
  return nameIndex().get(String(name).trim().toLowerCase()) || null;
}

/* ---------------- connections ---------------- */

const REL_LABEL = { owns: 'teaches', member: 'in class', deploy: 'deployed', context: 'context', wiki: 'linked', docs: 'section', uses: 'uses' };

/** Typed connections for a node, derived from the same graph the viz uses. */
export function entityConnections(nodeId) {
  const { nodes, edges } = deriveGraph({ includeDocs: true });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out = [];
  const seen = new Set();
  for (const e of edges) {
    const other = e.source === nodeId ? e.target : e.target === nodeId ? e.source : null;
    if (!other || seen.has(other) || !byId.has(other)) continue;
    seen.add(other);
    const n = byId.get(other);
    out.push({ id: other, type: n.type, label: n.label, rel: REL_LABEL[e.kind] || e.kind });
  }
  return out;
}

/* ---------------- per-entity markdown ---------------- */

function classroomMd(c) {
  const roster = store.studentsIn(c.id);
  const resources = store.resourcesIn(c.id);
  const aulas = store.aulasForClass(c.id);
  const parts = [];
  if (c.description) parts.push(c.description);
  parts.push(`## Context\n${c.context || '_No context captured yet._'}`);
  parts.push(`## Students (${roster.length})\n${roster.map((s) => `- ${wiki(s.name)} — ${s.level || 'level tbd'}`).join('\n') || '_None yet._'}`);
  if (resources.length) parts.push(`## Resources\n${resources.map((r) => `- ${wiki(r.title)}`).join('\n')}`);
  if (aulas.length) parts.push(`## Live classes\n${aulas.map((a) => `- ${wiki(a.title)} — code \`${a.code}\` (${a.status})`).join('\n')}`);
  return parts.join('\n\n');
}

function studentMd(s) {
  const cls = store.classroom(s.classId);
  const obs = (s.notes || []).map((n) => `- ${fmtDate(n.at)} — ${n.text}`).join('\n');
  const ctx = store.resources().filter((r) => r.studentId === s.id);
  const parts = [];
  if (cls) parts.push(`**Class:** ${wiki(cls.name)}${s.pronouns ? ` · ${s.pronouns}` : ''}`);
  parts.push(`## Goals\n${s.goals || '_None set yet._'}`);
  parts.push(`## Needs & context\n${s.needs || '_None captured yet._'}`);
  parts.push(`## Observations\n${obs || '_None yet._'}`);
  if (ctx.length) parts.push(`## Context files\n${ctx.map((r) => `- ${wiki(r.title)}`).join('\n')}`);
  return parts.join('\n\n');
}

function resourceMd(r) {
  const cls = r.classId ? store.classroom(r.classId) : null;
  const stu = r.studentId ? store.student(r.studentId) : null;
  const parts = [];
  const meta = [cls && `**Class:** ${wiki(cls.name)}`, stu && `**Student:** ${wiki(stu.name)}`].filter(Boolean).join(' · ');
  if (meta) parts.push(meta);
  if (r.note) parts.push(r.note);
  if (r.url) parts.push(`[Open resource ↗](${r.url})`);
  if ((r.tags || []).length) parts.push(`_Tags: ${r.tags.join(', ')}_`);
  return parts.join('\n\n') || '_No content yet._';
}

function worksheetMd(w) {
  const activities = w.doc?.sections?.reduce((n, s) => n + s.activities.length, 0) || 0;
  const aulas = store.aulas().filter((a) => a.worksheetIds.includes(w.id));
  const parts = [`${w.subject || 'Worksheet'} · ${activities} activities`];
  const secs = (w.doc?.sections || []).map((s) => `- **${s.title}** — ${s.activities.length} activities`).join('\n');
  if (secs) parts.push(`## Sections\n${secs}`);
  if (aulas.length) parts.push(`## Deployed in\n${aulas.map((a) => `- ${wiki(a.title)} — code \`${a.code}\``).join('\n')}`);
  return parts.join('\n\n');
}

function aulaMd(a) {
  const cls = store.classroom(a.classId);
  const worksheets = store.aulaWorksheets(a.id);
  const enrollments = store.enrollments(a.id);
  const parts = [];
  if (cls) parts.push(`**Class:** ${wiki(cls.name)}`);
  parts.push(`Join code: \`${a.code}\` · status: **${a.status}** · ${enrollments.length} student${enrollments.length === 1 ? '' : 's'} joined`);
  parts.push(`## Worksheets\n${worksheets.map((w) => `- ${wiki(w.title)}`).join('\n') || '_None._'}`);
  return parts.join('\n\n');
}

/* ---------------- docs layer markdown ---------------- */

function docUsageMd(slug) {
  if (!slug.startsWith('activities/')) return '';
  const used = worksheetsUsing(slug);
  if (!used.length) return `## Used in your worksheets\n_Not used in any worksheet yet._`;
  return `## Used in your worksheets (${used.length})\n${used.map((w) => `- ${wiki(w.title)}`).join('\n')}`;
}

function docMd(slug) {
  const d = docBySlug(slug);
  const parts = [d.blurb, docUsageMd(slug), `_Part of the universal EnsinoLibre docs layer — context every knowledge base carries._`];
  return parts.filter(Boolean).join('\n\n');
}

function docGroupMd(name) {
  const g = docGroup(name);
  const rows = g.pages.map((p) => {
    const used = p.slug.startsWith('activities/') ? worksheetsUsing(p.slug).length : 0;
    return `- ${wiki(p.title)}${used ? ` — used in ${used} worksheet${used === 1 ? '' : 's'}` : ''}`;
  });
  return `## Pages\n${rows.join('\n')}`;
}

function docsHubMd() {
  const groups = DOC_PAGES.map((g) => `- ${wiki(g.group)} — ${g.pages.length} pages`).join('\n');
  return `The universal context layer every EnsinoLibre knowledge base carries: the platform docs, floating behind your workspace. Activity docs connect to the worksheets built with them — an at-a-glance map of which components are used where.\n\n## Sections\n${groups}`;
}

/**
 * Full content descriptor for a node id.
 * Returns null for unknown ids.
 */
export function entityContent(nodeId) {
  if (!nodeId) return null;
  const [kind, id] = nodeId.includes(':') ? nodeId.split(':') : [nodeId, null];

  let type = kind, title = '', subtitle = '', markdown = '', url, route;

  if (kind === 'teacher') {
    const t = store.teacher();
    type = 'teacher'; title = t.name; subtitle = t.school || 'Teacher';
    markdown = [t.bio, `## Classrooms\n${store.classrooms().map((c) => `- ${wiki(c.name)}`).join('\n') || '_None yet._'}`].filter(Boolean).join('\n\n');
  } else if (kind === 'class') {
    const c = store.classroom(id); if (!c) return null;
    type = 'class'; title = c.name; subtitle = [c.subject, c.level, c.term].filter(Boolean).join(' · ');
    markdown = classroomMd(c);
  } else if (kind === 'student') {
    const s = store.student(id); if (!s) return null;
    type = 'student'; title = s.name; subtitle = s.level ? `Level ${s.level}` : (s.pronouns || 'Student');
    markdown = studentMd(s);
  } else if (kind === 'worksheet') {
    const w = store.worksheet(id); if (!w) return null;
    type = 'worksheet'; title = w.title; subtitle = w.subject || 'Worksheet';
    markdown = worksheetMd(w); route = `/worksheets/${w.id}`;
  } else if (kind === 'resource') {
    const r = store.resource(id); if (!r) return null;
    type = 'resource-' + (r.kind || 'material'); title = r.title;
    subtitle = [typeLabel(type), r.subject].filter(Boolean).join(' · ');
    markdown = resourceMd(r); url = r.url;
  } else if (kind === 'aula') {
    const a = store.aula(id); if (!a) return null;
    type = 'aula'; title = a.title; subtitle = `Live class · code ${a.code}`;
    markdown = aulaMd(a); route = '/live';
  } else if (kind === 'docs') {
    type = 'doc-hub'; title = 'EnsinoLibre docs'; subtitle = 'Universal context layer';
    markdown = docsHubMd(); url = docUrl('overview');
  } else if (kind === 'docgroup') {
    const g = docGroup(id); if (!g) return null;
    type = 'doc-group'; title = g.group; subtitle = `EnsinoLibre docs · ${g.pages.length} pages`;
    markdown = docGroupMd(id);
  } else if (kind === 'doc') {
    const d = docBySlug(id); if (!d) return null;
    type = 'doc'; title = d.title; subtitle = `EnsinoLibre docs · ${d.group}`;
    markdown = docMd(id); url = docUrl(id);
  } else {
    return null;
  }

  return { id: nodeId, type, typeLabel: typeLabel(type), title, subtitle, markdown, url, route, connections: entityConnections(nodeId) };
}
