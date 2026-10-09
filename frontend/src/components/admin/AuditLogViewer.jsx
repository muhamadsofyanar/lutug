import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet, API_BASE } from '../../services/api';

export default function AuditLogViewer() {
    const [page, setPage] = useState(0);
    const [filters, setFilters] = useState({
        user_id: '',
        action: '',
        date_from: '',
        date_to: ''
    });
    const limit = 50;

    const { data, isLoading, isError } = useQuery({
        queryKey: ['audit_logs', page, filters],
        queryFn: async () => {
            const queryParams = new URLSearchParams({
                action: 'admin_audit_logs',
                limit,
                offset: page * limit,
                user_id: filters.user_id,
                filter_action: filters.action,
                date_from: filters.date_from,
                date_to: filters.date_to
            });
            const res = await apiGet(`${API_BASE}?${queryParams.toString()}`);
            return res.ok ? res.data : { logs: [], total: 0 };
        },
        keepPreviousData: true
    });

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setPage(0); // Reset to first page on filter change
    };

    const { logs, total } = data || { logs: [], total: 0 };
    const totalPages = Math.ceil(total / limit);

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header / Pagination Controls */}
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm gap-4">
                <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    <span className="text-teal-500">🛡️</span> Log Audit Keamanan <span className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-500">{total}</span>
                </h3>
                
                {/* Filter Controls */}
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    <input 
                        type="number" 
                        placeholder="User ID" 
                        value={filters.user_id}
                        onChange={(e) => handleFilterChange('user_id', e.target.value)}
                        className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg w-20"
                    />
                    <select 
                        value={filters.action}
                        onChange={(e) => handleFilterChange('action', e.target.value)}
                        className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                    >
                        <option value="">Semua Aksi</option>
                        <option value="LOGIN">Login</option>
                        <option value="LOGOUT">Logout</option>
                        <option value="CREATE">Tambah</option>
                        <option value="UPDATE">Ubah</option>
                        <option value="DELETE">Hapus</option>
                    </select>
                    <input 
                        type="date" 
                        value={filters.date_from}
                        onChange={(e) => handleFilterChange('date_from', e.target.value)}
                        className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                    />
                    <span className="text-slate-400 self-center">-</span>
                    <input 
                        type="date" 
                        value={filters.date_to}
                        onChange={(e) => handleFilterChange('date_to', e.target.value)}
                        className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                    />
                </div>

                <div className="flex gap-2 self-end md:self-auto">
                    <button
                        disabled={page === 0}
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        className="px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        Sebelumnya
                    </button>
                    <span className="text-xs py-1.5 px-2 text-slate-500">
                        Hal {page + 1} / {totalPages || 1}
                    </span>
                    <button
                        disabled={page >= totalPages - 1}
                        onClick={() => setPage(p => p + 1)}
                        className="px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        Berikutnya
                    </button>
                </div>
             </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
                {isLoading ? (
                    <div className="p-8 text-center text-slate-500 italic">Memuat log...</div>
                ) : logs.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 italic">Tidak ada log ditemukan.</div>
                ) : logs.map(log => (
                    <AuditLogCard key={log.id} log={log} />
                ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                                <th className="p-4 text-xs font-bold text-slate-500 w-40">Waktu</th>
                                <th className="p-4 text-xs font-bold text-slate-500 w-32">Pengguna</th>
                                <th className="p-4 text-xs font-bold text-slate-500 w-32">Aksi</th>
                                <th className="p-4 text-xs font-bold text-slate-500 w-40">Target</th>
                                <th className="p-4 text-xs font-bold text-slate-500">Detail</th>
                                <th className="p-4 text-xs font-bold text-slate-500 w-32">IP</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                            {isLoading ? (
                                <tr><td colSpan="6" className="p-8 text-center text-slate-500 italic">Memuat log...</td></tr>
                            ) : logs.length === 0 ? (
                                <tr><td colSpan="6" className="p-8 text-center text-slate-500 italic">Tidak ada log ditemukan.</td></tr>
                            ) : logs.map(log => (
                                <AuditLogRow key={log.id} log={log} />
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function AuditLogCard({ log }) {
    const [expanded, setExpanded] = useState(false);

    const translateAction = (action) => {
        if (!action) return '-';
        
        // System Actions
        if (action === 'admin_system_reset') return 'Reset Sistem';
        if (action === 'admin_backup_create') return 'Buat Backup';
        if (action === 'admin_backup_restore') return 'Pulihkan Backup';
        if (action === 'admin_backup_delete') return 'Hapus Backup';
        if (action === 'admin_backup_download') return 'Unduh Backup';
        if (action === 'admin_export_json') return 'Export Data';
        if (action === 'admin_import_json') return 'Import Data';

        const upper = action.toUpperCase();
        if (upper.includes('CREATE')) return 'Tambah';
        if (upper.includes('UPDATE')) return 'Ubah';
        if (upper.includes('DELETE')) return 'Hapus';
        if (upper.includes('LOGIN')) return 'Masuk';
        if (upper.includes('LOGOUT')) return 'Keluar';
        
        return action.replace(/_/g, ' ');
    };

    return (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 dark:text-white">{log.username || 'System'}</span>
                    <span className="text-[10px] text-slate-400">{log.created_at}</span>
                </div>
                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide border ${
                     log.action.includes('DELETE') ? 'bg-red-50 text-red-600 border-red-200' :
                     log.action.includes('UPDATE') ? 'bg-orange-50 text-orange-600 border-orange-200' :
                     log.action.includes('CREATE') ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                     'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'
                }`}>
                    {translateAction(log.action)}
                </span>
            </div>
            
            <div className="text-xs text-slate-600 dark:text-slate-300 mb-2">
                <span className="font-semibold text-slate-500 dark:text-slate-400 uppercase text-[10px] mr-2">Target:</span>
                {log.target_type} {log.target_id && <span className="opacity-50">#{log.target_id}</span>}
            </div>
            
            <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-700 mt-2">
                <span className="text-[10px] text-slate-400 font-mono">{log.ip_address}</span>
                {log.details && (
                    <button 
                        onClick={() => setExpanded(!expanded)}
                        className="text-xs font-bold text-blue-500 hover:text-blue-400"
                    >
                        {expanded ? 'Tutup Detail' : 'Lihat Detail'}
                    </button>
                )}
            </div>

            {expanded && log.details && (
                <div className="mt-3 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                    <pre className="text-[10px] font-mono text-slate-600 dark:text-slate-400 overflow-x-auto">
                        {JSON.stringify(log.details, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
}

function AuditLogRow({ log }) {
    const [expanded, setExpanded] = useState(false);

    const translateAction = (action) => {
        if (!action) return '-';
        
        // System Actions
        if (action === 'admin_system_reset') return 'Reset Sistem';
        if (action === 'admin_backup_create') return 'Buat Backup';
        if (action === 'admin_backup_restore') return 'Pulihkan Backup';
        if (action === 'admin_backup_delete') return 'Hapus Backup';
        if (action === 'admin_backup_download') return 'Unduh Backup';
        if (action === 'admin_export_json') return 'Export Data';
        if (action === 'admin_import_json') return 'Import Data';

        const upper = action.toUpperCase();
        if (upper.includes('CREATE')) return 'Tambah';
        if (upper.includes('UPDATE')) return 'Ubah';
        if (upper.includes('DELETE')) return 'Hapus';
        if (upper.includes('LOGIN')) return 'Masuk';
        if (upper.includes('LOGOUT')) return 'Keluar';
        
        return action.replace(/_/g, ' ');
    };

    return (
        <>
            <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors text-sm text-slate-600 dark:text-slate-300 border-l-2 border-transparent hover:border-teal-500">
                <td className="p-4 whitespace-nowrap text-xs text-slate-500">{log.created_at}</td>
                <td className="p-4 font-bold text-teal-600 dark:text-teal-400">{log.username || 'System'}</td>
                <td className="p-4 font-medium">
                    <span className={`px-2 py-0.5 rounded text-[10px] border ${
                        log.action.includes('DELETE') ? 'bg-red-50 text-red-600 border-red-200' :
                        log.action.includes('UPDATE') ? 'bg-orange-50 text-orange-600 border-orange-200' :
                        log.action.includes('CREATE') ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                        'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'
                    }`}>
                        {translateAction(log.action)}
                    </span>
                </td>
                <td className="p-4 text-xs">
                    {log.target_type} 
                    {log.target_id && <span className="opacity-50 ml-1">#{log.target_id}</span>}
                </td>
                <td className="p-4">
                    {log.details ? (
                         <button 
                            onClick={() => setExpanded(!expanded)}
                            className="text-xs font-bold text-blue-500 hover:text-blue-400 hover:underline flex items-center gap-1"
                         >
                            {expanded ? 'Sembunyikan' : 'Lihat'}
                         </button>
                    ) : <span className="text-slate-300 dark:text-slate-700">-</span>}
                </td>
                <td className="p-4 text-xs text-slate-400">{log.ip_address}</td>
            </tr>
            {expanded && log.details && (
                <tr className="bg-slate-50 dark:bg-slate-900/50">
                    <td colSpan="6" className="p-4">
                        <pre className="text-[10px] font-mono text-slate-600 dark:text-slate-400 overflow-x-auto bg-white dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800 shadow-inner">
                            {JSON.stringify(log.details, null, 2)}
                        </pre>
                    </td>
                </tr>
            )}
        </>
    );
}
