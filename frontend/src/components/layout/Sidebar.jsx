import { Link } from 'react-router-dom';
import { Shield, Activity, BookOpen, FileText, Settings, User } from 'lucide-react';
import { useAppStore } from '@/store';

export default function Sidebar() {
  const user = useAppStore((state) => state.user);
  const canAudit = ['ADMIN', 'AUDITOR'].includes(user?.role);

  return (
    <aside className="w-64 border-r bg-card hidden md:block">
      <div className="h-full flex flex-col">
        <div className="h-16 flex items-center px-6 border-b">
          <Shield className="h-6 w-6 text-primary mr-2" />
          <span className="font-bold text-lg tracking-tight">VulnMind SOC</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <Link to="/" className="flex items-center space-x-3 px-3 py-2 rounded-lg bg-secondary text-secondary-foreground transition-colors hover:bg-secondary/80">
            <Activity className="h-4 w-4" />
            <span className="font-medium">Dashboard</span>
          </Link>
          {canAudit && (
            <Link to="/audits" className="flex items-center space-x-3 px-3 py-2 rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-secondary-foreground">
              <FileText className="h-4 w-4" />
              <span className="font-medium">Auditorías</span>
            </Link>
          )}
          <Link to="/knowledge" className="flex items-center space-x-3 px-3 py-2 rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-secondary-foreground">
            <BookOpen className="h-4 w-4" />
            <span className="font-medium">Conocimiento</span>
          </Link>
          <Link to="/settings" className="flex items-center space-x-3 px-3 py-2 rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-secondary-foreground">
            <Settings className="h-4 w-4" />
            <span className="font-medium">Configuración</span>
          </Link>
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
  );
}
