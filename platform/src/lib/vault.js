/**
 * EnsinoLibre — export the teacher workspace as an Obsidian-style vault.
 *
 * One markdown note per classroom, student, worksheet, resource and live
 * class, with YAML frontmatter and [[wikilinks]] connecting them. This is the
 * token-efficient, agent-friendly representation of the workspace: an AI agent
 * (or a human in Obsidian) can read the linked notes instead of parsing JSON.
 */
import { store } from './store.js';
import { emitAnalog } from './analog.js';

/** Obsidian note names allow spaces; strip only filesystem-illegal chars. */
function noteName(s) { return String(s).replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim(); }
const link = (name) => `[[${noteName(name)}]]`;
const fmDate = (iso) => (iso ? iso.slice(0, 10) : '');

function frontmatter(obj) {
  const lines = ['---'];
  for (const [k, v] of Object.entries(obj)) {
    if (v == null || v === '') continue;
    if (Array.isArray(v)) { lines.push(`${k}:`); v.forEach((x) => lines.push(`  - ${x}`)); }
    else lines.push(`${k}: ${String(v).includes(':') ? `"${v}"` : v}`);
  }
  lines.push('---', '');
  return lines.join('\n');
}

export function buildVault() {
  const files = [];
  const t = store.teacher();

  /* Teacher */
  files.push({ name: 'Teacher.md', content:
    frontmatter({ type: 'teacher', name: t.name, email: t.email, school: t.school, subjects: t.subjects, tags: ['ensinolibre/teacher'] }) +
    `# ${t.name}\n\n${t.bio || ''}\n\n## Classrooms\n` +
    store.classrooms().map((c) => `- ${link(c.name)}`).join('\n') + '\n' });

  /* Classrooms */
  for (const c of store.classrooms()) {
    const roster = store.studentsIn(c.id);
    const resources = store.resourcesIn(c.id);
    const aulas = store.aulasForClass(c.id);
    files.push({ name: `Classrooms/${noteName(c.name)}.md`, content:
      frontmatter({ type: 'classroom', subject: c.subject, level: c.level, term: c.term, students: roster.length, tags: ['ensinolibre/classroom'] }) +
      `# ${c.name}\n\n${c.description || ''}\n\n## Context\n${c.context || '_No context yet._'}\n\n` +
      `## Students\n${roster.map((s) => `- ${link(s.name)}`).join('\n') || '_None yet._'}\n\n` +
      `## Resources\n${resources.map((r) => `- ${link(r.title)}`).join('\n') || '_None yet._'}\n\n` +
      `## Live classes\n${aulas.map((a) => `- ${link(a.title)} (code ${a.code}, ${a.status})`).join('\n') || '_None._'}\n` });
  }

  /* Students */
  for (const s of store.students()) {
    const cls = store.classroom(s.classId);
    const obs = (s.notes || []).map((n) => `- ${fmDate(n.at)} — ${n.text}`).join('\n');
    files.push({ name: `Students/${noteName(s.name)}.md`, content:
      frontmatter({ type: 'student', level: s.level, pronouns: s.pronouns, class: cls ? noteName(cls.name) : '', tags: ['ensinolibre/student'] }) +
      `# ${s.name}\n\n${cls ? `Class: ${link(cls.name)}\n\n` : ''}` +
      `## Goals\n${s.goals || '_None set._'}\n\n## Needs & context\n${s.needs || '_None yet._'}\n\n` +
      `## Observations\n${obs || '_None yet._'}\n` });
  }

  /* Worksheets (with analog content = token-efficient) */
  for (const w of (store.worksheetsAll ? store.worksheetsAll() : [])) {
    const aula = store.aulas().find((a) => a.worksheetIds.includes(w.id));
    const cls = aula ? store.classroom(aula.classId) : null;
    let analog = '';
    try { analog = emitAnalog(w.doc); } catch { analog = '_Worksheet content unavailable._'; }
    // Drop the analog's own frontmatter block; we supply our own.
    analog = analog.replace(/^---\n[\s\S]*?\n---\n\n?/, '');
    files.push({ name: `Worksheets/${noteName(w.title)}.md`, content:
      frontmatter({ type: 'worksheet', subject: w.subject, class: cls ? noteName(cls.name) : '', deployedIn: aula ? noteName(aula.title) : '', tags: ['ensinolibre/worksheet'] }) +
      analog + '\n' });
  }

  /* Resources */
  for (const r of store.resources()) {
    const cls = r.classId ? store.classroom(r.classId) : null;
    files.push({ name: `Resources/${noteName(r.title)}.md`, content:
      frontmatter({ type: 'resource', 'resource-type': r.type, subject: r.subject, class: cls ? noteName(cls.name) : '', created: fmDate(r.createdAt), tags: (r.tags || []).map((x) => `ensinolibre/${x}`).concat('ensinolibre/resource') }) +
      `# ${r.title}\n\n${cls ? `Class: ${link(cls.name)}\n\n` : ''}${r.note || ''}\n` });
  }

  /* Live classes (aula) with progress */
  for (const a of store.aulas()) {
    const cls = store.classroom(a.classId);
    const worksheets = store.aulaWorksheets(a.id);
    const enrollments = store.enrollments(a.id);
    const rows = ['| Student | Worksheet | Progress | Score | Status | Validation |', '|---|---|---|---|---|---|'];
    for (const e of enrollments) {
      for (const w of worksheets) {
        const p = store.getProgress(a.id, e.id, w.id);
        rows.push(`| ${e.name} | ${w.title} | ${p ? `${p.attempted}/${p.total}` : '0/0'} | ${p ? Math.round((p.score || 0) * 100) + '%' : '—'} | ${p?.done ? 'complete' : (p?.attempted ? 'in progress' : 'not started')} | ${p?.validated || ''} |`);
      }
    }
    files.push({ name: `Live Classes/${noteName(a.title)}.md`, content:
      frontmatter({ type: 'live-class', code: a.code, status: a.status, class: cls ? noteName(cls.name) : '', created: fmDate(a.createdAt), tags: ['ensinolibre/live-class'] }) +
      `# ${a.title}\n\n${cls ? `Class: ${link(cls.name)}\n\n` : ''}Join code: **${a.code}**\n\n` +
      `## Worksheets\n${worksheets.map((w) => `- ${link(w.title)}`).join('\n')}\n\n## Progress\n${rows.join('\n')}\n` });
  }

  /* Index */
  files.push({ name: 'README.md', content:
    frontmatter({ type: 'index', exported: new Date().toISOString().slice(0, 16).replace('T', ' '), tags: ['ensinolibre'] }) +
    `# EnsinoLibre workspace\n\nAn Obsidian-style export of ${store.teacher().name}'s teaching workspace. ` +
    `Open this folder as an Obsidian vault, or point an AI agent at it.\n\n` +
    `- ${link('Teacher')}\n- **Classrooms/** — ${store.classrooms().length}\n- **Students/** — ${store.students().length}\n` +
    `- **Worksheets/** — ${(store.worksheetsAll ? store.worksheetsAll() : []).length}\n- **Resources/** — ${store.resources().length}\n- **Live Classes/** — ${store.aulas().length}\n` });

  return files;
}
