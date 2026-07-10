/**
 * EnsinoLibre — knowledge-base seeding.
 *
 * The teacher's raw materials live on THEIR machine; the workspace holds
 * front-facing summarizing markdown notes (llm.wiki philosophy, after
 * Karpathy: every artefact gets a small, token-efficient md summary an LLM
 * can read instead of the raw file). Seeding follows the platform's core
 * copy-paste mechanic:
 *
 *   1. Teacher picks files (bulk) — we stage names + text excerpts locally.
 *   2. We build a prompt for their LOCAL agent (Claude Code etc.), which has
 *      the actual files on disk.
 *   3. The agent replies with strict JSON: one front-facing summary md per
 *      file, plus kind/subject/tags/wikilinks.
 *   4. Teacher pastes the JSON back; we create linked resources in the
 *      knowledge base (and thus in the graph + vault export).
 *
 * The Google Classroom import works the same way: prompt out, JSON in,
 * classrooms/students/materials created with summarizing context md.
 */
import { store } from './store.js';
import { resolveWikilink } from './content.js';

export const SEED_SCHEMA_VERSION = 'el-kb-seed-1';
export const GC_SCHEMA_VERSION = 'el-gc-import-1';

export const RESOURCE_KINDS = ['material', 'guideline', 'external', 'context'];

/* ---------------- file staging (client-side, nothing leaves the browser) ---------------- */

const TEXT_EXTS = new Set(['md', 'markdown', 'txt', 'csv', 'tsv', 'json', 'html', 'htm', 'tex', 'srt', 'vtt', 'rtf', 'yaml', 'yml', 'xml']);
const MAX_TEXT_BYTES = 2 * 1024 * 1024; // don't file.text() anything huge
const EXCERPT_CHARS = 900;

const extOf = (name) => (String(name).includes('.') ? String(name).split('.').pop().toLowerCase() : '');

export function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Stage a FileList / File[] for prompt building. Text-like files contribute a
 * short excerpt (helps the agent orient); binaries contribute metadata only —
 * the agent reads the real files on the teacher's disk.
 */
export async function stageFiles(fileList) {
  const files = Array.from(fileList || []);
  return Promise.all(files.map(async (f) => {
    const ext = extOf(f.name);
    const staged = {
      name: f.name,
      // webkitRelativePath is set when a whole folder is picked
      path: f.webkitRelativePath || f.name,
      size: f.size, ext, mime: f.type || '',
      excerpt: '', truncated: false,
    };
    if (TEXT_EXTS.has(ext) && f.size <= MAX_TEXT_BYTES) {
      try {
        const text = await f.text();
        staged.excerpt = text.slice(0, EXCERPT_CHARS).trim();
        staged.truncated = text.length > EXCERPT_CHARS;
      } catch { /* metadata-only is fine */ }
    }
    return staged;
  }));
}

/* ---------------- shared prompt fragments ---------------- */

function workspaceContextMd() {
  const t = store.teacher();
  const classes = store.classrooms();
  const lines = [
    `Teacher: ${t.name}${t.school ? ` (${t.school})` : ''}${t.subjects ? ` — subjects: ${t.subjects}` : ''}`,
  ];
  if (classes.length) {
    lines.push('Classrooms:');
    for (const c of classes) {
      const n = store.studentsIn(c.id).length;
      lines.push(`- "${c.name}" — ${[c.subject, c.level, c.term].filter(Boolean).join(', ') || 'no metadata'} (${n} students)`);
    }
  }
  const titles = store.resources().map((r) => r.title).slice(0, 40);
  if (titles.length) lines.push(`Existing resource notes (link to these by exact name where relevant): ${titles.map((x) => `"${x}"`).join(', ')}`);
  return lines.join('\n');
}

const PHILOSOPHY = `PHILOSOPHY (llm.wiki, after Karpathy): the knowledge base never stores raw files — it stores a FRONT-FACING SUMMARIZING MARKDOWN note per file. Each note must let an LLM (or the teacher) grasp the file's content and pedagogical use WITHOUT opening the original. Write summaries dense and factual, not promotional. Keep each under ~200 words, followed by a short "Key points" bullet list. Use [[wikilinks]] with the EXACT names of workspace entities (classrooms, students, existing resources) when the file clearly relates to them.`;

/** Tolerant JSON extraction: strips code fences, grabs the outermost object. */
export function extractJson(text) {
  let s = String(text || '').trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('No JSON object found in the pasted text.');
  return JSON.parse(s.slice(start, end + 1));
}

/* ---------------- seed prompt (bulk files → summaries) ---------------- */

/**
 * Build the copy-paste prompt for the teacher's local agent.
 * scope: { kind?, classId?, studentId? } — fixes the target subcategory /
 * classroom / student when seeding from a scoped surface.
 */
