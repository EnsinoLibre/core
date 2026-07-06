/**
 * Thin typed-ish re-export of the framework-agnostic workspace logic.
 * store.js / graph.js are shared with the public generator and treated as the
 * single source of truth; the platform imports them here and (for now) as any.
 */
// @ts-ignore - plain JS module, no d.ts
import { store as _store, auth as _auth, studentAuth as _studentAuth, onLiveUpdate as _onLive, refresh as _refresh } from './store.js';
// @ts-ignore
import { deriveGraph as _derive, buildAdjacency as _adj, bfsDistances as _bfs, NODE_TYPES as _NT } from './graph.js';

export const store: any = _store;
export const auth: any = _auth;
export const studentAuth: any = _studentAuth;
export const onLiveUpdate: (fn: (m: any) => void) => (() => void) = _onLive;
export const refresh: () => void = _refresh;

export const deriveGraph: () => { nodes: GraphNode[]; edges: GraphEdge[] } = _derive;
export const buildAdjacency: (g: any) => Map<string, Set<string>> = _adj;
export const bfsDistances: (adj: Map<string, Set<string>>, from: string) => Map<string, number> = _bfs;
export const NODE_TYPES: Record<string, string> = _NT;

export interface GraphNode { id: string; type: string; label: string; subtitle?: string; body?: string; url?: string; }
export interface GraphEdge { source: string; target: string; kind: string; }
