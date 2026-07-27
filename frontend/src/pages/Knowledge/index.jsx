import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Pencil, PlusCircle, Power, Trash2, X } from 'lucide-react';
import { knowledgeService } from '@/services/api';
import { useAppStore } from '@/store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const emptyForm = {
  name: '', type: 'PORT_SERVICE', condition: '{"port": 21}', baseRiskScore: 30,
  recommendation: '', priority: 0, mitreIds: '', owaspIds: '', cweIds: '', active: true
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
  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['knowledge-rules', search, active],
    queryFn: () => knowledgeService.getRules({
      ...(search ? { search } : {}),
      ...(active ? { active } : {})
    })
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['knowledge-rules'] });
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

  const edit = (rule) => {
    setEditingId(rule.id);
    setForm({
      name: rule.name, type: rule.type, condition: JSON.stringify(rule.condition),
      baseRiskScore: rule.baseRiskScore, recommendation: rule.recommendation,
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
        condition: JSON.parse(form.condition),
        baseRiskScore: Number(form.baseRiskScore),
        priority: Number(form.priority),
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
            <CardTitle>{editingId ? 'Editar regla' : 'Nueva regla'}</CardTitle>
            <CardDescription>La condición usa JSON, por ejemplo: {`{"port": 21}`}.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
              <div className="space-y-2"><Label>Nombre</Label><Input required minLength={3} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
              <div className="space-y-2"><Label>Tipo</Label><Input required value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value.toUpperCase() })} /></div>
              <div className="space-y-2"><Label>Condición JSON</Label><Input required value={form.condition} onChange={(event) => setForm({ ...form, condition: event.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Riesgo</Label><Input required type="number" min="0" max="100" value={form.baseRiskScore} onChange={(event) => setForm({ ...form, baseRiskScore: event.target.value })} /></div>
                <div className="space-y-2"><Label>Prioridad</Label><Input type="number" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })} /></div>
              </div>
              <div className="space-y-2 md:col-span-2"><Label>Recomendación</Label><Input required minLength={5} value={form.recommendation} onChange={(event) => setForm({ ...form, recommendation: event.target.value })} /></div>
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
                <div><CardTitle className="text-lg">{rule.name}</CardTitle><CardDescription>{rule.type} · prioridad {rule.priority}</CardDescription></div>
                <Badge variant={rule.active ? 'default' : 'secondary'}>{rule.active ? 'Activa' : 'Inactiva'}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <code className="block overflow-x-auto rounded bg-muted p-2">{JSON.stringify(rule.condition)}</code>
              <p><strong>Riesgo base:</strong> {rule.baseRiskScore}/100</p>
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
