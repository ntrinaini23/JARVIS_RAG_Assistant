import { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import Sidebar from './components/layout/Sidebar';
import TopHeader from './components/layout/TopHeader';
import JarvisOrb from './components/three/JarvisOrb';

// Pages
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';
import Documents from './pages/Documents';
import KnowledgeBase from './pages/KnowledgeBase';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';

export default function App() {
  const [activePage, setActivePage] = useState<string>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [enable3D, setEnable3D] = useState<boolean>(true);
  const [globalChatState, setGlobalChatState] = useState<'idle' | 'searching' | 'thinking' | 'responding' | 'error'>('idle');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Apply dark mode class to html element on theme changes
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Load preferences from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('jarvis_theme');
    if (savedTheme === 'light' || savedTheme === 'dark') {
      setTheme(savedTheme);
    }
    const saved3D = localStorage.getItem('jarvis_enable_3d');
    if (saved3D === 'false') {
      setEnable3D(false);
    }
  }, []);

  const handleSetTheme = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    localStorage.setItem('jarvis_theme', newTheme);
  };

  const handleSetEnable3D = (val: boolean) => {
    setEnable3D(val);
    localStorage.setItem('jarvis_enable_3d', val.toString());
  };

  // Page Routing switcher (Chat is now handled separately to keep state mounted)
  const renderActivePage = () => {
    switch (activePage) {
      case 'dashboard':
        return <Dashboard />;
      case 'documents':
        return <Documents />;
      case 'knowledge':
        return <KnowledgeBase enable3D={enable3D} setEnable3D={handleSetEnable3D} />;
      case 'analytics':
        return <Analytics />;
      case 'settings':
        return (
          <Settings 
            enable3D={enable3D} 
            setEnable3D={handleSetEnable3D} 
            theme={theme} 
            setTheme={handleSetTheme} 
          />
        );
      case 'chat':
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-300 relative">
      
      {/* Full-screen 3D Jarvis Neural Interface Background */}
      {enable3D && (
        <div className="absolute inset-0 z-0 pointer-events-none opacity-25 dark:opacity-15 flex items-center justify-center overflow-hidden">
          <Canvas camera={{ position: [0, 0, 15], fov: 60 }} style={{ pointerEvents: 'auto', width: '100vw', height: '100vh' }}>
            <ambientLight intensity={0.7} />
            <directionalLight position={[2, 2, 2]} intensity={1.5} />
            <JarvisOrb state={globalChatState} theme={theme} />
            <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.15} />
          </Canvas>
        </div>
      )}

      {/* Desktop Sidebar Navigation */}
      <div className="hidden md:flex h-full flex-shrink-0">
        <Sidebar 
          activePage={activePage} 
          setActivePage={setActivePage} 
          collapsed={sidebarCollapsed} 
          setCollapsed={setSidebarCollapsed} 
        />
      </div>

      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <div 
        className={`fixed inset-y-0 left-0 z-50 transform ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } transition-transform duration-300 ease-in-out md:hidden flex h-full flex-shrink-0`}
      >
        <Sidebar 
          activePage={activePage} 
          setActivePage={(page) => {
            setActivePage(page);
            setMobileMenuOpen(false);
          }} 
          collapsed={false} 
          setCollapsed={() => {}} 
        />
      </div>

      {/* Main Workspace Column */}
      <div className="flex flex-col flex-grow h-screen overflow-hidden relative z-10 w-full">
        
        {/* Top Header systems check */}
        <TopHeader 
          activePage={activePage} 
          theme={theme} 
          setTheme={handleSetTheme} 
          onMenuClick={() => setMobileMenuOpen(true)}
        />

        {/* Scrollable Page Space */}
        <main className="flex-grow overflow-y-auto p-4 md:p-8 relative">
          {/* Keep Chat mounted to preserve active SSE streaming and state */}
          <div className={activePage === 'chat' ? 'block' : 'hidden'}>
            <Chat 
              chatState={globalChatState} 
              setChatState={setGlobalChatState} 
              isActive={activePage === 'chat'}
            />
          </div>
          {renderActivePage()}
        </main>
      </div>

    </div>
  );
}
