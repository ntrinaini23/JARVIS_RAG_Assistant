import { Sun, Moon, Database, Cpu } from 'lucide-react';
import { useEffect, useState } from 'react';

interface TopHeaderProps {
  activePage: string;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

interface HealthStatus {
  sqlite: string;
  chroma: string;
  ollama: {
    status: string;
    error: string | null;
  };
}

export default function TopHeader({ activePage, theme, setTheme }: TopHeaderProps) {
  const [health, setHealth] = useState<HealthStatus | null>(null);

  // Poll API health endpoint every 10 seconds
  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/health');
        if (res.ok) {
          const data = await res.json();
          setHealth(data);
        }
      } catch (err) {
        setHealth({
          sqlite: 'offline',
          chroma: 'offline',
          ollama: { status: 'offline', error: 'Connection failed' }
        });
      }
    };
    
    fetchHealth();
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  const pageTitles: Record<string, string> = {
    dashboard: 'Workspace Dashboard',
    chat: 'JARVIS AI Assistant',
    documents: 'Document Center',
    knowledge: 'Knowledge pipeline',
    analytics: 'Analytics & Logs',
    settings: 'System Configuration'
  };

  return (
    <header className="h-20 border-b border-slate-200/20 dark:border-slate-800/20 glass-panel flex items-center justify-between px-8 relative z-20">
      {/* Title */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
          {pageTitles[activePage] || 'JARVIS'}
        </h1>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Your Documents. Your Knowledge. Your AI.
        </p>
      </div>

      {/* Systems Status Bar and Theme Switcher */}
      <div className="flex items-center gap-6">
        {/* Connection Status badges */}
        <div className="hidden md:flex items-center gap-4 text-xs font-medium bg-slate-200/10 dark:bg-slate-900/40 px-4 py-2 rounded-xl border border-slate-200/10">
          {/* SQLite DB Badge */}
          <div className="flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-500 dark:text-slate-400">MetaDB:</span>
            <span className={`w-2 h-2 rounded-full ${health?.sqlite === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
          </div>

          <div className="w-px h-3 bg-slate-200/20 dark:bg-slate-700/20" />

          {/* ChromaDB Badge */}
          <div className="flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-500 dark:text-slate-400">VectorDB:</span>
            <span className={`w-2 h-2 rounded-full ${health?.chroma === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
          </div>

          <div className="w-px h-3 bg-slate-200/20 dark:bg-slate-700/20" />

          {/* Ollama LLM Badge */}
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-slate-500 dark:text-slate-400">Ollama:</span>
            <span className={`w-2 h-2 rounded-full ${health?.ollama?.status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
          </div>
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="w-10 h-10 rounded-xl glass-panel border hover:border-cyan-400 flex items-center justify-center text-slate-500 hover:text-cyan-400 dark:text-slate-400 dark:hover:text-cyan-400 transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        {/* Profile Circle */}
        <div className="flex items-center gap-3 border-l border-slate-200/20 dark:border-slate-800/20 pl-6">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center font-bold text-white text-sm shadow-glass">
            JD
          </div>
          <div className="hidden xl:block text-left">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">John Doe</p>
            <p className="text-[10px] text-slate-400">RAG Administrator</p>
          </div>
        </div>
      </div>
    </header>
  );
}
