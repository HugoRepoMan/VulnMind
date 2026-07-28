/** Configuración de Web Push, cola offline y administración de usuarios ADMIN. */
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, CloudCog, RefreshCw, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { db } from '@/db';
import { notificationService } from '@/services/api';
import { discardQueueItem, retryQueueItem } from '@/services/offline';
import { useAppStore } from '@/store';
import UserAdministration from './UserAdministration';

const statusLabels = {
  pending: 'Pendiente',
  syncing: 'Sincronizando',
  failed: 'Fallido',
  conflict: 'Conflicto',
  synced: 'Sincronizado'
};

const toApplicationServerKey = (value) => {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replaceAll('-', '+').replaceAll('_', '/');
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
};

const apiError = (error) =>
  error.response?.data?.message || error.message || 'No se pudo completar la operación.';

const getServiceWorkerRegistration = async () => {
  const timeout = new Promise((_, reject) => {
    window.setTimeout(
      () => reject(new Error('El service worker no pudo iniciarse. Recarga la página e inténtalo de nuevo.')),
      10000
    );
  });

  return Promise.race([navigator.serviceWorker.ready, timeout]);
};

export default function Settings() {
  const queryClient = useQueryClient();
  const currentUserId = useAppStore((state) => state.user?.id);
  const [notice, setNotice] = useState('');
  const queue = useLiveQuery(
    () => currentUserId
      ? db.syncQueue.where('userId').equals(currentUserId).toArray()
      : [],
    [currentUserId],
    []
  ).sort((a, b) => b.createdAt - a.createdAt);

  const configuration = useQuery({
    queryKey: ['notificationConfiguration'],
    queryFn: notificationService.getConfiguration
  });

  const enablePush = useMutation({
    mutationFn: async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        throw new Error('Este navegador no admite notificaciones Push.');
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('El permiso de notificaciones fue rechazado.');
      const registration = await getServiceWorkerRegistration();
      const current = await registration.pushManager.getSubscription();
      const subscription = current || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: toApplicationServerKey(configuration.data.publicKey)
      });
      await notificationService.subscribe(subscription.toJSON());
    },
    onSuccess: () => {
      setNotice('Notificaciones críticas activadas.');
      queryClient.invalidateQueries({ queryKey: ['notificationConfiguration'] });
    }
  });

  const disablePush = useMutation({
    mutationFn: async () => {
      const registration = await getServiceWorkerRegistration();
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await notificationService.unsubscribe(subscription.endpoint);
        await subscription.unsubscribe();
      }
    },
    onSuccess: () => {
      setNotice('Notificaciones desactivadas.');
      queryClient.invalidateQueries({ queryKey: ['notificationConfiguration'] });
    }
  });

  const mutationError = enablePush.error || disablePush.error;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configuración</h1>
        <p className="mt-1 text-muted-foreground">
          Administra alertas críticas y operaciones guardadas sin conexión.
        </p>
      </div>

      {notice && <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-600">{notice}</div>}
      {mutationError && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{apiError(mutationError)}</div>}

      <UserAdministration />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BellRing className="h-5 w-5" /> Notificaciones Push</CardTitle>
          <CardDescription>
            Recibe una alerta del navegador cuando el motor procese un riesgo crítico.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            {!configuration.data?.enabled
              ? 'El servidor todavía no tiene claves VAPID configuradas.'
              : configuration.data.subscribed
                ? 'Suscripción activa para esta cuenta.'
                : 'Disponible, pero no activada en este navegador.'}
          </div>
          {configuration.data?.subscribed ? (
            <Button variant="outline" onClick={() => disablePush.mutate()} disabled={disablePush.isPending}>
              Desactivar
            </Button>
          ) : (
            <Button
              onClick={() => enablePush.mutate()}
              disabled={!configuration.data?.enabled || enablePush.isPending}
            >
              Activar alertas
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CloudCog className="h-5 w-5" /> Cola de sincronización</CardTitle>
          <CardDescription>
            Los reintentos conservan su clave idempotente. Un conflicto puede descartarse o enviarse como copia nueva.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!queue.length && <p className="py-4 text-sm text-muted-foreground">No hay operaciones locales.</p>}
          {queue.map((entry) => (
            <div key={entry.id} className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">Crear hallazgo</span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{statusLabels[entry.status] || entry.status}</span>
                </div>
                <p className="truncate text-muted-foreground">
                  Activo {entry.payload.assetId} · {entry.payload.rawData.vulnerability || `puerto ${entry.payload.rawData.port || 'sin puerto'}`}
                </p>
                {entry.lastError && <p className="text-xs text-destructive">{entry.lastError}</p>}
              </div>
              <div className="flex shrink-0 gap-2">
                {['failed', 'pending'].includes(entry.status) && (
                  <Button size="sm" variant="outline" onClick={() => retryQueueItem(entry.id)}>
                    <RefreshCw className="h-4 w-4" /> Reintentar
                  </Button>
                )}
                {entry.status === 'conflict' && (
                  <Button size="sm" variant="outline" onClick={() => retryQueueItem(entry.id, true)}>
                    Reintentar como copia
                  </Button>
                )}
                {entry.status !== 'syncing' && (
                  <Button size="icon" variant="ghost" aria-label="Descartar operación" onClick={() => discardQueueItem(entry.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
