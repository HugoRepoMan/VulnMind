import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Background, Controls, MiniMap, ReactFlow, ReactFlowProvider, useReactFlow
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  AlertTriangle, Crosshair, Database, Eye, FileSearch, Focus, Maximize2,
  Network, RefreshCw, ShieldAlert, X
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { attackGraphService, operationsService } from '@/services/api';
import AttackEdge from './AttackEdge';
import AttackNode from './AttackNode';
import {
  TYPE_LABELS, TYPE_ORDER, applyRouteFocus, fitGraphToView, getVisibleGraph, layoutAttackGraph
} from './graph-layout';

const selectClass = 'flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm';
const nodeTypes = { attackNode: AttackNode };
const edgeTypes = { attackEdge: AttackEdge };
const typeColors = {
  ENTRY: '#0ea5e9', ASSET: '#3b82f6', SERVICE: '#8b5cf6',
  VULNERABILITY: '#f43f5e', IDENTITY: '#f59e0b', EVIDENCE: '#10b981'
};

const DetailPanel = ({ selected, graph, onClose }) => {
  if (!selected) return null;
  const semantic = selected.data || selected;
  const incoming = graph.edges.filter(({ target }) => target === selected.id);
  const outgoing = graph.edges.filter(({ source }) => source === selected.id);
  const rows = [
    ['Tipo', TYPE_LABELS[semantic.type] || semantic.type],
    ['Nombre', semantic.label],
    ['Activo relacionado', semantic.assetName],
    ['Servicio y puerto', [semantic.service, semantic.protocol, semantic.port].filter(Boolean).join(' · ')],
    ['Riesgo', semantic.riskScore !== undefined ? `${Math.round(semantic.riskScore)}/100` : null],
    ['Regla aplicada', semantic.ruleNames?.join(', ')],
    ['Hallazgo de origen', semantic.externalId || semantic.findingId],
    ['Evidencia', semantic.evidence]
  ].filter(([, value]) => value);
  return (
    <aside className="absolute inset-y-0 right-0 z-20 w-full overflow-y-auto border-l bg-background/95 p-4 shadow-xl backdrop-blur sm:w-80">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Detalle del nodo</p>
          <h3 className="mt-1 font-semibold">{semantic.label}</h3>
        </div>
        <button type="button" onClick={onClose} aria-label="Cerrar detalle"><X className="h-4 w-4" /></button>
      </div>
      <dl className="mt-4 space-y-3 text-sm">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
            <dd className="break-words">{String(value)}</dd>
          </div>
        ))}
      </dl>
      {[
        ['Relaciones entrantes', incoming],
        ['Relaciones salientes', outgoing]
      ].map(([title, relations]) => (
        <section key={title} className="mt-5">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground">{title} ({relations.length})</h4>
          <div className="mt-2 space-y-2">
            {relations.map((edge) => (
              <div key={edge.id} className="rounded border p-2 text-xs">
                <p className="font-medium">{edge.type.replaceAll('_', ' ')}</p>
                <p className="mt-1 text-muted-foreground">{edge.reason}</p>
              </div>
            ))}
            {!relations.length && <p className="text-xs text-muted-foreground">Sin relaciones.</p>}
          </div>
        </section>
      ))}
    </aside>
  );
};

