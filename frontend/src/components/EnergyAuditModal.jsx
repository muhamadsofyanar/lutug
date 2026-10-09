import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet, API_BASE } from '../services/api';

const EnergyAuditModal = ({ onClose }) => {
    const [days, setDays] = useState(7);

    const { data: auditData, isLoading, error } = useQuery({
        queryKey: ['energyAudit', days],
        queryFn: async () => {
            const result = await apiGet(`${API_BASE}?action=task_energy_audit&days=${days}`);
            if (!result.ok) throw new Error("Gagal mengambil audit energi");
            return result.data.audit_data;
        },
        // Optimasi caching per sesi (1 jam) agar tidak loading terus menerus
        staleTime: 1000 * 60 * 60, 
        gcTime: 1000 * 60 * 60,
        refetchOnWindowFocus: false,
        refetchOnMount: false
    });

    // Process data for visualization
    const processData = () => {
        if (!auditData) return [];
        
        // Group by date
        const grouped = {};
        auditData.forEach(item => {
            if (!grouped[item.audit_date]) {
                grouped[item.audit_date] = { date: item.audit_date, high: 0, medium: 0, low: 0, total: 0 };
            }
            const count = parseInt(item.task_count);
            grouped[item.audit_date][item.energy_level] = count;
            grouped[item.audit_date].total += count;
        });

        return Object.values(grouped).sort((a, b) => new Date(a.date) - new Date(b.date));
    };

    const chartData = processData();
    const maxTasks = Math.max(...chartData.map(d => d.total), 1); // Avoid div by zero

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                
                {/* Header */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                    <div>
                        <h2 className="text-2xl font-bold bg-gradient-to-r from-teal-500 to-emerald-600 bg-clip-text text-transparent">
                            Audit Energi
                        </h2>
                        <p className="text-slate-500 text-sm mt-1">Analisis penggunaan energi Anda dari waktu ke waktu.</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Controls */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex gap-2 overflow-x-auto">
                    {[7, 14, 30].map(d => (
                        <button
                            key={d}
                            onClick={() => setDays(d)}
                            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                                days === d 
                                ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/30' 
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                        >
                            {d} Hari Terakhir
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-slate-900/50">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-64">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
                        </div>
                    ) : error ? (
                        <div className="text-red-500 text-center p-8 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-900/30">
                            Gagal memuat data energi.
                        </div>
                    ) : chartData.length === 0 ? (
                        <div className="text-slate-500 text-center p-12 flex flex-col items-center justify-center h-64">
                            <svg className="w-16 h-16 mb-4 text-slate-300 dark:text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <p>Tidak ada tugas selesai dalam periode ini.</p>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {/* Summary Stats */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-100 dark:border-red-900/30 text-center">
                                    <div className="text-red-600 dark:text-red-400 font-bold text-2xl">{auditData.filter(x => x.energy_level === 'high').reduce((a,b) => a + parseInt(b.task_count), 0)}</div>
                                    <div className="text-red-600/70 dark:text-red-400/70 text-xs font-medium mt-1">Energi Tinggi</div>
                                </div>
                                <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-xl border border-amber-100 dark:border-amber-900/30 text-center">
                                    <div className="text-amber-600 dark:text-amber-400 font-bold text-2xl">{auditData.filter(x => x.energy_level === 'medium').reduce((a,b) => a + parseInt(b.task_count), 0)}</div>
                                    <div className="text-amber-600/70 dark:text-amber-400/70 text-xs font-medium mt-1">Energi Sedang</div>
                                </div>
                                <div className="bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30 text-center">
                                    <div className="text-emerald-600 dark:text-emerald-400 font-bold text-2xl">{auditData.filter(x => x.energy_level === 'low').reduce((a,b) => a + parseInt(b.task_count), 0)}</div>
                                    <div className="text-emerald-600/70 dark:text-emerald-400/70 text-xs font-medium mt-1">Energi Rendah</div>
                                </div>
                            </div>

                            {/* Chart */}
                            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
                                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-6">Analisis Output Harian</h3>
                                <div className="flex items-end justify-between gap-2 h-64">
                                    {chartData.map((day, idx) => {
                                        const highH = (day.high / maxTasks) * 100;
                                        const medH = (day.medium / maxTasks) * 100;
                                        const lowH = (day.low / maxTasks) * 100;
                                        
                                        return (
                                            <div key={idx} className="flex-1 flex flex-col items-center group relative">
                                                {/* Tooltip */}
                                                <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-xs p-2 rounded pointer-events-none whitespace-nowrap z-10 shadow-lg">
                                                    <div className="font-bold mb-1">{new Date(day.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                                                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
                                                        <span className="text-red-300">Tinggi:</span> <span className="text-right">{day.high}</span>
                                                        <span className="text-amber-300">Sedang:</span> <span className="text-right">{day.medium}</span>
                                                        <span className="text-emerald-300">Rendah:</span> <span className="text-right">{day.low}</span>
                                                        <div className="col-span-2 border-t border-slate-600 mt-1 pt-1 font-bold flex justify-between">
                                                            <span>Total:</span> <span>{day.total}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Stacked Bar */}
                                                <div className="w-full max-w-[40px] flex flex-col justify-end h-full bg-slate-100 dark:bg-slate-700/50 rounded-t-lg overflow-hidden relative">
                                                    {day.high > 0 && <div style={{ height: `${highH}%` }} className="bg-red-400 hover:bg-red-500 transition-colors w-full"></div>}
                                                    {day.medium > 0 && <div style={{ height: `${medH}%` }} className="bg-amber-400 hover:bg-amber-500 transition-colors w-full"></div>}
                                                    {day.low > 0 && <div style={{ height: `${lowH}%` }} className="bg-emerald-400 hover:bg-emerald-500 transition-colors w-full"></div>}
                                                </div>
                                                
                                                {/* Label */}
                                                <div className="mt-2 text-[10px] text-slate-500 dark:text-slate-400 rotate-0 truncate w-full text-center">
                                                    {new Date(day.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'numeric' })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EnergyAuditModal;