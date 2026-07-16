/**
 * EnsinoLibre — MCP server (Model Context Protocol, streamable HTTP).
 *
 * Lets any MCP client (Claude Code, Claude Desktop/claude.ai connectors, …)
 * work directly inside a teacher's workspace: read the workspace context,
 * fetch the worksheet contract, and create worksheets / knowledge notes —
 * the "no copy-paste" path next to the platform's prompt builder.
 *
 * Auth: custom bearer keys (`elk_…`) generated in the teacher app (Create
 * worksheet → Connect via MCP). Only SHA-256 hashes live in `agent_keys`;
 * the function maps key → teacher_id and writes with the service role,
 * always scoped to that teacher. Deploy with verify_jwt OFF (custom auth):
 *
 *   supabase functions deploy mcp --no-verify-jwt
 *
 * validator.js / prompt-builder.js are verbatim copies of the canonical
 * modules in site/assets/js — keep them in sync.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
// @ts-ignore - pure JS modules shared with the site
import { validateWorksheet } from './validator.js';
// @ts-ignore
import { CONTRACTS, ACTIVITY_TYPES } from './prompt-builder.js';

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-agent-key, content-type, mcp-session-id, mcp-protocol-version',
  'Access-Control-Expose-Headers': 'mcp-session-id',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS } });

const rpcResult = (id: unknown, result: unknown) => json({ jsonrpc: '2.0', id, result });
const rpcError = (id: unknown, code: number, message: string, status = 200) =>
  json({ jsonrpc: '2.0', id, error: { code, message } }, status);

async function sha256hex(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

interface Auth { teacherId: string; agentKeyId: string; agentLabel: string }
interface AuthResult { who: Auth | null; expired?: boolean }

/** Resolve the agent key from headers → { who, expired? } (issue #47: a key with a past expires_at is rejected distinctly from an unrecognised one, so the client can tell "generate a new key" from "check your key"). */
async function authenticate(req: Request): Promise<AuthResult> {
  const auth = req.headers.get('authorization') || '';
  const raw = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : (req.headers.get('x-agent-key') || '').trim();
  if (!raw.startsWith('elk_')) return { who: null };
  const hash = await sha256hex(raw);
  const { data } = await supa.from('agent_keys').select('id,teacher_id,label,expires_at').eq('key_hash', hash).maybeSingle();
  if (!data) return { who: null };
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) return { who: null, expired: true };
  supa.from('agent_keys').update({ last_used_at: new Date().toISOString() }).eq('id', data.id).then(() => {});
  return { who: { teacherId: data.teacher_id, agentKeyId: data.id, agentLabel: data.label } };
}

// Rate limiting (issue #47): bound the blast radius of a leaked key. Reuses
// agent_activity — every tool call already logs a row there — instead of a
// new counter table; a request that hasn't hit tools/call yet (e.g. the
// very first call on a key) has no rows, so it's never falsely limited.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;

async function isRateLimited(agentKeyId: string): Promise<boolean> {
  const { count } = await supa.from('agent_activity').select('id', { count: 'exact', head: true })
    .eq('agent_key_id', agentKeyId).gte('created_at', new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString());
  return (count ?? 0) >= RATE_LIMIT_MAX;
}

// Retention for the audit trail (issue #28): long enough for "what did my
// agent do yesterday/last week", short enough to keep the table bounded.
// The Knowledge graph's live overlay only ever queries its own short
// lookback window (ACTIVITY_LOOKBACK_MS client-side), so this is independent
// of that — extending retention here doesn't change the graph's behaviour.
const ACTIVITY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Fire-and-forget activity log for the Knowledge graph's live "agent" node
 * and the platform's Agent activity history: one row per tool call —
 * success AND error, so a misbehaving agent is visible, not silent — with a
 * one-line human summary. Sweeps this teacher's rows older than the
 * retention window on each call so the table stays bounded.
 */
function logActivity(who: Auth, tool: string, targetNodeId: string | null, summary: string | null, status: 'done' | 'error' = 'done') {
  supa.from('agent_activity').insert({
    teacher_id: who.teacherId, agent_key_id: who.agentKeyId, agent_label: who.agentLabel,
    tool, status, target_node_id: targetNodeId, summary, finished_at: new Date().toISOString(),
  }).then(() => {});
  supa.from('agent_activity').delete().eq('teacher_id', who.teacherId)
    .lt('created_at', new Date(Date.now() - ACTIVITY_RETENTION_MS).toISOString()).then(() => {});
}

/** One-line human summary for the activity log — the same text already shown to the agent, capped so a huge tool result (e.g. get_workspace_context) doesn't bloat the log. */
function resultSummary(r: any, cap = 220): string | null {
  const t = r?.content?.[0]?.text;
  return typeof t === 'string' ? (t.length > cap ? t.slice(0, cap) + '…' : t) : null;
}

/* ---------------- tools ---------------- */

