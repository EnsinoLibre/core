import { useEffect, useMemo, useRef, useState } from 'react';
import Graph from 'graphology';
import Sigma from 'sigma';
import {
  forceSimulation, forceManyBody, forceLink, forceCollide, forceX, forceY, forceRadial,
} from 'd3-force';
import { deriveGraph, buildAdjacency, bfsDistances } from '../lib/api';
import { useContent } from './ContentPanel';

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
};
const SIZE: Record<string, number> = {
  teacher: 16, class: 13, aula: 12, worksheet: 10, student: 10, 'resource-guideline': 10,
};

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

  const data = useMemo(() => deriveGraph(), []);
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

    // graphology graph
    const g = new Graph({ multi: false });
    graphRef.current = g;
    data.nodes.forEach((n, i) => {
      const a = (i / data.nodes.length) * Math.PI * 2;
      g.addNode(n.id, { x: Math.cos(a) * 200 + (Math.random() - 0.5) * 40, y: Math.sin(a) * 200 + (Math.random() - 0.5) * 40, size: SIZE[n.type] || 8, label: n.label, ntype: n.type });
    });
    for (const e of data.edges) {
      // simple graph: collapse parallel / bidirectional edges into one
      if (g.hasEdge(e.source, e.target) || g.hasEdge(e.target, e.source)) continue;
      g.addEdge(e.source, e.target, { kind: e.kind, size: 1 });
    }
    adjRef.current = buildAdjacency(data);

    // d3-force
    const simNodes: any[] = data.nodes.map((n) => ({ id: n.id, x: g.getNodeAttribute(n.id, 'x'), y: g.getNodeAttribute(n.id, 'y') }));
    const idToSim = new Map(simNodes.map((n) => [n.id, n]));
    const simLinks = data.edges.map((e) => ({ source: e.source, target: e.target }));
    const sim = forceSimulation(simNodes)
      .force('charge', forceManyBody().strength(-260).distanceMax(500))
      .force('link', forceLink(simLinks).id((d: any) => d.id).distance(90).strength(0.12))
      .force('collide', forceCollide().radius((d: any) => (SIZE[nodeById.get(d.id)?.type || ''] || 8) + 8))
      .force('x', forceX(0).strength(0.03))
      .force('y', forceY(0).strength(0.03));
    simRef.current = sim;

    // sigma
    const renderer = new Sigma(g, container, {
      renderLabels: true,
      allowInvalidContainer: true,
      labelFont: 'Atkinson Hyperlegible, system-ui, sans-serif',
      labelColor: { color: paletteRef.current.text },
      labelSize: 12, labelWeight: '600',
      defaultEdgeColor: paletteRef.current.edge,
      zIndex: true, minCameraRatio: 0.35, maxCameraRatio: 3,
      nodeReducer: (node: string, d: any) => {
        const dist = distRef.current ? distRef.current.get(node) : undefined;
        const f = focusRef.current;
        const hovered = node === hoverRef.current;
        const focused = node === f;
        const neighbor = !!f && dist === 1;
        let color = nodeColor(d.ntype);
        if (f) {
          if (dist == null || dist >= 3) color = mix(color, paletteRef.current.bg, 0.86);
          else if (dist === 2) color = mix(color, paletteRef.current.bg, 0.45);
        }
        if (hovered) color = paletteRef.current.accent;
        return {
          ...d, color,
          size: focused ? d.size * 1.5 : hovered ? d.size * 1.2 : d.size,
          forceLabel: hovered || focused || neighbor,
          zIndex: focused ? 3 : hovered ? 2 : 1,
          highlighted: hovered || focused,
        };
      },
      edgeReducer: (edge: string, d: any) => {
        const [s, t] = g.extremities(edge);
        const f = focusRef.current; const h = hoverRef.current;
        const incident = s === f || t === f || s === h || t === h;
        let color = paletteRef.current.edge;
        if (f) {
          const ds = distRef.current?.get(s); const dt = distRef.current?.get(t);
          const near = incident || ((ds != null && ds <= 1) && (dt != null && dt <= 1));
          if (!near) color = mix(paletteRef.current.edge, paletteRef.current.bg, 0.7);
        }
        if (incident) color = paletteRef.current.accent;
        return { ...d, color, size: incident ? 2.2 : 1 };
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
        (sim.force('x') as any).strength(0.008); (sim.force('y') as any).strength(0.008);
        (sim.force('charge') as any).strength(-160);
      } else {
        sim.force('radial', null as any);
        (sim.force('x') as any).strength(0.03); (sim.force('y') as any).strength(0.03);
        (sim.force('charge') as any).strength(-260);
      }
      sim.alpha(0.9).restart();
      renderer.refresh();
    };
    applyFocusRef.current = applyFocus;

    // interactions
    renderer.on('enterNode', ({ node }: any) => { hoverRef.current = node; container.style.cursor = 'pointer'; renderer.refresh(); });
    renderer.on('leaveNode', () => { hoverRef.current = null; container.style.cursor = 'default'; renderer.refresh(); });
    renderer.on('clickNode', ({ node }: any) => openRef.current(node));
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

  // react focus state → engine (then pan the camera to the focused node)
  useEffect(() => {
    applyFocusRef.current?.(focus);
    if (!focus) return;
    const t = setTimeout(() => recenterRef.current(), 200);
    return () => clearTimeout(t);
  }, [focus]);

  const doSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim().toLowerCase();
    if (!q) return;
    const hit = data.nodes.find((n) => n.label.toLowerCase().includes(q));
    if (hit) open(hit.id);
  };

  return (
    <div className="knw" ref={rootRef}>
      <div className="knw-stage" ref={stageRef} />
      <div className="knw-toolbar">
        <div>
          <h1 className="knw-title">Knowledge</h1>
          <p className="knw-sub">Click a node — the graph reorganises around it.</p>
        </div>
        <form onSubmit={doSearch}><input className="el-input knw-search" placeholder="Search nodes…" value={query} onChange={(e) => setQuery(e.target.value)} /></form>
        <div className="knw-controls">
          {focus && <button className="el-button el-button--ghost el-button--small" onClick={() => close()}>Clear focus</button>}
          <button className="el-button el-button--ghost el-button--small" onClick={() => sigmaRef.current?.getCamera().animatedReset()}>Fit</button>
        </div>
      </div>

      <Legend />
      {!focus && <div className="knw-hint">Tip: search or click any node to open its content</div>}
    </div>
  );
}

function Legend() {
  const items: [string, string][] = [
    ['Classroom', TYPE_VAR.class], ['Student', TYPE_VAR.student], ['Live class', TYPE_VAR.aula],
    ['Worksheet', TYPE_VAR.worksheet], ['Material', TYPE_VAR['resource-material']],
    ['Guideline', TYPE_VAR['resource-guideline']], ['External', TYPE_VAR['resource-external']],
    ['Context', TYPE_VAR['resource-context']], ['Teacher', TYPE_VAR.teacher],
  ];
  return (
    <div className="knw-legend">
      <h4>Legend</h4>
      {items.map(([label, v]) => (
        <div className="knw-legend-row" key={label}><span className="knw-legend-dot" style={{ background: `var(${v})` }} />{label}</div>
      ))}
    </div>
  );
}
