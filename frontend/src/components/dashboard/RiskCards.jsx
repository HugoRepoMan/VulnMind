import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, ShieldAlert, Activity, CheckCircle } from 'lucide-react';

export default function RiskCards() {
  const stats = [
    {
      title: "Riesgo Global",
      value: "85/100",
      description: "+12% desde última auditoría",
      icon: ShieldAlert,
      alert: true,
    },
    {
      title: "Hallazgos Críticos",
      value: "4",
      description: "2 requieren atención inmediata",
      icon: AlertTriangle,
      alert: true,
    },
    {
      title: "Activos Analizados",
      value: "12",
      description: "3 servidores, 9 endpoints",
      icon: Activity,
      alert: false,
    },
    {
      title: "Reglas Satisfechas",
      value: "156",
      description: "Cobertura MITRE ATT&CK: 42%",
      icon: CheckCircle,
      alert: false,
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, i) => (
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
