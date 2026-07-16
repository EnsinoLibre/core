import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import Graph from 'graphology';
import Sigma from 'sigma';
import {
  forceSimulation, forceManyBody, forceLink, forceCollide, forceX, forceY, forceRadial,
} from 'd3-force';
import { drawDiscNodeLabel } from 'sigma/rendering';
import { store, deriveGraph, buildAdjacency, bfsDistances, hydrate, download } from '../lib/api';
import { useContent } from './ContentPanel';
import { listRecentActivity, listAgentKeys, type ActivityRow, type AgentKey } from '../lib/agentkeys';
import { CreateWorksheetModal } from './CreateWorksheet';
import { SeedModal, ClassroomImportModal } from './SeedKB';
import { McpConnectModal } from './McpConnect';
import { KebabMenu } from './bits';

/* ---------- palette ---------- */

const TYPE_VAR: Record<string, string> = {
  teacher: '--color-gold-700',
  class: '--color-teal-500',
  student: '--color-teal-400',
  aula: '--color-teal-700',
  worksheet: '--color-terracotta-500',
  'resource-worksheet': '--color-terracotta-400',
  'resource-material': '--color-terracotta-300',
  'resource-guideline': '--color-gold-500',
  'resource-external': '--color-gold-400',
  'resource-context': '--color-teal-300',
  'doc-hub': '--color-text',
  'doc-group': '--color-text-muted',
  doc: '--color-text-muted',
  // Violet is reserved for these two AI-related types — never used for
  // workspace content — so they read as categorically different at a glance.
  // 'ai' (persistent launcher) gets a lighter shade than 'agent' (a live,
  // currently-connected MCP session) so the two don't get confused.
  agent: '--color-violet-500',
  ai: '--color-violet-400',
};
const SIZE: Record<string, number> = {
  teacher: 16, class: 13, aula: 12, worksheet: 10, student: 10, 'resource-guideline': 10,
  'doc-hub': 14, 'doc-group': 9, doc: 7,
  agent: 15, // on par with the other hub-ish nodes — distinct colour does the differentiating, not size
  ai: 16,
};

/** How long an agent node / touch glow / WIP ring survive after their last activity row. */
const AGENT_IDLE_MS = 45_000;
const TOUCH_GLOW_MS = 12_000;
const WIP_GRACE_MS = 60_000;
const ACTIVITY_POLL_MS = 2_000;
const ACTIVITY_LOOKBACK_MS = 120_000;

/** The docs layer floats behind the workspace (or vice versa) — see layer switch. */
const isDocType = (t: string | undefined) => t === 'doc' || t === 'doc-group' || t === 'doc-hub';
type Layer = 'workspace' | 'docs';

/** Camera zoom bounds — kept in sync with the Sigma constructor's min/maxCameraRatio. */
const CAMERA_RATIO = { min: 0.35, max: 6 };

/** Legend rows double as visibility filters; each maps one or more node types to a toggle key. */
const LEGEND_ITEMS: { label: string; key: string; colorType: string; types: string[] }[] = [
  { label: 'Classroom', key: 'class', colorType: 'class', types: ['class'] },
  { label: 'Student', key: 'student', colorType: 'student', types: ['student'] },
  { label: 'Live class', key: 'aula', colorType: 'aula', types: ['aula'] },
  { label: 'Worksheet', key: 'worksheet', colorType: 'worksheet', types: ['worksheet', 'resource-worksheet'] },
  { label: 'Material', key: 'resource-material', colorType: 'resource-material', types: ['resource-material'] },
  { label: 'Guideline', key: 'resource-guideline', colorType: 'resource-guideline', types: ['resource-guideline'] },
  { label: 'External', key: 'resource-external', colorType: 'resource-external', types: ['resource-external'] },
  { label: 'Context', key: 'resource-context', colorType: 'resource-context', types: ['resource-context'] },
  { label: 'Teacher', key: 'teacher', colorType: 'teacher', types: ['teacher'] },
  { label: 'EnsinoLibre docs', key: 'docs', colorType: 'doc', types: ['doc', 'doc-group', 'doc-hub'] },
  { label: 'AI assistant', key: 'ai', colorType: 'ai', types: ['ai'] },
  { label: 'Connected agent', key: 'agent', colorType: 'agent', types: ['agent'] },
];
const LEGEND_KEY_OF: Record<string, string> = {};
LEGEND_ITEMS.forEach((item) => item.types.forEach((t) => { LEGEND_KEY_OF[t] = item.key; }));
const legendKeyOf = (ntype: string | undefined) => (ntype && LEGEND_KEY_OF[ntype]) || ntype || '';

function cssVar(name: string, fallback = '#888') {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}
function hexToRgb(h: string) {
  const m = h.replace('#', '');
  const n = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}
function mix(a: string, b: string, t: number) {
  const [r1, g1, b1] = hexToRgb(a); const [r2, g2, b2] = hexToRgb(b);
  const r = Math.round(r1 + (r2 - r1) * t), g = Math.round(g1 + (g2 - g1) * t), bl = Math.round(b1 + (b2 - b1) * t);
  return `#${[r, g, bl].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

const RING = (d: number | undefined) => (d == null ? 430 : [0, 130, 250, 360][d] ?? 420);
const RING_STRENGTH = (d: number | undefined) => (d == null ? 0.3 : [1, 0.6, 0.5, 0.35][d] ?? 0.3);

/** Instant workspace summary — no AI round-trip, just what's already local. */
function buildWorkspaceReport() {
  const t = store.teacher();
  const classes = store.classrooms();
  const students = store.students();
  const resources = store.resources();
  const worksheets = store.worksheetsAll();
  const aulas = store.aulas();
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const lines = [
    `# Workspace report — ${t.name}`,
    `_Generated ${date}_`,
    '',
    '## Overview',
    `- ${classes.length} classroom${classes.length === 1 ? '' : 's'}`,
    `- ${students.length} student${students.length === 1 ? '' : 's'}`,
    `- ${resources.length} knowledge-base note${resources.length === 1 ? '' : 's'}`,
    `- ${worksheets.length} worksheet${worksheets.length === 1 ? '' : 's'}`,
    `- ${aulas.length} live deployment${aulas.length === 1 ? '' : 's'}`,
  ];

  if (classes.length) {
    lines.push('', '## Classrooms');
    for (const c of classes) {
      const roster = store.studentsIn(c.id);
      lines.push(`- **${c.name}** — ${[c.subject, c.level, c.term].filter(Boolean).join(' · ') || 'no details'} — ${roster.length} student${roster.length === 1 ? '' : 's'}`);
    }
  }

  if (aulas.length) {
    lines.push('', '## Live classes');
    for (const a of aulas) {
      const rows = store.exportRows(a.id);
      const complete = rows.filter((r: any) => r.status === 'complete').length;
      const avg = rows.length ? Math.round(rows.reduce((s: number, r: any) => s + r.scorePct, 0) / rows.length) : 0;
      const cls = store.classroom(a.classId);
      lines.push(`- **${a.title}** (${cls ? cls.name : 'public link'}, code ${a.code}, ${a.status}) — ${store.enrollments(a.id).length} joined, ${complete}/${rows.length} worksheets complete, ${avg}% average score`);
    }
  }

  if (worksheets.length) {
    lines.push('', '## Worksheets');
    for (const w of worksheets) {
      const count = (w.doc?.sections || []).reduce((n: number, s: any) => n + (s.activities?.length || 0), 0);
      lines.push(`- **${w.title}** — ${w.subject || 'no subject'} · ${count} activities`);
    }
  }

  if (resources.length) {
    lines.push('', '## Knowledge base');
    const byKind = new Map<string, number>();
    for (const r of resources) byKind.set(r.kind || 'material', (byKind.get(r.kind || 'material') || 0) + 1);
    for (const [kind, n] of byKind) lines.push(`- ${n} ${kind}`);
  }

  return lines.join('\n');
}

