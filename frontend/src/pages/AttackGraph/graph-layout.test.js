import { describe, expect, test, vi } from 'vitest';
import {
  applyRouteFocus, fitGraphToView, getVisibleGraph, layoutAttackGraph
} from './graph-layout';

const nodes = [
  { id: 'origin:internet', type: 'ENTRY', label: 'Internet' },
  { id: 'asset:web', type: 'ASSET', label: 'web', assetId: 'web' },
  { id: 'service:web:tcp:8080', type: 'SERVICE', label: 'http', assetId: 'web' },
  { id: 'vulnerability:f1:cve', type: 'VULNERABILITY', label: 'CVE', assetId: 'web' },
  { id: 'evidence:f1', type: 'EVIDENCE', label: 'Evidence', assetId: 'web' }
];
const edges = nodes.slice(1).map((node, index) => ({
  id: `edge-${index}`,
  source: nodes[index].id,
  target: node.id,
  type: 'RELATION',
  reason: 'Persisted relation'
}));

describe('attack graph layout and focus', () => {
  test('ELK returns finite, non-overlapping, left-to-right positions', async () => {
    const layout = await layoutAttackGraph(nodes, edges);
    layout.nodes.forEach(({ position }) => {
      expect(Number.isFinite(position.x)).toBe(true);
      expect(Number.isFinite(position.y)).toBe(true);
    });
    for (let left = 0; left < layout.nodes.length; left += 1) {
      for (let right = left + 1; right < layout.nodes.length; right += 1) {
        const a = layout.nodes[left];
        const b = layout.nodes[right];
        const overlaps = a.position.x < b.position.x + b.width &&
          a.position.x + a.width > b.position.x &&
          a.position.y < b.position.y + b.height &&
          a.position.y + a.height > b.position.y;
        expect(overlaps).toBe(false);
      }
    }
    const byId = new Map(layout.nodes.map((node) => [node.id, node]));
    edges.forEach((edge) => {
      expect(byId.get(edge.source).position.x).toBeLessThan(byId.get(edge.target).position.x);
    });
  });

  test('a selected route highlights only its exact node and edge IDs', async () => {
    const layout = await layoutAttackGraph(nodes, edges);
    const route = { nodeIds: nodes.slice(0, 3).map(({ id }) => id), edgeIds: ['edge-0', 'edge-1'] };
    const focused = applyRouteFocus(layout.nodes, layout.edges, route);

    expect(focused.nodes.filter(({ data }) => data.active).map(({ id }) => id)).toEqual(route.nodeIds);
    expect(focused.edges.filter(({ data }) => data.active).map(({ id }) => id)).toEqual(route.edgeIds);
    expect(focused.edges.filter(({ data }) => data.inactive)).toHaveLength(edges.length - 2);
  });

  test('collapsed assets keep the selected route visible', () => {
    const graph = { nodes, edges };
    const collapsed = getVisibleGraph(graph, new Set(['web']), null);
    const selected = getVisibleGraph(graph, new Set(['web']), {
      nodeIds: ['asset:web', 'service:web:tcp:8080'],
      edgeIds: ['edge-1']
    });

    expect(collapsed.nodes.map(({ id }) => id)).toEqual(['origin:internet', 'asset:web']);
    expect(selected.nodes.some(({ id }) => id === 'service:web:tcp:8080')).toBe(true);
  });

  test('fit-to-screen uses the current nodes and moderate padding', async () => {
    const fitView = vi.fn().mockResolvedValue(true);
    await fitGraphToView({ fitView }, nodes, 0.2);
    expect(fitView).toHaveBeenCalledWith({ nodes, padding: 0.2, duration: 450 });
  });
});
