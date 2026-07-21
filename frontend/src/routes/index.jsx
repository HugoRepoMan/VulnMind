import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import RootLayout from '../layouts/RootLayout.jsx';
import { Dashboard, Login, Audits } from '../pages/index.js';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <Dashboard />
      },
      {
        path: 'audits',
        element: <Audits />
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
