import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet, API_BASE } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import TacticalCharts from './TacticalCharts';
import FocusStatsWidget from './widgets/FocusStatsWidget';
import Skeleton from './common/Skeleton';

export default function CommandCenter({ setView }) {
    const { theme } = useTheme();
    const [currentTime, setCurrentTime] = useState(new Date());

    // Update clock
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Fetch Stats
    const { data: stats, isLoading } = useQuery({
        queryKey: ['dashboard_stats'],
        queryFn: async () => {
            const result = await apiGet(`${API_BASE}?action=dashboard_stats`);
            if (result.ok) return result.data.stats;
            return null;
        },
        refetchInterval: 15000,
    });

    const formatTime = (date) => {
        return date.toLocaleTimeString('id-ID', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    const formatDate = (date) => {
        return date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    };

    const zombieCount = stats?.zombies || 0;
    const projectColor = zombieCount > 0 ? 'rose' : 'teal';
    const projectIcon = zombieCount > 0 ? '⚠️' : '🏗️';
    const projectLabel = zombieCount > 0 ? 'PERLU PERHATIAN' : 'PROYEK';

    const modules = [
        { id: 'inbox', label: 'INBOX', icon: '📥', count: stats?.inbox || 0, color: 'teal', subCount: 0 },
        { id: 'today', label: 'HARI INI', icon: '🗓️', count: stats?.today || 0, color: 'emerald', subCount: 0 },
        { id: 'projects', label: projectLabel, icon: projectIcon, count: stats?.projects || 0, color: projectColor, subCount: zombieCount },
        { id: 'weekly_direction', label: 'STRATEGI', icon: '🎯', count: stats?.weekly_set > 0 ? 'AKTIF' : 'BUKA', color: 'emerald', subCount: 0 },
        { id: 'references', label: 'REFERENSI', icon: '📚', count: stats?.references || 0, color: 'slate', subCount: 0 },
    ];

    const getEnergyStyles = (advice) => {
        if (!advice) return {
            container: 'from-slate-900/40 to-slate-900/40 border-slate-500/20',
            blob: 'bg-slate-500/20',
            icon: 'text-slate-400',
            title: 'text-slate-300',
            button: 'bg-slate-500/20 hover:bg-slate-500/30 border-slate-500/30 text-slate-200 hover:shadow-[0_0_20px_rgba(100,116,139,0.3)]'
        };

        const colors = {
            emerald: {
                container: 'from-emerald-900/40 to-slate-900/40 border-emerald-500/20',
                blob: 'bg-emerald-500/20',
                icon: 'text-emerald-400',
                title: 'text-emerald-300',
                badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
                button: 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/30 text-emerald-200 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]'
            },
            yellow: {
                container: 'from-yellow-900/40 to-slate-900/40 border-yellow-500/20',
                blob: 'bg-yellow-500/20',
                icon: 'text-yellow-400',
                title: 'text-yellow-300',
                badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
                button: 'bg-yellow-500/20 hover:bg-yellow-500/30 border-yellow-500/30 text-yellow-200 hover:shadow-[0_0_20px_rgba(234,179,8,0.3)]'
            },
            red: {
                container: 'from-red-900/40 to-slate-900/40 border-red-500/20',
                blob: 'bg-red-500/20',
                icon: 'text-red-400',
                title: 'text-red-300',
                badge: 'bg-red-500/20 text-red-300 border-red-500/30',
                button: 'bg-red-500/20 hover:bg-red-500/30 border-red-500/30 text-red-200 hover:shadow-[0_0_20px_rgba(239,68,68,0.3)]'
            },
            slate: {
                container: 'from-slate-800/40 to-slate-900/40 border-slate-600/20',
                blob: 'bg-slate-500/20',
                icon: 'text-slate-400',
                title: 'text-slate-300',
                badge: 'bg-slate-700/50 text-slate-300 border-slate-600',
                button: 'bg-slate-700/30 hover:bg-slate-700/50 border-slate-600 text-slate-300'
            }
        };

        return colors[advice.color] || colors.slate;
    };

    const energyStyle = getEnergyStyles(stats?.energy_advice);

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto h-full overflow-y-auto custom-scrollbar animate-in fade-in duration-700">
            {/* Header HUD */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 relative">
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span className="text-xs font-medium text-slate-500">Status Aplikasi</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                        Beranda
                    </h1>
                </div>
                
                <div className="mt-6 md:mt-0 flex flex-col items-end">
                    <div className="text-3xl md:text-5xl font-bold text-slate-700 dark:text-slate-300 tabular-nums tracking-tight">
                        {formatTime(currentTime)}
                    </div>
                    <div className="text-xs font-medium text-slate-400 border-t border-slate-200 dark:border-slate-700 pt-1 mt-1 w-full text-right">
                        {formatDate(currentTime)}
                    </div>
                </div>
            </div>

            {/* Bio-Feedback Stats (Focus) */}
            {isLoading ? (
                <Skeleton className="h-32 w-full mb-6 rounded-2xl" />
            ) : (
                <FocusStatsWidget focusStats={stats?.focus_stats} />
            )}

            {/* Main Dashboard Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-10">
                {isLoading ? (
                    // Skeleton Loading State for Modules
                    [1, 2, 3, 4].map((i) => (
                        <div key={i} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 h-[140px] flex flex-col justify-between">
                            <Skeleton className="h-8 w-8 mb-4 rounded-lg" />
                            <div>
                                <Skeleton className="h-8 w-16 mb-2 rounded-lg" />
                                <Skeleton className="h-3 w-24 rounded-lg" />
                            </div>
                        </div>
                    ))
                ) : (
                    modules.map((module, idx) => (
                        <button
                            key={module.id}
                            onClick={() => setView(module.id)}
                            className="group relative bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-teal-300 dark:hover:border-teal-700 transition-all duration-300 hover:shadow-sm hover:translate-y-[-2px] overflow-hidden text-left"
                            style={{ animationDelay: `${idx * 100}ms` }}
                        >
                            
                            <div className="relative z-10 flex flex-col h-full justify-between">
                                <div className="flex justify-between items-start mb-4">
                                    <span className="text-3xl text-slate-400 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors duration-300">{module.icon}</span>
                                </div>
                                
                                <div>
                                    <div className="text-3xl font-bold text-slate-800 dark:text-white mb-1 tabular-nums flex items-baseline gap-2">
                                        {module.count}
                                        {module.subCount > 0 && (
                                            <span className="text-sm text-red-500 font-bold">
                                                ({module.subCount}!)
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400 group-hover:text-teal-600 dark:group-hover:text-teal-400">
                                        {module.label}
                                    </div>
                                </div>
                            </div>
                        </button>
                    ))
                )}
            </div>

            {/* Tactical Analytics */}
            {isLoading ? (
                <Skeleton className="h-96 w-full mb-10 rounded-2xl" />
            ) : stats && (
                <div className="mb-10">
                    <TacticalCharts 
                        velocity={Array.isArray(stats.velocity) ? stats.velocity : []} 
                        distribution={Array.isArray(stats.distribution?.projects) ? stats.distribution.projects : []}
                        projectDistribution={Array.isArray(stats.distribution?.projects) ? stats.distribution.projects : []}
                        taskDistribution={Array.isArray(stats.distribution?.tasks) ? stats.distribution.tasks : []}
                        inboxDistribution={Array.isArray(stats.distribution?.inbox) ? stats.distribution.inbox : []}
                        energy={Array.isArray(stats.energy_trend) ? stats.energy_trend : []}
                        radarPoints={Array.isArray(stats.radar_points) ? stats.radar_points : []}
                        unitSummary={stats.unit_summary || {}}
                    />
                </div>
            )}

            {/* Quick Actions & System Status */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Operational Units Status */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
                    {isLoading ? (
                        <div className="space-y-4">
                            <Skeleton className="h-6 w-32 mb-6" />
                            {[1,2,3].map(i => (
                                <div key={i} className="flex justify-between items-center gap-4">
                                    <div className="flex-1 space-y-2">
                                        <Skeleton className="h-4 w-24" />
                                        <Skeleton className="h-2 w-full" />
                                    </div>
                                    <div className="flex gap-4">
                                        <Skeleton className="h-8 w-8" />
                                        <Skeleton className="h-8 w-8" />
                                        <Skeleton className="h-8 w-8" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="h-full relative overflow-hidden">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-6 flex items-center gap-2">
                            <span className="text-teal-500">🏢</span> Unit Bisnis
                        </h3>
                        
                        <div className="space-y-4 mb-6 max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
                            {stats?.unit_summary && Object.entries(stats.unit_summary).map(([unit, data]) => (
                                <div key={unit} className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3 last:border-0 last:pb-0 group hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors rounded px-2 -mx-2">
                                    <div className="flex flex-col gap-1.5">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${
                                                data.health_score >= 80 ? 'bg-emerald-500' :
                                                data.health_score >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                                            }`}></div>
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{unit}</span>
                                        </div>
                                        <div className="w-24 h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full transition-all duration-1000 ${
                                                    data.health_score >= 80 ? 'bg-emerald-500' :
                                                    data.health_score >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                                                }`}
                                                style={{ width: `${data.health_score}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="flex flex-col items-end group/stat min-w-[30px]">
                                            <span className="text-[10px] text-slate-400 mb-0.5">Skor</span>
                                            <span className={`text-sm font-bold ${
                                                data.health_score >= 80 ? 'text-emerald-600 dark:text-emerald-400' : 
                                                data.health_score >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'
                                            }`}>{data.health_score}</span>
                                        </div>
                                        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                                        <div className="flex flex-col items-end group/stat">
                                            <span className="text-[10px] text-slate-400 mb-0.5">Proyek</span>
                                            <span className="text-sm font-bold text-slate-600 dark:text-slate-400">{data.projects}</span>
                                        </div>
                                        <div className="flex flex-col items-end group/stat">
                                            <span className="text-[10px] text-slate-400 mb-0.5">Tugas</span>
                                            <span className="text-sm font-bold text-slate-600 dark:text-slate-400">{data.tasks}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {(!stats?.unit_summary || Object.keys(stats.unit_summary).length === 0) && (
                                <div className="text-center text-slate-400 text-sm py-8 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                                    Belum ada unit aktif
                                </div>
                            )}
                        </div>

                        <div className="pt-6 border-t border-slate-100 dark:border-slate-700 grid grid-cols-2 gap-4">
                            <button 
                                onClick={() => setView('weekly_direction')}
                                className="p-3 bg-slate-50 dark:bg-slate-700/30 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 transition-colors border border-slate-200 dark:border-slate-600 hover:border-teal-400 dark:hover:border-teal-500 text-left flex items-center gap-2 group"
                            >
                                <span className="text-lg group-hover:scale-110 transition-transform">🎯</span>
                                <span>Tinjau Strategi</span>
                            </button>
                            <button 
                                onClick={() => setView('activity')}
                                className="p-3 bg-slate-50 dark:bg-slate-700/30 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 transition-colors border border-slate-200 dark:border-slate-600 hover:border-teal-400 dark:hover:border-teal-500 text-left flex items-center gap-2 group"
                            >
                                <span className="text-lg group-hover:scale-110 transition-transform">⚡</span>
                                <span>Lihat Aktivitas</span>
                            </button>
                        </div>
                    </div>
                    )}
                </div>

                {/* Energy Advice / Daily Tip */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden group">
                    
                    <div className="relative z-10 h-full flex flex-col justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <span className="text-amber-500">⚡</span>
                                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                    {stats?.energy_advice ? 'Saran Energi' : 'Wawasan Harian'}
                                </h3>
                            </div>
                            
                            {stats?.energy_advice ? (
                                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                                    <div className="flex items-baseline gap-2 mb-2">
                                        <h4 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                                            {stats.energy_advice.phase}
                                        </h4>
                                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                            Rata-rata {stats.energy_advice.avg_level}%
                                        </span>
                                    </div>
                                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400 leading-relaxed border-l-2 border-slate-200 dark:border-slate-700 pl-3">
                                        "{stats.energy_advice.message}"
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <p className="text-lg font-medium text-slate-700 dark:text-slate-200 leading-relaxed italic">
                                        "Efisiensi adalah melakukan sesuatu dengan benar; efektivitas adalah melakukan sesuatu yang benar."
                                    </p>
                                    <p className="text-xs text-slate-500 mt-2 font-medium">— Peter Drucker</p>
                                </>
                            )}
                        </div>
                        
                        <button 
                            onClick={() => setView('night_review')}
                            className="mt-6 w-full py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                        >
                            {stats?.energy_advice?.phase === 'CALIBRATION' ? 'Mulai Kalibrasi' : 'Perbarui Status'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
