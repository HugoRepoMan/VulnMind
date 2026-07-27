import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Download, PlusCircle } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import RiskCards from '@/components/dashboard/RiskCards';
import RiskChart from '@/components/dashboard/RiskChart';
import RecentFindings from '@/components/dashboard/RecentFindings';
import FindingInsight from '@/components/dashboard/FindingInsight';
import { Button } from '@/components/ui/button';
import { dashboardService, exportService, operationsService } from '@/services/api';
import { useAppStore } from '@/store';

const selectClass = 'flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm';

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const role = useAppStore((state) => state.user?.role);
  const canWrite = ['ADMIN', 'AUDITOR'].includes(role);
  const [filters, setFilters] = useState({
    projectId: '',
    auditId: '',
    assetId: '',
    period: '7d'
  });
  const [selected, setSelected] = useState(null);
  const requestFilters = useMemo(() => Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value)
  ), [filters]);

  const projects = useQuery({ queryKey: ['projects'], queryFn: operationsService.getProjects });
  const audits = useQuery({
    queryKey: ['audits', filters.projectId],
    queryFn: () => operationsService.getAudits(filters.projectId),
    enabled: Boolean(filters.projectId)
  });
  const assets = useQuery({
    queryKey: ['assets', filters.auditId],
    queryFn: () => operationsService.getAssets(filters.auditId),
    enabled: Boolean(filters.auditId)
  });
  const stats = useQuery({
    queryKey: ['dashboardStats', requestFilters],
    queryFn: () => dashboardService.getStats(requestFilters),
    refetchInterval: 10000
  });
  const recent = useQuery({
    queryKey: ['recentFindings', requestFilters],
    queryFn: () => dashboardService.getRecentFindings(requestFilters),
    refetchInterval: 10000
  });
  const exporter = useMutation({
    mutationFn: (format) => exportService.downloadFindings(format, requestFilters)
  });

  useEffect(() => {
    const target = searchParams.get('finding');
    const match = recent.data?.find(({ id }) => id === target);
    if (match) setSelected(match);
  }, [recent.data, searchParams]);

  const selectFinding = (finding) => {
    setSelected(finding);
    setSearchParams({ finding: finding.id });
    window.setTimeout(() => document.getElementById('finding-insight')?.scrollIntoView({ behavior: 'smooth' }), 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Centro de Operaciones (SOC)</h1>
          <p className="mt-1 text-muted-foreground">Riesgo y explicabilidad calculados con datos persistentes.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canWrite && (
            <>
              <Button variant="outline" onClick={() => exporter.mutate('csv')} disabled={exporter.isPending}>
                <Download className="h-4 w-4" /> CSV
              </Button>
              <Button variant="outline" onClick={() => exporter.mutate('json')} disabled={exporter.isPending}>
                <Download className="h-4 w-4" /> JSON
              </Button>
              <Button onClick={() => navigate('/audits')}>
                <PlusCircle className="h-4 w-4" /> Nuevo hallazgo
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Filtros del dashboard">
        <select
          aria-label="Proyecto"
          className={selectClass}
          value={filters.projectId}
          onChange={(event) => setFilters({ ...filters, projectId: event.target.value, auditId: '', assetId: '' })}
        >
          <option value="">Todos los proyectos</option>
          {(projects.data || []).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
        <select
          aria-label="Auditoría"
          className={selectClass}
          value={filters.auditId}
          disabled={!filters.projectId}
          onChange={(event) => setFilters({ ...filters, auditId: event.target.value, assetId: '' })}
        >
          <option value="">Todas las auditorías</option>
          {(audits.data || []).map((audit) => <option key={audit.id} value={audit.id}>{audit.name}</option>)}
        </select>
        <select
          aria-label="Activo"
          className={selectClass}
          value={filters.assetId}
          disabled={!filters.auditId}
          onChange={(event) => setFilters({ ...filters, assetId: event.target.value })}
        >
          <option value="">Todos los activos</option>
          {(assets.data || []).map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
        </select>
        <select
          aria-label="Periodo"
          className={selectClass}
          value={filters.period}
          onChange={(event) => setFilters({ ...filters, period: event.target.value })}
        >
          <option value="7d">Últimos 7 días</option>
          <option value="30d">Últimos 30 días</option>
          <option value="90d">Últimos 90 días</option>
        </select>
      </div>

      {exporter.error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">No se pudo generar la exportación.</div>}

      <RiskCards stats={stats.data} isLoading={stats.isLoading} isError={stats.isError} />

      <div className="grid gap-4 lg:grid-cols-5">
        <RiskChart data={stats.data?.riskTrend} period={filters.period} />
        <RecentFindings findings={recent.data} isLoading={recent.isLoading} onSelect={selectFinding} selectedId={selected?.id} />
      </div>

      <FindingInsight finding={selected} />
    </div>
  );
}
