import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import RootLayout from '../layouts/RootLayout.jsx';
import { Dashboard, Login, Audits } from '../pages/index.js';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <div className="p-8 text-center text-red-500">Ruta no encontrada (Error 404)</div>,
    children: [
      {
        index: true,
        element: <Dashboard />
      },
      {
        path: 'audits',
        element: <Audits />
      },
      {
        path: 'settings',
        element: <div className="p-8">Configuración (Próximamente)</div>
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
