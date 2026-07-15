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

/** Resolve the agent key from headers → { teacherId, agentKeyId, agentLabel }, or null. */
async function authenticate(req: Request): Promise<Auth | null> {
  const auth = req.headers.get('authorization') || '';
  const raw = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : (req.headers.get('x-agent-key') || '').trim();
  if (!raw.startsWith('elk_')) return null;
  const hash = await sha256hex(raw);
  const { data } = await supa.from('agent_keys').select('id,teacher_id,label').eq('key_hash', hash).maybeSingle();
  if (!data) return null;
  supa.from('agent_keys').update({ last_used_at: new Date().toISOString() }).eq('id', data.id).then(() => {});
  return { teacherId: data.teacher_id, agentKeyId: data.id, agentLabel: data.label };
}

/**
 * Fire-and-forget activity log for the Knowledge graph's live "agent" node:
 * one row per successful tool call, plus a cheap sweep of this teacher's
 * older rows so the table stays small (the graph only ever looks at the
 * last couple of minutes).
 */
function logActivity(who: Auth, tool: string, targetNodeId: string | null) {
  supa.from('agent_activity').insert({
    teacher_id: who.teacherId, agent_key_id: who.agentKeyId, agent_label: who.agentLabel,
    tool, status: 'done', target_node_id: targetNodeId,
  }).then(() => {});
  supa.from('agent_activity').delete().eq('teacher_id', who.teacherId)
    .lt('created_at', new Date(Date.now() - 5 * 60_000).toISOString()).then(() => {});
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
    description: "Add a note to the teacher's knowledge base. Follow the llm.wiki style: `note` is a front-facing summarizing markdown (~200 words + key points) that stands in for the source material. Pass `classroom` and/or `student` (by name) to scope it — same match-or-create-by-name rule as upsert_classroom/upsert_student.",
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
      },
      required: ['title', 'note'],
      additionalProperties: false,
    },
  },
  {
    name: 'upsert_classroom',
    description: "Create a classroom, or merge into an existing one matched by name (case-insensitive) — exactly the rule the platform's own Google Classroom import uses: a new name creates, a matching name fills in only the fields that were empty. Safe to call repeatedly for the same class without duplicating it. Returns the classroom id.",
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        subject: { type: 'string' },
        level: { type: 'string' },
        term: { type: 'string' },
        description: { type: 'string' },
        context: { type: 'string', description: 'Free-text notes that flow into worksheet generation — write a real sentence or two, not a placeholder.' },
      },
      required: ['name'],
      additionalProperties: false,
    },
  },
  {
    name: 'upsert_student',
    description: "Create a student, or merge into an existing one matched by name within their classroom (case-insensitive) — same match-or-create rule as upsert_classroom. If `classroom` doesn't exist yet it is created bare (call upsert_classroom first if you have more detail for it). Safe to call repeatedly without duplicating the student. Returns the student id.",
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        classroom: { type: 'string', description: 'Classroom name this student belongs to.' },
        level: { type: 'string' },
        pronouns: { type: 'string' },
        goals: { type: 'string' },
        needs: { type: 'string', description: 'Needs and context — flows into worksheet generation and get_workspace_context.' },
      },
      required: ['name', 'classroom'],
      additionalProperties: false,
    },
  },
];

const text = (t: string, isError = false) => ({ content: [{ type: 'text', text: t }], isError });
const activityCount = (doc: any) => (doc?.sections || []).reduce((n: number, s: any) => n + (s.activities?.length || 0), 0);

