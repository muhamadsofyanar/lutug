import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet, API_BASE } from '../../services/api';

export default function SystemHealthWidget() {
    const { data: health, isLoading, isError } = useQuery({
        queryKey: ['system_health'],
        queryFn: async () => {
            const res = await apiGet(`${API_BASE}?action=admin_health_check`);
            return res.ok ? res.data.health : null;
        }
    });

    if (isLoading) return <div className="text-sm text-slate-500 animate-pulse">Memeriksa sistem...</div>;
    if (isError || !health) return <div className="text-sm text-red-500 font-medium">Data tidak tersedia.</div>;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-500">
            <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="font-medium text-slate-600 dark:text-slate-300 text-sm">Koneksi Database</span>
                    <StatusBadge status={health.database === 'ok' ? 'ok' : 'error'} />
                </div>
                
                <div className="bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                     <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                        <span>📊</span> Tabel Data
                     </h4>
                     <div className="space-y-2">
                        {Object.entries(health.tables).map(([table, status]) => (
                            <div key={table} className="flex justify-between items-center text-sm border-b border-slate-100 dark:border-slate-800 last:border-0 pb-1 last:pb-0">
                                <span className="text-slate-600 dark:text-slate-400 text-xs">{table}</span>
                                <div className="flex items-center gap-2">
                                    {status.status === 'ok' ? (
                                        <span className="text-[10px] text-slate-400">({status.count})</span>
                                    ) : (
                                        <span className="text-[10px] text-red-500">{status.error}</span>
                                    )}
                                    <StatusBadge status={status.status === 'ok' ? 'ok' : 'error'} mini />
                                </div>
                            </div>
                        ))}
                     </div>
                </div>
            </div>

            <div className="space-y-4">
                <div className="bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                     <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                        <span>📂</span> Izin File
                     </h4>
                     <div className="space-y-2">
                        {Object.entries(health.writable).map(([dir, status]) => (
                            <div key={dir} className="flex justify-between items-center text-sm">
                                <span className="text-slate-600 dark:text-slate-400 text-xs">{dir}</span>
                                <StatusBadge status={status === 'ok' ? 'ok' : 'error'} text={status === 'ok' ? 'Aman' : 'Dibatasi'} />
                            </div>
                        ))}
                     </div>
                </div>

                {health.errors.length > 0 ? (
                    <div className="bg-red-50 rounded-xl border border-red-100 p-4">
                        <h4 className="text-sm font-semibold text-red-600 mb-2">Masalah Terdeteksi</h4>
                        <ul className="list-disc list-inside text-xs text-red-500">
                            {health.errors.map((err, i) => (
                                <li key={i}>{err}</li>
                            ))}
                        </ul>
                    </div>
                ) : (
                    <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-4 flex items-center justify-center h-24">
                        <div className="text-center">
                            <div className="text-2xl mb-1">✅</div>
                            <div className="text-sm font-semibold text-emerald-600">Sistem Sehat</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function StatusBadge({ status, mini, text }) {
    const isOk = status === 'ok';
    return (
        <span className={`
            ${mini ? 'w-2 h-2 rounded-full' : 'px-2 py-1 rounded text-[10px] font-medium'}
            ${isOk ? (mini ? 'bg-emerald-500' : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20') : (mini ? 'bg-red-500' : 'bg-red-500/10 text-red-600 border border-red-500/20')}
        `}>
            {mini ? '' : (text || (isOk ? 'Normal' : 'Kritis'))}
        </span>
    );
}