export function buildSeedPrompt(stagedFiles, scope = {}) {
  const cls = scope.classId ? store.classroom(scope.classId) : null;
  const stu = scope.studentId ? store.student(scope.studentId) : null;

  const fileBlock = stagedFiles.map((f) => {
    const head = `### ${f.path} (${fmtSize(f.size)}${f.mime ? `, ${f.mime}` : ''})`;
    return f.excerpt ? `${head}\nExcerpt${f.truncated ? ' (truncated)' : ''}:\n\`\`\`\n${f.excerpt}\n\`\`\`` : head;
  }).join('\n\n');

  const kindLine = scope.kind
    ? `Every entry MUST use "kind": "${scope.kind}" (the teacher is seeding that subcategory directly).`
    : `Choose "kind" per file from: ${RESOURCE_KINDS.join(' | ')}. Use "material" for teaching material, "guideline" for curricula/rubrics/policies, "context" for background knowledge about learners or the class, "external" for things that are really pointers to the web.`;

  const scopeLines = [
    cls ? `All entries belong to the classroom "${cls.name}" — mention it in summaries where useful.` : '',
    stu ? `All entries are context for the student "${stu.name}".` : '',
  ].filter(Boolean).join('\n');

  return `You are the teacher's local agent, running on the machine where the files below live. Your job: integrate them into the teacher's EnsinoLibre knowledge base by writing one front-facing summarizing markdown note per file.

${PHILOSOPHY}

WORKSPACE
${workspaceContextMd()}

FILES TO INTEGRATE (${stagedFiles.length})
The teacher selected these files in their browser; locate them on disk (ask the teacher for the folder if unclear) and READ EACH ONE fully before summarizing. Excerpts below are only for orientation.

${fileBlock}

INSTRUCTIONS
1. Read every file. For PDFs/DOCX/media, extract or describe the actual content — never summarize from the filename alone.
2. For each file, produce a front-facing summary markdown note (see PHILOSOPHY).
3. ${kindLine}
${scopeLines ? scopeLines + '\n' : ''}4. Reply with STRICT JSON ONLY (no prose, no code fences) matching exactly:

{
  "version": "${SEED_SCHEMA_VERSION}",
  "resources": [
    {
      "file": "<the file path exactly as listed above>",
      "title": "<short human title for the note>",
      "kind": "material | guideline | external | context",
      "subject": "<subject area, e.g. Biology>",
      "tags": ["lowercase", "tags"],
      "url": "<original URL if the file points to one, else omit>",
      "summary": "<the front-facing markdown note: ~200-word summary, then '**Key points**' bullets, with [[wikilinks]] to workspace entities>",
      "links": ["<exact workspace entity names this relates to, e.g. a classroom or student name>"]
    }
  ]
}

The teacher will paste your JSON back into EnsinoLibre, which creates one linked note per file in the knowledge base.`;
}

/** Validate + normalize the agent's pasted seed JSON. Throws with a readable message. */
export function parseSeedResult(text) {
  const doc = extractJson(text);
  if (doc.version && doc.version !== SEED_SCHEMA_VERSION) {
    throw new Error(`Unexpected version "${doc.version}" (expected ${SEED_SCHEMA_VERSION}).`);
  }
  const list = Array.isArray(doc.resources) ? doc.resources : null;
  if (!list || !list.length) throw new Error('JSON has no "resources" array.');
  return list.map((r, i) => {
    if (!r || typeof r !== 'object') throw new Error(`resources[${i}] is not an object.`);
    const title = String(r.title || r.file || '').trim();
    if (!title) throw new Error(`resources[${i}] is missing "title".`);
    const summary = String(r.summary || '').trim();
    if (!summary) throw new Error(`resources[${i}] ("${title}") is missing "summary" — every file needs its front-facing md.`);
    return {
      file: String(r.file || '').trim(),
      title,
      kind: RESOURCE_KINDS.includes(r.kind) ? r.kind : null,
      subject: String(r.subject || '').trim(),
      tags: Array.isArray(r.tags) ? r.tags.map((t) => String(t).trim()).filter(Boolean) : [],
      url: r.url ? String(r.url).trim() : undefined,
      summary,
      links: Array.isArray(r.links) ? r.links.map((l) => String(l).trim()).filter(Boolean) : [],
    };
  });
}

/**
 * Create knowledge-base resources from parsed seed entries.
 * Returns { created, linked, unresolved } for the success summary.
 */
export function applySeedResult(entries, scope = {}) {
  let linked = 0;
  const unresolved = [];
  const created = entries.map((e) => {
    const r = store.addResource({
      title: e.title,
      kind: scope.kind || e.kind || 'context',
      type: e.file ? (extOf(e.file) || 'file') : 'note',
      subject: e.subject,
      classId: scope.classId || null,
      studentId: scope.studentId || null,
      url: e.url,
      note: e.summary,
      tags: e.tags,
    });
    for (const name of e.links) {
      const target = resolveWikilink(name);
      if (target && target !== 'resource:' + r.id) { store.linkResource(r.id, target); linked++; }
      else if (!target) unresolved.push(name);
    }
    return r;
  });
  return { created, linked, unresolved };
}

/* ---------------- Google Classroom import ---------------- */

