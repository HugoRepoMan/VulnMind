import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, PlusCircle } from 'lucide-react';

export default function Audits() {
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
            <form className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="asset">Activo Afectado</Label>
                <Input id="asset" placeholder="IP, Hostname o ID" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="port">Puerto / Servicio</Label>
                <Input id="port" placeholder="Ej: 21, 3306, HTTP" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vulnerability">Vulnerabilidad Detectada (Opcional)</Label>
                <Input id="vulnerability" placeholder="Ej: CVE-2021-44228" />
              </div>
              <Button type="button" className="w-full gap-2">
                <PlusCircle className="h-4 w-4" />
                Procesar Hallazgo
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
