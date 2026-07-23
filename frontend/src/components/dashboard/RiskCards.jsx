import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, ShieldAlert, Activity, CheckCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '@/services/api';

export default function RiskCards() {
  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: dashboardService.getStats,
    refetchInterval: 10000 // Refresca cada 10s
  });

  if (isLoading) return <div className="text-muted-foreground animate-pulse">Cargando métricas...</div>;
  if (isError) return <div className="text-destructive">Error cargando métricas</div>;

  const cardsData = [
    {
      title: "Riesgo Global",
      value: `${stats?.globalRisk || 0}/100`,
      description: "Calculado por el Motor",
      icon: ShieldAlert,
      alert: (stats?.globalRisk || 0) > 50,
    },
    {
      title: "Hallazgos Críticos",
      value: stats?.criticalFindings || 0,
      description: "Requieren atención inmediata",
      icon: AlertTriangle,
      alert: (stats?.criticalFindings || 0) > 0,
    },
    {
      title: "Activos Analizados",
      value: stats?.totalAssets || 0,
      description: "En el inventario",
      icon: Activity,
      alert: false,
    },
    {
      title: "Reglas Satisfechas",
      value: stats?.rulesMatched || 0,
      description: "Cobertura de base de conocimiento",
      icon: CheckCircle,
      alert: false,
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cardsData.map((stat, i) => (
        <Card key={i} className={stat.alert ? "border-destructive/50 shadow-sm" : "shadow-sm"}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {stat.title}
            </CardTitle>
            <stat.icon className={`h-4 w-4 ${stat.alert ? 'text-destructive' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stat.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
