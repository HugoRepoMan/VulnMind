/** Lista accesible que comunica al Dashboard cuál hallazgo quiere inspeccionar. */
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const severityColors = {
  Critical: 'bg-red-600 hover:bg-red-700',
  High: 'bg-orange-500 hover:bg-orange-600',
  Medium: 'bg-yellow-500 text-black hover:bg-yellow-600',
  Low: 'bg-blue-500 hover:bg-blue-600'
};

export default function RecentFindings({ findings = [], isLoading, onSelect, selectedId }) {
  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader>
        <CardTitle>Hallazgos recientes</CardTitle>
        <CardDescription>Selecciona uno para inspeccionar la decisión del motor</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="animate-pulse text-sm text-muted-foreground">Cargando hallazgos…</div>
        ) : findings.length === 0 ? (
          <div className="text-sm text-muted-foreground">No hay hallazgos en el periodo.</div>
        ) : (
          <div className="space-y-2">
            {findings.map((finding) => (
              <button
                type="button"
                key={finding.id}
                onClick={() => onSelect(finding)}
                className={`flex w-full items-center justify-between rounded-md border p-3 text-left transition-colors hover:bg-muted/60 ${selectedId === finding.id ? 'border-primary bg-muted/50' : ''}`}
              >
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-sm font-medium">
                    {finding.vulnerability || `Puerto ${finding.port} expuesto`}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {finding.assetName} · {new Date(finding.timestamp).toLocaleString()}
                  </p>
                </div>
                <Badge className={severityColors[finding.severity]}>{finding.severity}</Badge>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