const TOOLS = [
  {
    name: 'get_workspace_context',
    description: "The teacher's workspace as front-facing markdown: profile, classrooms with captured context, students, knowledge-base notes and existing worksheets. Read this first to ground any material you create.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_worksheet_contract',
    description: 'The worksheet JSON contract: document envelope, quality rules, and the exact activity shapes. Pass `types` to fetch only the activity types you plan to use.',
    inputSchema: {
      type: 'object',
      properties: { types: { type: 'array', items: { type: 'string' }, description: 'Activity type ids, e.g. ["mcq", "gap-fill"]. Omit for the full catalogue.' } },
      additionalProperties: false,
    },
  },
  {
    name: 'create_worksheet',
    description: "Validate a worksheet document and add it to the teacher's library. The doc must follow get_worksheet_contract; validation problems are returned verbatim so you can fix and retry.",
    inputSchema: {
      type: 'object',
      properties: { doc: { type: 'object', description: 'The complete worksheet JSON document.' } },
      required: ['doc'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_worksheets',
    description: "List the worksheets already in the teacher's library (id, title, subject, activity count).",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'add_resource',
    description: "Add a note to the teacher's knowledge base. Follow the llm.wiki style: `note` is a front-facing summarizing markdown (~200 words + key points) that stands in for the source material. Pass `classroom` and/or `student` (by name) to scope it — same match-or-create-by-name rule as upsert_classroom/upsert_student. Idempotent: calling this again with the same title (and same classroom/student scope) UPDATES that note instead of duplicating it, so re-running an import or a seeding pass is always safe.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        kind: { type: 'string', enum: ['material', 'guideline', 'external', 'context'] },
        subject: { type: 'string' },
        note: { type: 'string', description: 'Front-facing markdown summary.' },
        url: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        classroom: { type: 'string', description: 'Classroom name to link this resource to. Matched case-insensitively; left unresolved (not created) if no such classroom exists.' },
        student: { type: 'string', description: 'Student name to link this resource to (looked up within `classroom` if given, otherwise across the teacher\'s roster).' },
        links: { type: 'array', items: { type: 'string' }, description: 'Names of other entities this note relates to — classrooms, students, worksheets, other resources, or live deployments — resolved to real knowledge-graph edges. Names that don\'t match anything are reported back unresolved, not created.' },
      },
      required: ['title', 'note'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_resource',
    description: "Read one knowledge-base note in FULL (get_workspace_context and search_resources both only preview note text). Pass `id` or `title` (case-insensitive exact match).",
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, title: { type: 'string' } },
      additionalProperties: false,
    },
  },
  {
    name: 'search_resources',
    description: "Full-text search over the knowledge base — the targeted alternative to reading everything via get_workspace_context. `query` searches title/note/subject; narrow further with kind/classroom/student/tags. Returns previews; follow up with get_resource for the full text of a hit.",
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Free-text search, e.g. "phrasal verbs B1". Omit to just filter by kind/classroom/student/tags.' },
        kind: { type: 'string', enum: ['material', 'guideline', 'external', 'context'] },
        classroom: { type: 'string' },
        student: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        limit: { type: 'number', description: 'Max results, default 15, max 50.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'update_resource',
    description: "Revise an existing knowledge-base note in place (id or title). Pass only the fields you want to change; the rest are left as-is. Use this for a correction or rewrite; use append_resource_note instead for a dated addendum.",
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' }, title: { type: 'string' },
        note: { type: 'string' }, kind: { type: 'string', enum: ['material', 'guideline', 'external', 'context'] },
        subject: { type: 'string' }, url: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'append_resource_note',
    description: "Add a dated addendum to an existing note (id or title) without touching the existing text — the right tool for 'here's a new observation' on a note that already has content, as opposed to update_resource's full rewrite.",
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, title: { type: 'string' }, addition: { type: 'string' } },
      required: ['addition'],
      additionalProperties: false,
    },
  },
  {
    name: 'upsert_classroom',
    description: "Create a classroom, or merge into an existing one matched by name (case-insensitive) — exactly the rule the platform's own Google Classroom import uses: a new name creates, a matching name fills in only the fields that were empty. Safe to call repeatedly for the same class without duplicating it. Pass `overwrite: true` ONLY on an explicit teacher instruction to update existing context (e.g. \"update the B1 class context: we finished unit 4\") — it replaces the fields you pass instead of only filling gaps. Returns the classroom id.",
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        subject: { type: 'string' },
        level: { type: 'string' },
        term: { type: 'string' },
        description: { type: 'string' },
        context: { type: 'string', description: 'Free-text notes that flow into worksheet generation — write a real sentence or two, not a placeholder.' },
        overwrite: { type: 'boolean', description: 'Replace existing field values with the ones passed here, instead of only filling in what was empty. Default false.' },
      },
      required: ['name'],
      additionalProperties: false,
    },
  },
  {
    name: 'upsert_student',
    description: "Create a student, or merge into an existing one matched by name within their classroom (case-insensitive) — same match-or-create rule as upsert_classroom. If `classroom` doesn't exist yet it is created bare (call upsert_classroom first if you have more detail for it). Safe to call repeatedly without duplicating the student. Pass `overwrite: true` ONLY on an explicit teacher instruction to update existing fields (e.g. goals/needs) — it replaces them instead of only filling gaps. Returns the student id.",
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        classroom: { type: 'string', description: 'Classroom name this student belongs to.' },
        level: { type: 'string' },
        pronouns: { type: 'string' },
        goals: { type: 'string' },
        needs: { type: 'string', description: 'Needs and context — flows into worksheet generation and get_workspace_context.' },
        overwrite: { type: 'boolean', description: 'Replace existing field values with the ones passed here, instead of only filling in what was empty. Default false.' },
      },
      required: ['name', 'classroom'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_worksheet',
    description: "Revise an existing worksheet's content in place (same validation as create_worksheet — rejections return the problems verbatim so you can fix and retry).",
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, doc: { type: 'object', description: 'The complete, revised worksheet JSON document.' } },
      required: ['id', 'doc'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_worksheet',
    description: "Remove a worksheet from the library. Refuses if it's currently deployed to a live class — close or remove that deployment first.",
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'add_student_note',
    description: "Add a dated observation to a student's record (e.g. \"struggled with past perfect on Tuesday\") — the highest-value persistent memory for lesson planning. Recent notes surface automatically in get_workspace_context.",
    inputSchema: {
      type: 'object',
      properties: {
        student: { type: 'string' },
        classroom: { type: 'string', description: 'Narrows the student lookup if the name exists in more than one class.' },
        text: { type: 'string' },
      },
      required: ['student', 'text'],
      additionalProperties: false,
    },
  },
  {
    name: 'deploy_worksheets',
    description: "Deploy one or more worksheets as a live session with a join code — the last step of the create → deploy loop. Omit `classroom` for a public link anyone with the code (and password, if set) can join under any name; set it for a class deployment gated to that class's roster.",
    inputSchema: {
      type: 'object',
      properties: {
        classroom: { type: 'string', description: 'Classroom to gate this deployment to. Omit for a public link.' },
        title: { type: 'string', description: 'Session title. Defaults to a dated placeholder.' },
        worksheet_ids: { type: 'array', items: { type: 'string' }, description: 'Ids from create_worksheet/list_worksheets, in the order students should see them.' },
        password: { type: 'string', description: 'Optional join password (required in the platform UI for class deployments, but left to your judgement here). Hashed server-side; never echoed back.' },
      },
      required: ['worksheet_ids'],
      additionalProperties: false,
    },
  },
  {
    name: 'set_aula_status',
    description: "Open or close a live deployment by its join code — 'closed' stops new joins/submissions without deleting progress.",
    inputSchema: {
      type: 'object',
      properties: { code: { type: 'string' }, status: { type: 'string', enum: ['live', 'closed'] } },
      required: ['code', 'status'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_progress',
    description: "Read student results across live deployments — the starting point for any progress review, remedial worksheet, or report. Scoped to this teacher's own deployments only. Filter by aula_code, classroom, and/or student; omit all three for everything.",
    inputSchema: {
      type: 'object',
      properties: {
        aula_code: { type: 'string' },
        classroom: { type: 'string' },
        student: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
];

const text = (t: string, isError = false) => ({ content: [{ type: 'text', text: t }], isError });
const activityCount = (doc: any) => (doc?.sections || []).reduce((n: number, s: any) => n + (s.activities?.length || 0), 0);

// How many recent notes to preview in the default context dump, and how much
// of each note's body to show. This is a PREVIEW, not the whole memory: past
// this count the summary tells the agent the true total and points it at
// search_resources / get_resource instead of silently dropping the rest.
const CONTEXT_NOTE_LIMIT = 120;
const CONTEXT_NOTE_PREVIEW_CHARS = 280;

async function getWorkspaceContext(teacherId: string) {
  const [prof, cls, stu, obs, resCount, res, ws, aulas] = await Promise.all([
    supa.from('profiles').select('name,school,subjects,bio').eq('id', teacherId).maybeSingle(),
    supa.from('classrooms').select('id,name,subject,level,term,description,context').eq('teacher_id', teacherId),
    supa.from('students').select('id,class_id,name,level,goals,needs').eq('teacher_id', teacherId),
    supa.from('student_notes').select('student_id,text,created_at').eq('teacher_id', teacherId).order('created_at', { ascending: false }).limit(300),
    supa.from('resources').select('id', { count: 'exact', head: true }).eq('teacher_id', teacherId),
    supa.from('resources').select('title,kind,subject,note,tags,links').eq('teacher_id', teacherId).order('created_at', { ascending: false }).limit(CONTEXT_NOTE_LIMIT),
    supa.from('worksheets').select('title,subject').eq('teacher_id', teacherId),
    supa.from('aulas').select('class_id,title,code,status').eq('teacher_id', teacherId),
  ]);
  const p = prof.data;
  const lines = [
    `# Workspace of ${p?.name || 'the teacher'}`,
    [p?.school, p?.subjects].filter(Boolean).join(' · '),
    p?.bio || '',
  ];
  // Most recent 3 observations per student — obs.data is already ordered
  // newest-first globally, so the first 3 seen per student ARE their 3 most recent.
  const obsByStudent = new Map<string, { text: string; created_at: string }[]>();
  for (const o of obs.data || []) {
    const list = obsByStudent.get(o.student_id) || [];
    if (list.length < 3) { list.push(o); obsByStudent.set(o.student_id, list); }
  }
  for (const c of cls.data || []) {
    const roster = (stu.data || []).filter((s) => s.class_id === c.id);
    lines.push(`\n## Classroom: ${c.name}`,
      [c.subject, c.level, c.term].filter(Boolean).join(' · '),
      c.description || '', c.context ? `Context: ${c.context}` : '',
      roster.length ? `Students: ${roster.map((s) => {
        const notes = obsByStudent.get(s.id);
        const obsStr = notes?.length ? ` [recent notes: ${notes.map((n) => `${n.created_at.slice(0, 10)} — ${String(n.text).replace(/\s+/g, ' ').slice(0, 100)}`).join(' | ')}]` : '';
        return `${s.name}${s.level ? ` (${s.level})` : ''}${s.needs ? ` — needs: ${s.needs}` : ''}${obsStr}`;
      }).join('; ')}` : '');
  }
  const rows = res.data || [];
  const total = resCount.count ?? rows.length;
  const notes = rows.map((r) => {
    const tags = r.tags?.length ? ` {${r.tags.join(', ')}}` : '';
    const links = r.links?.length ? ` → ${r.links.join(', ')}` : '';
    const preview = r.note ? String(r.note).replace(/\s+/g, ' ').slice(0, CONTEXT_NOTE_PREVIEW_CHARS) : '';
    return `- [${r.kind}] ${r.title}${r.subject ? ` (${r.subject})` : ''}${tags}${links}${preview ? ` — ${preview}` : ''}`;
  });
  if (notes.length) {
    const heading = total > notes.length
      ? `\n## Knowledge-base notes (showing ${notes.length} most recent of ${total} total — call search_resources to find something specific, or get_resource for a note's full text)`
      : `\n## Knowledge-base notes (${notes.length})`;
    lines.push(heading, ...notes);
  }
  const sheets = (ws.data || []).map((w) => `- ${w.title}${w.subject ? ` (${w.subject})` : ''}`);
  if (sheets.length) lines.push(`\n## Existing worksheets (${sheets.length})`, ...sheets);
  const classNameById = new Map((cls.data || []).map((c) => [c.id, c.name]));
  const deployments = (aulas.data || []).map((a) => `- ${a.title} (code ${a.code}, ${a.status}${a.class_id ? `, class: ${classNameById.get(a.class_id) || '?'}` : ', public link'})`);
  if (deployments.length) lines.push(`\n## Live deployments (${deployments.length})`, ...deployments);
  return lines.filter((l) => l !== '').join('\n');
}

function getWorksheetContract(types?: string[]) {
  const known = ACTIVITY_TYPES.map((t: any) => t.id);
  const chosen = (types && types.length) ? known.filter((id: string) => types.includes(id)) : known;
  const unknown = (types || []).filter((t) => !known.includes(t));
  const shapes = chosen.map((id: string) => `- ${(CONTRACTS as Record<string, string>)[id]}`).join('\n\n');
  return [
    unknown.length ? `NOTE: unknown types ignored: ${unknown.join(', ')}. Known: ${known.join(', ')}` : '',
    `Return a single JSON document with this envelope:

{
  "$schemaVersion": "2.0",
  "title": "<worksheet title>",
  "subject": "<subject>",
  "topic": "<topic>",
  "audience": "<audience>",
  "language": "<BCP-47 tag, e.g. en-GB>",
  "estimatedMinutes": <integer>,
  "instructions": "<one or two friendly sentences for the learner>",
  "sections": [ { "title": "<section title>", "instructions": "<optional>", "activities": [ <activity objects> ] } ]
}

Quality rules: answers factually correct and unambiguous; hints never reveal the answer; explanations may; distractors plausible but clearly wrong; easier → harder within sections, production tasks last; learner-facing text in the requested language; entirely self-contained (no external media; inline SVG only where a shape allows it); speakers are roles, never real people's names.

Activity object shapes (the "type" field selects the shape):

${shapes}`,
  ].filter(Boolean).join('\n\n');
}

async function createWorksheet(teacherId: string, args: any, agentKeyId: string) {
  let doc = args?.doc;
  if (typeof doc === 'string') { try { doc = JSON.parse(doc); } catch { return text('doc is a string but not valid JSON.', true); } }
  if (!doc || typeof doc !== 'object') return text('Missing "doc" (the worksheet JSON object).', true);
  const problems = validateWorksheet(doc);
  if (problems.length) return text(`Worksheet rejected — fix these and retry:\n${problems.map((p: string) => `- ${p}`).join('\n')}`, true);
  const id = crypto.randomUUID();
  const { error } = await supa.from('worksheets').insert({
    id, teacher_id: teacherId, title: doc.title || 'Untitled worksheet', subject: doc.subject || '', doc,
    created_by_agent_key_id: agentKeyId,
  });
  if (error) return text(`Insert failed: ${error.message}`, true);
  return { ...text(`Created worksheet "${doc.title}" (${id}) with ${activityCount(doc)} activities. It is now in the teacher's library and can be deployed to a class.`), createdId: id };
}

async function listWorksheets(teacherId: string) {
  const { data, error } = await supa.from('worksheets').select('id,title,subject,doc').eq('teacher_id', teacherId).order('created_at', { ascending: false });
  if (error) return text(`Query failed: ${error.message}`, true);
  if (!data?.length) return text('The library is empty — no worksheets yet.');
  return text(data.map((w) => `- ${w.title} (${w.subject || 'no subject'}, ${activityCount(w.doc)} activities) — id ${w.id}`).join('\n'));
}

/** Resolve entity names (classroom/student/resource/worksheet/aula) to knowledge-graph node ids, the same id shapes content.js's nameIndex() builds — { resolved: string[], unresolved: string[] }. */
async function resolveEntityLinks(teacherId: string, names: string[]): Promise<{ resolved: string[]; unresolved: string[] }> {
  const wanted = names.map((n) => String(n).trim()).filter(Boolean);
  if (!wanted.length) return { resolved: [], unresolved: [] };
  const [cls, stu, resr, ws, aulas] = await Promise.all([
    supa.from('classrooms').select('id,name').eq('teacher_id', teacherId),
    supa.from('students').select('id,name').eq('teacher_id', teacherId),
    supa.from('resources').select('id,title').eq('teacher_id', teacherId),
    supa.from('worksheets').select('id,title').eq('teacher_id', teacherId),
    supa.from('aulas').select('id,title').eq('teacher_id', teacherId),
  ]);
  const index = new Map<string, string>();
  for (const c of cls.data || []) index.set(c.name.trim().toLowerCase(), 'class:' + c.id);
  for (const s of stu.data || []) index.set(s.name.trim().toLowerCase(), 'student:' + s.id);
  for (const w of ws.data || []) index.set(w.title.trim().toLowerCase(), 'worksheet:' + w.id);
  for (const r of resr.data || []) index.set(r.title.trim().toLowerCase(), 'resource:' + r.id);
  for (const a of aulas.data || []) index.set(a.title.trim().toLowerCase(), 'aula:' + a.id);
  const resolved: string[] = []; const unresolved: string[] = [];
  for (const n of wanted) {
    const id = index.get(n.toLowerCase());
    if (id) resolved.push(id); else unresolved.push(n);
  }
  return { resolved, unresolved };
}

/** Find a resource by title within the same classroom/student scope (both must match, including "unscoped") — the identity a re-run of the same import/seed reproduces. */
async function findResourceByScopedTitle(teacherId: string, title: string, classId: string | null, studentId: string | null) {
  let q = supa.from('resources').select('*').eq('teacher_id', teacherId).ilike('title', title);
  q = classId ? q.eq('class_id', classId) : q.is('class_id', null);
  q = studentId ? q.eq('student_id', studentId) : q.is('student_id', null);
  const { data } = await q.maybeSingle();
  return data;
}

/**
 * Soft llm.wiki style check for add_resource's note (issue #40) — the tool
 * description asks for "~200 words + key points", but nothing enforced it,
 * so convention drift silently degraded the knowledge base's scannability
 * over time. Warnings only, never a hard rejection: a genuinely short note
 * ("office hours: Tue 3pm") is still a legitimate note.
 */
function checkNoteStyle(note: string): string[] {
  const warnings: string[] = [];
  const words = note.trim().split(/\s+/).filter(Boolean).length;
  if (words > 400) warnings.push(`this note is ${words} words — llm.wiki style is ~200 words; consider tightening it so the knowledge base stays scannable`);
  if (words >= 60 && !/key points?/i.test(note) && !/^#+\s/m.test(note) && !/^[-*]\s/m.test(note)) {
    warnings.push('no headings or bullet list found — a short "Key points" list keeps longer notes scannable at a glance');
  }
  return warnings;
}

async function addResource(teacherId: string, args: any, agentKeyId: string) {
  const title = String(args?.title || '').trim();
  const note = String(args?.note || '').trim();
  if (!title || !note) return text('Both "title" and "note" are required.', true);
  const kind = ['material', 'guideline', 'external', 'context'].includes(args?.kind) ? args.kind : 'context';

  let classId: string | null = null;
  if (args?.classroom) {
    const { data } = await supa.from('classrooms').select('id').eq('teacher_id', teacherId)
      .ilike('name', String(args.classroom).trim()).maybeSingle();
    classId = data?.id ?? null;
  }
  let studentId: string | null = null;
  if (args?.student) {
    let q = supa.from('students').select('id').eq('teacher_id', teacherId).ilike('name', String(args.student).trim());
    if (classId) q = q.eq('class_id', classId);
    const { data } = await q.maybeSingle();
    studentId = data?.id ?? null;
  }

  let linkResolved: string[] = []; let linkUnresolved: string[] = [];
  if (Array.isArray(args?.links) && args.links.length) {
    ({ resolved: linkResolved, unresolved: linkUnresolved } = await resolveEntityLinks(teacherId, args.links));
  }
  const unresolvedNote = linkUnresolved.length ? ` Couldn't resolve these link names (skipped — retry with a corrected name): ${linkUnresolved.join(', ')}.` : '';
  const styleWarnings = checkNoteStyle(note);
  const styleNote = styleWarnings.length ? ` Style note: ${styleWarnings.join('; ')}.` : '';

  // Idempotent by (title, classroom, student): re-running the same seed or
  // import updates the note it already filed instead of duplicating it.
  const existing = await findResourceByScopedTitle(teacherId, title, classId, studentId);
  if (existing) {
    const mergedLinks = Array.from(new Set([...(existing.links || []), ...linkResolved]));
    const patch: Record<string, unknown> = {
      note, kind, subject: String(args?.subject ?? existing.subject ?? ''),
      url: args?.url ? String(args.url) : existing.url,
      tags: Array.isArray(args?.tags) ? args.tags.map(String) : existing.tags,
      links: mergedLinks,
    };
    const { error } = await supa.from('resources').update(patch).eq('id', existing.id);
    if (error) return text(`Update failed: ${error.message}`, true);
    return { ...text(`Updated existing ${kind} note "${title}" (${existing.id}) — re-running this import didn't duplicate it.${unresolvedNote}${styleNote}`), createdId: existing.id };
  }

  const id = crypto.randomUUID();
  const { error } = await supa.from('resources').insert({
    id, teacher_id: teacherId, title, kind, type: 'mcp', subject: String(args?.subject || ''),
    class_id: classId, student_id: studentId,
    url: args?.url ? String(args.url) : null, note,
    tags: Array.isArray(args?.tags) ? args.tags.map(String) : [], links: linkResolved,
    created_by_agent_key_id: agentKeyId,
  });
  if (error) return text(`Insert failed: ${error.message}`, true);
  const scope = [classId ? 'classroom' : null, studentId ? 'student' : null].filter(Boolean).join('+');
  return { ...text(`Added ${kind} note "${title}" (${id}) to the knowledge base${scope ? ` (linked to ${scope})` : ''}.${unresolvedNote}${styleNote}`), createdId: id };
}

/** Resolve a resource by id or (case-insensitive) title, for the read/update/append tools. */
async function resolveResource(teacherId: string, args: any): Promise<{ row: any } | { err: string }> {
  const id = args?.id ? String(args.id).trim() : '';
  const title = args?.title ? String(args.title).trim() : '';
  if (!id && !title) return { err: 'Pass "id" or "title".' };
  let q = supa.from('resources').select('*').eq('teacher_id', teacherId);
  q = id ? q.eq('id', id) : q.ilike('title', title);
  const { data, error } = await q.maybeSingle();
  if (error) return { err: `Query failed: ${error.message}` };
  if (!data) return { err: `No resource found matching ${id ? `id "${id}"` : `title "${title}"`}.` };
  return { row: data };
}

async function getResource(teacherId: string, args: any) {
  const r = await resolveResource(teacherId, args);
  if ('err' in r) return text(r.err, true);
  const { row } = r;
  const meta = [`[${row.kind}]`, row.subject || null, row.url ? `link: ${row.url}` : null].filter(Boolean).join(' · ');
  const tags = row.tags?.length ? `Tags: ${row.tags.join(', ')}` : '';
  const links = row.links?.length ? `Links: ${row.links.join(', ')}` : '';
  return text([`# ${row.title}`, meta, [tags, links].filter(Boolean).join(' · '), '', row.note || '(empty note)'].filter((l) => l !== '').join('\n'));
}

async function updateResource(teacherId: string, args: any) {
  const r = await resolveResource(teacherId, args);
  if ('err' in r) return text(r.err, true);
  const { row } = r;
  const patch: Record<string, unknown> = {};
  if (args?.note != null) patch.note = String(args.note);
  if (args?.subject != null) patch.subject = String(args.subject);
  if (args?.url != null) patch.url = String(args.url) || null;
  if (args?.kind && ['material', 'guideline', 'external', 'context'].includes(args.kind)) patch.kind = args.kind;
  if (Array.isArray(args?.tags)) patch.tags = args.tags.map(String);
  if (!Object.keys(patch).length) return text('Nothing to update — pass at least one of note, kind, subject, url, tags.', true);
  const { error } = await supa.from('resources').update(patch).eq('id', row.id);
  if (error) return text(`Update failed: ${error.message}`, true);
  return { ...text(`Updated "${row.title}" (${row.id}).`), createdId: row.id };
}

async function appendResourceNote(teacherId: string, args: any) {
  const addition = String(args?.addition || '').trim();
  if (!addition) return text('"addition" is required.', true);
  const r = await resolveResource(teacherId, args);
  if ('err' in r) return text(r.err, true);
  const { row } = r;
  const stamp = new Date().toISOString().slice(0, 10);
  const note = `${row.note || ''}\n\n---\n**Update ${stamp}:** ${addition}`.trim();
  const { error } = await supa.from('resources').update({ note }).eq('id', row.id);
  if (error) return text(`Append failed: ${error.message}`, true);
  return { ...text(`Appended a dated update to "${row.title}" (${row.id}).`), createdId: row.id };
}

async function searchResources(teacherId: string, args: any) {
  const query = args?.query ? String(args.query).trim() : '';
  const limit = Math.min(Math.max(Number(args?.limit) || 15, 1), 50);

  let classId: string | null = null;
  if (args?.classroom) {
    const { data } = await supa.from('classrooms').select('id').eq('teacher_id', teacherId).ilike('name', String(args.classroom).trim()).maybeSingle();
    classId = data?.id ?? null;
  }
  let studentId: string | null = null;
  if (args?.student) {
    let q = supa.from('students').select('id').eq('teacher_id', teacherId).ilike('name', String(args.student).trim());
    if (classId) q = q.eq('class_id', classId);
    const { data } = await q.maybeSingle();
    studentId = data?.id ?? null;
  }

  let q = supa.from('resources').select('id,title,kind,subject,note,tags').eq('teacher_id', teacherId);
  if (query) q = q.textSearch('search_vector', query, { type: 'websearch', config: 'simple' });
  if (args?.kind && ['material', 'guideline', 'external', 'context'].includes(args.kind)) q = q.eq('kind', args.kind);
  if (classId) q = q.eq('class_id', classId);
  if (studentId) q = q.eq('student_id', studentId);
  if (Array.isArray(args?.tags) && args.tags.length) q = q.contains('tags', args.tags.map(String));
  q = q.order('created_at', { ascending: false }).limit(limit);

  const { data, error } = await q;
  if (error) return text(`Search failed: ${error.message}`, true);
  if (!data?.length) return text('No matching resources.');
  return text(data.map((r) => `- [${r.kind}] ${r.title}${r.subject ? ` (${r.subject})` : ''} — id ${r.id}${r.note ? `\n  ${String(r.note).replace(/\s+/g, ' ').slice(0, 200)}` : ''}`).join('\n'));
}

/** Find a classroom by name (case-insensitive) for this teacher, or null. */
async function findClassroomByName(teacherId: string, name: string) {
  const { data } = await supa.from('classrooms').select('*').eq('teacher_id', teacherId).ilike('name', name).maybeSingle();
  return data;
}

async function upsertClassroom(teacherId: string, args: any) {
  const name = String(args?.name || '').trim();
  if (!name) return text('"name" is required.', true);
  const fields = ['subject', 'level', 'term', 'description', 'context'] as const;
  const patch: Record<string, string> = {};
  for (const f of fields) if (args?.[f] != null) patch[f] = String(args[f]);

  const overwrite = args?.overwrite === true;
  const existing = await findClassroomByName(teacherId, name);
  if (existing) {
    // Default merge rule: fill in only fields that were empty, never overwrite
    // existing content. overwrite:true (explicit teacher instruction only)
    // replaces every field that was passed, regardless of current value.
    const fill: Record<string, string> = {};
    for (const f of fields) if (patch[f] && (overwrite || !existing[f])) fill[f] = patch[f];
    if (Object.keys(fill).length) {
      const { error } = await supa.from('classrooms').update(fill).eq('id', existing.id);
      if (error) return text(`Update failed: ${error.message}`, true);
    }
    const verb = overwrite ? 'updated' : 'filled';
    return { ...text(`Merged into existing classroom "${existing.name}" (${existing.id})${Object.keys(fill).length ? ` — ${verb} ${Object.keys(fill).join(', ')}` : ' — no fields to change'}.`), createdId: existing.id };
  }

  const id = crypto.randomUUID();
  const { error } = await supa.from('classrooms').insert({ id, teacher_id: teacherId, name, ...patch });
  if (error) return text(`Insert failed: ${error.message}`, true);
  return { ...text(`Created classroom "${name}" (${id}).`), createdId: id };
}

async function upsertStudent(teacherId: string, args: any) {
  const name = String(args?.name || '').trim();
  const classroomName = String(args?.classroom || '').trim();
  if (!name || !classroomName) return text('Both "name" and "classroom" are required.', true);

  let classroom = await findClassroomByName(teacherId, classroomName);
  if (!classroom) {
    const id = crypto.randomUUID();
    const { data, error } = await supa.from('classrooms').insert({ id, teacher_id: teacherId, name: classroomName }).select().single();
    if (error) return text(`Could not create classroom "${classroomName}": ${error.message}`, true);
    classroom = data;
  }

  const fields = ['level', 'pronouns', 'goals', 'needs'] as const;
  const patch: Record<string, string> = {};
  for (const f of fields) if (args?.[f] != null) patch[f] = String(args[f]);

  const overwrite = args?.overwrite === true;
  const { data: existing } = await supa.from('students').select('*').eq('teacher_id', teacherId).eq('class_id', classroom.id).ilike('name', name).maybeSingle();
  if (existing) {
    const fill: Record<string, string> = {};
    for (const f of fields) if (patch[f] && (overwrite || !existing[f])) fill[f] = patch[f];
    if (Object.keys(fill).length) {
      const { error } = await supa.from('students').update(fill).eq('id', existing.id);
      if (error) return text(`Update failed: ${error.message}`, true);
    }
    const verb = overwrite ? 'updated' : 'filled';
    return { ...text(`Merged into existing student "${existing.name}" (${existing.id}) in "${classroom.name}"${Object.keys(fill).length ? ` — ${verb} ${Object.keys(fill).join(', ')}` : ' — no fields to change'}.`), createdId: existing.id };
  }

  const id = crypto.randomUUID();
  const { error } = await supa.from('students').insert({ id, teacher_id: teacherId, class_id: classroom.id, name, ...patch });
  if (error) return text(`Insert failed: ${error.message}`, true);
  return { ...text(`Created student "${name}" (${id}) in "${classroom.name}".`), createdId: id };
}

async function updateWorksheet(teacherId: string, args: any) {
  const id = String(args?.id || '').trim();
  if (!id) return text('"id" is required.', true);
  let doc = args?.doc;
  if (typeof doc === 'string') { try { doc = JSON.parse(doc); } catch { return text('doc is a string but not valid JSON.', true); } }
  if (!doc || typeof doc !== 'object') return text('Missing "doc" (the worksheet JSON object).', true);
  const problems = validateWorksheet(doc);
  if (problems.length) return text(`Worksheet rejected — fix these and retry:\n${problems.map((p: string) => `- ${p}`).join('\n')}`, true);
  const { data: existing } = await supa.from('worksheets').select('id').eq('teacher_id', teacherId).eq('id', id).maybeSingle();
  if (!existing) return text(`No worksheet with id "${id}" in this teacher's library.`, true);
  const { error } = await supa.from('worksheets').update({ title: doc.title || 'Untitled worksheet', subject: doc.subject || '', doc }).eq('id', id);
  if (error) return text(`Update failed: ${error.message}`, true);
  return { ...text(`Updated worksheet "${doc.title}" (${id}) with ${activityCount(doc)} activities.`), createdId: id };
}

async function deleteWorksheet(teacherId: string, args: any) {
  const id = String(args?.id || '').trim();
  if (!id) return text('"id" is required.', true);
  const { data: existing } = await supa.from('worksheets').select('id,title').eq('teacher_id', teacherId).eq('id', id).maybeSingle();
  if (!existing) return text(`No worksheet with id "${id}" in this teacher's library.`, true);
  const { data: deployed } = await supa.from('aula_worksheets').select('aula_id').eq('worksheet_id', id).limit(1);
  if (deployed && deployed.length) return text(`"${existing.title}" is deployed in a live class — close or remove that deployment first.`, true);
  const { error } = await supa.from('worksheets').delete().eq('id', id);
  if (error) return text(`Delete failed: ${error.message}`, true);
  return { ...text(`Removed "${existing.title}" (${id}) from the library.`), createdId: id };
}

async function addStudentNote(teacherId: string, args: any) {
  const noteText = String(args?.text || '').trim();
  if (!noteText) return text('"text" is required.', true);
  const studentName = String(args?.student || '').trim();
  if (!studentName) return text('"student" is required.', true);
  let classId: string | null = null;
  if (args?.classroom) {
    const cls = await findClassroomByName(teacherId, String(args.classroom).trim());
    if (!cls) return text(`No classroom named "${args.classroom}".`, true);
    classId = cls.id;
  }
  let q = supa.from('students').select('id,name').eq('teacher_id', teacherId).ilike('name', studentName);
  if (classId) q = q.eq('class_id', classId);
  const { data: student } = await q.maybeSingle();
  if (!student) return text(`No student named "${studentName}"${args?.classroom ? ` in "${args.classroom}"` : ''}. Use upsert_student first if they're new.`, true);
  const id = crypto.randomUUID();
  const { error } = await supa.from('student_notes').insert({ id, teacher_id: teacherId, student_id: student.id, text: noteText });
  if (error) return text(`Insert failed: ${error.message}`, true);
  return { ...text(`Added an observation for ${student.name}.`), createdId: 'student:' + student.id };
}

async function deployWorksheets(teacherId: string, args: any) {
  const worksheetIds = Array.isArray(args?.worksheet_ids) ? args.worksheet_ids.map(String) : [];
  if (!worksheetIds.length) return text('"worksheet_ids" must be a non-empty array.', true);
  const { data: owned } = await supa.from('worksheets').select('id').eq('teacher_id', teacherId).in('id', worksheetIds);
  const ownedIds = new Set((owned || []).map((w) => w.id));
  const missing = worksheetIds.filter((id) => !ownedIds.has(id));
  if (missing.length) return text(`Unknown worksheet id(s): ${missing.join(', ')}.`, true);

  let classId: string | null = null;
  if (args?.classroom) {
    const cls = await findClassroomByName(teacherId, String(args.classroom).trim());
    if (!cls) return text(`No classroom named "${args.classroom}". Create it first with upsert_classroom, or omit classroom for a public link.`, true);
    classId = cls.id;
  }

  let code = '';
  for (let tries = 0; tries < 20; tries++) {
    code = 'A' + Math.random().toString(36).slice(2, 6).toUpperCase();
    const { data: clash } = await supa.from('aulas').select('id').eq('code', code).maybeSingle();
    if (!clash) break;
  }

  let passwordHash: string | null = null;
  if (args?.password) {
    const { data: hash, error: hErr } = await supa.rpc('bcrypt_hash_service', { p_plain: String(args.password) });
    if (hErr) return text(`Could not hash password: ${hErr.message}`, true);
    passwordHash = hash;
  }

  const id = crypto.randomUUID();
  const title = args?.title ? String(args.title) : `Deployment ${new Date().toISOString().slice(0, 10)}`;
  const { error } = await supa.from('aulas').insert({ id, teacher_id: teacherId, class_id: classId, title, code, status: 'live', password_hash: passwordHash });
  if (error) return text(`Insert failed: ${error.message}`, true);
  const { error: awErr } = await supa.from('aula_worksheets').insert(worksheetIds.map((wid, i) => ({ aula_id: id, worksheet_id: wid, position: i })));
  if (awErr) return text(`Deployment created (${code}) but linking worksheets failed: ${awErr.message}`, true);
  return {
    ...text(`Deployed "${title}" (${id}) — join code ${code}${classId ? '' : ' (public link, no class)'}${passwordHash ? '. Password-protected — share the password with students separately, it is not echoed back' : ''}. ${worksheetIds.length} worksheet${worksheetIds.length === 1 ? '' : 's'} included.`),
    createdId: id,
  };
}

async function setAulaStatus(teacherId: string, args: any) {
  const code = String(args?.code || '').trim();
  const status = args?.status;
  if (!code) return text('"code" is required.', true);
  if (!['live', 'closed'].includes(status)) return text('"status" must be "live" or "closed".', true);
  const { data: aula } = await supa.from('aulas').select('id,title').eq('teacher_id', teacherId).ilike('code', code).maybeSingle();
  if (!aula) return text(`No deployment with code "${code}" in this teacher's workspace.`, true);
  const { error } = await supa.from('aulas').update({ status }).eq('id', aula.id);
  if (error) return text(`Update failed: ${error.message}`, true);
  return { ...text(`"${aula.title}" (${code}) is now ${status}.`), createdId: aula.id };
}

async function getProgress(teacherId: string, args: any) {
  let aq = supa.from('aulas').select('id,code,title,class_id').eq('teacher_id', teacherId);
  if (args?.aula_code) aq = aq.ilike('code', String(args.aula_code).trim());
  if (args?.classroom) {
    const cls = await findClassroomByName(teacherId, String(args.classroom).trim());
    if (!cls) return text(`No classroom named "${args.classroom}".`, true);
    aq = aq.eq('class_id', cls.id);
  }
  const { data: aulas, error: aErr } = await aq;
  if (aErr) return text(`Query failed: ${aErr.message}`, true);
  if (!aulas?.length) return text('No matching live deployments.');
  const aulaIds = aulas.map((a) => a.id);
  const aulaById = new Map(aulas.map((a) => [a.id, a]));

  const [{ data: enrollments }, { data: progress }, { data: worksheets }] = await Promise.all([
    supa.from('enrollments').select('id,aula_id,name').in('aula_id', aulaIds),
    supa.from('progress').select('aula_id,enrollment_id,worksheet_id,total,attempted,correct,done,score,validated,updated_at').in('aula_id', aulaIds),
    supa.from('worksheets').select('id,title').eq('teacher_id', teacherId),
  ]);
  const enrollById = new Map((enrollments || []).map((e) => [e.id, e]));
  const wsById = new Map((worksheets || []).map((w) => [w.id, w.title]));

  let rows = (progress || []).map((p) => {
    const e = enrollById.get(p.enrollment_id);
    const a = aulaById.get(p.aula_id);
    return {
      student: e?.name || '(unknown)', worksheet: wsById.get(p.worksheet_id) || '(unknown)',
      aula: a?.title || a?.code || '(unknown)', code: a?.code || '',
      attempted: p.attempted, total: p.total, correct: p.correct,
      scorePct: Math.round((p.score || 0) * 100),
      status: p.done ? 'complete' : (p.attempted ? 'in progress' : 'not started'),
      validated: p.validated || '', updatedAt: p.updated_at,
    };
  });
  if (args?.student) {
    const needle = String(args.student).trim().toLowerCase();
    rows = rows.filter((r) => r.student.toLowerCase() === needle);
  }
  if (!rows.length) return text('No progress recorded yet for the matching deployment(s).');
  const lines = rows.map((r) => `- ${r.student} — "${r.worksheet}" (${r.aula}, ${r.code}): ${r.attempted}/${r.total} attempted, ${r.correct} correct, ${r.scorePct}% score, ${r.status}${r.validated ? `, ${r.validated}` : ''}`);
  return text(lines.join('\n'));
}

/* ---------------- MCP over streamable HTTP ---------------- */

async function handleMessage(msg: any, who: Auth) {
  const { id, method, params } = msg;
  switch (method) {
    case 'initialize':
      return rpcResult(id, {
        protocolVersion: params?.protocolVersion || '2025-03-26',
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'ensinolibre', version: '1.0.0' },
        instructions: 'EnsinoLibre teacher workspace. Typical flow: get_workspace_context → get_worksheet_contract (with the types you plan to use) → create_worksheet → deploy_worksheets when the teacher wants it live. add_resource files llm.wiki-style summary notes into the knowledge base (pass `links` to relate it to other entities). For bulk imports (a roster file, a Google Classroom export, a folder of materials), call get_workspace_context first to see what already exists, then upsert_classroom / upsert_student / add_resource once per item — all three match-or-create by name, so re-running an import is safe and nothing is duplicated (pass `overwrite: true` on upsert_classroom/upsert_student only when the teacher explicitly asks to update existing context, not during routine imports). get_workspace_context only PREVIEWS the knowledge base (most recent notes, truncated) — once it reports more notes exist than it showed, use search_resources to find the relevant ones and get_resource to read one in full. To revise what you already know, update_resource rewrites a note and append_resource_note adds a dated addendum; add_student_note logs a dated observation about a student. update_worksheet/delete_worksheet revise or retire a worksheet already in the library. get_progress reads student results across live deployments — the starting point for any progress review or report.',
      });
    case 'ping':
      return rpcResult(id, {});
    case 'tools/list':
      return rpcResult(id, { tools: TOOLS });
    case 'tools/call': {
      const name = params?.name;
      const args = params?.arguments || {};
      // logResult: uniform success/error logging for a tool that already produced
      // its own { content, isError } result — used by every write/read-detail tool.
      const logResult = (result: any, prefix: string | null) => {
        const errored = !!result.isError;
        const target = errored ? null : (prefix && result.createdId ? prefix + ':' + result.createdId : prefix);
        logActivity(who, name, target, resultSummary(result), errored ? 'error' : 'done');
        return result;
      };
      try {
        if (name === 'get_workspace_context') {
          const out = await getWorkspaceContext(who.teacherId);
          // Never log the full dump (can be very large) — a fixed short summary is enough.
          logActivity(who, name, 'teacher', 'Read workspace context', 'done');
          return rpcResult(id, text(out));
        }
        if (name === 'get_worksheet_contract') {
          logActivity(who, name, null, args?.types?.length ? `Fetched contract for: ${args.types.join(', ')}` : 'Fetched the full worksheet contract', 'done');
          return rpcResult(id, text(getWorksheetContract(args.types)));
        }
        if (name === 'create_worksheet') {
          return rpcResult(id, logResult(await createWorksheet(who.teacherId, args, who.agentKeyId), 'worksheet'));
        }
        if (name === 'list_worksheets') {
          const result = await listWorksheets(who.teacherId);
          logActivity(who, name, 'teacher', resultSummary(result), result.isError ? 'error' : 'done');
          return rpcResult(id, result);
        }
        if (name === 'add_resource') {
          return rpcResult(id, logResult(await addResource(who.teacherId, args, who.agentKeyId), 'resource'));
        }
        if (name === 'get_resource') {
          return rpcResult(id, logResult(await getResource(who.teacherId, args), null));
        }
        if (name === 'search_resources') {
          return rpcResult(id, logResult(await searchResources(who.teacherId, args), null));
        }
        if (name === 'update_resource') {
          return rpcResult(id, logResult(await updateResource(who.teacherId, args), 'resource'));
        }
        if (name === 'append_resource_note') {
          return rpcResult(id, logResult(await appendResourceNote(who.teacherId, args), 'resource'));
        }
        if (name === 'upsert_classroom') {
          return rpcResult(id, logResult(await upsertClassroom(who.teacherId, args), 'classroom'));
        }
        if (name === 'upsert_student') {
          return rpcResult(id, logResult(await upsertStudent(who.teacherId, args), 'student'));
        }
        if (name === 'update_worksheet') {
          return rpcResult(id, logResult(await updateWorksheet(who.teacherId, args), 'worksheet'));
        }
        if (name === 'delete_worksheet') {
          return rpcResult(id, logResult(await deleteWorksheet(who.teacherId, args), 'worksheet'));
        }
        if (name === 'add_student_note') {
          const result = await addStudentNote(who.teacherId, args);
          const errored = !!result.isError;
          logActivity(who, name, errored ? null : result.createdId, resultSummary(result), errored ? 'error' : 'done');
          return rpcResult(id, result);
        }
        if (name === 'deploy_worksheets') {
          return rpcResult(id, logResult(await deployWorksheets(who.teacherId, args), 'aula'));
        }
        if (name === 'set_aula_status') {
          return rpcResult(id, logResult(await setAulaStatus(who.teacherId, args), 'aula'));
        }
        if (name === 'get_progress') {
          return rpcResult(id, logResult(await getProgress(who.teacherId, args), 'teacher'));
        }
        return rpcError(id, -32602, `Unknown tool: ${name}`);
      } catch (e) {
        const message = (e as Error).message;
        logActivity(who, name, null, `Tool failed: ${message}`.slice(0, 220), 'error');
        return rpcResult(id, text(`Tool failed: ${message}`, true));
      }
    }
    default:
      if (String(method || '').startsWith('notifications/')) return new Response(null, { status: 202, headers: CORS });
      return rpcError(id ?? null, -32601, `Method not found: ${method}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method === 'GET') return json({ name: 'ensinolibre-mcp', hint: 'POST MCP JSON-RPC here with an elk_ agent key as bearer token.' }, 405);
  if (req.method === 'DELETE') return new Response(null, { status: 200, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const { who, expired } = await authenticate(req);
  if (!who) {
    const message = expired
      ? 'Your EnsinoLibre agent key has expired — generate a new one in the app (Worksheets → + Create worksheet → Connect via MCP).'
      : 'Unauthorized: pass your EnsinoLibre agent key (elk_…) as a bearer token.';
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32001, message } }),
      { status: 401, headers: { 'Content-Type': 'application/json', 'WWW-Authenticate': 'Bearer realm="ensinolibre-mcp"', ...CORS } });
  }
  if (await isRateLimited(who.agentKeyId)) {
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32029, message: `Rate limit exceeded — max ${RATE_LIMIT_MAX} requests/minute per agent key. Try again shortly.` } }),
      { status: 429, headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  let body: any;
  try { body = await req.json(); } catch { return rpcError(null, -32700, 'Parse error', 400); }

  if (Array.isArray(body)) {
    // JSON-RPC batch: answer each request (notifications produce nothing)
    const answers = [];
    for (const m of body) {
      const r = await handleMessage(m, who);
      if (r.status !== 202 && m.id !== undefined) answers.push(await r.json());
    }
    return json(answers);
  }
  return handleMessage(body, who);
});
