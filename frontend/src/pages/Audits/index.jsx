import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, PlusCircle, CheckCircle2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { findingsService } from '@/services/api';

export default function Audits() {
  const [formData, setFormData] = useState({ assetId: 'asset-1', port: '', vulnerability: '' });
  const [successMsg, setSuccessMsg] = useState('');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: findingsService.createFinding,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      queryClient.invalidateQueries({ queryKey: ['recentFindings'] });
      setSuccessMsg('Hallazgo enviado y procesado con éxito.');
      setFormData({ assetId: 'asset-1', port: '', vulnerability: '' });
      setTimeout(() => setSuccessMsg(''), 3000);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.assetId || (!formData.port && !formData.vulnerability)) return;

    mutation.mutate({
      assetId: formData.assetId,
      rawData: {
        assetName: 'web-prod-01', // Simulation for UI ease
        port: formData.port ? parseInt(formData.port) : null,
        vulnerability: formData.vulnerability
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Auditorías Activas</h1>
          <p className="text-muted-foreground mt-1">Gestiona los proyectos y registra nuevos hallazgos.</p>
        </div>
        <Button className="shrink-0 gap-2">
          <FileText className="h-4 w-4" />
          Nueva Auditoría
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Registrar Hallazgo Manual</CardTitle>
            <CardDescription>Envía datos crudos al Motor Inteligente para su inferencia.</CardDescription>
          </CardHeader>
          <CardContent>
            {successMsg && (
              <div className="mb-4 p-3 bg-green-500/10 text-green-500 rounded-md flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4" />
                {successMsg}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="asset">Activo Afectado (ID o IP)</Label>
                <Input 
                  id="asset" 
                  value={formData.assetId}
                  onChange={(e) => setFormData({...formData, assetId: e.target.value})}
                  placeholder="asset-1, 192.168.1.50..." 
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="port">Puerto / Servicio</Label>
                <Input 
                  id="port" 
                  value={formData.port}
                  onChange={(e) => setFormData({...formData, port: e.target.value})}
                  placeholder="Ej: 21, 3306, 80" 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vulnerability">Vulnerabilidad Detectada (Opcional)</Label>
                <Input 
                  id="vulnerability" 
                  value={formData.vulnerability}
                  onChange={(e) => setFormData({...formData, vulnerability: e.target.value})}
                  placeholder="Ej: CVE-2021-44228" 
                />
              </div>
              <Button type="submit" className="w-full gap-2" disabled={mutation.isPending}>
                <PlusCircle className="h-4 w-4" />
                {mutation.isPending ? 'Procesando...' : 'Procesar Hallazgo'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Últimas Auditorías</CardTitle>
            <CardDescription>Proyectos recientemente modificados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground text-center py-8">
              No hay auditorías recientes.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
