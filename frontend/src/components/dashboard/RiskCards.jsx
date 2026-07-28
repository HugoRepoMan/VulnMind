/** Tarjetas que formatean métricas ya agregadas por PostgreSQL. */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, ShieldAlert, Activity, CheckCircle } from 'lucide-react';

export default function RiskCards({ stats, isLoading, isError }) {
  if (isLoading) return <div className="animate-pulse text-muted-foreground">Cargando métricas…</div>;
  if (isError) return <div className="text-destructive">Error cargando métricas</div>;

  const cardsData = [
    {
      title: 'Riesgo global',
      value: `${stats?.globalRisk || 0}/100`,
      description: 'Promedio del periodo',
      icon: ShieldAlert,
      alert: (stats?.globalRisk || 0) > 50
    },
    {
      title: 'Hallazgos críticos',
      value: stats?.criticalFindings || 0,
      description: 'Requieren atención inmediata',
      icon: AlertTriangle,
      alert: (stats?.criticalFindings || 0) > 0
    },
    {
      title: 'Activos analizados',
      value: `${stats?.analyzedAssets || 0}/${stats?.totalAssets || 0}`,
      description: 'Con hallazgos en el periodo',
      icon: Activity,
      alert: false
    },
    {
      title: 'Reglas satisfechas',
      value: stats?.rulesMatched || 0,
      description: 'Coincidencias del conocimiento',
      icon: CheckCircle,
      alert: false
    }
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cardsData.map((stat) => (
        <Card key={stat.title} className={stat.alert ? 'border-destructive/50 shadow-sm' : 'shadow-sm'}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <stat.icon className={`h-4 w-4 ${stat.alert ? 'text-destructive' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="mt-1 text-xs text-muted-foreground">{stat.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
