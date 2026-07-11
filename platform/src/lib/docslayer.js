/**
 * EnsinoLibre — the DOCS layer of the knowledge graph.
 *
 * Every workspace knowledge base carries a second, universal layer: the
 * EnsinoLibre documentation. It floats ghostly behind the teacher's own
 * graph and connects to the worksheets that USE each activity block — an
 * at-a-glance map of which components are used where.
 *
 * Node id scheme (extends graph.js): "docs" (hub), "docgroup:<group>",
 * "doc:<slug>". Activity docs ("activities/<type>") link to every worksheet
 * whose document contains an activity of that type (edge kind "uses").
 *
 * NOTE: DOC_PAGES mirrors the sidebar manifest in site/assets/js/docs.js
 * (which can't be imported here — it touches the DOM at module load).
 * Keep the two in sync when docs are added.
 */
import { store } from './store.js';

export const DOC_URL_BASE = '../docs.html?page=';

const act = (slug, title) => ({
  slug: `activities/${slug}`, title,
  blurb: `Spec and contract for the "${title}" activity block — behaviour, JSON shape, on-screen rendering and analog (print) form.`,
});

export const DOC_PAGES = [
  { group: 'Start here', pages: [
    { slug: 'overview', title: 'Overview', blurb: 'What EnsinoLibre is: the philosophy, the architecture, and the copy-paste prompt mechanic at the heart of everything.' },
    { slug: 'getting-started', title: 'Getting started', blurb: 'Zero-to-worksheet walkthrough: describe the class, copy the prompt, paste the JSON back, print or deploy live.' },
    { slug: 'prompt-template', title: 'The prompt template', blurb: 'The prompt contract the generator builds — what any capable LLM needs to produce a valid worksheet document.' },
  ]},
  { group: 'Reference', pages: [
    { slug: 'worksheet-schema', title: 'Worksheet schema', blurb: 'The worksheet JSON document: sections, activities, validation rules and versioning.' },
    { slug: 'rendering-and-embedding', title: 'Rendering & embedding', blurb: 'How worksheets render anywhere — the embed API and the token-efficient analog print export.' },
  ]},
  { group: 'Teacher platform', pages: [
    { slug: 'platform-overview', title: 'Teacher platform', blurb: 'The logged-in workspace — classrooms, students, resources, live sessions and the knowledge graph — and how it differs from the worksheet builder.' },
    { slug: 'dashboard', title: 'Dashboard', blurb: "The platform's home page — classes and knowledge base at a glance." },
    { slug: 'classrooms-and-students', title: 'Classrooms & Students', blurb: 'Rosters and per-class/per-student context, manual entry with notion-style relation pickers, and Google Classroom import.' },
    { slug: 'resources-knowledge-base', title: 'Resources', blurb: 'The linked knowledge repository — teaching materials, guidelines, external links and captured context — entered by hand or seeded from files.' },
    { slug: 'worksheets-library', title: 'Worksheets', blurb: "The platform's worksheet library — create in-app, deploy live, export for print or Moodle." },
    { slug: 'knowledge-graph', title: 'Knowledge graph', blurb: 'Every classroom, student, worksheet and resource as one connected, filterable graph.' },
    { slug: 'live-classroom', title: 'Live classroom', blurb: 'Deploy worksheets to a class as a live session, watch progress in real time, and validate student work.' },
    { slug: 'profile-and-vault', title: 'Profile', blurb: 'Your teacher profile, plus workspace-wide exports and imports.' },
    { slug: 'obsidian-vault', title: 'Using with Obsidian', blurb: 'The workspace exported as linked markdown notes — for Obsidian, or for handing to an AI agent.' },
    { slug: 'knowledge-seeding', title: 'Seeding the knowledge base', blurb: 'Bulk-seed the knowledge base: local-agent prompts, Google Classroom import, and front-facing summary notes (llm.wiki).' },
    { slug: 'mcp-connect', title: 'Connect your AI (MCP)', blurb: 'The EnsinoLibre MCP server: agent keys plus tools for reading workspace context and creating worksheets and knowledge notes directly.' },
    { slug: 'google-classroom-import', title: 'Import from Google Classroom', blurb: 'No-technical-background walkthrough: export your data with Google Takeout, then bring classes, rosters and materials into EnsinoLibre.' },
  ]},
  { group: 'Core activities', pages: [
    act('mcq', 'Multiple choice'), act('true-false', 'True or false'), act('gap-fill', 'Fill in the gaps'),
    act('matching', 'Matching'), act('ordering', 'Put in order'), act('open-response', 'Open writing'),
  ]},
  { group: 'Input activities', pages: [
    act('content', 'Reading content'), act('course-presentation', 'Slides'), act('timeline', 'Timeline'),
    act('dialogue', 'Dialogue'), act('grammar-forms', 'Grammar forms'), act('tense-shift', 'Tense shift'),
    act('word-transform', 'Word building'), act('translation-compare', 'Translation compare'),
  ]},
  { group: 'Vocabulary', pages: [
    act('flashdeck', 'Flashcards'), act('memory-game', 'Memory game'), act('word-search', 'Word search'),
  ]},
  { group: 'Practice sets', pages: [
    act('quiz', 'Quiz (scored)'), act('single-choice-set', 'Rapid-fire set'),
    act('question-set', 'Mixed question set'), act('mark-words', 'Mark the words'),
  ]},
  { group: 'Contextualised', pages: [
    act('reading-comp', 'Reading comprehension'), act('translation', 'Translation drill'), act('scenario', 'Branching scenario'),
    act('lesson', 'Adaptive lesson'), act('crossword', 'Crossword'), act('image-hotspot', 'Picture labelling'),
  ]},
  { group: 'Checks & forms', pages: [
    act('summary', 'Summary builder'), act('survey', 'Self-assessment survey'), act('poll', 'Poll'),
  ]},
];

