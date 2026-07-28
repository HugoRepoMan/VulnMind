import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDown, ArrowUp, CheckCircle2, GitCompareArrows, Minus,
  RotateCcw, Server, ShieldAlert
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { operationsService, scanComparisonService } from '@/services/api';

const selectClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm';
const emptyList = [];

const assetIdentity = (asset) => asset.ip?.trim().toLowerCase() || asset.name.trim().toLowerCase();

const findingLabel = (finding) => {
  const item = finding.after || finding;
  const signal = item.vulnerability || item.service || 'Exposición detectada';
  return `${item.port ? `Puerto ${item.port} · ` : ''}${signal}`;
};

const ChangeList = ({ title, items, icon: Icon, tone, render = findingLabel }) => (
  <div className="rounded-lg border p-4">
    <div className={`mb-3 flex items-center justify-between gap-2 ${tone}`}>
      <div className="flex items-center gap-2 font-medium">
        <Icon className="h-4 w-4" /> {title}
      </div>
      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
        {items.length}
      </span>
    </div>
    {items.length ? (
      <ul className="space-y-2 text-sm">
        {items.slice(0, 8).map((item, index) => (
          <li key={item.id || item.after?.id || `${title}-${index}`} className="border-t pt-2 first:border-0 first:pt-0">
            {render(item)}
          </li>
        ))}
        {items.length > 8 && (
          <li className="text-xs text-muted-foreground">Y {items.length - 8} cambios más.</li>
        )}
      </ul>
    ) : (
      <p className="text-sm text-muted-foreground">Sin cambios en esta categoría.</p>
    )}
  </div>
);

