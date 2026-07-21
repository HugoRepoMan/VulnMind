import { Bell, Search, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function Navbar() {
  return (
    <header className="h-16 border-b bg-card flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center flex-1">
        <Button variant="ghost" size="icon" className="md:hidden mr-2">
          <Menu className="h-5 w-5" />
        </Button>
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
        <Button variant="outline" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive"></span>
        </Button>
      </div>
    </header>
  );
}
