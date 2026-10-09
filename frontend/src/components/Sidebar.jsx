import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet, API_BASE } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

export default function Sidebar({ currentView, setView, onSearch, onLogout, onOpenProfile, user, isOpen, onClose }) {
  const { theme, toggleTheme } = useTheme();
  
  const { data: stats } = useQuery({
    queryKey: ['dashboard_stats'],
    queryFn: async () => {
      const result = await apiGet(`${API_BASE}?action=dashboard_stats`);
      if (result.ok) return result.data.stats;
      return null;
    },
    refetchInterval: 30000, // Refresh every 30 seconds automatically
  });

  const getCount = (id) => {
    if (!stats) return null;
    switch(id) {
      case 'inbox': return stats.inbox;
      case 'today': return stats.today;
      case 'next_actions': return stats.next_actions;
      case 'projects': return stats.projects;
      case 'references': return stats.references;
      default: return null;
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Beranda', icon: '🌐' },
    { id: 'inbox', label: 'Kotak Masuk', icon: '📥' },
    { id: 'today', label: 'Hari Ini', icon: '📅' },
    { id: 'next_actions', label: 'Rencana Taktis', icon: '🔜' },
    { id: 'projects', label: 'Proyek', icon: '🏗️' },
    { id: 'references', label: 'Referensi', icon: '🗂️' },
    { id: 'people', label: 'Tim & Personel', icon: '👥' },
    { id: 'daily_update', label: 'Jurnal Harian', icon: '📝' },
    { id: 'weekly_direction', label: 'Strategi', icon: '🎯' },
    { id: 'activity', label: 'Riwayat Aktivitas', icon: '⚡' },
    { id: 'reports', label: 'Export Laporan', icon: '📄' },
    { id: 'night_review', label: 'Evaluasi Malam', icon: '🌙' },
    { id: 'profile', label: 'Profil Saya', icon: '👤' },
    { id: 'help', label: 'Bantuan', icon: '❓' },
  ];

  if (user && user.role === 'admin') {
      navItems.push({ id: 'admin_panel', label: 'Panel Admin', icon: '🛡️' });
  }

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] md:hidden transition-opacity animate-in fade-in duration-200"
          onClick={onClose}
        ></div>
      )}

      <nav className={`
        fixed inset-y-0 left-0 z-[70] w-72 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-2xl border-r border-gray-200 dark:border-slate-800 h-screen flex flex-col p-4 transition-transform duration-300 ease-out
        md:sticky md:top-0 md:translate-x-0 md:bg-slate-50/80 md:dark:bg-slate-950/80 md:w-64 md:z-auto md:backdrop-blur-none
        ${isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full shadow-none'}
      `}>
        {/* Decorative side glow - Softened */}
        <div className="absolute left-0 top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-teal-500 to-transparent opacity-30"></div>

        {/* Mobile Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white md:hidden"
        >
          ✕
        </button>

        <div className="mb-8 px-2 mt-8 md:mt-0">
          <div className="flex items-center gap-3">
             <img src="/assets/logo-insyarah.png" alt="Logo" className="w-10 h-10 object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
             <div className="font-black text-2xl text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-emerald-700 dark:from-teal-400 dark:to-emerald-500 tracking-tight">
               InsyaRah
             </div>
          </div>
        {user && (
          <div 
            onClick={onOpenProfile}
            className="flex items-center gap-3 mt-4 px-3 py-2 bg-white/50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-teal-900/30 hover:border-teal-500/50 transition-colors group cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-400 to-emerald-600 flex items-center justify-center text-xs text-white font-bold shadow-sm group-hover:shadow-md transition-all">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{user.full_name || user.username}</div>
                <div className="text-[10px] text-teal-600 dark:text-teal-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                    Online
                </div>
            </div>
          </div>
        )}
      </div>

      {/* Profile Modal Removed from here, moved to App.jsx */}

      <button 
        className="w-full flex items-center gap-3 px-3 py-3 mb-6 text-sm font-medium text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-white dark:hover:bg-slate-800 hover:text-teal-600 dark:hover:text-teal-400 hover:border-teal-500/30 transition-all shadow-sm hover:shadow-md group" 
        onClick={onSearch}
      >
        <span className="group-hover:scale-110 transition-transform text-teal-500">🔍</span>
        <span>Pencarian Global...</span>
      </button>

      <div className="flex-1 space-y-1 overflow-y-auto pr-1 custom-scrollbar">
        {navItems.map((item) => {
          const count = getCount(item.id);
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => item.id === 'profile' ? onOpenProfile() : setView(item.id)}
              className={`w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm font-medium transition-all duration-300 group relative overflow-hidden ${
                isActive 
                  ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 shadow-sm' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {isActive && (
                <>
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-teal-500 rounded-r-full" />
                </>
              )}
              <div className="flex items-center gap-3 relative z-10">
                <span className={`text-lg transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                    {item.icon}
                </span>
                <span className={`${isActive ? 'font-bold' : ''}`}>
                    {item.label}
                </span>
              </div>
              {count !== null && count > 0 && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded transition-all ${
                    isActive 
                    ? 'bg-teal-500 text-white' 
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 group-hover:bg-slate-300 dark:group-hover:bg-slate-700'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-auto pt-4 border-t border-gray-200 dark:border-slate-800 space-y-2">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all hover:shadow-sm"
        >
          <span className="transform transition-transform hover:rotate-180 duration-500 text-teal-500">{theme === 'dark' ? '☀️' : '🌙'}</span>
          <span>{theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}</span>
        </button>

        {onLogout && (
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <span>🚪</span>
            <span>Keluar Aplikasi</span>
          </button>
        )}
      </div>
    </nav>
    </>
  );
}