export default function ScanComparison({ audits, defaultCurrentAuditId }) {
  const [baselineAuditId, setBaselineAuditId] = useState('');
  const [currentAuditId, setCurrentAuditId] = useState('');
  const [baselineAssetId, setBaselineAssetId] = useState('');
  const [currentAssetId, setCurrentAssetId] = useState('');

  useEffect(() => {
    if (!audits.length) return;
    const current = audits.find(({ id }) => id === defaultCurrentAuditId) || audits[0];
    setCurrentAuditId((value) => audits.some(({ id }) => id === value) ? value : current.id);
  }, [audits, defaultCurrentAuditId]);

  useEffect(() => {
    const candidates = audits.filter(({ id }) => id !== currentAuditId);
    setBaselineAuditId((value) =>
      candidates.some(({ id }) => id === value) ? value : candidates[0]?.id || ''
    );
  }, [audits, currentAuditId]);

  const baselineAssetsQuery = useQuery({
    queryKey: ['comparisonAssets', baselineAuditId],
    queryFn: () => operationsService.getAssets(baselineAuditId),
    enabled: Boolean(baselineAuditId)
  });
  const currentAssetsQuery = useQuery({
    queryKey: ['comparisonAssets', currentAuditId],
    queryFn: () => operationsService.getAssets(currentAuditId),
    enabled: Boolean(currentAuditId)
  });

  const baselineAssets = baselineAssetsQuery.data ?? emptyList;
  const currentAssets = currentAssetsQuery.data ?? emptyList;

  useEffect(() => {
    setBaselineAssetId((value) =>
      baselineAssets.some(({ id }) => id === value) ? value : baselineAssets[0]?.id || ''
    );
  }, [baselineAssets]);

  useEffect(() => {
    const baseline = baselineAssets.find(({ id }) => id === baselineAssetId);
    const matching = baseline
      ? currentAssets.find((asset) => assetIdentity(asset) === assetIdentity(baseline))
      : null;
    setCurrentAssetId((value) =>
      currentAssets.some(({ id }) => id === value) && !matching
        ? value
        : matching?.id || currentAssets[0]?.id || ''
    );
  }, [baselineAssetId, baselineAssets, currentAssets]);

  const comparison = useQuery({
    queryKey: ['scanComparison', baselineAssetId, currentAssetId],
    queryFn: () => scanComparisonService.compare(baselineAssetId, currentAssetId),
    enabled: Boolean(baselineAssetId && currentAssetId && baselineAssetId !== currentAssetId)
  });

  const result = comparison.data;
  const risk = result?.summary;
  const riskPresentation = useMemo(() => {
    if (!risk) return null;
    if (risk.riskTrend === 'DECREASED') {
      return { Icon: ArrowDown, text: `Riesgo reducido ${Math.abs(Math.round(risk.riskDelta))} puntos`, tone: 'text-green-600' };
    }
    if (risk.riskTrend === 'INCREASED') {
      return { Icon: ArrowUp, text: `Riesgo aumentó ${Math.round(risk.riskDelta)} puntos`, tone: 'text-destructive' };
    }
    return { Icon: Minus, text: 'Riesgo sin variación', tone: 'text-muted-foreground' };
  }, [risk]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitCompareArrows className="h-5 w-5" /> Comparación inteligente entre escaneos
        </CardTitle>
        <CardDescription>
          Contrasta dos capturas reales del mismo activo. Los resultados se calculan con los hallazgos almacenados en PostgreSQL.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {audits.length < 2 ? (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Crea e importa al menos dos auditorías del mismo proyecto para compararlas.
          </p>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3 rounded-lg border p-4">
                <p className="font-medium">Escaneo inicial</p>
                <select className={selectClass} value={baselineAuditId} onChange={(event) => setBaselineAuditId(event.target.value)}>
                  {audits.filter(({ id }) => id !== currentAuditId).map((audit) => (
                    <option key={audit.id} value={audit.id}>{audit.name}</option>
                  ))}
                </select>
                <select className={selectClass} value={baselineAssetId} onChange={(event) => setBaselineAssetId(event.target.value)}>
                  {!baselineAssets.length && <option value="">Sin activos importados</option>}
                  {baselineAssets.map((asset) => (
                    <option key={asset.id} value={asset.id}>{asset.name}{asset.ip ? ` · ${asset.ip}` : ''}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-3 rounded-lg border p-4">
                <p className="font-medium">Escaneo posterior</p>
                <select className={selectClass} value={currentAuditId} onChange={(event) => setCurrentAuditId(event.target.value)}>
                  {audits.filter(({ id }) => id !== baselineAuditId).map((audit) => (
                    <option key={audit.id} value={audit.id}>{audit.name}</option>
                  ))}
                </select>
                <select className={selectClass} value={currentAssetId} onChange={(event) => setCurrentAssetId(event.target.value)}>
                  {!currentAssets.length && <option value="">Sin activos importados</option>}
                  {currentAssets.map((asset) => (
                    <option key={asset.id} value={asset.id}>{asset.name}{asset.ip ? ` · ${asset.ip}` : ''}</option>
                  ))}
                </select>
              </div>
            </div>

            {comparison.isLoading && <p className="text-sm text-muted-foreground">Analizando diferencias…</p>}
            {comparison.error && (
              <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {comparison.error.response?.data?.message || 'No se pudo comparar los escaneos.'}
              </p>
            )}

            {result && (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg bg-secondary/50 p-4">
                    <p className="text-xs text-muted-foreground">Riesgo inicial</p>
                    <p className="text-2xl font-bold">{Math.round(result.baseline.riskScore)}/100</p>
                  </div>
                  <div className="rounded-lg bg-secondary/50 p-4">
                    <p className="text-xs text-muted-foreground">Riesgo posterior</p>
                    <p className="text-2xl font-bold">{Math.round(result.current.riskScore)}/100</p>
                  </div>
                  <div className="rounded-lg bg-secondary/50 p-4">
                    <p className="text-xs text-muted-foreground">Variación</p>
                    <p className={`flex items-center gap-2 text-lg font-bold ${riskPresentation.tone}`}>
                      <riskPresentation.Icon className="h-5 w-5" /> {riskPresentation.text}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <ChangeList title="Nuevos hallazgos" items={result.changes.newFindings} icon={ShieldAlert} tone="text-destructive" />
                  <ChangeList title="Persistentes" items={result.changes.persistentFindings} icon={Minus} tone="text-amber-600" />
                  <ChangeList title="Corregidos" items={result.changes.correctedFindings} icon={CheckCircle2} tone="text-green-600" />
                  <ChangeList title="Reabiertos" items={result.changes.reopenedFindings} icon={RotateCcw} tone="text-orange-600" />
                  <ChangeList title="Puertos nuevos" items={result.changes.newPorts} icon={Server} tone="text-destructive" />
                  <ChangeList title="Puertos eliminados" items={result.changes.removedPorts} icon={CheckCircle2} tone="text-green-600" />
                  <ChangeList title="Servicios eliminados" items={result.changes.removedServices} icon={CheckCircle2} tone="text-green-600" />
                  <ChangeList
                    title="Versiones modificadas"
                    items={result.changes.versionChanges}
                    icon={GitCompareArrows}
                    tone="text-blue-600"
                    render={(item) => `Puerto ${item.port} · ${item.service || 'Servicio'}: ${item.before} → ${item.after}`}
                  />
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
