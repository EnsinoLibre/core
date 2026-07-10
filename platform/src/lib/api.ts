/**
 * Thin typed-ish re-export of the framework-agnostic workspace logic.
 * store.js / graph.js are shared with the public generator and treated as the
 * single source of truth; the platform imports them here and (for now) as any.
 */
// @ts-ignore - plain JS module, no d.ts
import { store as _store, auth as _auth, studentAuth as _studentAuth, onLiveUpdate as _onLive, refresh as _refresh, hydrate as _hydrate, isHydrated as _isHydrated } from './store.js';
// @ts-ignore
import { deriveGraph as _derive, buildAdjacency as _adj, bfsDistances as _bfs, NODE_TYPES as _NT } from './graph.js';
export { supabase } from './supabase';

export const store: any = _store;
export const auth: any = _auth;
export const studentAuth: any = _studentAuth;
export const onLiveUpdate: (fn: (m: any) => void) => (() => void) = _onLive;
export const refresh: () => void = _refresh;
export const hydrate: () => Promise<any> = _hydrate;
export const isHydrated: () => boolean = _isHydrated;

export const deriveGraph: (opts?: { includeDocs?: boolean }) => { nodes: GraphNode[]; edges: GraphEdge[] } = _derive;
export const buildAdjacency: (g: any) => Map<string, Set<string>> = _adj;
export const bfsDistances: (adj: Map<string, Set<string>>, from: string) => Map<string, number> = _bfs;
export const NODE_TYPES: Record<string, string> = _NT;

// @ts-ignore - shared exporters (JSON / Analog PDF / Markdown / Moodle XML)
import { exportAnalogPDF as _pdf, exportMoodle as _moodle, exportMarkdown as _emd, exportJSON as _ejson, moodleQuestionCount as _mq, download as _dl } from './exporters.js';
// @ts-ignore
import { buildVault as _vault } from './vault.js';
// @ts-ignore
import { makeZip as _zip } from './zip.js';

export const exportAnalogPDF: (ws: any) => void = _pdf;
export const exportMoodle: (ws: any) => void = _moodle;
export const exportMarkdown: (ws: any) => void = _emd;
export const exportJSON: (ws: any) => void = _ejson;
export const moodleQuestionCount: (ws: any) => number = _mq;
export const download: (name: string, content: string, mime: string) => void = _dl;
export const buildVault: () => { name: string; content: string }[] = _vault;
export const makeZip: (files: { name: string; content: string }[]) => Blob = _zip;

// @ts-ignore
import { validateWorksheet as _vw } from './validator.js';
export const validateWorksheet: (ws: any) => string[] = _vw;

// @ts-ignore - knowledge-base seeding (bulk files / Google Classroom → summary notes)
import { stageFiles as _sf, buildSeedPrompt as _bsp, parseSeedResult as _psr, applySeedResult as _asr, buildClassroomImportPrompt as _bcp, parseClassroomImport as _pci, applyClassroomImport as _aci } from './kbseed.js';
export const stageFiles: (files: FileList | File[]) => Promise<any[]> = _sf;
export const buildSeedPrompt: (staged: any[], scope?: any) => string = _bsp;
export const parseSeedResult: (text: string) => any[] = _psr;
export const applySeedResult: (entries: any[], scope?: any) => { created: any[]; linked: number; unresolved: string[] } = _asr;
export const buildClassroomImportPrompt: () => string = _bcp;
export const parseClassroomImport: (text: string) => any[] = _pci;
export const applyClassroomImport: (classes: any[]) => { classroomsCreated: number; classroomsMerged: number; students: number; resources: number } = _aci;

export interface GraphNode { id: string; type: string; label: string; subtitle?: string; body?: string; url?: string; }
export interface GraphEdge { source: string; target: string; kind: string; }