export function KnowledgeGraph({ initialFocus }: { initialFocus?: string | null }) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const recenterRef = useRef<() => void>(() => {});
  // The graph is one view onto the shared "current content" — clicking a node
  // opens the global content panel; the panel (and cards elsewhere) drive the
  // focus lens back here.
  const { current: focus, open, close } = useContent();
  const openRef = useRef(open);
  openRef.current = open;
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  // Which layer is in the FOREGROUND; the other floats ghostly behind it.
  const [layer, setLayer] = useState<Layer>('workspace');
  const layerRef = useRef<Layer>(layer);
  // Legend rows toggled off — those node types (and their edges) are hidden entirely.
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
  const hiddenRef = useRef<Set<string>>(hiddenTypes);
  // Click on an "agent:<id>" node opens a lightweight popover (live/ephemeral
  // data, not a workspace entity — doesn't go through the shared content panel).
  const [agentPopover, setAgentPopover] = useState<{ id: string; label: string; recent: ActivityRow[] } | null>(null);
  // Click on the persistent "ai-hub" node opens a menu of downstream actions
  // (also not a workspace entity — no shared content panel for it either).
  // The menu itself is connection-aware: no agent key yet → just "Connect
  // your AI"; at least one key → connection info + the quick actions, each
  // opening its modal straight on the "Connect via MCP" tab (the agent is
  // already connected, so skip the copy-paste tab it'd otherwise default to).
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [aiAction, setAiAction] = useState<'worksheet' | 'seed' | 'classroom' | null>(null);
  const [aiConnectOpen, setAiConnectOpen] = useState(false);
  const [aiKeys, setAiKeys] = useState<{ loading: boolean; keys: AgentKey[] }>({ loading: true, keys: [] });
  const refreshAiKeys = () => {
    listAgentKeys().then((r) => setAiKeys({ loading: false, keys: r.keys })).catch(() => setAiKeys({ loading: false, keys: [] }));
  };

  // Open the deep-linked node once on mount (?focus=<id>).
  useEffect(() => { if (initialFocus) open(initialFocus); /* eslint-disable-next-line */ }, []);

  // The graph canvas is NEVER resized when the panel/drawer opens. Instead we
  // pan the camera so the focused node sits in the visible region — above the
  // mobile drawer, or centred in the (now narrower) area beside the desktop
  // panel — while the graph stays full-size and interactive.
  useEffect(() => {
    const recenter = () => {
      const s = sigmaRef.current as any;
      const root = rootRef.current;
      if (!s || !root) return;
      const fid = focusRef.current;
      if (!fid) return;
      let nd: any;
      try { nd = s.getNodeDisplayData(fid); } catch { nd = null; }
      if (!nd) return;
      const inset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--content-bottom-inset')) || 0;
      let dy = 0;
      if (inset > 0 && typeof s.viewportToFramedGraph === 'function') {
        const W = root.clientWidth, H = root.clientHeight;
        const vCenter = s.viewportToFramedGraph({ x: W / 2, y: H / 2 });
        const vVisible = s.viewportToFramedGraph({ x: W / 2, y: (H - inset) / 2 });
        dy = vCenter.y - vVisible.y; // shift so the node rises into the visible area
      }
      const cam = s.getCamera();
      cam.animate({ x: nd.x, y: nd.y + dy, ratio: cam.getState().ratio, angle: 0 }, { duration: 260 });
    };
    recenterRef.current = recenter;
    const onInset = () => requestAnimationFrame(recenter);
    window.addEventListener('el-content-inset', onInset);
    return () => { window.removeEventListener('el-content-inset', onInset); recenterRef.current = () => {}; };
  }, []);

  // engine refs
  const sigmaRef = useRef<Sigma | null>(null);
  const simRef = useRef<any>(null);
  const graphRef = useRef<Graph | null>(null);
  const adjRef = useRef<Map<string, Set<string>>>(new Map());
  const distRef = useRef<Map<string, number> | null>(null);
  const focusRef = useRef<string | null>(focus);
  const hoverRef = useRef<string | null>(null);
  const paletteRef = useRef<any>({});
  const applyFocusRef = useRef<(id: string | null) => void>(() => {});
  // Lets a manual "+Add" action (AI hub menu) graft its new node into the live
  // graph immediately, the same way the MCP-activity poll does for agent writes.
  const mergeFreshNodesRef = useRef<() => void>(() => {});
  // d3-force's own node list — the live-agent overlay pushes/removes entries
  // here directly so new nodes join the simulation without resetting it.
  const simNodesRef = useRef<any[]>([]);
  const idToSimRef = useRef<Map<string, any>>(new Map());
  const simLinksRef = useRef<any[]>([]);
  // Live MCP-agent overlay, refreshed by the polling effect below and read
  // by the reducers each frame — never triggers a React re-render itself.
  const agentsRef = useRef<Map<string, { label: string; lastSeen: number }>>(new Map());
  const touchesRef = useRef<Map<string, number>>(new Map());
  const wipRef = useRef<Map<string, number>>(new Map());
  const activityByAgentRef = useRef<Map<string, ActivityRow[]>>(new Map());
  const pulseRafRef = useRef(0);

  const data = useMemo(() => deriveGraph({ includeDocs: true }), []);
  const nodeById = useMemo(() => new Map(data.nodes.map((n) => [n.id, n])), [data]);

  /* build engine once (deferred until the container has a measured size) */
  useEffect(() => {
    const container = stageRef.current!;
    let raf = 0;
    let killed = false;
    let onTheme: (() => void) | null = null;
    let ro: ResizeObserver | null = null;

    const build = () => {
    const resolvePalette = () => {
      paletteRef.current = {
        bg: cssVar('--color-surface', '#fff'),
        edge: cssVar('--color-border-strong', '#ccc'),
        accent: cssVar('--color-primary', '#1f6f5c'),
        text: cssVar('--color-text', '#222'),
        type: Object.fromEntries(Object.entries(TYPE_VAR).map(([k, v]) => [k, cssVar(v)])),
      };
    };
    resolvePalette();
    const nodeColor = (type: string) => paletteRef.current.type[type] || cssVar('--color-text-muted', '#888');

    // Sigma's default hover renderer fills the label's background pill with a
    // hardcoded "#FFF", which reads as white-on-white against our (near-white)
    // dark-theme label text. Same geometry, themed fill instead.
    const drawNodeHover = (context: CanvasRenderingContext2D, data: any, settings: any) => {
      const size = settings.labelSize, font = settings.labelFont, weight = settings.labelWeight;
      context.font = `${weight} ${size}px ${font}`;
      context.fillStyle = paletteRef.current.bg;
      context.shadowOffsetX = 0; context.shadowOffsetY = 0; context.shadowBlur = 8; context.shadowColor = '#000';
      const PADDING = 2;
      if (typeof data.label === 'string') {
        const textWidth = context.measureText(data.label).width;
        const boxWidth = Math.round(textWidth + 5);
        const boxHeight = Math.round(size + 2 * PADDING);
        const radius = Math.max(data.size, size / 2) + PADDING;
        const angle = Math.asin(boxHeight / 2 / radius);
        const dx = Math.sqrt(Math.abs(radius ** 2 - (boxHeight / 2) ** 2));
        context.beginPath();
        context.moveTo(data.x + dx, data.y + boxHeight / 2);
        context.lineTo(data.x + radius + boxWidth, data.y + boxHeight / 2);
        context.lineTo(data.x + radius + boxWidth, data.y - boxHeight / 2);
        context.lineTo(data.x + dx, data.y - boxHeight / 2);
        context.arc(data.x, data.y, radius, angle, -angle);
        context.closePath();
        context.fill();
      } else {
        context.beginPath();
        context.arc(data.x, data.y, data.size + PADDING, 0, Math.PI * 2);
        context.closePath();
        context.fill();
      }
      context.shadowOffsetX = 0; context.shadowOffsetY = 0; context.shadowBlur = 0;
      drawDiscNodeLabel(context, data, settings);
    };

    // "Still in process" ring: a slim dashed amber outline around resources/
    // worksheets the agent just wrote (WIP grace window), and a slim pulsing
    // ring around the agent node itself while it has recent activity — quiet
    // enough to sit alongside the rest of the graph's understated styling.
    // Drawn on the label layer so it isn't tied to hover state and survives
    // every node (forceLabel guarantees this callback runs for it).
    const drawNodeLabel = (context: CanvasRenderingContext2D, data: any, settings: any) => {
      if (data.wip || data.ntype === 'agent' || data.glow > 0) {
        const pulse = data.ntype === 'agent' ? (Math.sin(Date.now() / 320) + 1) / 2 : 0;
        context.save();
        if (!data.wip && data.ntype !== 'agent' && data.glow > 0) {
          // Being read/written right now: a slim ring that fades out over
          // TOUCH_GLOW_MS as the agent moves on to the next node.
          context.strokeStyle = paletteRef.current.accent;
          context.lineWidth = 1.5;
          context.globalAlpha = Math.min(0.6, data.glow);
          context.beginPath();
          context.arc(data.x, data.y, data.size + 4, 0, Math.PI * 2);
          context.stroke();
        } else if (data.wip) {
          // Slim dashed ring in a distinct "in progress" amber/gold, slowly
          // rotating (one full turn every ~14s) — a quiet ambient cue rather
          // than the fast "marching ants" look.
          context.strokeStyle = '#d9a548';
          context.lineWidth = 1.5;
          context.setLineDash([4, 3]);
          context.lineDashOffset = -(Date.now() / 2000) % 7;
          context.globalAlpha = 0.75;
          context.beginPath();
          context.arc(data.x, data.y, data.size + 5, 0, Math.PI * 2);
          context.stroke();
        } else {
          // Agent node: one slim pulsing ring in its own violet, not the teal
          // accent used for hover/focus.
          context.strokeStyle = nodeColor('agent');
          context.lineWidth = 1.5;
          context.globalAlpha = 0.35 + pulse * 0.25;
          context.beginPath();
          context.arc(data.x, data.y, data.size + 4 + pulse * 2, 0, Math.PI * 2);
          context.stroke();
        }
        context.restore();
      }
      drawDiscNodeLabel(context, data, settings);
    };

    // graphology graph
    const g = new Graph({ multi: false });
    graphRef.current = g;
    // Keep initial density roughly constant as the graph grows (e.g. a full
    // Google Classroom import) so a big import starts pre-spread instead of
    // piling into the same small circle the force sim then has to untangle.
    const spread = Math.max(1, Math.sqrt(data.nodes.length / 40));
    data.nodes.forEach((n, i) => {
      const a = (i / data.nodes.length) * Math.PI * 2;
      // docs constellation starts on a wider ring so it settles around the workspace
      const r = (isDocType(n.type) ? 430 : 200) * spread;
      g.addNode(n.id, { x: Math.cos(a) * r + (Math.random() - 0.5) * 40, y: Math.sin(a) * r + (Math.random() - 0.5) * 40, size: SIZE[n.type] || 8, label: n.label, ntype: n.type });
    });
    for (const e of data.edges) {
      // simple graph: collapse parallel / bidirectional edges into one
      if (g.hasEdge(e.source, e.target) || g.hasEdge(e.target, e.source)) continue;
      g.addEdge(e.source, e.target, { kind: e.kind, size: 1 });
    }
    adjRef.current = buildAdjacency(data);

    // Persistent, non-animated "AI Assistant" launcher — always present,
    // unlike the ephemeral "agent:<id>" nodes tied to a live MCP connection.
    // Anchored right next to the teacher hub so it never drifts into empty space.
    if (g.hasNode('teacher')) {
      const tx = g.getNodeAttribute('teacher', 'x'), ty = g.getNodeAttribute('teacher', 'y');
      const angle = Math.random() * Math.PI * 2;
      const aiX = tx + Math.cos(angle) * 70, aiY = ty + Math.sin(angle) * 70;
      g.addNode('ai-hub', { x: aiX, y: aiY, size: SIZE.ai, label: '✨ AI Assistant', ntype: 'ai' });
      g.addEdge('ai-hub', 'teacher', { kind: 'ai-hub', size: 1 });
      adjRef.current.set('ai-hub', new Set(['teacher']));
      adjRef.current.get('teacher')!.add('ai-hub');
    }

    // d3-force
    const simNodes: any[] = data.nodes.map((n) => ({ id: n.id, x: g.getNodeAttribute(n.id, 'x'), y: g.getNodeAttribute(n.id, 'y') }));
    if (g.hasNode('ai-hub')) simNodes.push({ id: 'ai-hub', x: g.getNodeAttribute('ai-hub', 'x'), y: g.getNodeAttribute('ai-hub', 'y') });
    const idToSim = new Map(simNodes.map((n) => [n.id, n]));
    simNodesRef.current = simNodes;
    idToSimRef.current = idToSim;
    const simLinks: any[] = data.edges.map((e) => ({ source: e.source, target: e.target, kind: e.kind }));
    if (g.hasEdge('ai-hub', 'teacher')) simLinks.push({ source: 'ai-hub', target: 'teacher', kind: 'ai-hub' });
    simLinksRef.current = simLinks;
    // Docs-tree edges pull tight (a constellation of sections); "uses" edges
    // tether activity docs loosely to the worksheets built with them.
    const linkDistance = (l: any) => (l.kind === 'docs' ? 55 : l.kind === 'uses' ? 190 : l.kind === 'agent-touch' ? 90 : 130);
    const linkStrength = (l: any) => (l.kind === 'docs' ? 0.45 : l.kind === 'uses' ? 0.03 : l.kind === 'agent-touch' ? 0.06 : 0.09);
    // Live agent nodes aren't in `data.nodes` (the static snapshot) — read
    // their type off the live graphology graph first, falling back to it.
    const typeOf = (id: string) => (g.hasNode(id) ? g.getNodeAttribute(id, 'ntype') : nodeById.get(id)?.type);
    const nodeCharge = (d: any) => {
      const t = typeOf(d.id);
      return t === 'doc-hub' ? -220 : isDocType(t) ? -90 : -420;
    };
    const sim = forceSimulation(simNodes)
      // Stronger repulsion reaching further out (distanceMax) is what lets a
      // large import (e.g. a full Google Classroom export) spread outward
      // instead of clumping; a light centering pull (x/y strength) keeps the
      // graph from drifting off-screen without fighting that spread.
      .force('charge', forceManyBody().strength(nodeCharge).distanceMax(900))
      .force('link', forceLink(simLinks).id((d: any) => d.id).distance(linkDistance).strength(linkStrength))
      .force('collide', forceCollide().radius((d: any) => (SIZE[typeOf(d.id) || ''] || 8) + 18))
      .force('x', forceX(0).strength(0.015))
      .force('y', forceY(0).strength(0.015));
    simRef.current = sim;

    // sigma
    const renderer = new Sigma(g, container, {
      renderLabels: true,
      allowInvalidContainer: true,
      labelFont: 'Atkinson Hyperlegible, system-ui, sans-serif',
      labelColor: { color: paletteRef.current.text },
      labelSize: 12, labelWeight: '600',
      defaultDrawNodeHover: drawNodeHover,
      defaultDrawNodeLabel: drawNodeLabel,
      defaultEdgeColor: paletteRef.current.edge,
      zIndex: true, minCameraRatio: CAMERA_RATIO.min, maxCameraRatio: CAMERA_RATIO.max,
      nodeReducer: (node: string, d: any) => {
        const dist = distRef.current ? distRef.current.get(node) : undefined;
        const f = focusRef.current;
        const hovered = node === hoverRef.current;
        const focused = node === f;
        const neighbor = !!f && dist === 1;
        // Ghost = the node belongs to the BACKGROUND layer of the switch.
        const ghost = isDocType(d.ntype) !== (layerRef.current === 'docs');
        // Live MCP-agent overlay: knowledge retrieval/generation "lights up"
        // whatever node the agent just touched, decaying over a few seconds.
        const touchedAt = touchesRef.current.get(node);
        const touchAge = touchedAt ? Date.now() - touchedAt : Infinity;
        const touching = touchAge < TOUCH_GLOW_MS;
        const glow = touching ? 1 - touchAge / TOUCH_GLOW_MS : 0;
        const wip = wipRef.current.has(node);
        let color = nodeColor(d.ntype);
        if (ghost) color = mix(color, paletteRef.current.bg, 0.78);
        if (f) {
          if (dist == null || dist >= 3) color = mix(color, paletteRef.current.bg, 0.86);
          else if (dist === 2) color = mix(color, paletteRef.current.bg, 0.45);
        }
        if (glow > 0) color = mix(color, paletteRef.current.accent, glow * 0.4);
        if (hovered) color = paletteRef.current.accent;
        const size = (ghost ? d.size * 0.8 : d.size) * (focused ? 1.5 : hovered ? 1.2 : 1) * (1 + glow * 0.15);
        const forceLabel = hovered || focused || (neighbor && !ghost) || touching || wip || d.ntype === 'agent';
        return {
          ...d, color, size, wip, glow,
          // ghosts stay quiet: no label unless you reach into the layer
          label: ghost && !forceLabel ? null : d.label,
          forceLabel,
          zIndex: focused ? 3 : hovered ? 2 : ghost ? 0 : 1,
          highlighted: hovered || focused,
          hidden: hiddenRef.current.has(legendKeyOf(d.ntype)),
        };
      },
      edgeReducer: (edge: string, d: any) => {
        const [s, t] = g.extremities(edge);
        const f = focusRef.current; const h = hoverRef.current;
        const incident = s === f || t === f || s === h || t === h;
        const docLayer = layerRef.current === 'docs';
        const sType = g.getNodeAttribute(s, 'ntype'); const tType = g.getNodeAttribute(t, 'ntype');
        const ghosts = (isDocType(sType) !== docLayer ? 1 : 0) + (isDocType(tType) !== docLayer ? 1 : 0);
        const suppressed = hiddenRef.current.has(legendKeyOf(sType)) || hiddenRef.current.has(legendKeyOf(tType));
        // An "agent-touch" edge glows for as long as its target node does: a
        // brief decaying flash for a plain read, or a sustained gentle pulse
        // for the whole WIP window while the target is still "being written".
        const otherEnd = sType === 'agent' ? t : tType === 'agent' ? s : null;
        const otherWip = otherEnd ? wipRef.current.has(otherEnd) : false;
        const touchedAt = otherEnd ? touchesRef.current.get(otherEnd) : undefined;
        const touchAge = touchedAt ? Date.now() - touchedAt : Infinity;
        let glow = 0;
        if (d.kind === 'agent-touch') {
          if (otherWip) glow = 0.4 + ((Math.sin(Date.now() / 320) + 1) / 2) * 0.35;
          else if (touchAge < TOUCH_GLOW_MS) glow = (1 - touchAge / TOUCH_GLOW_MS) * 0.7;
        }
        let color = paletteRef.current.edge;
        if (ghosts === 2) color = mix(color, paletteRef.current.bg, 0.82);
        else if (ghosts === 1) color = mix(color, paletteRef.current.bg, 0.55); // cross-layer "uses" tether
        if (f) {
          const ds = distRef.current?.get(s); const dt = distRef.current?.get(t);
          const near = incident || ((ds != null && ds <= 1) && (dt != null && dt <= 1));
          if (!near) color = mix(color, paletteRef.current.bg, 0.7);
        }
        if (glow > 0) color = mix(color, paletteRef.current.accent, glow * 0.6);
        if (incident) color = paletteRef.current.accent;
        return { ...d, color, size: incident ? 2.2 : glow > 0 ? 1.4 + glow * 0.6 : ghosts === 2 ? 0.6 : ghosts === 1 ? 0.8 : 1, hidden: suppressed };
      },
    });
    sigmaRef.current = renderer;

    sim.on('tick', () => {
      for (const n of simNodes) { g.setNodeAttribute(n.id, 'x', n.x); g.setNodeAttribute(n.id, 'y', n.y); }
      renderer.refresh({ skipIndexation: true } as any);
    });

    // drag state (declared before focus lens closure, which references it)
    const dragRef = { current: null as string | null };

    // focus lens
    const applyFocus = (id: string | null) => {
      focusRef.current = id;
      distRef.current = id ? bfsDistances(adjRef.current, id) : null;
      for (const n of simNodes) { if (n.id === id) { n.fx = 0; n.fy = 0; } else if (n.id !== dragRef.current) { n.fx = null; n.fy = null; } }
      if (id) {
        sim.force('radial', forceRadial((d: any) => RING(distRef.current!.get(d.id)), 0, 0).strength((d: any) => RING_STRENGTH(distRef.current!.get(d.id))));
        (sim.force('x') as any).strength(0.004); (sim.force('y') as any).strength(0.004);
        (sim.force('charge') as any).strength(-260);
      } else {
        sim.force('radial', null as any);
        (sim.force('x') as any).strength(0.015); (sim.force('y') as any).strength(0.015);
        (sim.force('charge') as any).strength(nodeCharge);
      }
      sim.alpha(0.9).restart();
      renderer.refresh();
    };
    applyFocusRef.current = applyFocus;

    // interactions
    renderer.on('enterNode', ({ node }: any) => { hoverRef.current = node; container.style.cursor = 'pointer'; renderer.refresh(); });
    renderer.on('leaveNode', () => { hoverRef.current = null; container.style.cursor = 'default'; renderer.refresh(); });
    renderer.on('clickStage', () => { setAgentPopover(null); setAiMenuOpen(false); });
    renderer.on('clickNode', ({ node }: any) => {
      // Agent nodes are live/ephemeral, not a workspace entity with a markdown
      // note — show a small popover instead of routing through the shared
      // content panel.
      if (node.startsWith('agent:')) {
        const agentKeyId = node.slice('agent:'.length);
        const info = agentsRef.current.get(agentKeyId);
        setAgentPopover({ id: agentKeyId, label: info?.label || 'Agent', recent: activityByAgentRef.current.get(agentKeyId) || [] });
        setAiMenuOpen(false);
        return;
      }
      // The persistent AI hub isn't a workspace entity either — it opens a
      // menu of downstream actions instead of the shared content panel.
      if (node === 'ai-hub') {
        setAgentPopover(null);
        setAiMenuOpen((o) => {
          const next = !o;
          if (next) refreshAiKeys();
          return next;
        });
        return;
      }
      setAgentPopover(null);
      setAiMenuOpen(false);
      openRef.current(node);
    });
    renderer.on('downNode', ({ node }: any) => {
      dragRef.current = node; sim.alphaTarget(0.15).restart();
      const n = idToSim.get(node); if (n) { n.fx = n.x; n.fy = n.y; }
    });
    const mouse = renderer.getMouseCaptor();
    mouse.on('mousemovebody', (e: any) => {
      if (!dragRef.current) return;
      const pos = renderer.viewportToGraph(e);
      const n = idToSim.get(dragRef.current); if (n) { n.fx = pos.x; n.fy = pos.y; }
      e.preventSigmaDefault(); e.original.preventDefault?.(); e.original.stopPropagation?.();
    });
    const endDrag = () => {
      if (dragRef.current) {
        const n = idToSim.get(dragRef.current);
        if (n && dragRef.current !== focusRef.current) { n.fx = null; n.fy = null; }
        dragRef.current = null; sim.alphaTarget(0);
      }
    };
    mouse.on('mouseup', endDrag);

    onTheme = () => { resolvePalette(); renderer.setSetting('labelColor', { color: paletteRef.current.text }); renderer.setSetting('defaultEdgeColor', paletteRef.current.edge); renderer.refresh(); };
    document.addEventListener('themechange', onTheme);

    // The content panel shares the row (desktop) or reflows the graph above the
    // drawer (mobile) — refit Sigma to the container whenever it resizes so the
    // focused node stays centred in the visible area.
    let roRaf = 0;
    ro = new ResizeObserver(() => {
      cancelAnimationFrame(roRaf);
      roRaf = requestAnimationFrame(() => {
        const s = sigmaRef.current as any;
        if (!s) return;
        s.resize?.();
        s.refresh?.();
        recenterRef.current();      // keep the focus in view after a resize
      });
    });
    ro.observe(container);

    if (focusRef.current) setTimeout(() => applyFocus(focusRef.current), 80);
    }; // end build

    const waitAndBuild = () => {
      if (killed) return;
      if (!container || container.clientWidth === 0 || container.clientHeight === 0) { raf = requestAnimationFrame(waitAndBuild); return; }
      build();
    };
    waitAndBuild();

    return () => {
      killed = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      if (onTheme) document.removeEventListener('themechange', onTheme);
      simRef.current?.stop?.();
      sigmaRef.current?.kill?.();
      sigmaRef.current = null; simRef.current = null; applyFocusRef.current = () => {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Live MCP-agent overlay: poll agent_activity and mutate the graph engine
  // directly (agent nodes/touch edges are ephemeral — not part of the static
  // `data` snapshot deriveGraph() produced, so they never trigger a rebuild).
  useEffect(() => {
    let stopped = false;
    let timer = 0;
    // A resource/worksheet the agent just created isn't a REAL graph node yet
    // — deriveGraph() only ran once, off the local store snapshot, which never
    // saw the agent's direct-to-Supabase write. Re-hydrate once per missing
    // target and graft any brand-new nodes/edges into the live graph, so the
    // node the WIP ring is drawn on actually exists.
    const attemptedRef = new Set<string>();

    // Spawn point for any brand-new live node (agent or freshly-merged
    // resource/worksheet): near a real anchor if one exists, else near the
    // 'teacher' hub — never a bare random offset from the origin, which tends
    // to land in empty space far from wherever the cluster has drifted. Placed
    // at arm's length on a random bearing (not a tight jitter box), so it
    // doesn't spawn directly on top of the anchor or its other neighbours —
    // the link/collide forces pull it into a natural resting spot from there.
    const spawnNear = (anchorId: string | null) => {
      const g = graphRef.current;
      const id = anchorId && g?.hasNode(anchorId) ? anchorId : (g?.hasNode('teacher') ? 'teacher' : null);
      if (!id || !g) return { x: (Math.random() - 0.5) * 100, y: (Math.random() - 0.5) * 100 };
      const angle = Math.random() * Math.PI * 2;
      const dist = 90 + Math.random() * 40;
      return { x: g.getNodeAttribute(id, 'x') + Math.cos(angle) * dist, y: g.getNodeAttribute(id, 'y') + Math.sin(angle) * dist };
    };

    const mergeFreshNodes = () => {
      const g = graphRef.current; if (!g) return;
      const fresh = deriveGraph({ includeDocs: true });
      for (const n of fresh.nodes) {
        if (g.hasNode(n.id)) continue;
        const anchorEdge = fresh.edges.find((e) => (e.source === n.id && g.hasNode(e.target)) || (e.target === n.id && g.hasNode(e.source)));
        const anchor = anchorEdge ? (anchorEdge.source === n.id ? anchorEdge.target : anchorEdge.source) : null;
        const { x, y } = spawnNear(anchor);
        g.addNode(n.id, { x, y, size: SIZE[n.type] || 8, label: n.label, ntype: n.type });
        const simNode = { id: n.id, x, y };
        simNodesRef.current.push(simNode);
        idToSimRef.current.set(n.id, simNode);
        adjRef.current.set(n.id, new Set());
      }
      for (const e of fresh.edges) {
        if (!g.hasNode(e.source) || !g.hasNode(e.target) || g.hasEdge(e.source, e.target) || g.hasEdge(e.target, e.source)) continue;
        g.addEdge(e.source, e.target, { kind: e.kind, size: 1 });
        simLinksRef.current.push({ source: e.source, target: e.target, kind: e.kind });
        adjRef.current.get(e.source)?.add(e.target);
        adjRef.current.get(e.target)?.add(e.source);
      }
      simRef.current?.nodes(simNodesRef.current);
      (simRef.current?.force('link') as any)?.links(simLinksRef.current);
      // Full restart, not a mild reheat — a bulk import (e.g. a whole Google
      // Classroom export) can graft in dozens of nodes at once, all spawned
      // near the same anchor, and needs the full run to fully untangle.
      simRef.current?.alpha(1).restart();
      sigmaRef.current?.refresh();
    };
    mergeFreshNodesRef.current = mergeFreshNodes;

    const ensureAgentNode = (agentKeyId: string, label: string) => {
      const g = graphRef.current; if (!g || !simRef.current) return;
      const nid = 'agent:' + agentKeyId;
      const displayLabel = '🤖 ' + label;
      if (g.hasNode(nid)) { g.setNodeAttribute(nid, 'label', displayLabel); return; }
      const { x, y } = spawnNear(null); // no specific target yet — spawn by the teacher hub
      g.addNode(nid, { x, y, size: SIZE.agent, label: displayLabel, ntype: 'agent' });
      const simNode = { id: nid, x, y };
      simNodesRef.current.push(simNode);
      idToSimRef.current.set(nid, simNode);
      simRef.current.nodes(simNodesRef.current);
      adjRef.current.set(nid, new Set());
      simRef.current.alpha(0.5).restart();
    };

    const removeAgentNode = (agentKeyId: string) => {
      const g = graphRef.current; if (!g || !simRef.current) return;
      const nid = 'agent:' + agentKeyId;
      if (!g.hasNode(nid)) return;
      g.dropNode(nid); // also drops incident edges from the graphology graph
      simNodesRef.current = simNodesRef.current.filter((n) => n.id !== nid);
      idToSimRef.current.delete(nid);
      simLinksRef.current = simLinksRef.current.filter((l: any) => {
        const sid = typeof l.source === 'string' ? l.source : l.source.id;
        const tid = typeof l.target === 'string' ? l.target : l.target.id;
        return sid !== nid && tid !== nid;
      });
      simRef.current.nodes(simNodesRef.current);
      (simRef.current.force('link') as any)?.links(simLinksRef.current);
      adjRef.current.delete(nid);
    };

    const ensureTouchEdge = (agentKeyId: string, targetId: string) => {
      const g = graphRef.current; if (!g || !simRef.current) return;
      const a = 'agent:' + agentKeyId;
      if (!g.hasNode(a) || !g.hasNode(targetId) || a === targetId) return;
      if (g.hasEdge(a, targetId) || g.hasEdge(targetId, a)) return;
      g.addEdge(a, targetId, { kind: 'agent-touch', size: 1 });
      simLinksRef.current.push({ source: a, target: targetId, kind: 'agent-touch' });
      (simRef.current.force('link') as any)?.links(simLinksRef.current);
      adjRef.current.get(a)?.add(targetId);
      adjRef.current.get(targetId)?.add(a);
    };

    const poll = async () => {
      if (stopped) return;
      if (!graphRef.current || !simRef.current) { timer = window.setTimeout(poll, ACTIVITY_POLL_MS); return; }
      const rows = await listRecentActivity(new Date(Date.now() - ACTIVITY_LOOKBACK_MS).toISOString());
      if (stopped) return;
      const now = Date.now();
      const byAgent = new Map<string, ActivityRow[]>();
      for (const r of rows) {
        if (!r.agentKeyId) continue;
        if (!byAgent.has(r.agentKeyId)) byAgent.set(r.agentKeyId, []);
        byAgent.get(r.agentKeyId)!.push(r);
        const at = new Date(r.createdAt).getTime();
        agentsRef.current.set(r.agentKeyId, { label: r.agentLabel, lastSeen: Math.max(agentsRef.current.get(r.agentKeyId)?.lastSeen || 0, at) });
        if (r.targetNodeId) {
          touchesRef.current.set(r.targetNodeId, Math.max(touchesRef.current.get(r.targetNodeId) || 0, at));
          if ((r.tool === 'create_worksheet' || r.tool === 'add_resource') && !wipRef.current.has(r.targetNodeId)) {
            wipRef.current.set(r.targetNodeId, at);
          }
        }
      }
      activityByAgentRef.current = byAgent;

      const missing = rows.filter((r) =>
        (r.tool === 'create_worksheet' || r.tool === 'add_resource') && r.targetNodeId
        && !graphRef.current!.hasNode(r.targetNodeId) && !attemptedRef.has(r.targetNodeId));
      if (missing.length) {
        for (const r of missing) attemptedRef.add(r.targetNodeId!);
        try { await hydrate(); mergeFreshNodes(); } catch { /* best-effort */ }
      }

      for (const [aid, info] of agentsRef.current) {
        if (now - info.lastSeen > AGENT_IDLE_MS) { agentsRef.current.delete(aid); removeAgentNode(aid); continue; }
        ensureAgentNode(aid, info.label);
      }
      for (const r of rows) {
        if (r.agentKeyId && r.targetNodeId && agentsRef.current.has(r.agentKeyId)) ensureTouchEdge(r.agentKeyId, r.targetNodeId);
      }
      for (const [nid, ts] of wipRef.current) if (now - ts > WIP_GRACE_MS) wipRef.current.delete(nid);

      const anyActive = agentsRef.current.size > 0 || wipRef.current.size > 0
        || [...touchesRef.current.values()].some((ts) => now - ts < TOUCH_GLOW_MS);
      if (anyActive && !pulseRafRef.current) {
        const tick = () => { sigmaRef.current?.refresh(); pulseRafRef.current = requestAnimationFrame(tick); };
        pulseRafRef.current = requestAnimationFrame(tick);
      } else if (!anyActive && pulseRafRef.current) {
        cancelAnimationFrame(pulseRafRef.current);
        pulseRafRef.current = 0;
      }
      sigmaRef.current?.refresh();

      if (!stopped) timer = window.setTimeout(poll, ACTIVITY_POLL_MS);
    };
    poll();

    return () => {
      stopped = true;
      clearTimeout(timer);
      if (pulseRafRef.current) { cancelAnimationFrame(pulseRafRef.current); pulseRafRef.current = 0; }
      mergeFreshNodesRef.current = () => {};
    };
  }, []);

  // react focus state → engine (then pan the camera to the focused node)
  useEffect(() => {
    applyFocusRef.current?.(focus);
    if (!focus) return;
    const t = setTimeout(() => recenterRef.current(), 200);
    return () => clearTimeout(t);
  }, [focus]);

  // layer switch → restyle only (the layout never jumps; reducers read layerRef)
  useEffect(() => {
    layerRef.current = layer;
    sigmaRef.current?.refresh();
  }, [layer]);

  // legend toggles → restyle only (reducers read hiddenRef)
  useEffect(() => {
    hiddenRef.current = hiddenTypes;
    sigmaRef.current?.refresh();
  }, [hiddenTypes]);

  const toggleLegend = (key: string) => {
    const next = new Set(hiddenTypes);
    if (next.has(key)) next.delete(key); else next.add(key);
    // don't leave the content panel open on a node that just became invisible
    if (focus && next.has(key)) {
      const n = nodeById.get(focus);
      if (n && legendKeyOf(n.type) === key) close();
    }
    setHiddenTypes(next);
  };

  const doSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim().toLowerCase();
    if (!q) return;
    const hit = data.nodes.find((n) => n.label.toLowerCase().includes(q));
    if (hit) open(hit.id);
  };

  // Fit the camera to the bounding box of the currently VISIBLE nodes (legend
  // filters excluded), with breathing room — not sigma's animatedReset(),
  // which just recentres on the whole graph regardless of what's shown.
  const fitToView = () => {
    const s = sigmaRef.current as any;
    const root = rootRef.current;
    const g = graphRef.current;
    if (!s || !root || !g) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let any = false;
    g.forEachNode((id: string) => {
      let d: any;
      try { d = s.getNodeDisplayData(id); } catch { d = null; }
      if (!d || d.hidden) return;
      any = true;
      minX = Math.min(minX, d.x); maxX = Math.max(maxX, d.x);
      minY = Math.min(minY, d.y); maxY = Math.max(maxY, d.y);
    });
    if (!any) return;
    const PADDING = 0.2; // 20% breathing room around the bounds
    const boxW = Math.max(maxX - minX, 1e-6);
    const boxH = Math.max(maxY - minY, 1e-6);
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;

    const cam = s.getCamera();
    const W = root.clientWidth, H = root.clientHeight;
    // How much framed-graph space the viewport currently shows, at the current
    // ratio — used as a scale reference to derive the ratio the target box needs.
    const topLeft = s.viewportToFramedGraph({ x: 0, y: 0 });
    const bottomRight = s.viewportToFramedGraph({ x: W, y: H });
    const viewW = Math.abs(bottomRight.x - topLeft.x) || 1e-6;
    const viewH = Math.abs(bottomRight.y - topLeft.y) || 1e-6;
    const scale = Math.max((boxW * (1 + PADDING)) / viewW, (boxH * (1 + PADDING)) / viewH);
    const ratio = Math.min(Math.max(cam.getState().ratio * scale, CAMERA_RATIO.min), CAMERA_RATIO.max);
    cam.animate({ x: cx, y: cy, ratio, angle: 0 }, { duration: 260 });
  };

  const toggleSearch = () => { if (searchOpen) setQuery(''); setSearchOpen((o) => !o); };
  const submitSearch = (e: React.FormEvent) => { doSearch(e); setSearchOpen(false); };

  const generateReport = () => {
    download(`workspace-report-${new Date().toISOString().slice(0, 10)}.md`, buildWorkspaceReport(), 'text/markdown');
    setAiMenuOpen(false);
  };

  return (
    <div className="knw" ref={rootRef}>
      <div className="knw-stage" ref={stageRef} />
      <div className="knw-toolbar">
        <div className="knw-toolbar-row">
          <div>
            <h1 className="knw-title">Knowledge</h1>
            <p className="knw-sub">Click a node — the graph reorganises around it.</p>
          </div>
          <div className="knw-controls">
            <div className="knw-layers" role="group" aria-label="Knowledge layer">
              <button className={`knw-layer-btn${layer === 'workspace' ? ' knw-layer-btn--active' : ''}`} onClick={() => setLayer('workspace')} title="Your workspace in front, docs floating behind">Workspace</button>
              <button className={`knw-layer-btn${layer === 'docs' ? ' knw-layer-btn--active' : ''}`} onClick={() => setLayer('docs')} title="EnsinoLibre docs in front — see which components are used where">Docs</button>
            </div>
            {focus && <button className="el-button el-button--ghost el-button--small" onClick={() => close()}>Clear focus</button>}
            <button className={`app-icon-btn knw-icon-btn${searchOpen ? ' knw-icon-btn--active' : ''}`} aria-label="Search nodes" aria-expanded={searchOpen} title="Search nodes" onClick={toggleSearch}>🔍</button>
            <button className={`app-icon-btn knw-icon-btn${legendOpen ? ' knw-icon-btn--active' : ''}`} aria-label="Filter node types" aria-expanded={legendOpen} title="Filter node types" onClick={() => setLegendOpen((o) => !o)}>▽</button>
            <button className="app-icon-btn knw-icon-btn" aria-label="Fit to view" title="Fit to view" onClick={fitToView}>⛶</button>
          </div>
        </div>
        {searchOpen && (
          <form onSubmit={submitSearch} className="knw-search-row">
            <input className="el-input knw-search" autoFocus placeholder="Search nodes…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </form>
        )}
      </div>

      {legendOpen && <Legend hidden={hiddenTypes} onToggle={toggleLegend} />}
      {agentPopover && <AgentPopover info={agentPopover} onClose={() => setAgentPopover(null)} />}
      {aiMenuOpen && (
        <AiMenu
          loading={aiKeys.loading}
          connected={aiKeys.keys.length > 0}
          keyCount={aiKeys.keys.length}
          onClose={() => setAiMenuOpen(false)}
          onConnect={() => { setAiMenuOpen(false); setAiConnectOpen(true); }}
          onCreateWorksheet={() => { setAiAction('worksheet'); setAiMenuOpen(false); }}
          onSeedKnowledgeBase={() => { setAiAction('seed'); setAiMenuOpen(false); }}
          onImportClassroom={() => { setAiAction('classroom'); setAiMenuOpen(false); }}
          onGenerateReport={generateReport}
        />
      )}
      {!focus && (
        <div className="knw-hint">
          {layer === 'docs'
            ? 'Docs layer: activity pages link to the worksheets built with them'
            : 'Tip: search or click any node to open its content'}
        </div>
      )}
      <AnimatePresence>
        {aiAction === 'worksheet' && (
          <CreateWorksheetModal
            initialTab="mcp"
            onClose={() => setAiAction(null)}
            onAdded={() => { setAiAction(null); mergeFreshNodesRef.current(); }}
          />
        )}
        {aiAction === 'seed' && (
          <SeedModal
            initialTab="mcp"
            onClose={() => setAiAction(null)}
            onApplied={() => { mergeFreshNodesRef.current(); }}
          />
        )}
        {aiAction === 'classroom' && (
          <ClassroomImportModal
            initialTab="mcp"
            onClose={() => setAiAction(null)}
            onApplied={() => { mergeFreshNodesRef.current(); }}
          />
        )}
        {aiConnectOpen && (
          <McpConnectModal onClose={() => { setAiConnectOpen(false); refreshAiKeys(); }} />
        )}
      </AnimatePresence>
    </div>
  );
}

function Legend({ hidden, onToggle }: { hidden: Set<string>; onToggle: (key: string) => void }) {
  return (
    <div className="knw-legend">
      <h4>Legend</h4>
      {LEGEND_ITEMS.map(({ label, key, colorType }) => {
        const visible = !hidden.has(key);
        return (
          <button
            key={key} type="button" className="knw-legend-row" aria-pressed={visible}
            title={visible ? `Hide ${label} nodes` : `Show ${label} nodes`}
            onClick={() => onToggle(key)}
          >
            <span className="knw-legend-dot" style={{ background: visible ? `var(${TYPE_VAR[colorType]})` : 'var(--color-text-muted)' }} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

const TOOL_LABEL: Record<string, string> = {
  get_workspace_context: 'read the workspace',
  get_worksheet_contract: 'fetched the worksheet contract',
  create_worksheet: 'created a worksheet',
  list_worksheets: 'listed worksheets',
  add_resource: 'added a knowledge note',
  get_resource: 'read a knowledge note',
  search_resources: 'searched the knowledge base',
  update_resource: 'revised a knowledge note',
  append_resource_note: 'added a dated note update',
  upsert_classroom: 'created/updated a classroom',
  upsert_student: 'created/updated a student',
  update_worksheet: 'revised a worksheet',
  delete_worksheet: 'removed a worksheet',
  add_student_note: 'logged a student observation',
  deploy_worksheets: 'deployed a live session',
  set_aula_status: 'changed a deployment status',
  get_progress: 'read student progress',
  revert: 'reverted an agent change',
};

function timeAgo(iso: string) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  return `${Math.round(s / 60)}m ago`;
}

/**
 * Downstream actions off the persistent AI hub node — connection-aware:
 * no agent key yet → a short pitch for what connecting unlocks, plus
 * "Connect your AI" (the modal it opens still works without a key, via its
 * own copy-paste tab); at least one key → connection info (with a kebab to
 * manage/change it) plus the 4 quick actions, each jumping straight to that
 * modal's "Connect via MCP" tab since the agent is already wired up.
 */
function AiMenu({ loading, connected, keyCount, onClose, onConnect, onCreateWorksheet, onSeedKnowledgeBase, onImportClassroom, onGenerateReport }: {
  loading: boolean; connected: boolean; keyCount: number;
  onClose: () => void; onConnect: () => void;
  onCreateWorksheet: () => void; onSeedKnowledgeBase: () => void; onImportClassroom: () => void; onGenerateReport: () => void;
}) {
  return (
    <div className="knw-legend knw-agent-popover">
      <div className="knw-agent-popover-head">
        <h4>✨ AI Assistant</h4>
        <div className="knw-agent-popover-head-actions">
          {connected && <KebabMenu items={[{ label: '🔌 Change connection', onClick: onConnect }]} />}
          <button className="app-icon-btn" aria-label="Close" onClick={onClose}>✕</button>
        </div>
      </div>
      {loading ? (
        <p className="app-muted">Checking connection…</p>
      ) : !connected ? (
        <>
          <p className="app-muted">
            Not connected yet. A connected agent can create worksheets, seed your knowledge base and
            import a whole Google Classroom export directly — file by file, with no copy-paste and no
            size limit.
          </p>
          <div className="knw-ai-actions">
            <button className="el-button el-button--small" onClick={onConnect}>🔌 Connect your AI</button>
          </div>
        </>
      ) : (
        <>
          <p className="app-muted">✓ Connected · {keyCount} agent key{keyCount === 1 ? '' : 's'}</p>
          <div className="knw-ai-actions">
            <button className="el-button el-button--ghost el-button--small" onClick={onCreateWorksheet}>📝 Create worksheet</button>
            <button className="el-button el-button--ghost el-button--small" onClick={onSeedKnowledgeBase}>🌱 Seed knowledge base</button>
            <button className="el-button el-button--ghost el-button--small" onClick={onImportClassroom}>🏫 Import classroom</button>
            <button className="el-button el-button--ghost el-button--small" onClick={onGenerateReport}>📊 Generate report</button>
          </div>
        </>
      )}
    </div>
  );
}

/** Live/ephemeral info about a connected MCP agent — not a workspace entity,
 * so it gets its own small popover rather than the shared content panel. */
function AgentPopover({ info, onClose }: { info: { id: string; label: string; recent: ActivityRow[] }; onClose: () => void }) {
  return (
    <div className="knw-legend knw-agent-popover">
      <div className="knw-agent-popover-head">
        <h4>🤖 {info.label}</h4>
        <button className="app-icon-btn" aria-label="Close" onClick={onClose}>✕</button>
      </div>
      <p className="app-muted">Connected via MCP · recent activity</p>
      {info.recent.length === 0 ? (
        <p className="app-muted">No recent tool calls.</p>
      ) : (
        <ul className="knw-agent-activity">
          {info.recent.slice().reverse().slice(0, 8).map((r) => (
            <li key={r.id} className={r.status === 'error' ? 'knw-agent-activity--error' : undefined}>
              <span>{r.status === 'error' ? '⚠ ' : ''}{r.summary || TOOL_LABEL[r.tool] || r.tool}</span>
              <span className="app-muted">{timeAgo(r.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
