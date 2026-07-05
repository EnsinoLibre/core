/**
 * EnsinoLibre — Obsidian-flavoured Markdown helpers.
 *
 * The docs are plain Obsidian-compatible Markdown files. This module adds,
 * on top of the vendored `marked` renderer:
 *   - YAML frontmatter   → parsed into a key/value map (shown as properties)
 *   - [[wikilinks]]      → docs.html?page=<slug> links
 *   - > [!note] callouts → styled callout boxes (note / tip / warning)
 *   - ```worksheet fences → live interactive worksheet examples
 *
 * `marked` is loaded globally by docs.html before this module runs.
 */

/** Split "---\nyaml\n---\nbody" into { frontmatter: {..}, body }. */
export function splitFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { frontmatter: {}, body: raw };
  const frontmatter = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (kv) frontmatter[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
  }
  return { frontmatter, body: raw.slice(m[0].length) };
}

/** Replace [[target]] and [[target|label]] with docs viewer links. */
export function resolveWikilinks(md) {
  return md.replace(/\[\[([^\[\]|]+)(?:\|([^\[\]]+))?\]\]/g, (_, target, label) => {
    // Inside Markdown tables Obsidian escapes the label pipe as \| — strip the stray backslash.
    const slug = target.trim().replace(/\\$/, '').replace(/\.md$/i, '');
    return `[${(label || target).trim()}](docs.html?page=${encodeURIComponent(slug)})`;
  });
}

const CALLOUT_KINDS = { note: 'note', info: 'note', tip: 'tip', success: 'tip', warning: 'warning', caution: 'warning', danger: 'warning' };

/**
 * Convert rendered blockquotes that start with [!kind] into callout divs.
 * Runs on the HTML output, which keeps the Markdown files pure Obsidian syntax.
 */
export function upgradeCallouts(container) {
  for (const bq of container.querySelectorAll('blockquote')) {
    const first = bq.firstElementChild;
    if (!first) continue;
    const m = first.textContent.match(/^\[!(\w+)\]\s*(.*)/);
    if (!m) continue;
    const kind = CALLOUT_KINDS[m[1].toLowerCase()] || 'note';
    const div = document.createElement('div');
    div.className = `oc-callout oc-callout--${kind}`;
    const title = document.createElement('div');
    title.className = 'oc-callout-title';
    title.textContent = m[2] || m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
    div.appendChild(title);
    // Remove the "[!kind] Title" line from the first paragraph, keep the rest.
    first.innerHTML = first.innerHTML.replace(/^\s*\[!\w+\][^<]*(<br\s*\/?>)?/, '');
    for (const child of [...bq.childNodes]) {
      if (child === first && !first.textContent.trim()) continue;
      div.appendChild(child);
    }
    bq.replaceWith(div);
  }
}

/**
 * Pull ```worksheet fenced blocks out of the Markdown before rendering,
 * leaving placeholders; returns { md, examples: [{id, json}] }.
 */
export function extractWorksheetBlocks(md) {
  const examples = [];
  const out = md.replace(/```worksheet\r?\n([\s\S]*?)```/g, (_, json) => {
    const id = `oc-example-${examples.length}`;
    examples.push({ id, json });
    return `<div class="oc-live-example" data-example-id="${id}"></div>`;
  });
  return { md: out, examples };
}
