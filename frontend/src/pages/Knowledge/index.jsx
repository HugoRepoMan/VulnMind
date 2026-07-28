import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, FileJson, Pencil, PlusCircle, Power, Trash2, Upload, X } from 'lucide-react';
import { knowledgeService } from '@/services/api';
import { useAppStore } from '@/store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const emptyForm = {
  code: '', name: '', type: 'PORT_SERVICE', condition: '{"port": 21}', baseRiskScore: 30,
  recommendation: '', remediationEffort: 'MEDIUM', dependencies: '', priority: 0,
  mitreIds: '', owaspIds: '', cweIds: '', active: true
};
const parseIds = (value) => value.split(',').map((item) => item.trim()).filter(Boolean);
const selectClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm';

export default function Knowledge() {
  const queryClient = useQueryClient();
  const isAdmin = useAppStore((state) => state.user?.role === 'ADMIN');
  const [search, setSearch] = useState('');
  const [active, setActive] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [importFile, setImportFile] = useState(null);
  const [importSummary, setImportSummary] = useState(null);
  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['knowledge-rules', search, active],
    queryFn: () => knowledgeService.getRules({
      ...(search ? { search } : {}),
      ...(active ? { active } : {})
    })
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['knowledge-rules'] });
    queryClient.invalidateQueries({ queryKey: ['remediationPriorities'] });
  };
  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
  };
  const saveRule = useMutation({
    mutationFn: (payload) => editingId
      ? knowledgeService.updateRule({ id: editingId, ...payload })
      : knowledgeService.createRule(payload),
    onSuccess: () => {
      refresh();
      resetForm();
    },
    onError: (mutationError) => setError(
      mutationError.response?.data?.message || 'No se pudo guardar la regla.'
    )
  });
  const updateRule = useMutation({ mutationFn: knowledgeService.updateRule, onSuccess: refresh });
  const deleteRule = useMutation({ mutationFn: knowledgeService.deleteRule, onSuccess: refresh });
  const importRules = useMutation({
    mutationFn: knowledgeService.importRules,
    onSuccess: (summary) => {
      setImportSummary(summary);
      setImportFile(null);
      refresh();
    }
  });

  const edit = (rule) => {
    setEditingId(rule.id);
    setForm({
      code: rule.code || '', name: rule.name, type: rule.type, condition: JSON.stringify(rule.condition),
      baseRiskScore: rule.baseRiskScore, recommendation: rule.recommendation,
      remediationEffort: rule.remediationEffort, dependencies: rule.dependencies.join(', '),
      priority: rule.priority, mitreIds: rule.mitreIds.join(', '),
      owaspIds: rule.owaspIds.join(', '), cweIds: rule.cweIds.join(', '), active: rule.active
    });
    setError('');
  };

  const submit = (event) => {
    event.preventDefault();
    try {
      saveRule.mutate({
        ...form,
        code: form.code.trim() || undefined,
        condition: JSON.parse(form.condition),
        baseRiskScore: Number(form.baseRiskScore),
        priority: Number(form.priority),
        dependencies: parseIds(form.dependencies),
        mitreIds: parseIds(form.mitreIds),
        owaspIds: parseIds(form.owaspIds),
        cweIds: parseIds(form.cweIds)
      });
    } catch {
      setError('La condición debe ser un objeto JSON válido.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><BookOpen /> Base de conocimiento</h1>
        <p className="text-muted-foreground">Reglas persistentes utilizadas para evaluar y explicar hallazgos.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-[1fr_180px]">
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar reglas" />
        <select className={selectClass} value={active} onChange={(event) => setActive(event.target.value)}>
          <option value="">Todos los estados</option><option value="true">Activas</option><option value="false">Inactivas</option>
        </select>
      </div>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileJson className="h-5 w-5" /> Importar reglas JSON</CardTitle>
            <CardDescription>
              Acepta una lista de reglas o un objeto con <code>rules</code> o <code>knowledgeRules</code>. Las reglas con el mismo código se actualizan.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              className="flex flex-col gap-3 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault();
                if (importFile) {
                  setImportSummary(null);
                  importRules.mutate(importFile);
                }
              }}
            >
              <Input
                type="file"
                accept=".json,application/json"
                onChange={(event) => setImportFile(event.target.files?.[0] || null)}
              />
              <Button disabled={!importFile || importRules.isPending}>
                <Upload /> {importRules.isPending ? 'Validando…' : 'Importar JSON'}
              </Button>
            </form>
            {importRules.error && (
              <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {importRules.error.response?.data?.message || 'No se pudo importar el archivo.'}
              </p>
            )}
            {importSummary && (
              <div className="rounded-lg border p-4 text-sm">
                <p className="font-medium">{importSummary.filename}</p>
                <p className="mt-1 text-muted-foreground">
                  {importSummary.created} creadas · {importSummary.updated} actualizadas · {importSummary.rejected} rechazadas
                </p>
                {importSummary.warnings.map((warning) => (
                  <p key={warning} className="mt-2 text-amber-600">{warning}</p>
                ))}
                {importSummary.errors.length > 0 && (
                  <ul className="mt-3 max-h-40 list-disc space-y-1 overflow-y-auto pl-5 text-destructive">
                    {importSummary.errors.map((item) => (
                      <li key={`${item.index}-${item.code}`}>Regla {item.index}{item.code ? ` (${item.code})` : ''}: {item.message}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Editar regla' : 'Nueva regla'}</CardTitle>
            <CardDescription>La condición usa JSON, por ejemplo: {`{"port": 21}`}.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
              <div className="space-y-2"><Label>Código único (opcional)</Label><Input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="KB-FTP-001" /></div>
              <div className="space-y-2"><Label>Nombre</Label><Input required minLength={3} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
              <div className="space-y-2"><Label>Tipo</Label><Input required value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value.toUpperCase() })} /></div>
              <div className="space-y-2"><Label>Condición JSON</Label><Input required value={form.condition} onChange={(event) => setForm({ ...form, condition: event.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Riesgo</Label><Input required type="number" min="0" max="100" value={form.baseRiskScore} onChange={(event) => setForm({ ...form, baseRiskScore: event.target.value })} /></div>
                <div className="space-y-2"><Label>Prioridad</Label><Input type="number" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })} /></div>
              </div>
              <div className="space-y-2 md:col-span-2"><Label>Recomendación</Label><Input required minLength={5} value={form.recommendation} onChange={(event) => setForm({ ...form, recommendation: event.target.value })} /></div>
              <div className="space-y-2">
                <Label>Esfuerzo estimado</Label>
                <select className={selectClass} value={form.remediationEffort} onChange={(event) => setForm({ ...form, remediationEffort: event.target.value })}>
                  <option value="LOW">Bajo</option>
                  <option value="MEDIUM">Medio</option>
                  <option value="HIGH">Alto</option>
                </select>
              </div>
              <div className="space-y-2"><Label>Dependencias (separadas por coma)</Label><Input value={form.dependencies} onChange={(event) => setForm({ ...form, dependencies: event.target.value })} placeholder="Cambio de red, ventana de mantenimiento" /></div>
              <div className="space-y-2"><Label>MITRE IDs (separados por coma)</Label><Input value={form.mitreIds} onChange={(event) => setForm({ ...form, mitreIds: event.target.value })} /></div>
              <div className="space-y-2"><Label>OWASP IDs</Label><Input value={form.owaspIds} onChange={(event) => setForm({ ...form, owaspIds: event.target.value })} /></div>
              <div className="space-y-2"><Label>CWE IDs</Label><Input value={form.cweIds} onChange={(event) => setForm({ ...form, cweIds: event.target.value })} /></div>
              <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Regla activa</label>
              {error && <p className="text-sm text-red-500 md:col-span-2">{error}</p>}
              <div className="flex gap-2 md:col-span-2">
                <Button disabled={saveRule.isPending}><PlusCircle /> {editingId ? 'Guardar cambios' : 'Crear regla'}</Button>
                {editingId && <Button type="button" variant="outline" onClick={resetForm}><X /> Cancelar</Button>}
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {rules.map((rule) => (
          <Card key={rule.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div><CardTitle className="text-lg">{rule.name}</CardTitle><CardDescription>{rule.code ? `${rule.code} · ` : ''}{rule.type} · prioridad {rule.priority}</CardDescription></div>
                <Badge variant={rule.active ? 'default' : 'secondary'}>{rule.active ? 'Activa' : 'Inactiva'}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <code className="block overflow-x-auto rounded bg-muted p-2">{JSON.stringify(rule.condition)}</code>
              <p><strong>Riesgo base:</strong> {rule.baseRiskScore}/100</p>
              <p><strong>Esfuerzo:</strong> {rule.remediationEffort} · <strong>Dependencias:</strong> {rule.dependencies.length ? rule.dependencies.join(', ') : 'ninguna'}</p>
              <p>{rule.recommendation}</p>
              <p className="text-muted-foreground">{rule._count.analyses} análisis relacionados</p>
              {isAdmin && (
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => edit(rule)}><Pencil /> Editar</Button>
                  <Button size="sm" variant="outline" onClick={() => updateRule.mutate({ id: rule.id, active: !rule.active })}><Power /> {rule.active ? 'Desactivar' : 'Activar'}</Button>
                  <Button size="sm" variant="destructive" onClick={() => {
                    if (window.confirm(`¿Eliminar la regla "${rule.name}"?`)) deleteRule.mutate(rule.id);
                  }}><Trash2 /> Eliminar</Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      {!isLoading && !rules.length && <p className="py-8 text-center text-muted-foreground">No se encontraron reglas.</p>}
    </div>
  );
}
