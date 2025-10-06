import { Mic, Library } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

export const BottomNav = () => {
  const location = useLocation();
  
  const isActive = (path: string) => location.pathname === path;
  
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 safe-area-pb">
      <div className="max-w-4xl mx-auto px-4 py-3 flex justify-around items-center">
        <Link
          to="/"
          className={`flex flex-col items-center gap-1 px-6 py-2 rounded-lg transition-colors ${
            isActive("/")
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
          }`}
        >
          <Mic className="w-5 h-5" />
          <span className="text-xs font-medium">Spela in</span>
        </Link>
        
        <Link
          to="/library"
          className={`flex flex-col items-center gap-1 px-6 py-2 rounded-lg transition-colors ${
            isActive("/library")
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
          }`}
        >
          <Library className="w-5 h-5" />
          <span className="text-xs font-medium">Bibliotek</span>
        </Link>
      </div>
    </nav>
  );
};
