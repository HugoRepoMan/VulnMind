import { Outlet } from 'react-router-dom';

export default function RootLayout() {
  return (
    <div className="min-h-screen bg-background font-sans antialiased text-foreground">
      <main className="flex min-h-screen flex-col items-center justify-center">
        {/* Aquí luego añadiremos Navbar / Sidebar */}
        <Outlet />
      </main>
    </div>
  );
}
