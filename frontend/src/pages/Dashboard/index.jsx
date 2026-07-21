import RiskCards from '@/components/dashboard/RiskCards';
import RiskChart from '@/components/dashboard/RiskChart';
import RecentFindings from '@/components/dashboard/RecentFindings';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Centro de Operaciones (SOC)</h1>
          <p className="text-muted-foreground mt-1">Visión general del estado de seguridad y hallazgos en tiempo real.</p>
        </div>
        <Button className="shrink-0 gap-2">
          <PlusCircle className="h-4 w-4" />
          Nuevo Hallazgo
        </Button>
      </div>
      
      <RiskCards />
      
      <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-5">
        <RiskChart />
        <RecentFindings />
      </div>
    </div>
  );
}
