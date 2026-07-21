import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const findings = [
  {
    id: 'F-104',
    asset: '192.168.1.10',
    title: 'Vulnerabilidad Log4j Detectada',
    severity: 'Critical',
    time: 'Hace 2 horas',
  },
  {
    id: 'F-103',
    asset: 'db-server-01',
    title: 'Puerto 3306 Expuesto',
    severity: 'High',
    time: 'Hace 5 horas',
  },
  {
    id: 'F-102',
    asset: 'web-prod',
    title: 'Headers HTTP Inseguros',
    severity: 'Medium',
    time: 'Ayer',
  },
  {
    id: 'F-101',
    asset: '10.0.0.5',
    title: 'Servicio FTP Anónimo Habilitado',
    severity: 'High',
    time: 'Ayer',
  },
];

const severityColors = {
  'Critical': 'bg-red-600 hover:bg-red-700',
  'High': 'bg-orange-500 hover:bg-orange-600',
  'Medium': 'bg-yellow-500 hover:bg-yellow-600',
  'Low': 'bg-blue-500 hover:bg-blue-600',
};

export default function RecentFindings() {
  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader>
        <CardTitle>Hallazgos Recientes</CardTitle>
        <CardDescription>Últimas vulnerabilidades detectadas por el motor inteligente</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {findings.map((finding) => (
            <div key={finding.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">{finding.title}</p>
                <p className="text-sm text-muted-foreground">
                  Activo: {finding.asset} • {finding.time}
                </p>
              </div>
              <Badge className={severityColors[finding.severity]}>
                {finding.severity}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