export function buildClassroomImportPrompt() {
  return `You are the teacher's local agent. Your job: pull the teacher's Google Classroom data and prepare it for import into their EnsinoLibre knowledge base.

${PHILOSOPHY}

WORKSPACE (already in EnsinoLibre — merge, don't duplicate)
${workspaceContextMd()}

HOW TO GET THE DATA (pick what you can actually do; ask the teacher which they prefer):
- Browse classroom.google.com in the teacher's logged-in browser and read each class: name, section/level, description, roster (People tab), and Classwork materials.
- Or read a Google Takeout export of Classroom the teacher downloaded (folder of JSON/HTML).
- Or have the teacher paste the roster and materials to you directly.

INSTRUCTIONS
1. For EVERY class, write a "context" field: a front-facing summarizing markdown note describing the group, level, what they've covered, and current focus (see PHILOSOPHY).
2. For every Classwork material worth keeping, write its own front-facing "summary" markdown.
3. Skip classes/students that already exist in the workspace above unless you have new information.
4. Reply with STRICT JSON ONLY (no prose, no code fences) matching exactly:

{
  "version": "${GC_SCHEMA_VERSION}",
  "classrooms": [
    {
      "name": "<class name>",
      "subject": "<subject>",
      "level": "<level/section, e.g. B2, Grade 9>",
      "term": "<term/year if known>",
      "description": "<one-line description>",
      "context": "<front-facing markdown note about this class>",
      "students": [
        { "name": "<full name>", "level": "", "goals": "", "needs": "" }
      ],
      "materials": [
        { "title": "<material title>", "url": "<link if any>", "tags": [], "summary": "<front-facing markdown note>" }
      ]
    }
  ]
}

The teacher will paste your JSON back into EnsinoLibre, which creates the classrooms, enrolls the students, and files each material as a linked knowledge-base note.`;
}

/** Validate + normalize pasted Google Classroom JSON. Throws with a readable message. */
export function parseClassroomImport(text) {
  const doc = extractJson(text);
  if (doc.version && doc.version !== GC_SCHEMA_VERSION) {
    throw new Error(`Unexpected version "${doc.version}" (expected ${GC_SCHEMA_VERSION}).`);
  }
  const list = Array.isArray(doc.classrooms) ? doc.classrooms : null;
  if (!list || !list.length) throw new Error('JSON has no "classrooms" array.');
  return list.map((c, i) => {
    const name = String(c?.name || '').trim();
    if (!name) throw new Error(`classrooms[${i}] is missing "name".`);
    return {
      name,
      subject: String(c.subject || '').trim(),
      level: String(c.level || '').trim(),
      term: String(c.term || '').trim(),
      description: String(c.description || '').trim(),
      context: String(c.context || '').trim(),
      students: (Array.isArray(c.students) ? c.students : []).map((s) => ({
        name: String(s?.name || '').trim(),
        level: String(s?.level || '').trim(),
        goals: String(s?.goals || '').trim(),
        needs: String(s?.needs || '').trim(),
      })).filter((s) => s.name),
      materials: (Array.isArray(c.materials) ? c.materials : []).map((m) => ({
        title: String(m?.title || '').trim(),
        url: m?.url ? String(m.url).trim() : undefined,
        tags: Array.isArray(m?.tags) ? m.tags.map((t) => String(t).trim()).filter(Boolean) : [],
        summary: String(m?.summary || '').trim(),
      })).filter((m) => m.title),
    };
  });
}

/**
 * Merge parsed Google Classroom data into the workspace. Existing classrooms
 * (matched by name, case-insensitive) are reused: context is filled if empty,
 * only missing students/materials are added. Returns counts for the summary.
 */
export function applyClassroomImport(classes) {
  const counts = { classroomsCreated: 0, classroomsMerged: 0, students: 0, resources: 0 };
  for (const c of classes) {
    let cls = store.classrooms().find((x) => x.name.trim().toLowerCase() === c.name.toLowerCase());
    if (cls) {
      counts.classroomsMerged++;
      const patch = {};
      if (!cls.context && c.context) patch.context = c.context;
      if (!cls.description && c.description) patch.description = c.description;
      if (Object.keys(patch).length) store.updateClassroom(cls.id, patch);
    } else {
      cls = store.addClassroom({
        name: c.name, subject: c.subject, level: c.level, term: c.term,
        description: c.description, context: c.context,
      });
      counts.classroomsCreated++;
    }
    const roster = new Set(store.studentsIn(cls.id).map((s) => s.name.trim().toLowerCase()));
    for (const s of c.students) {
      if (roster.has(s.name.toLowerCase())) continue;
      store.addStudent(cls.id, { name: s.name, level: s.level, goals: s.goals, needs: s.needs });
      counts.students++;
    }
    const existing = new Set(store.resourcesIn(cls.id).map((r) => r.title.trim().toLowerCase()));
    for (const m of c.materials) {
      if (existing.has(m.title.toLowerCase())) continue;
      store.addResource({
        title: m.title, kind: m.summary ? 'material' : 'external', type: 'google-classroom',
        subject: c.subject, classId: cls.id, url: m.url, note: m.summary,
        tags: ['google-classroom', ...m.tags],
      });
      counts.resources++;
    }
  }
  return counts;
}
