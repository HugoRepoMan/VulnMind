/** Muestra prioridades calculadas por backend; no estima riesgo en el navegador. */
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Boxes, ChevronDown, ChevronUp, CircleGauge, Globe2,
  ListChecks, Route, ShieldCheck, TrendingDown, Wrench
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { operationsService, remediationService } from '@/services/api';

const selectClass = 'flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm';
const effortLabel = { LOW: 'Bajo', MEDIUM: 'Medio', HIGH: 'Alto' };

export default function Remediations() {
  const [projectId, setProjectId] = useState('');
  const [auditId, setAuditId] = useState('');
  const [showMethodology, setShowMethodology] = useState(false);

  const projects = useQuery({ queryKey: ['projects'], queryFn: operationsService.getProjects });
  const audits = useQuery({
    queryKey: ['audits', projectId],
    queryFn: () => operationsService.getAudits(projectId),
    enabled: Boolean(projectId)
  });
  const priorities = useQuery({
    queryKey: ['remediationPriorities', projectId, auditId],
    queryFn: () => remediationService.getPriorities({ projectId, auditId }),
    refetchInterval: 15000
  });

  useEffect(() => setAuditId(''), [projectId]);

  const result = priorities.data;
  const summary = result?.summary;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
          <ListChecks className="h-8 w-8 text-primary" /> Priorización de remediaciones
        </h1>
        <p className="mt-1 text-muted-foreground">
          Identifica qué acción reduce más riesgo usando reglas, relaciones y puntuaciones persistidas.
        </p>
      </div>

      <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2">
        <select className={selectClass} value={projectId} onChange={(event) => setProjectId(event.target.value)} aria-label="Filtrar por proyecto">
          <option value="">Todos los proyectos</option>
          {(projects.data || []).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
        <select className={selectClass} value={auditId} onChange={(event) => setAuditId(event.target.value)} disabled={!projectId} aria-label="Filtrar por auditoría">
          <option value="">Todas las auditorías</option>
          {(audits.data || []).map((audit) => <option key={audit.id} value={audit.id}>{audit.name}</option>)}
        </select>
      </div>

      {priorities.error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {priorities.error.response?.data?.message || 'No se pudieron calcular las prioridades.'}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Hallazgos analizados', summary?.analyzedFindings, CircleGauge],
          ['Acciones propuestas', summary?.recommendations, Wrench],
          ['Mayor reducción estimada', summary ? `${summary.highestEstimatedRiskReduction} pts` : '—', TrendingDown],
          ['Rutas abordadas', summary?.attackChainsAddressed, Route]
        ].map(([label, value, Icon]) => (
          <Card key={label}>
            <CardContent className="flex items-center justify-between p-4">
              <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value ?? '—'}</p></div>
              <Icon className="h-5 w-5 text-primary" />
            </CardContent>
          </Card>
        ))}
      </div>

      {priorities.isLoading && (
        <p className="py-10 text-center text-muted-foreground">Calculando impacto marginal desde PostgreSQL…</p>
      )}

      {result && !result.priorities.length && (
        <Card>
          <CardContent className="p-8 text-center">
            <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No hay recomendaciones persistidas para priorizar.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Los hallazgos deben coincidir con reglas que contengan una recomendación o guardar recomendaciones en su análisis.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {result?.priorities.map((item) => (
          <Card key={item.id} className={item.priority === 1 ? 'border-primary/60 shadow-sm' : ''}>
            <CardHeader>
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">
                      Prioridad {item.priority}
                    </span>
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-xs">
                      Puntaje {item.prioritizationScore}
                    </span>
                    <span className="rounded-full border px-2.5 py-1 text-xs">
                      Esfuerzo {effortLabel[item.remediationEffort]}
                    </span>
                  </div>
                  <CardTitle className="text-xl">{item.title}</CardTitle>
                  <CardDescription className="mt-1">{item.explanation}</CardDescription>
                </div>
                <div className="shrink-0 rounded-lg bg-green-500/10 px-4 py-3 text-right text-green-700 dark:text-green-400">
                  <p className="text-xs">Reducción estimada</p>
                  <p className="text-2xl font-bold">{item.estimatedRiskReduction} pts</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <Route className="h-5 w-5 text-primary" />
                  <div><p className="text-xs text-muted-foreground">Rutas que rompe</p><p className="font-semibold">{item.attackChainsBroken}</p></div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <Boxes className="h-5 w-5 text-primary" />
                  <div><p className="text-xs text-muted-foreground">Activos relacionados</p><p className="font-semibold">{item.relatedAssets}</p></div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <Globe2 className="h-5 w-5 text-primary" />
                  <div><p className="text-xs text-muted-foreground">Expuestos externamente</p><p className="font-semibold">{item.internetExposedAssets}</p></div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <CircleGauge className="h-5 w-5 text-primary" />
                  <div><p className="text-xs text-muted-foreground">Hallazgos cubiertos</p><p className="font-semibold">{item.affectedFindings}</p></div>
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold">Impacto por activo</p>
                <div className="grid gap-2 lg:grid-cols-2">
                  {item.assets.map((asset) => (
                    <div key={asset.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                      <div>
                        <p className="font-medium">{asset.name}</p>
                        <p className="text-xs text-muted-foreground">Criticidad {asset.criticality.toLowerCase()}</p>
                      </div>
                      <p className="font-semibold">{Math.round(asset.riskBefore)} → {Math.round(asset.riskAfter)} <span className="text-green-600">(-{Math.round(asset.riskReduction)})</span></p>
                    </div>
                  ))}
                </div>
              </div>

              {item.dependencies.length > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                  <p className="font-semibold text-amber-700 dark:text-amber-400">Dependencias registradas</p>
                  <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                    {item.dependencies.map((dependency) => <li key={dependency}>{dependency}</li>)}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {result && (
        <Card>
          <CardHeader>
            <button type="button" className="flex w-full items-center justify-between text-left" onClick={() => setShowMethodology(!showMethodology)}>
              <div>
                <CardTitle className="text-lg">Metodología auditable</CardTitle>
                <CardDescription>Consulta cómo se obtiene el orden, sin simulaciones ocultas.</CardDescription>
              </div>
              {showMethodology ? <ChevronUp /> : <ChevronDown />}
            </button>
          </CardHeader>
          {showMethodology && (
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p><strong className="text-foreground">Reducción:</strong> {result.methodology.riskReduction}</p>
              <p><strong className="text-foreground">Fórmula:</strong> <code className="rounded bg-muted px-1.5 py-1">{result.methodology.formula}</code></p>
              <p><strong className="text-foreground">Pesos de criticidad:</strong> {Object.entries(result.methodology.criticalityWeights).map(([key, value]) => `${key}=${value}`).join(' · ')}</p>
              <p><strong className="text-foreground">Factores de esfuerzo:</strong> {Object.entries(result.methodology.effortFactors).map(([key, value]) => `${key}=${value}`).join(' · ')}</p>
              {summary.findingsWithoutRecommendation > 0 && (
                <p className="text-amber-600">{summary.findingsWithoutRecommendation} hallazgo(s) no se priorizaron porque no tienen una recomendación persistida.</p>
              )}
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