function GraphWorkspace({ graph, activeRoute, collapsedAssets, onToggleAsset, onSelectNode }) {
  const wrapperRef = useRef(null);
  const [baseLayout, setBaseLayout] = useState({ nodes: [], edges: [] });
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [layoutRevision, setLayoutRevision] = useState(0);
  const instance = useReactFlow();

  const visibleGraph = useMemo(
    () => getVisibleGraph(graph, collapsedAssets, activeRoute),
    [graph, collapsedAssets, activeRoute]
  );
  const reorganize = useCallback(() => setLayoutRevision((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    const nodeData = visibleGraph.nodes.map((node) => ({
      ...node,
      typeLabel: TYPE_LABELS[node.type],
      collapsed: node.type === 'ASSET' && collapsedAssets.has(node.assetId),
      onToggle: onToggleAsset
    }));
    layoutAttackGraph(nodeData, visibleGraph.edges).then((layout) => {
      if (!active) return;
      setBaseLayout(layout);
      requestAnimationFrame(() => {
        const routeIds = new Set(activeRoute?.nodeIds || []);
        const targetNodes = activeRoute
          ? layout.nodes.filter(({ id }) => routeIds.has(id))
          : layout.nodes;
        fitGraphToView(instance, targetNodes, activeRoute ? 0.3 : 0.2);
      });
    });
    return () => { active = false; };
  }, [activeRoute, collapsedAssets, instance, layoutRevision, onToggleAsset, visibleGraph]);

  const focusedGraph = useMemo(() => {
    const focused = applyRouteFocus(
      baseLayout.nodes, baseLayout.edges, activeRoute, hoveredNodeId
    );
    return {
      nodes: focused.nodes,
      edges: focused.edges.map((edge) => ({
        ...edge,
        label: edge.id === hoveredEdgeId || edge.data.active ? edge.data.reason : edge.label,
        data: { ...edge.data, hovered: edge.id === hoveredEdgeId || edge.data.hovered }
      }))
    };
  }, [activeRoute, baseLayout, hoveredEdgeId, hoveredNodeId]);
  const flowNodes = focusedGraph.nodes;
  const flowEdges = focusedGraph.edges;

  const centerRoute = useCallback(() => {
    if (!activeRoute) return fitGraphToView(instance, flowNodes, 0.2);
    const ids = new Set(activeRoute.nodeIds);
    return fitGraphToView(instance, flowNodes.filter(({ id }) => ids.has(id)), 0.3);
  }, [activeRoute, flowNodes, instance]);

  return (
    <div ref={wrapperRef} className="relative h-[68vh] min-h-[520px] w-full overflow-hidden rounded-lg border bg-background">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        zoomOnScroll
        panOnScroll
        minZoom={0.15}
        maxZoom={2}
        onNodeClick={(_, node) => {
          setSelectedNode(node);
          onSelectNode(node);
        }}
        onNodeMouseEnter={(_, node) => setHoveredNodeId(node.id)}
        onNodeMouseLeave={() => setHoveredNodeId(null)}
        onEdgeMouseEnter={(_, edge) => setHoveredEdgeId(edge.id)}
        onEdgeMouseLeave={() => setHoveredEdgeId(null)}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        aria-label="Grafo de rutas de ataque basado en datos persistidos"
      >
        <Background gap={22} size={1} />
        <Controls showInteractive={false} />
        {flowNodes.length > 12 && (
          <MiniMap
            pannable
            zoomable
            nodeColor={(node) => typeColors[node.data.type] || '#64748b'}
            maskColor="rgba(15, 23, 42, 0.12)"
          />
        )}
        <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-2">
          {[
            ['Ajustar a pantalla', Focus, () => fitGraphToView(instance, flowNodes, 0.2)],
            ['Reorganizar', RefreshCw, reorganize],
            ['Centrar ruta', Crosshair, centerRoute],
            ['Pantalla completa', Maximize2, () => wrapperRef.current?.requestFullscreen?.()]
          ].map(([label, Icon, action]) => (
            <button
              key={label}
              type="button"
              onClick={action}
              disabled={label === 'Centrar ruta' && !activeRoute}
              className="flex items-center gap-1.5 rounded border bg-background/95 px-2 py-1.5 text-xs shadow-sm disabled:opacity-40"
              title={label}
            >
              <Icon className="h-3.5 w-3.5" /><span className="hidden md:inline">{label}</span>
            </button>
          ))}
        </div>
      </ReactFlow>
      <DetailPanel selected={selectedNode} graph={graph} onClose={() => setSelectedNode(null)} />
    </div>
  );
}

function AttackGraphPage() {
  const [projectId, setProjectId] = useState('');
  const [auditId, setAuditId] = useState('');
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [collapsedAssets, setCollapsedAssets] = useState(new Set());

  const projects = useQuery({ queryKey: ['projects'], queryFn: operationsService.getProjects });
  const audits = useQuery({
    queryKey: ['audits', projectId],
    queryFn: () => operationsService.getAudits(projectId),
    enabled: Boolean(projectId)
  });
  const graph = useQuery({
    queryKey: ['attackGraph', projectId, auditId],
    queryFn: () => attackGraphService.getGraph({ projectId, auditId }),
    enabled: Boolean(auditId),
    refetchInterval: 15000
  });

  useEffect(() => {
    if (!projectId && projects.data?.length) setProjectId(projects.data[0].id);
  }, [projectId, projects.data]);
  useEffect(() => {
    setAuditId('');
    setSelectedRouteId('');
  }, [projectId]);
  useEffect(() => {
    if (!auditId && audits.data?.length) setAuditId(audits.data[0].id);
  }, [auditId, audits.data]);
  useEffect(() => {
    if (!graph.data) return;
    const criticalRoute = graph.data.routes[0];
    setSelectedRouteId(criticalRoute?.id || '');
    const criticalNodes = new Set(criticalRoute?.nodeIds || []);
    setCollapsedAssets(new Set(
      graph.data.nodes
        .filter((node) => node.type === 'ASSET' && !criticalNodes.has(node.id))
        .map(({ assetId }) => assetId)
    ));
  }, [graph.data]);

  const activeRoute = graph.data?.routes.find(({ id }) => id === selectedRouteId) || null;
  const summary = graph.data?.summary;
  const toggleAsset = useCallback((assetId) => {
    setCollapsedAssets((current) => {
      const next = new Set(current);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
          <Network className="h-8 w-8 text-primary" /> Grafo de rutas de ataque
        </h1>
        <p className="mt-1 text-muted-foreground">
          Relaciones verificables de la auditoría seleccionada, organizadas automáticamente de izquierda a derecha.
        </p>
      </div>
      <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2">
        <select className={selectClass} value={projectId} onChange={(event) => setProjectId(event.target.value)} aria-label="Filtrar por proyecto">
          <option value="">Selecciona un proyecto</option>
          {(projects.data || []).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
        <select className={selectClass} value={auditId} onChange={(event) => setAuditId(event.target.value)} disabled={!projectId} aria-label="Filtrar por auditoría">
          <option value="">Selecciona una auditoría</option>
          {(audits.data || []).map((audit) => <option key={audit.id} value={audit.id}>{audit.name}</option>)}
        </select>
      </div>
      {graph.error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{graph.error.response?.data?.message || 'No se pudo generar el grafo.'}</div>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ['Hallazgos analizados', summary?.analyzedFindings, FileSearch],
          ['Nodos únicos', summary?.nodes, Database],
          ['Conexiones válidas', summary?.connections, Network],
          ['Rutas posibles', summary?.routes, Eye],
          ['Prioridad alta', summary?.highPriorityRoutes, AlertTriangle]
        ].map(([label, value, Icon]) => (
          <Card key={label}><CardContent className="flex items-center justify-between p-4">
            <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value ?? '—'}</p></div>
            <Icon className="h-5 w-5 text-primary" />
          </CardContent></Card>
        ))}
      </div>
      {graph.isLoading && <p className="py-10 text-center text-muted-foreground">Construyendo y organizando el grafo desde PostgreSQL…</p>}
      {!auditId && <p className="py-10 text-center text-muted-foreground">Selecciona una auditoría para evitar mezclar escaneos.</p>}
      {graph.data && !summary?.analyzedFindings && (
        <Card><CardContent className="p-8 text-center">
          <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-medium">No hay hallazgos abiertos en esta auditoría.</p>
        </CardContent></Card>
      )}
      {graph.data && summary?.analyzedFindings > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Mapa correlacionado</CardTitle>
            <CardDescription>
              La ruta crítica se muestra primero. Selecciona “Todas las relaciones” para la vista general.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setSelectedRouteId('')}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${!selectedRouteId ? 'border-primary bg-primary/10' : ''}`}
              >
                Todas las relaciones
              </button>
              {graph.data.routes.map((route, index) => (
                <button
                  key={route.id}
                  type="button"
                  onClick={() => setSelectedRouteId(route.id)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${selectedRouteId === route.id ? 'border-primary bg-primary/10' : ''}`}
                  title={route.explanation}
                >
                  Ruta {route.priority === 'HIGH' ? 'crítica' : 'detectada'} {index + 1}
                </button>
              ))}
            </div>
            {activeRoute && (
              <div className="rounded-lg border-l-4 border-l-primary bg-muted/40 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{activeRoute.name}</p>
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                    Riesgo {Math.round(activeRoute.riskScore)}/100 · {activeRoute.priority}
                  </span>
                </div>
                <p className="mt-1 text-muted-foreground">{activeRoute.explanation}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-2 text-xs">
              {TYPE_ORDER.map((type) => (
                <span key={type} className="flex items-center gap-1.5 rounded-full border px-2 py-1">
                  <span className="h-2 w-2 rounded-full" style={{ background: typeColors[type] }} />
                  {TYPE_LABELS[type]}
                </span>
              ))}
              <span className="flex items-center gap-1.5 rounded-full border px-2 py-1">
                <span className="h-0.5 w-3 bg-amber-600" /> Relación por regla
              </span>
            </div>
            <GraphWorkspace
              graph={graph.data}
              activeRoute={activeRoute}
              collapsedAssets={collapsedAssets}
              onToggleAsset={toggleAsset}
              onSelectNode={() => {}}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function AttackGraph() {
  return <ReactFlowProvider><AttackGraphPage /></ReactFlowProvider>;
}
