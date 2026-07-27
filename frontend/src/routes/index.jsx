import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import RootLayout from '../layouts/RootLayout.jsx';
import { Dashboard, Login, Audits, Knowledge } from '../pages/index.js';
import { useAppStore } from '@/store';

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

export const router = createBrowserRouter([
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
        element: <Dashboard />
      },
      {
        path: 'audits',
        element: (
          <ProtectedRoute roles={['ADMIN', 'AUDITOR']}>
            <Audits />
          </ProtectedRoute>
        )
      },
      {
        path: 'settings',
        element: <div className="p-8">Configuración (Próximamente)</div>
      },
      {
        path: 'knowledge',
        element: <Knowledge />
      },
      {
        path: '*',
        element: <Navigate to="/" replace />
      }
    ]
  },
  {
    path: '/login',
    element: <Login />
  }
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
