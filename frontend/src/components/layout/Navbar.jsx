import { Bell, Search, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppStore } from '@/store';

export default function Navbar() {
  const navigate = useNavigate();
  const user = useAppStore((state) => state.user);
  const logout = useAppStore((state) => state.logout);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="h-16 border-b bg-card flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center flex-1">
        <div className="relative w-full max-w-md hidden md:flex items-center">
          <Search className="absolute left-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            type="search" 
            placeholder="Buscar vulnerabilidades (CVE, CWE, Tácticas MITRE)..." 
            className="w-full pl-9 bg-muted/50 border-none focus-visible:ring-1"
          />
        </div>
      </div>
      
      <div className="flex items-center space-x-4">
        <span className="hidden text-sm text-muted-foreground lg:inline">
          {user?.email} · {user?.role}
        </span>
        <Button variant="outline" size="icon" className="relative" aria-label="Configurar notificaciones" onClick={() => navigate('/settings')}>
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive"></span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Cerrar sesión"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
