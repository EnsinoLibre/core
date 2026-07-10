/** EnsinoLibre — docs viewer: loads Obsidian Markdown and renders it with live examples. */

import { splitFrontmatter, resolveWikilinks, upgradeCallouts, extractWorksheetBlocks } from './md.js';
import { validateWorksheet, validateActivity, KNOWN_TYPES } from './validator.js';
import { renderWorksheet } from './renderer.js';
import { initTopbar } from './nav.js';

initTopbar();

/** Sidebar structure. slug = path under ../docs/ without .md */
export const DOC_PAGES = [
  { group: 'Start here', pages: [
    { slug: 'overview', title: 'Overview' },
    { slug: 'getting-started', title: 'Getting started' },
    { slug: 'prompt-template', title: 'The prompt template' },
  ]},
  { group: 'Reference', pages: [
    { slug: 'worksheet-schema', title: 'Worksheet schema' },
    { slug: 'rendering-and-embedding', title: 'Rendering & embedding' },
    { slug: 'obsidian-vault', title: 'Using with Obsidian' },
    { slug: 'knowledge-seeding', title: 'Seeding the knowledge base' },
    { slug: 'mcp-connect', title: 'Connect your AI (MCP)' },
  ]},
  { group: 'Imports', pages: [
    { slug: 'google-classroom-import', title: 'Import from Google Classroom' },
  ]},
  { group: 'Core activities', pages: [
    { slug: 'activities/mcq', title: 'Multiple choice' },
    { slug: 'activities/true-false', title: 'True or false' },
    { slug: 'activities/gap-fill', title: 'Fill in the gaps' },
    { slug: 'activities/matching', title: 'Matching' },
    { slug: 'activities/ordering', title: 'Put in order' },
    { slug: 'activities/open-response', title: 'Open writing' },
  ]},
  { group: 'Input activities', pages: [
    { slug: 'activities/content', title: 'Reading content' },
    { slug: 'activities/course-presentation', title: 'Slides' },
    { slug: 'activities/timeline', title: 'Timeline' },
    { slug: 'activities/dialogue', title: 'Dialogue' },
    { slug: 'activities/grammar-forms', title: 'Grammar forms' },
    { slug: 'activities/tense-shift', title: 'Tense shift' },
    { slug: 'activities/word-transform', title: 'Word building' },
    { slug: 'activities/translation-compare', title: 'Translation compare' },
  ]},
  { group: 'Vocabulary', pages: [
    { slug: 'activities/flashdeck', title: 'Flashcards' },
    { slug: 'activities/memory-game', title: 'Memory game' },
    { slug: 'activities/word-search', title: 'Word search' },
  ]},
  { group: 'Practice sets', pages: [
    { slug: 'activities/quiz', title: 'Quiz (scored)' },
    { slug: 'activities/single-choice-set', title: 'Rapid-fire set' },
    { slug: 'activities/question-set', title: 'Mixed question set' },
    { slug: 'activities/mark-words', title: 'Mark the words' },
  ]},
  { group: 'Contextualised', pages: [
    { slug: 'activities/reading-comp', title: 'Reading comprehension' },
    { slug: 'activities/translation', title: 'Translation drill' },
    { slug: 'activities/scenario', title: 'Branching scenario' },
    { slug: 'activities/lesson', title: 'Adaptive lesson' },
    { slug: 'activities/crossword', title: 'Crossword' },
    { slug: 'activities/image-hotspot', title: 'Picture labelling' },
  ]},
  { group: 'Checks & forms', pages: [
    { slug: 'activities/summary', title: 'Summary builder' },
    { slug: 'activities/survey', title: 'Self-assessment survey' },
    { slug: 'activities/poll', title: 'Poll' },
  ]},
];

const ALL_SLUGS = new Set(DOC_PAGES.flatMap((g) => g.pages.map((p) => p.slug)));

function currentSlug() {
  const slug = new URLSearchParams(location.search).get('page') || 'overview';
  return ALL_SLUGS.has(slug) ? slug : 'overview';
}

function buildSidebar(active) {
  const host = document.getElementById('oc-sidebar');
  host.textContent = '';
  for (const group of DOC_PAGES) {
    const h = document.createElement('h4');
    h.textContent = group.group;
    host.appendChild(h);
    const ul = document.createElement('ul');
    for (const page of group.pages) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `docs.html?page=${encodeURIComponent(page.slug)}`;
      a.textContent = page.title;
      if (page.slug === active) a.className = 'active';
      li.appendChild(a);
      ul.appendChild(li);
    }
    host.appendChild(ul);
  }
}

function renderFrontmatter(fm, host) {
  const keys = Object.keys(fm).filter((k) => !['name'].includes(k));
  if (!keys.length) return;
  const box = document.createElement('dl');
  box.className = 'oc-frontmatter';
  for (const k of keys) {
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = fm[k];
    box.appendChild(dt);
    box.appendChild(dd);
  }
  host.appendChild(box);
}

/** Wrap a bare activity object into a minimal worksheet for the live preview.
 *  A full worksheet has "sections" and no "type" (the content activity also
 *  has "sections", so the "type" check is load-bearing). */
function toWorksheet(parsed) {
  if (parsed.sections && !parsed.type) return parsed;
  return {
    title: 'Live example',
    subject: 'Example',
    audience: 'Documentation readers',
    language: 'en-GB',
    sections: [{ title: 'Try it', activities: [parsed] }],
  };
}

function mountExamples(container, examples) {
  for (const { id, json } of examples) {
    const host = container.querySelector(`[data-example-id="${id}"]`);
    if (!host) continue;
    const label = document.createElement('div');
    label.className = 'oc-live-example-label';
    label.textContent = '▶ Live example — try it';
    host.appendChild(label);
    const mount = document.createElement('div');
    host.appendChild(mount);
    try {
      const parsed = JSON.parse(json);
      const problems = (parsed.sections && !parsed.type)
        ? validateWorksheet(parsed)
        : (KNOWN_TYPES.includes(parsed.type) ? validateActivity(parsed) : [`unknown activity type ${parsed.type}`]);
      if (problems.length) throw new Error(problems.join(' '));
      renderWorksheet(toWorksheet(parsed), mount);
    } catch (e) {
      mount.className = 'oc-errors';
      mount.textContent = `Example failed to render: ${e.message}`;
    }
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = 'View the JSON behind this example';
    details.appendChild(summary);
    const pre = document.createElement('pre');
    const code = document.createElement('code');
    code.textContent = json.trim();
    pre.appendChild(code);
    details.appendChild(pre);
    host.appendChild(details);
  }
}

async function loadPage(slug) {
  const body = document.getElementById('oc-doc-body');
  body.innerHTML = '<p>Loading…</p>';
  let raw;
  try {
    const res = await fetch(`../docs/${slug}.md`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    raw = await res.text();
  } catch (e) {
    body.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'oc-errors';
    p.textContent = `Could not load this page (${e.message}).`;
    body.appendChild(p);
    return;
  }
  const { frontmatter, body: mdBody } = splitFrontmatter(raw);
  const { md, examples } = extractWorksheetBlocks(resolveWikilinks(mdBody));
  body.innerHTML = '';
  renderFrontmatter(frontmatter, body);
  const content = document.createElement('div');
  content.innerHTML = window.marked.parse(md);
  upgradeCallouts(content);
  body.appendChild(content);
  mountExamples(content, examples);
  if (frontmatter.title || content.querySelector('h1')) {
    document.title = `${frontmatter.title || content.querySelector('h1').textContent} — EnsinoLibre Docs`;
  }
}

const slug = currentSlug();
buildSidebar(slug);
loadPage(slug);
