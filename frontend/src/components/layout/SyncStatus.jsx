import { CloudOff, RefreshCw, TriangleAlert } from 'lucide-react';
import { useOfflineSync } from '@/hooks/useOfflineSync';

export default function SyncStatus() {
  const { pending, conflicts } = useOfflineSync();
  const online = navigator.onLine;
  if (online && !pending && !conflicts) return null;

  return (
    <div
      className="flex items-center justify-center gap-2 border-b bg-amber-500/10 px-4 py-2 text-xs text-amber-700 dark:text-amber-300"
      role="status"
    >
      {!online ? <CloudOff className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
      {!online ? 'Sin conexión. Los nuevos hallazgos quedarán en cola.' : `${pending} registro(s) pendientes de sincronizar.`}
      {conflicts > 0 && (
        <span className="inline-flex items-center gap-1">
          <TriangleAlert className="h-3.5 w-3.5" /> {conflicts} conflicto(s)
        </span>
      )}
    </div>
  );
}
