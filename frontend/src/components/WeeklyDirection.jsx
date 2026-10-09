import React, { useState, useEffect } from 'react';
import { apiGet, apiPost, API_BASE } from '../services/api';

export default function WeeklyDirection({ addToast, viewParams }) {
    const [directions, setDirections] = useState([]);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [viewMode, setViewMode] = useState('directives'); // 'directives' | 'insights'
    const [insights, setInsights] = useState(null);
    const [loadingInsights, setLoadingInsights] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    // Multi-Business State
    const [businessUnits, setBusinessUnits] = useState([]);
    const [selectedUnit, setSelectedUnit] = useState(''); // '' means Personal

    // Helper to get Monday of the week
    const getMonday = (d) => {
        d = new Date(d);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
        const monday = new Date(d.setDate(diff));
        monday.setHours(0, 0, 0, 0);
        return monday;
    };

    const currentWeekStart = getMonday(selectedDate);
    const offset = currentWeekStart.getTimezoneOffset();
    const currentWeekStartStr = new Date(currentWeekStart.getTime() - (offset*60*1000)).toISOString().split('T')[0];

    useEffect(() => {
        loadBusinessUnits();
    }, []);

    useEffect(() => {
        loadDirections();
        if (viewMode === 'insights') {
            loadInsights();
        }
    }, [selectedUnit]); // Reload when unit changes

    useEffect(() => {
        if (viewMode === 'insights') {
            loadInsights();
        }
    }, [currentWeekStartStr, viewMode]);

    // Deep linking effect
    useEffect(() => {
        if (viewParams?.id && directions.length > 0) {
            // Find direction by ID
            const direction = directions.find(d => d.id == viewParams.id);
            if (direction) {
                // If found, switch to that week
                // direction.week_start is YYYY-MM-DD string
                const weekDate = new Date(direction.week_start);
                // Adjust for timezone if necessary or just use the string directly if we parse it carefully
                // Since week_start is YYYY-MM-DD, new Date(string) might result in UTC midnight, which depends on browser
                // Better to use getMonday logic or just set selectedDate to it.
                // The current logic uses getMonday(selectedDate) to calculate currentWeekStartStr
                // So if we set selectedDate to a date within that week, it should work.
                
                // Add 12 hours to avoid timezone issues with midnight
                weekDate.setHours(12, 0, 0, 0);
                setSelectedDate(weekDate);
                
                // Also highlight it briefly?
                // Maybe not needed for full page view
            }
        }
    }, [viewParams, directions]);

    useEffect(() => {
        const found = directions.find(d => d.week_start === currentWeekStartStr);
        const newContent = found ? found.content : '';
        setContent(newContent);
        if (!newContent) {
            setIsEditing(true);
        } else {
            setIsEditing(false);
        }
    }, [currentWeekStartStr, directions]);

    const loadBusinessUnits = async () => {
        const result = await apiGet(`${API_BASE}?action=business_unit_list`);
        if (result.ok) {
            setBusinessUnits(result.data.units || []);
        }
    };

    const loadDirections = async () => {
        setLoading(true);
        const unitParam = selectedUnit ? `&business_unit=${encodeURIComponent(selectedUnit)}` : '';
        const result = await apiGet(`${API_BASE}?action=weekly_list${unitParam}`);
        if (result.ok) {
            setDirections(result.data.weekly_directions || []);
        } else {
            addToast('Gagal memuat arahan', 'error');
        }
        setLoading(false);
    };

    const loadInsights = async () => {
        setLoadingInsights(true);
        const unitParam = selectedUnit ? `&business_unit=${encodeURIComponent(selectedUnit)}` : '';
        const result = await apiGet(`${API_BASE}?action=weekly_insights&week_start=${currentWeekStartStr}${unitParam}`);
        if (result.ok) {
            setInsights(result.data);
        } else {
            addToast('Gagal memuat wawasan', 'error');
        }
        setLoadingInsights(false);
    };

    const handleSave = async () => {
        setSaving(true);
        const result = await apiPost(`${API_BASE}?action=weekly_direction_save`, {
            week_start: currentWeekStartStr,
            content: content,
            business_unit: selectedUnit
        });

        if (result.ok) {
            addToast('Arahan tersimpan', 'success');
            await loadDirections(); 
            setIsEditing(false);
        } else {
            addToast('Gagal Menyimpan: ' + (result.data?.error || 'Unknown error'), 'error');
        }
        setSaving(false);
    };

    const changeWeek = (offset) => {
        const newDate = new Date(selectedDate);
        newDate.setDate(newDate.getDate() + (offset * 7));
        setSelectedDate(newDate);
    };

    const formatDateDisplay = (date) => {
        return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    // Standard Markdown Renderer
    const renderMarkdown = (text) => {
        if (!text) return (
            <div className="flex flex-col items-center justify-center py-20 opacity-50">
                <div className="text-4xl mb-4 text-slate-300">📝</div>
                <p className="font-medium text-slate-500 text-sm">Belum ada arahan minggu ini</p>
            </div>
        );
        
        return text.split('\n').map((line, idx) => {
            if (line.startsWith('# ')) {
                return (
                    <div key={idx} className="relative mt-8 mb-4">
                        <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{line.substring(2)}</h3>
                        <div className="h-px w-full bg-slate-200 dark:bg-slate-700 mt-2"></div>
                    </div>
                );
            }
            if (line.startsWith('## ')) {
                return (
                    <div key={idx} className="mt-6 mb-3 flex items-center gap-3">
                        <span className="text-teal-600 dark:text-teal-400 text-sm">●</span>
                        <h4 className="text-lg font-semibold text-slate-700 dark:text-slate-200">{line.substring(3)}</h4>
                    </div>
                );
            }
            if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
                return (
                    <div key={idx} className="flex items-start ml-2 mb-2 group">
                        <span className="mr-3 text-slate-400 mt-1.5 text-[6px]">●</span>
                        <span className="text-slate-600 dark:text-slate-300 font-sans leading-relaxed">{line.trim().substring(2)}</span>
                    </div>
                );
            }
            if (line.trim() === '') {
                return <div key={idx} className="h-4"></div>;
            }
            return <p key={idx} className="mb-2 leading-relaxed text-slate-600 dark:text-slate-300 font-sans text-sm">{line}</p>;
        });
    };

    const renderInsights = () => {
        if (loadingInsights) {
            return (
                <div className="flex flex-col items-center justify-center h-full">
                    <div className="w-8 h-8 rounded-full border-4 border-slate-100 border-t-teal-500 animate-spin mb-4"></div>
                    <p className="text-slate-500 font-medium text-xs">Sedang menganalisis...</p>
                </div>
            );
        }

        if (!insights) return (
            <div className="flex flex-col items-center justify-center h-full opacity-50">
                <p className="font-medium text-slate-400 text-xs">Belum ada wawasan tersedia</p>
            </div>
        );

        const { metrics, reasons } = insights;

        return (
            <div className="flex flex-col gap-6 h-full animate-in fade-in duration-500">
                {/* Metric Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl relative overflow-hidden group shadow-sm">
                        <div className="absolute top-0 right-0 p-2 opacity-20 group-hover:opacity-40 transition-opacity">
                            <span className="text-4xl">✅</span>
                        </div>
                        <h4 className="text-slate-500 dark:text-slate-400 text-xs font-bold mb-1">Selesai</h4>
                        <div className="text-3xl font-bold text-slate-800 dark:text-slate-100">{metrics.tasks_completed}</div>
                    </div>
                    
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl relative overflow-hidden group shadow-sm">
                         <div className="absolute top-0 right-0 p-2 opacity-20 group-hover:opacity-40 transition-opacity">
                            <span className="text-4xl">✨</span>
                        </div>
                        <h4 className="text-slate-500 dark:text-slate-400 text-xs font-bold mb-1">Dibuat</h4>
                        <div className="text-3xl font-bold text-slate-800 dark:text-slate-100">{metrics.tasks_created}</div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl relative overflow-hidden group shadow-sm">
                         <div className="absolute top-0 right-0 p-2 opacity-20 group-hover:opacity-40 transition-opacity">
                            <span className="text-4xl">🗑️</span>
                        </div>
                        <h4 className="text-slate-500 dark:text-slate-400 text-xs font-bold mb-1">Dibatalkan</h4>
                        <div className="text-3xl font-bold text-slate-800 dark:text-slate-100">{metrics.tasks_terminated}</div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl relative overflow-hidden group shadow-sm">
                         <div className="absolute top-0 right-0 p-2 opacity-20 group-hover:opacity-40 transition-opacity">
                            <span className="text-4xl">📁</span>
                        </div>
                        <h4 className="text-slate-500 dark:text-slate-400 text-xs font-bold mb-1">Proyek Stop</h4>
                        <div className="text-3xl font-bold text-slate-800 dark:text-slate-100">{metrics.projects_terminated}</div>
                    </div>
                </div>

                {/* Pattern Analysis & Learning Log */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0">
                    {/* Pattern Analysis */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 overflow-hidden flex flex-col shadow-sm">
                        
                        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100 dark:border-slate-700">
                            <span className="text-teal-600 text-lg">📊</span>
                            <h3 className="text-slate-800 dark:text-slate-100 font-bold text-sm">Pola Kerja</h3>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6 relative z-10">
                            {/* AI / System Analysis */}
                            {insights.analysis && insights.analysis.length > 0 && (
                                <div>
                                    <h4 className="text-xs text-teal-600 font-bold mb-3 flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-teal-400 rounded-full"></span>
                                        Saran Sistem
                                    </h4>
                                    <div className="space-y-2 bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
                                        {insights.analysis.map((line, i) => (
                                            <div key={i} className="flex gap-2 text-sm text-slate-600 dark:text-slate-300">
                                                <span className="text-teal-500 select-none">•</span>
                                                <span>{line}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Decision Metrics (Phase 4) */}
                            {insights.decision_stats && Object.keys(insights.decision_stats).length > 0 && (
                                <div>
                                    <h4 className="text-xs text-amber-600 font-bold mb-3 flex items-center gap-2">
                                        <span className="text-lg">⚖️</span> Beban Keputusan
                                    </h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        {Object.entries(insights.decision_stats).map(([type, count]) => (
                                            <div key={type} className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700 flex justify-between items-center">
                                                <span className="text-xs text-slate-500 font-medium capitalize">{type.replace(/_/g, ' ')}</span>
                                                <span className="text-sm font-bold text-amber-500">{count}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-2 text-xs text-slate-400 text-right">
                                        Total: {Object.values(insights.decision_stats).reduce((a, b) => a + b, 0)} Keputusan
                                    </div>
                                </div>
                            )}

                            {/* Bio-Rhythm (Internal Battery) */}
                            <div>
                                <h4 className="text-xs text-emerald-600 font-bold mb-3 flex items-center gap-2">
                                    <span className="text-lg">🔋</span> Tingkat Energi
                                </h4>
                                <div className="flex items-end justify-between h-24 gap-1 pt-2 border-b border-emerald-100 dark:border-emerald-900/30 pb-1 bg-emerald-50 dark:bg-emerald-900/5 rounded-xl px-4">
                                    {insights.bio_rhythm?.map((d, idx) => {
                                        const h = d.energy_level || 0;
                                        const dayName = new Date(d.date).toLocaleDateString('id-ID', { weekday: 'short' }).substring(0, 2);
                                        const colorClass = h > 70 ? 'bg-emerald-400' : h > 30 ? 'bg-amber-400' : 'bg-rose-400';
                                        
                                        return (
                                            <div key={idx} className="flex-1 flex flex-col items-center gap-2 group relative">
                                                <div className="w-2 bg-slate-200 dark:bg-slate-700 rounded-full h-full relative overflow-hidden">
                                                    <div 
                                                        className={`absolute bottom-0 left-0 right-0 w-full transition-all duration-1000 ${colorClass} group-hover:brightness-110`} 
                                                        style={{ height: `${h}%` }}
                                                    ></div>
                                                </div>
                                                <span className="text-[10px] text-slate-500 font-medium">{dayName}</span>
                                                
                                                {/* Tooltip */}
                                                <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-xs py-1 px-2 rounded-lg shadow-lg pointer-events-none whitespace-nowrap z-20">
                                                    {h}%
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {(!insights.bio_rhythm || insights.bio_rhythm.length === 0) && (
                                        <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm italic">Tidak ada data energi</div>
                                    )}
                                </div>
                            </div>

                            {/* Energy Distribution (Task Demand) */}
                             <div>
                                <h4 className="text-xs text-slate-500 font-bold mb-3">Sebaran Fokus</h4>
                                <div className="space-y-3">
                                    {['high', 'medium', 'low'].map(level => {
                                        const count = insights.energy_distribution?.[level] || 0;
                                        const total = Object.values(insights.energy_distribution || {}).reduce((a, b) => a + b, 0) || 1;
                                        const pct = Math.round((count / total) * 100);
                                        
                                        let color = 'bg-slate-200';
                                        let label = 'Rendah';
                                        if (level === 'high') { color = 'bg-rose-400'; label = 'Tinggi'; }
                                        if (level === 'medium') { color = 'bg-amber-400'; label = 'Sedang'; }
                                        if (level === 'low') { color = 'bg-teal-400'; label = 'Rendah'; }

                                        return (
                                            <div key={level} className="flex items-center gap-3">
                                                <div className="w-16 text-xs text-slate-500 font-medium text-right">{label}</div>
                                                <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                    <div className={`h-full ${color} transition-all duration-1000`} style={{ width: `${pct}%` }}></div>
                                                </div>
                                                <div className="w-8 text-xs text-slate-500 font-medium text-right">{count}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                             </div>

                             {/* Daily Velocity */}
                             <div>
                                <h4 className="text-xs text-slate-500 font-bold mb-3">Produktivitas Harian</h4>
                                <div className="flex items-end justify-between h-24 gap-1 pt-2 border-b border-slate-200 dark:border-slate-700 pb-1">
                                    {insights.daily_velocity?.map((d, idx) => {
                                        const max = Math.max(...(insights.daily_velocity?.map(v => v.count) || [1]));
                                        const h = Math.max(10, (d.count / (max || 1)) * 100);
                                        const dayName = new Date(d.date).toLocaleDateString('id-ID', { weekday: 'short' }).substring(0, 2);
                                        return (
                                            <div key={idx} className="flex-1 flex flex-col items-center gap-1 group">
                                                <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-t-lg relative overflow-hidden group-hover:bg-slate-200 dark:group-hover:bg-slate-600 transition-colors" style={{ height: `${h}%` }}>
                                                    <div className="absolute bottom-0 left-0 right-0 h-full bg-teal-400/80 rounded-t-lg"></div>
                                                </div>
                                                <span className="text-[10px] text-slate-500 font-medium group-hover:text-teal-600 transition-colors">{dayName}</span>
                                            </div>
                                        );
                                    })}
                                    {(!insights.daily_velocity || insights.daily_velocity.length === 0) && (
                                        <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm italic">Tidak ada data</div>
                                    )}
                                </div>
                             </div>

                            {/* Golden Hours (Productivity Heatmap) */}
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-amber-500 text-lg">☀️</span>
                                    <h4 className="text-xs text-slate-500 font-bold">Waktu Produktif</h4>
                                </div>
                                <div className="flex items-end h-20 gap-0.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
                                    {Array.from({ length: 24 }).map((_, hour) => {
                                        const count = insights.golden_hours ? (insights.golden_hours[hour] || 0) : 0;
                                        // Fix for potential non-object or missing keys
                                        const allCounts = insights.golden_hours ? Object.values(insights.golden_hours) : [0];
                                        const max = Math.max(...allCounts, 1); // Avoid div by zero
                                        const h = max > 0 ? (count / max) * 100 : 0;
                                        
                                        // Color logic - Softer palette
                                        let bgClass = 'bg-slate-200 dark:bg-slate-700';
                                        if (count > 0) {
                                            if (hour < 6) bgClass = 'bg-slate-300 dark:bg-slate-600';
                                            else if (hour < 12) bgClass = 'bg-teal-300 dark:bg-teal-600';
                                            else if (hour < 18) bgClass = 'bg-emerald-300 dark:bg-emerald-600';
                                            else bgClass = 'bg-slate-300 dark:bg-slate-600';
                                        }

                                        return (
                                            <div key={hour} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                                                <div 
                                                    className={`w-full rounded-sm transition-all duration-500 ${bgClass} group-hover:brightness-95`}
                                                    style={{ height: `${Math.max(5, h)}%` }}
                                                ></div>
                                                
                                                {/* Tooltip */}
                                                <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] py-1 px-2 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600 pointer-events-none whitespace-nowrap z-20">
                                                    {String(hour).padStart(2, '0')}:00 - {count} tugas
                                                </div>
                                                
                                                {/* Hour Markers (every 4 hours) */}
                                                {hour % 4 === 0 && (
                                                    <span className="absolute -bottom-4 text-[8px] text-slate-400 font-medium">{hour}</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="h-4"></div> {/* Spacing for labels */}
                            </div>
                        </div>
                    </div>

                    {/* The Graveyard / Learning Log */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 overflow-hidden flex flex-col shadow-sm">
                        
                        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100 dark:border-slate-700">
                            <span className="text-red-500 text-lg">🕯️</span>
                            <h3 className="text-slate-800 dark:text-slate-100 font-bold text-sm">Riwayat Pembatalan</h3>
                        </div>
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3 relative z-10">
                        {reasons.length === 0 ? (
                            <div className="text-center py-10 text-slate-400 text-sm italic">
                                Tidak ada pembatalan tercatat minggu ini.
                            </div>
                        ) : (
                            reasons.map((r, idx) => (
                                <div key={idx} className="bg-slate-50 dark:bg-slate-700/30 border border-slate-100 dark:border-slate-600/50 p-4 rounded-xl hover:border-red-100 dark:hover:border-red-500/30 transition-colors group">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] px-2 py-0.5 rounded-lg font-bold capitalize ${r.source_type === 'project' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-200 text-slate-500 dark:bg-slate-600 dark:text-slate-300'}`}>
                                                {r.source_type === 'project' ? 'Proyek' : 'Tugas'}
                                            </span>
                                            <span className="text-slate-700 dark:text-slate-200 font-bold text-sm">{r.source_title}</span>
                                        </div>
                                        <span className="text-xs text-slate-400">{new Date(r.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <p className="text-slate-600 dark:text-slate-300 text-sm pl-3 border-l-2 border-red-200 dark:border-red-500/30 group-hover:border-red-400 transition-colors">
                                        "{r.content}"
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-6 md:p-8 h-full flex flex-col max-w-6xl mx-auto animate-in fade-in duration-500">
            {/* Header Area */}
            <div className="mb-8 relative">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 relative z-10">
                    <div>
                        <div className="flex items-center gap-4 mb-2">
                            <div className="flex items-center gap-2">
                                <span className="h-2 w-2 bg-slate-400 rounded-full"></span>
                                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Fokus Mingguan</span>
                            </div>

                            {/* Business Unit Selector */}
                            <select 
                                value={selectedUnit} 
                                onChange={(e) => setSelectedUnit(e.target.value)}
                                className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-[11px] font-medium uppercase px-2 py-1 rounded focus:border-teal-500 outline-none transition-colors cursor-pointer"
                            >
                                <option value="">PRIBADI</option>
                                {businessUnits.map(u => (
                                    <option key={u.id} value={u.name}>{u.name}</option>
                                ))}
                            </select>
                        </div>
                        <h2 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">
                            Arahan Mingguan
                        </h2>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                        {/* View Mode Toggle */}
                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                            <button
                                onClick={() => setViewMode('directives')}
                                className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
                                    viewMode === 'directives' 
                                        ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' 
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                }`}
                            >
                                Arahan
                            </button>
                            <button
                                onClick={() => setViewMode('insights')}
                                className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
                                    viewMode === 'insights' 
                                        ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' 
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                }`}
                            >
                                Wawasan
                            </button>
                        </div>
                        
                        {/* Week Navigation */}
                        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                            <button 
                                onClick={() => changeWeek(-1)} 
                                className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
                            >
                                ←
                            </button>
                            <div className="flex flex-col items-center px-4 border-x border-slate-100 dark:border-slate-700">
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Minggu Mulai</span>
                                <span className="text-sm text-slate-700 dark:text-slate-200 font-bold">
                                    {formatDateDisplay(currentWeekStart)}
                                </span>
                            </div>
                            <button 
                                onClick={() => changeWeek(1)} 
                                className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
                            >
                                →
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 relative flex flex-col min-h-0 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="relative z-10 flex-1 p-6 md:p-8 overflow-y-auto custom-scrollbar flex flex-col">
                    {viewMode === 'insights' ? (
                        renderInsights()
                    ) : isEditing ? (
                        <div className="flex-1 flex flex-col relative h-full">
                            <textarea
                                className="flex-1 w-full bg-transparent resize-none focus:outline-none text-base leading-relaxed text-slate-700 dark:text-slate-200 placeholder:text-slate-400 custom-scrollbar font-sans"
                                placeholder="# Judul Bagian&#10;- Poin arahan..."
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                autoFocus
                            />
                        </div>
                    ) : (
                        <div className="prose prose-slate dark:prose-invert max-w-none" onDoubleClick={() => setIsEditing(true)}>
                            {renderMarkdown(content)}
                        </div>
                    )}
                </div>

                {/* Footer / Actions */}
                {viewMode !== 'insights' && (
                    <div className="relative z-10 p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
                        {!isEditing ? (
                            <div className="flex items-center gap-2 text-slate-400 text-xs">
                                <span>Klik dua kali area untuk mengedit</span>
                            </div>
                        ) : (
                            <div className="text-xs font-medium text-teal-600 dark:text-teal-400">
                                Mode Edit
                            </div>
                        )}

                        <div className="flex gap-3">
                            {isEditing ? (
                                <>
                                    <button 
                                        onClick={() => {
                                            const found = directions.find(d => d.week_start === currentWeekStartStr);
                                            setContent(found ? found.content : '');
                                            setIsEditing(false);
                                        }}
                                        className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold uppercase tracking-wide hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                                    >
                                        Batal
                                    </button>
                                    <button 
                                        onClick={handleSave} 
                                        disabled={saving}
                                        className="px-6 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-bold uppercase tracking-wide shadow-sm hover:shadow transition-all flex items-center gap-2"
                                    >
                                        {saving ? 'Menyimpan...' : 'Simpan Arahan'}
                                    </button>
                                </>
                            ) : (
                                <button 
                                    onClick={() => setIsEditing(true)}
                                    className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-lg transition-all"
                                >
                                    Edit
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
