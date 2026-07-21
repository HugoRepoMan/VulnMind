import { Button } from '@/components/ui/button';

export default function Dashboard() {
  return (
    <div className="p-8 space-y-4">
      <h1 className="text-3xl font-bold tracking-tight">SOC Dashboard</h1>
      <p className="text-muted-foreground">Bienvenido a VulnMind.</p>
      <Button>Nueva Auditoría</Button>
    </div>
  );
}
