/**
 * Mapa de pantallas y guardas de sesión/rol. La API repite estas validaciones
 * porque ocultar una página en el navegador no constituye seguridad.
 */
import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import RootLayout from '../layouts/RootLayout.jsx';
import { useAppStore } from '@/store';

const Dashboard = lazy(() => import('../pages/Dashboard/index.jsx'));
const Login = lazy(() => import('../pages/Login/index.jsx'));
const Register = lazy(() => import('../pages/Register/index.jsx'));
const Audits = lazy(() => import('../pages/Audits/index.jsx'));
const Knowledge = lazy(() => import('../pages/Knowledge/index.jsx'));
const Settings = lazy(() => import('../pages/Settings/index.jsx'));
const AttackGraph = lazy(() => import('../pages/AttackGraph/index.jsx'));
const Remediations = lazy(() => import('../pages/Remediations/index.jsx'));

const page = (component) => (
  <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Cargando…</div>}>
    {component}
  </Suspense>
);

function ProtectedRoute({ roles, children }) {
  const user = useAppStore((state) => state.user);
  const token = useAppStore((state) => state.token);

  if (!user || !token) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <RootLayout />
      </ProtectedRoute>
    ),
    errorElement: <div className="p-8 text-center text-red-500">Ruta no encontrada (Error 404)</div>,
    children: [
      {
        index: true,
        element: page(<Dashboard />)
      },
      {
        path: 'audits',
        element: (
          <ProtectedRoute roles={['ADMIN', 'AUDITOR']}>
            {page(<Audits />)}
          </ProtectedRoute>
        )
      },
      {
        path: 'settings',
        element: (
          <ProtectedRoute roles={['ADMIN', 'AUDITOR']}>
            {page(<Settings />)}
          </ProtectedRoute>
        )
      },
      {
        path: 'knowledge',
        element: (
          <ProtectedRoute roles={['ADMIN', 'AUDITOR']}>
            {page(<Knowledge />)}
          </ProtectedRoute>
        )
      },
      {
        path: 'attack-graph',
        element: (
          <ProtectedRoute roles={['ADMIN', 'AUDITOR']}>
            {page(<AttackGraph />)}
          </ProtectedRoute>
        )
      },
      {
        path: 'remediations',
        element: (
          <ProtectedRoute roles={['ADMIN', 'AUDITOR']}>
            {page(<Remediations />)}
          </ProtectedRoute>
        )
      },
      {
        path: '*',
        element: <Navigate to="/" replace />
      }
    ]
  },
  {
    path: '/login',
    element: page(<Login />)
  },
  {
    path: '/register',
    element: page(<Register />)
  }
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