/* ---------------- lookups ---------------- */

export const docId = (slug) => `doc:${slug}`;
export const docGroupId = (group) => `docgroup:${group}`;
export const docUrl = (slug) => DOC_URL_BASE + encodeURIComponent(slug);

const BY_SLUG = new Map();
for (const g of DOC_PAGES) for (const p of g.pages) BY_SLUG.set(p.slug, { ...p, group: g.group });

export const docBySlug = (slug) => BY_SLUG.get(slug) || null;
export const docGroup = (group) => DOC_PAGES.find((g) => g.group === group) || null;

/** True when a node id / node type belongs to the docs layer. */
export const isDocNodeId = (id) => id === 'docs' || String(id).startsWith('doc:') || String(id).startsWith('docgroup:');
export const isDocNodeType = (t) => t === 'doc' || t === 'doc-group' || t === 'doc-hub';

/* ---------------- worksheet usage (which components are used where) ---------------- */

const activityTypesIn = (w) => {
  const types = new Set();
  for (const s of w.doc?.sections || []) for (const a of s.activities || []) if (a?.type) types.add(a.type);
  return types;
};

/** Worksheets that use the activity block a doc page describes. */
export function worksheetsUsing(slug) {
  if (!slug.startsWith('activities/')) return [];
  const type = slug.slice('activities/'.length);
  return store.worksheetsAll().filter((w) => activityTypesIn(w).has(type));
}

/* ---------------- layer derivation ---------------- */

/**
 * Derive the docs layer: hub → groups → pages, plus "uses" edges from each
 * activity doc to every worksheet whose document contains that block.
 * Returned in the same {nodes, edges} shape graph.js merges.
 */
export function deriveDocsLayer() {
  const nodes = [];
  const edges = [];

  nodes.push({ id: 'docs', type: 'doc-hub', label: 'EnsinoLibre docs', subtitle: 'Universal context layer' });

  for (const g of DOC_PAGES) {
    const gid = docGroupId(g.group);
    nodes.push({ id: gid, type: 'doc-group', label: g.group, subtitle: `${g.pages.length} pages` });
    edges.push({ source: 'docs', target: gid, kind: 'docs' });
    for (const p of g.pages) {
      nodes.push({ id: docId(p.slug), type: 'doc', label: p.title, subtitle: g.group, url: docUrl(p.slug) });
      edges.push({ source: gid, target: docId(p.slug), kind: 'docs' });
    }
  }

  // usage edges: activity doc → worksheets that use that block
  for (const w of store.worksheetsAll()) {
    for (const type of activityTypesIn(w)) {
      const slug = `activities/${type}`;
      if (BY_SLUG.has(slug)) edges.push({ source: docId(slug), target: 'worksheet:' + w.id, kind: 'uses' });
    }
  }

  return { nodes, edges };
}
