/**
 * Gestión operativa de proyectos, auditorías, activos, importaciones y
 * hallazgos. Las selecciones aportan los IDs reales usados por cada petición.
 */
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, FolderKanban, PlusCircle, Server, ShieldCheck, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ScanComparison from '@/components/audits/ScanComparison';
import { findingsService, importService, operationsService } from '@/services/api';
import {
  clearFindingDraft,
  loadFindingDraft,
  saveFindingDraft
} from '@/services/offline';

const selectClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm';
const emptyList = [];

const apiError = (error) =>
  error.response?.data?.errors?.[0]?.message ||
  error.response?.data?.message ||
  'No se pudo completar la operación.';

export default function Audits() {
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState('');
  const [auditId, setAuditId] = useState('');
  const [notice, setNotice] = useState('');
  const [projectName, setProjectName] = useState('');
  const [auditName, setAuditName] = useState('');
  const [assetForm, setAssetForm] = useState({ name: '', ip: '', criticality: 'MEDIUM' });
  const [findingForm, setFindingForm] = useState({ assetId: '', port: '', vulnerability: '' });
  const [draftReady, setDraftReady] = useState(false);
  const [importForm, setImportForm] = useState({ format: 'nmap', file: null });
  const [importSummary, setImportSummary] = useState(null);

  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: operationsService.getProjects
  });
  const auditsQuery = useQuery({
    queryKey: ['audits', projectId],
    queryFn: () => operationsService.getAudits(projectId),
    enabled: Boolean(projectId)
  });
  const assetsQuery = useQuery({
    queryKey: ['assets', auditId],
    queryFn: () => operationsService.getAssets(auditId),
    enabled: Boolean(auditId)
  });

  const projects = projectsQuery.data ?? emptyList;
  const audits = auditsQuery.data ?? emptyList;
  const assets = assetsQuery.data ?? emptyList;

  useEffect(() => {
    if (!projectId && projects.length) setProjectId(projects[0].id);
  }, [projectId, projects]);

  useEffect(() => {
    const next = audits.find((audit) => audit.id === auditId)?.id ?? audits[0]?.id ?? '';
    if (next !== auditId) setAuditId(next);
  }, [auditId, audits]);

  useEffect(() => {
    const next = assets.find((asset) => asset.id === findingForm.assetId)?.id ?? assets[0]?.id ?? '';
    if (next !== findingForm.assetId) {
      setFindingForm((current) => ({ ...current, assetId: next }));
    }
  }, [assets, findingForm.assetId]);

  useEffect(() => {
    loadFindingDraft().then((draft) => {
      if (draft) setFindingForm((current) => ({ ...current, ...draft }));
      setDraftReady(true);
    });
  }, []);

  useEffect(() => {
    if (!draftReady) return undefined;
    const timeout = window.setTimeout(() => saveFindingDraft(findingForm), 300);
    return () => window.clearTimeout(timeout);
  }, [draftReady, findingForm]);

  const showSuccess = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 3500);
  };

  const createProject = useMutation({
    mutationFn: operationsService.createProject,
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setProjectId(project.id);
      setProjectName('');
      showSuccess('Proyecto creado.');
    }
  });
  const createAudit = useMutation({
    mutationFn: operationsService.createAudit,
    onSuccess: (audit) => {
      queryClient.invalidateQueries({ queryKey: ['audits', projectId] });
      setAuditId(audit.id);
      setAuditName('');
      showSuccess('Auditoría creada.');
    }
  });
  const createAsset = useMutation({
    mutationFn: operationsService.createAsset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets', auditId] });
      queryClient.invalidateQueries({ queryKey: ['comparisonAssets', auditId] });
      queryClient.invalidateQueries({ queryKey: ['scanComparison'] });
      queryClient.invalidateQueries({ queryKey: ['attackGraph'] });
      queryClient.invalidateQueries({ queryKey: ['remediationPriorities'] });
      setAssetForm({ name: '', ip: '', criticality: 'MEDIUM' });
      showSuccess('Activo agregado.');
    }
  });
  const createFinding = useMutation({
    mutationFn: findingsService.createFinding,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['assets', auditId] });
      queryClient.invalidateQueries({ queryKey: ['comparisonAssets', auditId] });
      queryClient.invalidateQueries({ queryKey: ['scanComparison'] });
      queryClient.invalidateQueries({ queryKey: ['attackGraph'] });
      queryClient.invalidateQueries({ queryKey: ['remediationPriorities'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      queryClient.invalidateQueries({ queryKey: ['recentFindings'] });
      setFindingForm((current) => ({ ...current, port: '', vulnerability: '' }));
      clearFindingDraft();
      showSuccess(result.offline
        ? 'Sin conexión: el hallazgo quedó guardado para sincronizar.'
        : 'Hallazgo procesado por el motor inteligente.');
    }
  });
  const importFindings = useMutation({
    mutationFn: importService.importFindings,
    onSuccess: (summary) => {
      setImportSummary(summary);
      queryClient.invalidateQueries({ queryKey: ['assets', auditId] });
      queryClient.invalidateQueries({ queryKey: ['comparisonAssets', auditId] });
      queryClient.invalidateQueries({ queryKey: ['scanComparison'] });
      queryClient.invalidateQueries({ queryKey: ['attackGraph'] });
      queryClient.invalidateQueries({ queryKey: ['remediationPriorities'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      queryClient.invalidateQueries({ queryKey: ['recentFindings'] });
      showSuccess('Importación finalizada.');
    }
  });

  const currentError =
    projectsQuery.error || auditsQuery.error || assetsQuery.error ||
    createProject.error || createAudit.error || createAsset.error || createFinding.error ||
    importFindings.error;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Operaciones de auditoría</h1>
        <p className="mt-1 text-muted-foreground">
          Gestiona la relación entre proyectos, auditorías, activos y hallazgos.
        </p>
      </div>

      {notice && (
        <div className="flex items-center gap-2 rounded-md bg-green-500/10 p-3 text-sm text-green-500">
          <CheckCircle2 className="h-4 w-4" /> {notice}
        </div>
      )}
      {currentError && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {apiError(currentError)}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FolderKanban className="h-5 w-5" /> Proyecto
            </CardTitle>
            <CardDescription>Selecciona o crea un proyecto.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <select
              className={selectClass}
              value={projectId}
              onChange={(event) => {
                setProjectId(event.target.value);
                setAuditId('');
              }}
            >
              {!projects.length && <option value="">Sin proyectos</option>}
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (projectName.trim()) createProject.mutate({ name: projectName });
              }}
            >
              <Input value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="Nuevo proyecto" />
              <Button size="icon" aria-label="Crear proyecto" disabled={createProject.isPending}>
                <PlusCircle />
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5" /> Auditoría
            </CardTitle>
            <CardDescription>{audits.length} auditorías en el proyecto.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <select className={selectClass} value={auditId} onChange={(event) => setAuditId(event.target.value)} disabled={!projectId}>
              {!audits.length && <option value="">Sin auditorías</option>}
              {audits.map((audit) => (
                <option key={audit.id} value={audit.id}>{audit.name} · {audit.status}</option>
              ))}
            </select>
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (auditName.trim() && projectId) {
                  createAudit.mutate({ projectId, name: auditName, status: 'DRAFT' });
                }
              }}
            >
              <Input value={auditName} onChange={(event) => setAuditName(event.target.value)} placeholder="Nueva auditoría" disabled={!projectId} />
              <Button size="icon" aria-label="Crear auditoría" disabled={!projectId || createAudit.isPending}>
                <PlusCircle />
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Server className="h-5 w-5" /> Activos
            </CardTitle>
            <CardDescription>{assets.length} activos en la auditoría.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (assetForm.name.trim() && auditId) createAsset.mutate({ auditId, ...assetForm });
              }}
            >
              <Input value={assetForm.name} onChange={(event) => setAssetForm({ ...assetForm, name: event.target.value })} placeholder="Nombre del activo" disabled={!auditId} />
              <Input value={assetForm.ip} onChange={(event) => setAssetForm({ ...assetForm, ip: event.target.value })} placeholder="IP (opcional)" disabled={!auditId} />
              <select
                className={selectClass}
                value={assetForm.criticality}
                onChange={(event) => setAssetForm({ ...assetForm, criticality: event.target.value })}
                disabled={!auditId}
                aria-label="Criticidad del activo"
              >
                <option value="LOW">Criticidad baja</option>
                <option value="MEDIUM">Criticidad media</option>
                <option value="HIGH">Criticidad alta</option>
                <option value="CRITICAL">Criticidad crítica</option>
              </select>
              <Button className="w-full" disabled={!auditId || createAsset.isPending}>
                <PlusCircle /> Agregar activo
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registrar hallazgo manual</CardTitle>
          <CardDescription>El activo se selecciona desde la auditoría activa y se procesa con reglas persistentes.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 md:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!findingForm.assetId || (!findingForm.port && !findingForm.vulnerability)) return;
              const selectedAsset = assets.find((asset) => asset.id === findingForm.assetId);
              createFinding.mutate({
                assetId: findingForm.assetId,
                rawData: {
                  assetName: selectedAsset?.name,
                  port: findingForm.port ? Number(findingForm.port) : null,
                  vulnerability: findingForm.vulnerability || null
                }
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="asset">Activo</Label>
              <select id="asset" className={selectClass} value={findingForm.assetId} onChange={(event) => setFindingForm({ ...findingForm, assetId: event.target.value })}>
                {!assets.length && <option value="">Sin activos</option>}
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>{asset.name}{asset.ip ? ` · ${asset.ip}` : ''}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">Puerto</Label>
              <Input id="port" type="number" min="1" max="65535" value={findingForm.port} onChange={(event) => setFindingForm({ ...findingForm, port: event.target.value })} placeholder="21" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vulnerability">Vulnerabilidad</Label>
              <Input id="vulnerability" value={findingForm.vulnerability} onChange={(event) => setFindingForm({ ...findingForm, vulnerability: event.target.value })} placeholder="CVE-2021-44228" />
            </div>
            <Button className="self-end" disabled={!assets.length || createFinding.isPending}>
              <PlusCircle /> {createFinding.isPending ? 'Procesando…' : 'Procesar'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <ScanComparison audits={audits} defaultCurrentAuditId={auditId} />

      <Card>
        <CardHeader>
          <CardTitle>Importar hallazgos</CardTitle>
          <CardDescription>
            Carga Nmap XML, CSV o JSON (máximo 5 MB y 1.000 registros). Los activos se asocian sin duplicarse.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="grid gap-4 md:grid-cols-[180px_1fr_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              if (auditId && importForm.file) {
                setImportSummary(null);
                importFindings.mutate({ auditId, ...importForm });
              }
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="import-format">Formato</Label>
              <select
                id="import-format"
                className={selectClass}
                value={importForm.format}
                onChange={(event) => setImportForm({ ...importForm, format: event.target.value })}
              >
                <option value="nmap">Nmap XML</option>
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="import-file">Archivo</Label>
              <Input
                id="import-file"
                type="file"
                accept={importForm.format === 'nmap' ? '.xml,text/xml' : importForm.format === 'csv' ? '.csv,text/csv' : '.json,application/json'}
                onChange={(event) => setImportForm({ ...importForm, file: event.target.files?.[0] || null })}
              />
            </div>
            <Button className="self-end" disabled={!auditId || !importForm.file || importFindings.isPending}>
              <Upload className="h-4 w-4" /> {importFindings.isPending ? 'Importando…' : 'Importar'}
            </Button>
          </form>

          {importSummary && (
            <div className="rounded-md border p-4 text-sm">
              <p className="font-medium">{importSummary.filename}</p>
              <p className="text-muted-foreground">
                {importSummary.accepted} aceptados · {importSummary.replayed} ya existentes · {importSummary.rejected} rechazados · {importSummary.assetsCreated} activos nuevos
              </p>
              {importSummary.errors.length > 0 && (
                <ul className="mt-3 max-h-36 list-disc space-y-1 overflow-y-auto pl-5 text-destructive">
                  {importSummary.errors.map((error) => (
                    <li key={`${error.source}-${error.message}`}>Registro {error.source}: {error.message}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activos de la auditoría</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {assets.map((asset) => (
            <div key={asset.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
              <div>
                <p className="font-medium">{asset.name}</p>
                <p className="text-muted-foreground">{asset.ip || 'Sin IP'} · {asset.type} · criticidad {asset.criticality?.toLowerCase() || 'media'}</p>
              </div>
              <div className="text-right">
                <p className="font-medium">Riesgo {Math.round(asset.riskScore)}</p>
                <p className="text-muted-foreground">{asset._count.findings} hallazgos</p>
              </div>
            </div>
          ))}
          {!assets.length && <p className="py-6 text-center text-sm text-muted-foreground">No hay activos en esta auditoría.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
