/** Explica reglas, desglose de riesgo, correlación y recomendaciones del hallazgo. */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function FindingInsight({ finding }) {
  if (!finding) return null;
  const analysis = finding.analysis;
  const contributions = analysis?.riskBreakdown?.contributions ?? [];
  const signals = analysis?.correlation?.signals ?? [];
  const timeline = analysis?.timelineEvents ?? [];

  return (
    <Card id="finding-insight">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{finding.vulnerability || `Puerto ${finding.port} expuesto`}</CardTitle>
            <CardDescription>{finding.assetName} · motor {analysis?.engineVersion || 'sin versión'}</CardDescription>
          </div>
          <Badge>{Math.round(finding.riskScore)}/100 · {finding.severity}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <section>
          <h3 className="mb-2 text-sm font-semibold">Explicación</h3>
          <p className="text-sm leading-6 text-muted-foreground">{finding.explanation || 'El motor no guardó una explicación.'}</p>
        </section>

        <div className="grid gap-5 lg:grid-cols-2">
          <section>
            <h3 className="mb-2 text-sm font-semibold">Aportes de riesgo</h3>
            <div className="space-y-2">
              {contributions.map((item) => (
                <div key={item.ruleId} className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <span>{item.ruleName}</span><strong>+{item.score}</strong>
                </div>
              ))}
              {!contributions.length && <p className="text-sm text-muted-foreground">Sin reglas coincidentes.</p>}
            </div>
          </section>
          <section>
            <h3 className="mb-2 text-sm font-semibold">Correlación</h3>
            <p className="mb-2 text-sm text-muted-foreground">{analysis?.correlation?.summary || 'Sin historial correlacionado.'}</p>
            <div className="flex flex-wrap gap-2">
              {signals.map((signal, index) => <Badge key={`${signal.type}-${index}`} variant="secondary">{signal.type} · {signal.count}</Badge>)}
            </div>
          </section>
        </div>

        <section>
          <h3 className="mb-3 text-sm font-semibold">Línea de procesamiento</h3>
          <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {timeline.map((event, index) => (
              <li key={`${event.step}-${index}`} className="rounded-md border p-3 text-xs">
                <span className="mb-1 block font-semibold">{index + 1}. {event.step.replaceAll('_', ' ')}</span>
                <span className="text-muted-foreground">{event.detail || event.summary || 'Completado'}</span>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold">Recomendaciones</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {(finding.recommendations || []).map((recommendation) => <li key={recommendation}>{recommendation}</li>)}
          </ul>
        </section>
      </CardContent>
    </Card>
  );
}
