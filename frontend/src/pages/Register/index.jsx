/**
 * Registro autónomo. Sólo envía correo/contraseña: el backend fuerza VIEWER
 * aunque alguien manipule manualmente el formulario.
 */
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { authService } from '@/services/api';
import { useAppStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function Register() {
  const navigate = useNavigate();
  const token = useAppStore((state) => state.token);
  const [form, setForm] = useState({ email: '', password: '', confirmation: '' });
  const [validation, setValidation] = useState('');
  const mutation = useMutation({
    mutationFn: ({ email, password }) => authService.register({ email, password }),
    onSuccess: () => navigate('/login', {
      replace: true,
      state: { notice: 'Cuenta creada. Ya puedes iniciar sesión con acceso de solo lectura.' }
    })
  });

  if (token) return <Navigate to="/" replace />;

  const submit = (event) => {
    event.preventDefault();
    setValidation('');
    if (form.password !== form.confirmation) {
      setValidation('Las contraseñas no coinciden.');
      return;
    }
    mutation.mutate(form);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">Crear cuenta</CardTitle>
          <CardDescription>
            Tu cuenta comenzará con acceso de solo lectura al Dashboard. Un administrador puede promoverte a auditor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="register-email">Correo electrónico</Label>
              <Input
                id="register-email"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-password">Contraseña</Label>
              <Input
                id="register-password"
                type="password"
                autoComplete="new-password"
                minLength={10}
                required
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
              />
              <p className="text-xs text-muted-foreground">Usa al menos 10 caracteres.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-confirmation">Confirmar contraseña</Label>
              <Input
                id="register-confirmation"
                type="password"
                autoComplete="new-password"
                minLength={10}
                required
                value={form.confirmation}
                onChange={(event) => setForm({ ...form, confirmation: event.target.value })}
              />
            </div>
            {(validation || mutation.error) && (
              <p className="text-sm text-destructive" role="alert">
                {validation || mutation.error.response?.data?.message || 'No fue posible crear la cuenta.'}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? 'Creando cuenta…' : 'Registrarme'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              ¿Ya tienes cuenta? <Link className="font-medium text-primary underline" to="/login">Inicia sesión</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
