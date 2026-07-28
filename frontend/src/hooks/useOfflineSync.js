/** Reactiva la cola al volver Internet y publica contadores para la interfaz. */
import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { syncPendingFindings } from '@/services/offline';
import { useAppStore } from '@/store';

export const useOfflineSync = () => {
  const currentUserId = useAppStore((state) => state.user?.id);
  const entries = useLiveQuery(
    () => currentUserId
      ? db.syncQueue.where('userId').equals(currentUserId).reverse().sortBy('createdAt')
      : [],
    [currentUserId],
    []
  );

  useEffect(() => {
    const sync = () => syncPendingFindings();
    window.addEventListener('online', sync);
    const interval = window.setInterval(sync, 30000);
    sync();
    return () => {
      window.removeEventListener('online', sync);
      window.clearInterval(interval);
    };
  }, [currentUserId]);

  return {
    entries,
    pending: entries.filter(({ status }) => ['pending', 'syncing', 'failed'].includes(status)).length,
    conflicts: entries.filter(({ status }) => status === 'conflict').length
  };
};
