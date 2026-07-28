import { NavLink } from 'react-router-dom';
import { Shield, Activity, BookOpen, FileText, ListChecks, Network, Settings, User } from 'lucide-react';
import { useAppStore } from '@/store';

export default function Sidebar() {
  const user = useAppStore((state) => state.user);
  const canAudit = ['ADMIN', 'AUDITOR'].includes(user?.role);

  const links = [
    { to: '/', label: 'Dashboard', icon: Activity, end: true },
    ...(canAudit ? [{ to: '/audits', label: 'Auditorías', icon: FileText }] : []),
    { to: '/attack-graph', label: 'Rutas de ataque', icon: Network },
    { to: '/remediations', label: 'Remediaciones', icon: ListChecks },
    { to: '/knowledge', label: 'Conocimiento', icon: BookOpen },
    { to: '/settings', label: 'Configuración', icon: Settings }
  ];
  const linkClass = ({ isActive }) =>
    `flex items-center space-x-3 rounded-lg px-3 py-2 transition-colors ${
      isActive
        ? 'bg-secondary text-secondary-foreground'
        : 'text-muted-foreground hover:bg-secondary hover:text-secondary-foreground'
    }`;

  return (
    <>
    <aside className="w-64 border-r bg-card hidden md:block">
      <div className="h-full flex flex-col">
        <div className="h-16 flex items-center px-6 border-b">
          <Shield className="h-6 w-6 text-primary mr-2" />
          <span className="font-bold text-lg tracking-tight">VulnMind SOC</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={linkClass}>
              <Icon className="h-4 w-4" />
              <span className="font-medium">{label}</span>
            </NavLink>
          ))}
        </nav>
        
        <div className="p-4 border-t">
          <div className="flex items-center space-x-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
              <User className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium">{user?.email}</span>
              <span className="text-xs text-muted-foreground">{user?.role}</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
    <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t bg-card/95 p-2 backdrop-blur md:hidden" aria-label="Navegación principal">
      {links.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex min-w-14 flex-col items-center gap-1 rounded-md px-2 py-1 text-[11px] ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
          <Icon className="h-4 w-4" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
    </>
  );
}
