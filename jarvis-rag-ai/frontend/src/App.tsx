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

  // Page Routing switcher
  const renderActivePage = () => {
    switch (activePage) {
      case 'dashboard':
        return <Dashboard />;
      case 'chat':
        return (
          <Chat 
            chatState={globalChatState} 
            setChatState={setGlobalChatState} 
          />
        );
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
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-300 relative">
      
      {/* Full-screen 3D Jarvis Neural Interface Background */}
      {enable3D && (
        <div className="absolute inset-0 z-0 pointer-events-none opacity-25 dark:opacity-15 flex items-center justify-center overflow-hidden">
          <Canvas camera={{ position: [0, 0, 3.8], fov: 60 }} style={{ pointerEvents: 'auto', width: '100vw', height: '100vh' }}>
            <ambientLight intensity={0.7} />
            <directionalLight position={[2, 2, 2]} intensity={1.5} />
            <JarvisOrb state={globalChatState} theme={theme} />
            <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.15} />
          </Canvas>
        </div>
      )}

      {/* Sidebar Navigation */}
      <Sidebar 
        activePage={activePage} 
        setActivePage={setActivePage} 
        collapsed={sidebarCollapsed} 
        setCollapsed={setSidebarCollapsed} 
      />

      {/* Main Workspace Column */}
      <div className="flex flex-col flex-grow h-screen overflow-hidden relative z-10">
        
        {/* Top Header systems check */}
        <TopHeader 
          activePage={activePage} 
          theme={theme} 
          setTheme={handleSetTheme} 
        />

        {/* Scrollable Page Space */}
        <main className="flex-grow overflow-y-auto p-8 relative">
          {renderActivePage()}
        </main>
      </div>

    </div>
  );
}
