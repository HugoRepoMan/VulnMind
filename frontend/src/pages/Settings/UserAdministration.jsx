/**
 * Panel ADMIN. Después de cada mutación invalida la caché para mostrar el
 * rol/estado que PostgreSQL confirmó, no un valor optimista local.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { usersService } from '@/services/api';
import { useAppStore } from '@/store';

const roleLabels = { ADMIN: 'Administrador', AUDITOR: 'Auditor', VIEWER: 'Solo lectura' };
const errorMessage = (error) =>
  error.response?.data?.message || error.message || 'No se pudo completar la operación.';

export default function UserAdministration() {
  const queryClient = useQueryClient();
  const currentUser = useAppStore((state) => state.user);
  const [form, setForm] = useState({ email: '', password: '', role: 'AUDITOR' });
  const [reset, setReset] = useState({ userId: '', password: '' });
  const [notice, setNotice] = useState('');
  const users = useQuery({
    queryKey: ['users'],
    queryFn: usersService.getUsers,
    enabled: currentUser?.role === 'ADMIN'
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['users'] });
  const createUser = useMutation({
    mutationFn: usersService.createUser,
    onSuccess: () => {
      setForm({ email: '', password: '', role: 'AUDITOR' });
      setNotice('Usuario creado correctamente.');
      refresh();
    }
  });
  const updateUser = useMutation({
    mutationFn: usersService.updateUser,
    onSuccess: () => {
      setNotice('Permisos del usuario actualizados.');
      refresh();
    }
  });
  const resetPassword = useMutation({
    mutationFn: usersService.resetPassword,
    onSuccess: () => {
      setReset({ userId: '', password: '' });
      setNotice('Contraseña restablecida correctamente.');
    }
  });
  const mutationError = createUser.error || updateUser.error || resetPassword.error;

  if (currentUser?.role !== 'ADMIN') return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Usuarios y acceso</CardTitle>
        <CardDescription>
          Crea cuentas, asigna el nivel de acceso y bloquea usuarios sin eliminar su historial.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {notice && <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-600">{notice}</div>}
        {mutationError && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{errorMessage(mutationError)}</div>}

        <form
          className="grid gap-3 rounded-lg border p-4 md:grid-cols-[1fr_1fr_180px_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            setNotice('');
            createUser.mutate(form);
          }}
        >
          <Input
            type="email"
            required
            placeholder="correo@empresa.com"
            aria-label="Correo del nuevo usuario"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
          <Input
            type="password"
            required
            minLength={10}
            placeholder="Contraseña temporal"
            aria-label="Contraseña temporal"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
          />
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Rol del nuevo usuario"
            value={form.role}
            onChange={(event) => setForm({ ...form, role: event.target.value })}
          >
            {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <Button type="submit" disabled={createUser.isPending}>
            <UserPlus className="h-4 w-4" /> Crear
          </Button>
          <p className="text-xs text-muted-foreground md:col-span-4">
            La contraseña debe tener al menos 10 caracteres. El usuario podrá iniciar sesión inmediatamente.
          </p>
        </form>

        <div className="space-y-3">
          {users.isLoading && <p className="text-sm text-muted-foreground">Cargando usuarios…</p>}
          {(users.data || []).map((user) => (
            <div key={user.id} className="grid gap-3 rounded-lg border p-4 lg:grid-cols-[1fr_180px_130px_auto] lg:items-center">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{user.email}</p>
                <p className="text-xs text-muted-foreground">
                  {user._count.projects} proyectos · Creado {new Date(user.createdAt).toLocaleDateString()}
                  {user.id === currentUser.id ? ' · Tu cuenta' : ''}
                </p>
              </div>
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={user.role}
                aria-label={`Rol de ${user.email}`}
                onChange={(event) => updateUser.mutate({ id: user.id, role: event.target.value })}
                disabled={updateUser.isPending}
              >
                {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <Button
                size="sm"
                variant={user.active ? 'outline' : 'default'}
                disabled={updateUser.isPending || user.id === currentUser.id}
                onClick={() => updateUser.mutate({ id: user.id, active: !user.active })}
              >
                {user.active ? 'Desactivar' : 'Activar'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setReset({ userId: user.id, password: '' })}
              >
                <KeyRound className="h-4 w-4" /> Contraseña
              </Button>
              {reset.userId === user.id && (
                <form
                  className="flex flex-col gap-2 border-t pt-3 sm:flex-row lg:col-span-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    resetPassword.mutate({ id: user.id, password: reset.password });
                  }}
                >
                  <Input
                    autoFocus
                    required
                    minLength={10}
                    type="password"
                    placeholder="Nueva contraseña"
                    value={reset.password}
                    onChange={(event) => setReset({ ...reset, password: event.target.value })}
                  />
                  <Button type="submit" disabled={resetPassword.isPending}>Guardar contraseña</Button>
                  <Button type="button" variant="ghost" onClick={() => setReset({ userId: '', password: '' })}>Cancelar</Button>
                </form>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
