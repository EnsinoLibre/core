import { describe, it, expect, vi } from 'vitest';

const fixtureStore = {
  teacher: () => ({ name: 'Ana', school: 'LLC' }),
  classrooms: () => [{ id: 'c1', name: 'English A2', subject: 'English', level: 'A2', context: 'Evening group' }],
  students: () => [{ id: 's1', classId: 'c1', name: 'Rui', level: 'A2', goals: 'Pass the certificate' }],
  worksheetsAll: () => [{ id: 'w1', title: 'Daily Routines', subject: 'English' }],
  resources: () => [
    { id: 'r1', kind: 'material', title: 'Handout', subject: 'English', note: '', classId: 'c1', studentId: null, links: [] },
    // A dangling wiki link (target never added as a node) alongside a valid one, to prove dangling edges are dropped, not just untested.
    { id: 'r2', kind: 'context', title: 'Rui — context note', subject: '', note: '', classId: null, studentId: 's1', links: ['worksheet:w1', 'worksheet:does-not-exist'] },
  ],
  aulas: () => [{ id: 'a1', classId: 'c1', title: 'Tuesday session', code: 'A2LIVE', worksheetIds: ['w1'] }],
};

vi.mock('../store.js', () => ({ store: fixtureStore }));
vi.mock('../docslayer.js', () => ({ deriveDocsLayer: () => ({ nodes: [], edges: [] }) }));

const { deriveGraph, buildAdjacency, bfsDistances } = await import('../graph.js');

describe('deriveGraph', () => {
  it('creates one node per entity plus the teacher hub', () => {
    const { nodes } = deriveGraph();
    const ids = nodes.map((n: any) => n.id);
    expect(ids).toEqual(
      expect.arrayContaining(['teacher', 'class:c1', 'student:s1', 'worksheet:w1', 'resource:r1', 'resource:r2', 'aula:a1']),
    );
    expect(nodes).toHaveLength(7);
  });

  it('derives structural edges: ownership, membership and deployment', () => {
    const { edges } = deriveGraph();
    expect(edges).toEqual(expect.arrayContaining([
      { source: 'teacher', target: 'class:c1', kind: 'owns' },
      { source: 'class:c1', target: 'student:s1', kind: 'member' },
      { source: 'class:c1', target: 'aula:a1', kind: 'deploy' },
      { source: 'aula:a1', target: 'worksheet:w1', kind: 'deploy' },
    ]));
  });

  it('derives resource edges from classId/studentId scope and explicit wiki links', () => {
    const { edges } = deriveGraph();
    expect(edges).toContainEqual({ source: 'class:c1', target: 'resource:r1', kind: 'context' });
    expect(edges).toContainEqual({ source: 'student:s1', target: 'resource:r2', kind: 'context' });
    expect(edges).toContainEqual({ source: 'resource:r2', target: 'worksheet:w1', kind: 'wiki' });
  });

  it('drops a wiki-link edge whose target was never added as a node (dangling link)', () => {
    const { edges } = deriveGraph();
    expect(edges.some((e: any) => e.target === 'worksheet:does-not-exist')).toBe(false);
  });
});

describe('buildAdjacency + bfsDistances', () => {
  it('computes shortest hop distances across an undirected view of the edges', () => {
    const graph = deriveGraph();
    const adj = buildAdjacency(graph);
    const dist = bfsDistances(adj, 'teacher');

    expect(dist.get('teacher')).toBe(0);
    expect(dist.get('class:c1')).toBe(1);
    expect(dist.get('student:s1')).toBe(2);
    // aula:a1 is 2 hops from teacher (via class:c1); worksheet:w1 is a further hop via the aula's deploy edge.
    expect(dist.get('aula:a1')).toBe(2);
    expect(dist.get('worksheet:w1')).toBe(3);
  });
});
