import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet, API_BASE } from '../services/api';

export default function ActivityFeed() {
  const [businessUnits, setBusinessUnits] = useState([]);
  const [selectedUnit, setSelectedUnit] = useState(null);

  useEffect(() => {
    loadBusinessUnits();
  }, []);

  const loadBusinessUnits = async () => {
    const result = await apiGet(`${API_BASE}?action=business_units`);
    if (result.ok) {
        setBusinessUnits(result.data.units || []);
    }
  };

  const { data: events, isLoading, error } = useQuery({
    queryKey: ['activity_list', selectedUnit],
    queryFn: async () => {
      const url = selectedUnit 
        ? `${API_BASE}?action=activity_list&business_unit=${encodeURIComponent(selectedUnit)}`
        : `${API_BASE}?action=activity_list`;
      const result = await apiGet(url);
      if (!result.ok) throw new Error(result.error || 'Gagal memuat aktivitas');
      return result.data.events;
    },
    refetchInterval: 30000, // Auto-refresh every 30s
  });

  if (isLoading) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-emerald-600 dark:text-emerald-400 animate-in fade-in duration-500">
            <div className="relative w-12 h-12 mb-4">
                <div className="absolute inset-0 border-t-2 border-emerald-500 rounded-full animate-spin"></div>
            </div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Memuat aktivitas...</p>
        </div>
    );
  }

  if (error) {
    return (
        <div className="p-8 text-center bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-xl m-8 border border-red-200 dark:border-red-500/30 shadow-sm animate-in zoom-in-95">
            <div className="text-4xl mb-4">⚠️</div>
            <p className="font-bold text-sm mb-2">Gagal Memuat Data</p>
            <p className="text-xs opacity-70">{error.message}</p>
        </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="p-12 text-center bg-white/50 dark:bg-slate-900/40 backdrop-blur-md rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 m-8 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-700 relative overflow-hidden group">
        <div className="text-6xl mb-6 opacity-20 grayscale">📠</div>
        <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300 mb-2">Belum ada aktivitas</h3>
        <p className="text-slate-500 max-w-sm mx-auto leading-relaxed text-sm">
            Tidak ada aktivitas terbaru yang tercatat. Mulai kerjakan tugas atau proyek untuk melihat riwayat di sini.
        </p>
      </div>
    );
  }

  // Group events by date
  const groupedEvents = (events || []).reduce((acc, event) => {
    // Handle ISO string or YYYY-MM-DD HH:mm:ss format
    let dateStr = event.created_at;
    if (dateStr && dateStr.includes('T')) {
        dateStr = dateStr.split('T')[0];
    } else if (dateStr) {
        dateStr = dateStr.split(' ')[0];
    }
    
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(event);
    return acc;
  }, {});

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'HARI INI';
    if (date.toDateString() === yesterday.toDateString()) return 'KEMARIN';
    
    return new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: '2-digit', month: 'short' }).format(date).toUpperCase();
  };

  const formatTime = (dateStr) => {
    return new Date(dateStr).toLocaleTimeString('id-ID', { hour12: false, hour: '2-digit', minute: '2-digit' });
  };

  const getEventStyle = (type) => {
    if (type.includes('create')) return { icon: '+', color: 'text-teal-400', border: 'border-teal-500/30', bg: 'bg-teal-950/20' };
    if (type.includes('complete') || type.includes('done')) return { icon: '✓', color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-950/20' };
    if (type.includes('delete') || type.includes('trash')) return { icon: '×', color: 'text-red-400', border: 'border-red-500/30', bg: 'bg-red-950/20' };
    if (type.includes('update')) return { icon: '∆', color: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-950/20' };
    return { icon: '?', color: 'text-slate-400', border: 'border-slate-500/30', bg: 'bg-slate-950/20' };
  };

  // Generate consistent color for avatar based on username
  const getAvatarColor = (name) => {
      const colors = ['text-slate-400', 'text-teal-400', 'text-emerald-400', 'text-teal-500', 'text-emerald-500', 'text-slate-500'];
      let hash = 0;
      for (let i = 0; i < name.length; i++) {
          hash = name.charCodeAt(i) + ((hash << 5) - hash);
      }
      return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="p-6 md:p-8 pb-24 max-w-5xl mx-auto animate-in fade-in duration-500">
      <div className="mb-10 relative flex justify-between items-start">
        <div>
            <h2 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">
                Aktivitas Terkini
            </h2>
            <div className="flex items-center gap-2 mt-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                <p className="text-slate-500 dark:text-slate-400 text-sm">Real-time update</p>
            </div>
        </div>

        <select 
            className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-emerald-500/30 rounded-lg px-4 py-2.5 text-sm text-slate-700 dark:text-emerald-300 focus:outline-none focus:border-emerald-500 shadow-sm z-10"
            value={selectedUnit || ''}
            onChange={(e) => setSelectedUnit(e.target.value || null)}
        >
            <option value="">Semua Unit</option>
            {businessUnits.map(u => (
                <option key={u.id} value={u.name}>{u.name}</option>
            ))}
        </select>
      </div>

      <div className="relative pl-6">
        {/* Timeline Line */}
        <div className="absolute left-3 top-0 bottom-0 w-px bg-slate-200 dark:bg-slate-800"></div>

        {Object.keys(groupedEvents).map((date, dateIdx) => (
          <div key={date} className="mb-12 relative z-10 animate-in slide-in-from-bottom-4 duration-700 fill-mode-backwards" style={{ animationDelay: `${dateIdx * 100}ms` }}>
            <div className="flex items-center gap-4 mb-6">
                <div className="w-6 h-6 rounded-full bg-white dark:bg-slate-900 border border-emerald-500/50 flex items-center justify-center relative z-20 shadow-sm">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                </div>
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-500/70 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-500/20">
                    {formatDate(date)}
                </span>
            </div>
            
            <div className="space-y-4 pl-8 border-l border-transparent ml-3">
              {groupedEvents[date].map((event, idx) => {
                  const style = getEventStyle(event.event_type);
                  // Adjust colors for light mode
                  const lightBg = style.bg.replace('950/20', '50');
                  const lightBorder = style.border.replace('/30', '/20').replace('500', '200');
                  
                  return (
                    <div key={event.id} className="group relative">
                      <div className={`relative bg-white dark:bg-slate-900/40 backdrop-blur-sm p-4 rounded-xl border ${lightBorder} dark:${style.border.replace('/30', '')} shadow-sm hover:shadow-md transition-all duration-300`}>
                        
                        <div className="flex justify-between items-start mb-2 relative z-10">
                            <div className="flex items-center gap-3 flex-wrap">
                                <span className={`text-lg font-bold ${style.color}`}>{style.icon}</span>
                                <span className={`text-sm font-semibold ${style.color.replace('400', '600').replace('text-', 'text-slate-700 dark:text-')}`}>
                                    {(() => {
                                        const type = event.event_type;
                                        if (type.includes('create')) return 'Dibuat';
                                        if (type.includes('complete')) return 'Diselesaikan';
                                        if (type.includes('delete')) return 'Dihapus';
                                        if (type.includes('update')) return 'Diperbarui';
                                        return type.replace(/_/g, ' ');
                                    })()}
                                </span>
                                {event.business_unit && (
                                    <span className="px-2 py-0.5 rounded border border-slate-200 dark:border-teal-500/30 bg-slate-50 dark:bg-teal-950/30 text-xs text-slate-600 dark:text-teal-400">
                                        {event.business_unit}
                                    </span>
                                )}
                            </div>
                            <span className="text-xs text-slate-400">
                                {formatTime(event.created_at)}
                            </span>
                        </div>
                        
                        <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-3">
                            {event.description}
                        </p>

                        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
                            <span className="text-xs text-slate-400">Oleh:</span>
                            <span className={`text-xs font-medium ${getAvatarColor(event.actor)}`}>
                                {event.actor}
                            </span>
                        </div>
                      </div>
                    </div>
                  );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
