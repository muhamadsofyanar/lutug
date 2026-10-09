import React, { useState, useEffect, Suspense, lazy } from 'react'
import Sidebar from './components/Sidebar'
import BottomNav from './components/BottomNav'
import UserProfile from './components/UserProfile'
import { ToastProvider, useToast } from './contexts/ToastContext'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import { apiGet, apiPost, API_BASE } from './services/api'

// Lazy Load Components
const Inbox = lazy(() => import('./components/Inbox'));
const Today = lazy(() => import('./components/Today'));
const Projects = lazy(() => import('./components/Projects'));
const NextActions = lazy(() => import('./components/NextActions'));
const NightReview = lazy(() => import('./components/NightReview'));
const References = lazy(() => import('./components/References'));
const People = lazy(() => import('./components/People'));
const DailyUpdate = lazy(() => import('./components/DailyUpdate'));
const WeeklyDirection = lazy(() => import('./components/WeeklyDirection'));
const ActivityFeed = lazy(() => import('./components/ActivityFeed'));
const Login = lazy(() => import('./components/Login'));
const AdminPanel = lazy(() => import('./components/AdminPanel'));
const ReportExport = lazy(() => import('./components/ReportExport'));
const CommandCenter = lazy(() => import('./components/CommandCenter'));
const CommandPalette = lazy(() => import('./components/CommandPalette'));
const Help = lazy(() => import('./components/Help'));

// Loading Spinner Component
const PageLoader = () => (
  <div className="flex items-center justify-center h-full w-full min-h-[50vh]">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
  </div>
);

function AppContent() {
  const [currentView, setView] = useState('today');
  const [viewParams, setViewParams] = useState({});
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const { addToast } = useToast();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    checkAuth();
    
    // Handle Deep Linking
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    if (view) {
      setView(view);
      const paramsObj = {};
      for (const [key, value] of params.entries()) {
        if (key !== 'view') paramsObj[key] = value;
      }
      setViewParams(paramsObj);
    }
  }, []);

  const handleSetView = (view, params = {}) => {
    setView(view);
    setViewParams(params);
    setIsSidebarOpen(false); // Close sidebar on mobile when view changes
    
    const urlParams = new URLSearchParams();
    urlParams.set('view', view);
    Object.entries(params).forEach(([key, value]) => {
      urlParams.set(key, value);
    });
    const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
  };

  // Global Command Palette Shortcut (Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const checkAuth = async () => {
    try {
      const result = await apiGet(`${API_BASE}?action=auth_me`);
      if (result.ok) {
        setUser(result.data.user);
      } else {
        setUser(null);
      }
    } catch (e) {
      setUser(null);
    } finally {
      setLoadingAuth(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiPost(`${API_BASE}?action=auth_logout`);
      setUser(null);
      addToast("Berhasil keluar", "success");
    } catch (e) {
      addToast("Gagal keluar", "error");
    }
  };

  const renderContent = () => {
    return (
      <Suspense fallback={<PageLoader />}>
        {(() => {
          switch(currentView) {
            case 'dashboard': return <CommandCenter setView={handleSetView} />;
            case 'inbox': return <Inbox viewParams={viewParams} />;
            case 'today': return <Today viewParams={viewParams} />;
            case 'projects': return <Projects viewParams={viewParams} />;
            case 'next_actions': return <NextActions viewParams={viewParams} />;
            case 'night_review': return <NightReview />;
            case 'references': return <References viewParams={viewParams} />;
            case 'people': return <People user={user} />;
            case 'daily_update': return <DailyUpdate viewParams={viewParams} />;
            case 'weekly_direction': return <WeeklyDirection addToast={addToast} viewParams={viewParams} />;
            case 'activity': return <ActivityFeed />;
            case 'reports': return <ReportExport />;
            case 'help': return <Help />;
            case 'admin_panel': return <AdminPanel user={user} />;
            default: return <CommandCenter setView={handleSetView} />;
          }
        })()}
      </Suspense>
    );
  };

  if (loadingAuth) {
    return (
      <div className="flex justify-center items-center h-screen bg-slate-50 dark:bg-slate-900 text-teal-600 dark:text-teal-400">
        <div className="flex flex-col items-center gap-6 relative">
          <div className="relative z-10 w-12 h-12 border-4 border-slate-200 dark:border-slate-800 border-t-teal-500 rounded-full animate-spin"></div>
          <div className="flex flex-col items-center">
            <p className="font-bold text-lg text-slate-700 dark:text-slate-200">Memuat Aplikasi</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Menghubungkan...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="bg-slate-50 dark:bg-slate-900 min-h-screen">
        <Login onLoginSuccess={setUser} />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden font-sans text-slate-900 dark:text-slate-100 relative">
      
      {/* Desktop Sidebar */}
      <Sidebar 
        currentView={currentView} 
        setView={handleSetView} 
        onSearch={() => setShowCommandPalette(true)} 
        onLogout={handleLogout}
        onOpenProfile={() => setShowProfile(true)}
        user={user}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      
      {/* Mobile Bottom Navigation */}
      <BottomNav 
        currentView={currentView} 
        setView={handleSetView} 
        onToggleSidebar={() => setIsSidebarOpen(true)}
        onSearch={() => setShowCommandPalette(true)}
      />

      {showProfile && user && (
        <UserProfile user={user} onClose={() => setShowProfile(false)} />
      )}

      <main className="flex-1 overflow-y-auto w-full relative custom-scrollbar pb-24 md:pb-0">
        {/* Mobile Header */}
        <header className="md:hidden sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 p-4 flex justify-between items-center z-40 shadow-sm">
           <div className="flex items-center gap-3">
               <button onClick={() => setIsSidebarOpen(true)} className="text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors">
                   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                       <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                   </svg>
               </button>
               <button onClick={() => handleSetView('dashboard')} className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2 hover:opacity-80 transition-opacity">
                 <img src="/assets/logo-insyarah.png" alt="Logo" className="w-8 h-8 object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
                 <span className="text-teal-600 dark:text-teal-400">InsyaRah</span>
               </button>
           </div>
           <div className="flex gap-3 items-center">
             <button onClick={() => handleSetView('dashboard')} className="text-lg p-1 text-slate-500 hover:text-teal-600 transition-colors" title="Command Center">🌐</button>
             <button onClick={() => setShowProfile(true)} className="text-lg p-1 text-slate-500 hover:text-teal-600 transition-colors" title="Profil Saya">👤</button>
             <button onClick={toggleTheme} className="text-lg p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500 hover:text-teal-600">
               {theme === 'dark' ? '☀️' : '🌙'}
             </button>
             <button onClick={() => handleSetView('activity')} className="text-lg p-1 text-emerald-600 hover:text-emerald-500 transition-colors">⚡</button>
             <button onClick={handleLogout} className="text-lg text-red-500/70 hover:text-red-600 p-1 transition-colors">🚪</button>
           </div>
        </header>
        
        <div className="pb-20 md:pb-0 h-full">
            {renderContent()}
        </div>
      </main>

      <CommandPalette 
        isOpen={showCommandPalette} 
        onClose={() => setShowCommandPalette(false)}
        setView={handleSetView}
        toggleTheme={toggleTheme}
        onLogout={handleLogout}
      />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </ThemeProvider>
  )
}

export default App
