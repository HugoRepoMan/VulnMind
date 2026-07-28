import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import RootLayout from '../layouts/RootLayout.jsx';
import { useAppStore } from '@/store';

const Dashboard = lazy(() => import('../pages/Dashboard/index.jsx'));
const Login = lazy(() => import('../pages/Login/index.jsx'));
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
        element: page(<Settings />)
      },
      {
        path: 'knowledge',
        element: page(<Knowledge />)
      },
      {
        path: 'attack-graph',
        element: page(<AttackGraph />)
      },
      {
        path: 'remediations',
        element: page(<Remediations />)
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
  }
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
