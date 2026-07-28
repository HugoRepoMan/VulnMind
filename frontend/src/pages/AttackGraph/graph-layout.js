import { MarkerType } from '@xyflow/react';
import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();

export const TYPE_ORDER = ['ENTRY', 'ASSET', 'SERVICE', 'VULNERABILITY', 'IDENTITY', 'EVIDENCE'];
export const TYPE_LABELS = {
  ENTRY: 'Origen',
  ASSET: 'Activo',
  SERVICE: 'Servicio',
  VULNERABILITY: 'Vulnerabilidad',
  IDENTITY: 'Usuario / privilegio',
  EVIDENCE: 'Evidencia'
};

const dimensions = {
  ENTRY: { width: 190, height: 92 },
  ASSET: { width: 230, height: 118 },
  SERVICE: { width: 230, height: 104 },
  VULNERABILITY: { width: 250, height: 112 },
  IDENTITY: { width: 250, height: 108 },
  EVIDENCE: { width: 280, height: 112 }
};

export const getNodeDimensions = (type) => dimensions[type] || dimensions.EVIDENCE;

const edgeHandles = (index) => {
  const position = ['top', 'middle', 'bottom'][index % 3];
  return { sourceHandle: `out-${position}`, targetHandle: `in-${position}` };
};

export const layoutAttackGraph = async (nodes, edges) => {
  if (!nodes.length) return { nodes: [], edges: [] };
  const graph = await elk.layout({
    id: 'attack-graph',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.partitioning.activate': 'true',
      'elk.spacing.nodeNode': '45',
      'elk.layered.spacing.nodeNodeBetweenLayers': '110',
      'elk.spacing.edgeNode': '30',
      'elk.spacing.edgeEdge': '18',
      'elk.padding': '[top=55,left=55,bottom=55,right=55]'
    },
    children: nodes.map((node) => ({
      id: node.id,
      ...getNodeDimensions(node.type),
      layoutOptions: {
        'elk.partitioning.partition': String(
          Math.max(0, TYPE_ORDER.indexOf(node.type))
        )
      }
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target]
    }))
  });
  const positions = new Map(
    (graph.children || []).map((node) => [node.id, { x: node.x || 0, y: node.y || 0 }])
  );

  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      type: 'attackNode',
      position: positions.get(node.id) || { x: 0, y: 0 },
      data: node,
      ...getNodeDimensions(node.type)
    })),
    edges: edges.map((edge, index) => ({
      ...edge,
      type: 'attackEdge',
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
      ...edgeHandles(index),
      data: { ...edge }
    }))
  };
};

export const getVisibleGraph = (graph, collapsedAssetIds = new Set(), activeRoute = null) => {
  const activeIds = new Set(activeRoute?.nodeIds || []);
  const visibleNodes = graph.nodes.filter((node) => {
    if (!node.assetId || node.type === 'ASSET') return true;
    return !collapsedAssetIds.has(node.assetId) || activeIds.has(node.id);
  });
  const visibleIds = new Set(visibleNodes.map(({ id }) => id));
  return {
    nodes: visibleNodes,
    edges: graph.edges.filter(({ source, target }) => visibleIds.has(source) && visibleIds.has(target))
  };
};

export const applyRouteFocus = (nodes, edges, activeRoute, hoveredNodeId = null) => {
  const routeNodes = new Set(activeRoute?.nodeIds || []);
  const routeEdges = new Set(activeRoute?.edgeIds || []);
  const relatedEdges = new Set(
    hoveredNodeId
      ? edges.filter(({ source, target }) => source === hoveredNodeId || target === hoveredNodeId)
        .map(({ id }) => id)
      : []
  );
  const relatedNodes = new Set();
  edges.filter(({ id }) => relatedEdges.has(id)).forEach(({ source, target }) => {
    relatedNodes.add(source);
    relatedNodes.add(target);
  });

  return {
    nodes: nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        active: !activeRoute || routeNodes.has(node.id),
        related: !hoveredNodeId || relatedNodes.has(node.id)
      }
    })),
    edges: edges.map((edge) => ({
      ...edge,
      data: {
        ...edge.data,
        active: Boolean(activeRoute && routeEdges.has(edge.id)),
        inactive: Boolean(activeRoute && !routeEdges.has(edge.id)),
        hovered: relatedEdges.has(edge.id)
      },
      label: routeEdges.has(edge.id) || relatedEdges.has(edge.id) ? edge.data.reason : undefined
    }))
  };
};

export const fitGraphToView = (instance, nodes, padding = 0.2) =>
  instance.fitView({ nodes, padding, duration: 450 });
