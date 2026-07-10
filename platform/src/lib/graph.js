/**
 * EnsinoLibre — derive a knowledge graph from the workspace.
 *
 * Every classroom, student, worksheet, resource (external / material /
 * guideline / context / worksheet) and live class becomes a node; membership,
 * deployment, context and explicit wiki-links become edges. This is the data
 * the Knowledge view visualises.
 *
 * Node id scheme (also used by resource.links): "teacher", "class:<id>",
 * "student:<id>", "worksheet:<id>", "resource:<id>", "aula:<id>".
 */
import { store } from './store.js';
import { deriveDocsLayer } from './docslayer.js';

/** Visual node types → colours are assigned in the view from design tokens. */
export const NODE_TYPES = {
  teacher: 'Teacher',
  class: 'Classroom',
  student: 'Student',
  worksheet: 'Worksheet',
  'resource-external': 'External',
  'resource-material': 'Material',
  'resource-guideline': 'Guideline',
  'resource-context': 'Context',
  'resource-worksheet': 'Saved worksheet',
  aula: 'Live class',
  'doc-hub': 'EnsinoLibre docs',
  'doc-group': 'Docs section',
  doc: 'EnsinoLibre doc',
};

function resourceType(r) {
  return `resource-${r.kind || 'material'}`;
}

/**
 * Derive the workspace graph. With { includeDocs: true } the universal
 * EnsinoLibre docs layer is merged in: docs hub → sections → pages, plus
 * "uses" edges from each activity doc to the worksheets built with it.
 */
export function deriveGraph({ includeDocs = false } = {}) {
  const nodes = [];
  const edges = [];
  const seen = new Set();
  const addNode = (id, type, label, extra = {}) => {
    if (seen.has(id)) return; seen.add(id);
    nodes.push({ id, type, label, ...extra });
  };
  const addEdge = (source, target, kind) => {
    if (source === target || !seen.has(source) || !seen.has(target)) return;
    edges.push({ source, target, kind });
  };

  const t = store.teacher();
  addNode('teacher', 'teacher', t.name, { subtitle: t.school });

  for (const c of store.classrooms()) addNode('class:' + c.id, 'class', c.name, { subtitle: `${c.subject} · ${c.level}`, body: c.context || c.description });
  for (const s of store.students()) addNode('student:' + s.id, 'student', s.name, { subtitle: s.level, body: s.goals });
  for (const w of (store.worksheetsAll ? store.worksheetsAll() : [])) addNode('worksheet:' + w.id, 'worksheet', w.title, { subtitle: w.subject });
  for (const r of store.resources()) addNode('resource:' + r.id, resourceType(r), r.title, { subtitle: r.subject, body: r.note, url: r.url });
  for (const a of store.aulas()) addNode('aula:' + a.id, 'aula', a.title, { subtitle: `code ${a.code}` });

  // structural edges
  for (const c of store.classrooms()) addEdge('teacher', 'class:' + c.id, 'owns');
  for (const s of store.students()) addEdge('class:' + s.classId, 'student:' + s.id, 'member');
  for (const a of store.aulas()) {
    addEdge('class:' + a.classId, 'aula:' + a.id, 'deploy');
    for (const wid of a.worksheetIds) addEdge('aula:' + a.id, 'worksheet:' + wid, 'deploy');
  }
  // resource edges: classId/studentId context + explicit wiki links
  for (const r of store.resources()) {
    const rid = 'resource:' + r.id;
    if (r.classId) addEdge('class:' + r.classId, rid, 'context');
    if (r.studentId) addEdge('student:' + r.studentId, rid, 'context');
    for (const target of (r.links || [])) addEdge(rid, target, 'wiki');
  }

  if (includeDocs) {
    const docs = deriveDocsLayer();
    for (const n of docs.nodes) addNode(n.id, n.type, n.label, { subtitle: n.subtitle, url: n.url });
    for (const e of docs.edges) addEdge(e.source, e.target, e.kind);
  }

  return { nodes, edges };
}

/** Adjacency + BFS distances from a node (for the focus lens). */
export function buildAdjacency(graph) {
  const adj = new Map(graph.nodes.map((n) => [n.id, new Set()]));
  for (const e of graph.edges) { adj.get(e.source)?.add(e.target); adj.get(e.target)?.add(e.source); }
  return adj;
}

export function bfsDistances(adj, fromId) {
  const dist = new Map([[fromId, 0]]);
  let frontier = [fromId];
  while (frontier.length) {
    const next = [];
    for (const id of frontier) for (const nb of (adj.get(id) || [])) {
      if (!dist.has(nb)) { dist.set(nb, dist.get(id) + 1); next.push(nb); }
    }
    frontier = next;
  }
  return dist;
}