async function getWorkspaceContext(teacherId: string) {
  const [prof, cls, stu, res, ws] = await Promise.all([
    supa.from('profiles').select('name,school,subjects,bio').eq('id', teacherId).maybeSingle(),
    supa.from('classrooms').select('id,name,subject,level,term,description,context').eq('teacher_id', teacherId),
    supa.from('students').select('class_id,name,level,goals,needs').eq('teacher_id', teacherId),
    supa.from('resources').select('title,kind,subject,note').eq('teacher_id', teacherId).order('created_at', { ascending: false }).limit(60),
    supa.from('worksheets').select('title,subject').eq('teacher_id', teacherId),
  ]);
  const p = prof.data;
  const lines = [
    `# Workspace of ${p?.name || 'the teacher'}`,
    [p?.school, p?.subjects].filter(Boolean).join(' · '),
    p?.bio || '',
  ];
  for (const c of cls.data || []) {
    const roster = (stu.data || []).filter((s) => s.class_id === c.id);
    lines.push(`\n## Classroom: ${c.name}`,
      [c.subject, c.level, c.term].filter(Boolean).join(' · '),
      c.description || '', c.context ? `Context: ${c.context}` : '',
      roster.length ? `Students: ${roster.map((s) => `${s.name}${s.level ? ` (${s.level})` : ''}${s.needs ? ` — needs: ${s.needs}` : ''}`).join('; ')}` : '');
  }
  const notes = (res.data || []).map((r) => `- [${r.kind}] ${r.title}${r.subject ? ` (${r.subject})` : ''}${r.note ? ` — ${String(r.note).replace(/\s+/g, ' ').slice(0, 140)}` : ''}`);
  if (notes.length) lines.push(`\n## Knowledge-base notes (${notes.length})`, ...notes);
  const sheets = (ws.data || []).map((w) => `- ${w.title}${w.subject ? ` (${w.subject})` : ''}`);
  if (sheets.length) lines.push(`\n## Existing worksheets (${sheets.length})`, ...sheets);
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

async function createWorksheet(teacherId: string, args: any) {
  let doc = args?.doc;
  if (typeof doc === 'string') { try { doc = JSON.parse(doc); } catch { return text('doc is a string but not valid JSON.', true); } }
  if (!doc || typeof doc !== 'object') return text('Missing "doc" (the worksheet JSON object).', true);
  const problems = validateWorksheet(doc);
  if (problems.length) return text(`Worksheet rejected — fix these and retry:\n${problems.map((p: string) => `- ${p}`).join('\n')}`, true);
  const id = crypto.randomUUID();
  const { error } = await supa.from('worksheets').insert({
    id, teacher_id: teacherId, title: doc.title || 'Untitled worksheet', subject: doc.subject || '', doc,
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

async function addResource(teacherId: string, args: any) {
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

  const id = crypto.randomUUID();
  const { error } = await supa.from('resources').insert({
    id, teacher_id: teacherId, title, kind, type: 'mcp', subject: String(args?.subject || ''),
    class_id: classId, student_id: studentId,
    url: args?.url ? String(args.url) : null, note,
    tags: Array.isArray(args?.tags) ? args.tags.map(String) : [], links: [],
  });
  if (error) return text(`Insert failed: ${error.message}`, true);
  const scope = [classId ? 'classroom' : null, studentId ? 'student' : null].filter(Boolean).join('+');
  return { ...text(`Added ${kind} note "${title}" (${id}) to the knowledge base${scope ? ` (linked to ${scope})` : ''}.`), createdId: id };
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

  const existing = await findClassroomByName(teacherId, name);
  if (existing) {
    // Merge rule: fill in only fields that were empty, never overwrite existing content.
    const fill: Record<string, string> = {};
    for (const f of fields) if (patch[f] && !existing[f]) fill[f] = patch[f];
    if (Object.keys(fill).length) {
      const { error } = await supa.from('classrooms').update(fill).eq('id', existing.id);
      if (error) return text(`Update failed: ${error.message}`, true);
    }
    return { ...text(`Merged into existing classroom "${existing.name}" (${existing.id})${Object.keys(fill).length ? ` — filled ${Object.keys(fill).join(', ')}` : ' — no new fields to fill'}.`), createdId: existing.id };
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

  const { data: existing } = await supa.from('students').select('*').eq('teacher_id', teacherId).eq('class_id', classroom.id).ilike('name', name).maybeSingle();
  if (existing) {
    const fill: Record<string, string> = {};
    for (const f of fields) if (patch[f] && !existing[f]) fill[f] = patch[f];
    if (Object.keys(fill).length) {
      const { error } = await supa.from('students').update(fill).eq('id', existing.id);
      if (error) return text(`Update failed: ${error.message}`, true);
    }
    return { ...text(`Merged into existing student "${existing.name}" (${existing.id}) in "${classroom.name}"${Object.keys(fill).length ? ` — filled ${Object.keys(fill).join(', ')}` : ' — no new fields to fill'}.`), createdId: existing.id };
  }

  const id = crypto.randomUUID();
  const { error } = await supa.from('students').insert({ id, teacher_id: teacherId, class_id: classroom.id, name, ...patch });
  if (error) return text(`Insert failed: ${error.message}`, true);
  return { ...text(`Created student "${name}" (${id}) in "${classroom.name}".`), createdId: id };
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
        instructions: 'EnsinoLibre teacher workspace. Typical flow: get_workspace_context → get_worksheet_contract (with the types you plan to use) → create_worksheet. add_resource files llm.wiki-style summary notes into the knowledge base. For bulk imports (a roster file, a Google Classroom export, a folder of materials), call get_workspace_context first to see what already exists, then upsert_classroom / upsert_student / add_resource once per item — all three match-or-create by name, so re-running an import is safe and nothing is duplicated.',
      });
    case 'ping':
      return rpcResult(id, {});
    case 'tools/list':
      return rpcResult(id, { tools: TOOLS });
    case 'tools/call': {
      const name = params?.name;
      const args = params?.arguments || {};
      try {
        if (name === 'get_workspace_context') {
          const out = await getWorkspaceContext(who.teacherId);
          logActivity(who, name, 'teacher');
          return rpcResult(id, text(out));
        }
        if (name === 'get_worksheet_contract') {
          logActivity(who, name, null);
          return rpcResult(id, text(getWorksheetContract(args.types)));
        }
        if (name === 'create_worksheet') {
          const result = await createWorksheet(who.teacherId, args);
          if (!result.isError) logActivity(who, name, 'worksheet:' + result.createdId);
          return rpcResult(id, result);
        }
        if (name === 'list_worksheets') {
          logActivity(who, name, 'teacher');
          return rpcResult(id, await listWorksheets(who.teacherId));
        }
        if (name === 'add_resource') {
          const result = await addResource(who.teacherId, args);
          if (!result.isError) logActivity(who, name, 'resource:' + result.createdId);
          return rpcResult(id, result);
        }
        if (name === 'upsert_classroom') {
          const result = await upsertClassroom(who.teacherId, args);
          if (!result.isError) logActivity(who, name, 'classroom:' + result.createdId);
          return rpcResult(id, result);
        }
        if (name === 'upsert_student') {
          const result = await upsertStudent(who.teacherId, args);
          if (!result.isError) logActivity(who, name, 'student:' + result.createdId);
          return rpcResult(id, result);
        }
        return rpcError(id, -32602, `Unknown tool: ${name}`);
      } catch (e) {
        return rpcResult(id, text(`Tool failed: ${(e as Error).message}`, true));
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

  const who = await authenticate(req);
  if (!who) {
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Unauthorized: pass your EnsinoLibre agent key (elk_…) as a bearer token.' } }),
      { status: 401, headers: { 'Content-Type': 'application/json', 'WWW-Authenticate': 'Bearer realm="ensinolibre-mcp"', ...CORS } });
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
