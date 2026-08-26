import { 
  LayoutDashboard, 
  MessageSquare, 
  FileText, 
  BrainCircuit, 
  BarChart3, 
  Settings as SettingsIcon, 
  ChevronLeft, 
  ChevronRight,
  Terminal
} from 'lucide-react';

interface SidebarProps {
  activePage: string;
  setActivePage: (page: string) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

export default function Sidebar({ activePage, setActivePage, collapsed, setCollapsed }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'chat', label: 'Ask JARVIS', icon: MessageSquare },
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'knowledge', label: 'Knowledge Base', icon: BrainCircuit },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <aside 
      className={`glass-panel border-r flex flex-col justify-between transition-all duration-300 ease-in-out relative z-30 h-screen
        ${collapsed ? 'w-20' : 'w-64'}`}
    >
      {/* Brand Header */}
      <div>
        <div className="h-20 flex items-center justify-between px-6 border-b border-slate-200/20 dark:border-slate-800/20">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-cyan-500 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-neon-cyan animate-pulse">
              <Terminal className="w-5 h-5 text-white" />
            </div>
            {!collapsed && (
              <span className="font-extrabold text-xl tracking-wider bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
                JARVIS
              </span>
            )}
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-200 group relative
                  ${isActive 
                    ? 'bg-gradient-to-r from-cyan-500/15 to-violet-500/10 border-l-4 border-cyan-400 text-cyan-400 font-semibold' 
                    : 'text-slate-500 hover:text-cyan-400 hover:bg-slate-200/10 dark:text-slate-400'
                  }`}
              >
                <Icon className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 
                  ${isActive ? 'text-cyan-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-cyan-400'}`} 
                />
                
                {!collapsed && <span className="text-sm">{item.label}</span>}
                
                {/* Collapsed Tooltip */}
                {collapsed && (
                  <div className="absolute left-24 bg-slate-950 text-slate-100 text-xs py-1.5 px-3 rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 shadow-glass border border-slate-800 whitespace-nowrap z-50">
                    {item.label}
                  </div>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Collapse Toggle Trigger */}
      <div className="p-4 border-t border-slate-200/20 dark:border-slate-800/20">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center py-2.5 rounded-xl hover:bg-slate-200/10 text-slate-400 hover:text-cyan-400 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : (
            <div className="flex items-center gap-2">
              <ChevronLeft className="w-5 h-5" />
              <span className="text-xs font-medium">Collapse Sidebar</span>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}
