import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '@/services/api';

const severityColors = {
  'Critical': 'bg-red-600 hover:bg-red-700',
  'High': 'bg-orange-500 hover:bg-orange-600',
  'Medium': 'bg-yellow-500 hover:bg-yellow-600',
  'Low': 'bg-blue-500 hover:bg-blue-600',
};

export default function RecentFindings() {
  const { data: findings = [], isLoading } = useQuery({
    queryKey: ['recentFindings'],
    queryFn: dashboardService.getRecentFindings,
    refetchInterval: 10000
  });

  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader>
        <CardTitle>Hallazgos Recientes</CardTitle>
        <CardDescription>Últimas vulnerabilidades detectadas por el motor inteligente</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground animate-pulse">Cargando hallazgos...</div>
        ) : findings.length === 0 ? (
          <div className="text-sm text-muted-foreground">No hay hallazgos registrados.</div>
        ) : (
          <div className="space-y-4">
            {findings.map((finding) => (
              <div key={finding.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {finding.vulnerability || `Puerto ${finding.port} Expuesto`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Activo: {finding.assetName} • {new Date(finding.timestamp).toLocaleTimeString()}
                  </p>
                </div>
                <Badge className={severityColors[finding.severity]}>
                  {finding.severity}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
