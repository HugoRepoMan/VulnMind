import { Outlet } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar.jsx';
import Navbar from '../components/layout/Navbar.jsx';
import SyncStatus from '../components/layout/SyncStatus.jsx';

export default function RootLayout() {
  return (
    <div className="flex h-screen bg-background font-sans antialiased text-foreground overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />
        <SyncStatus />
        <main className="flex-1 overflow-y-auto bg-muted/20 p-4 pb-24 sm:p-6 md:pb-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
