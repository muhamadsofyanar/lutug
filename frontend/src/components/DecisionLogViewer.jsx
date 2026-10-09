import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet, API_BASE } from '../services/api';

export default function DecisionLogViewer() {
  const { data: logs, isLoading: logsLoading, error } = useQuery({
    queryKey: ['decision_logs'],
    queryFn: async () => {
      const result = await apiGet(`${API_BASE}?action=decision_list`);
      if (!result.ok) throw new Error(result.error || 'Gagal memuat log');
      return result.data.logs;
    }
  });

  const { data: stats } = useQuery({
    queryKey: ['decision_stats'],
    queryFn: async () => {
      const result = await apiGet(`${API_BASE}?action=decision_stats`);
      return result.ok ? result.data.stats : {};
    }
  });

  if (logsLoading) return <div className="p-8 text-center text-teal-600 dark:text-teal-400 font-medium">Memuat Log Keputusan...</div>;
  if (error) return <div className="p-8 text-center text-red-500 font-medium">Error: {error.message}</div>;

  const getStatColor = (type) => {
    if (type === 'killed') return 'text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-950/20';
    if (type === 'deferred' || type === 'deferred_fallback') return 'text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-950/20';
    if (type.includes('processed') || type === 'project' || type === 'reference') return 'text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/20';
    return 'text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/20';
  };

  const translateType = (type) => {
    switch (type) {
        case 'killed': return 'Dibatalkan';
        case 'deferred': return 'Ditunda';
        case 'deferred_fallback': return 'Ditunda (Otomatis)';
        case 'processed_to_today': return 'Ke Hari Ini';
        case 'project': return 'Proyek Baru';
        case 'reference': return 'Referensi';
        default: return type.replace(/_/g, ' ');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <h2 className="text-2xl mb-6 text-slate-800 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-800 pb-2 flex items-center gap-2">
        <span>🧠</span> Log Keputusan
      </h2>
      
      {/* Stats Grid */}
      {stats && Object.keys(stats).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {Object.entries(stats).map(([type, count]) => (
            <div key={type} className={`p-4 rounded-xl border flex flex-col items-center justify-center ${getStatColor(type)} shadow-sm`}>
              <span className="text-3xl font-bold">{count}</span>
              <span className="text-xs font-medium opacity-80 mt-1 capitalize">{translateType(type)}</span>
            </div>
          ))}
        </div>
      )}
      
      <div className="space-y-4">
        {logs && logs.length > 0 ? (
          logs.map(log => (
            <div key={log.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl hover:border-teal-500/30 transition-colors shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <span className={`px-2 py-0.5 text-xs rounded-lg font-medium border ${
                  log.decision_type === 'killed' ? 'border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20' :
                  (log.decision_type === 'deferred' || log.decision_type === 'deferred_fallback') ? 'border-amber-200 dark:border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20' :
                  'border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20'
                }`}>
                  {translateType(log.decision_type)}
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500">{log.created_at}</span>
              </div>
              
              <div className="mb-2">
                {log.meta_data?.title && <p className="text-slate-800 dark:text-slate-200 font-semibold">{log.meta_data.title}</p>}
                {log.meta_data?.original_content && <p className="text-slate-800 dark:text-slate-200 font-semibold">{log.meta_data.original_content}</p>}
              </div>

              {log.reason && (
                <p className="text-sm text-slate-600 dark:text-slate-400 italic border-l-2 border-slate-200 dark:border-slate-700 pl-3">
                  "{log.reason}"
                </p>
              )}
              
              {/* Debug Info */}
              <details className="mt-3">
                  <summary className="text-[10px] text-slate-400 cursor-pointer hover:text-teal-500 transition-colors">Lihat Data Mentah</summary>
                  <pre className="text-[10px] text-slate-500 overflow-x-auto mt-2 bg-slate-50 dark:bg-slate-950 p-2 rounded border border-slate-200 dark:border-slate-800">
                      {JSON.stringify(log.meta_data, null, 2)}
                  </pre>
              </details>
            </div>
          ))
        ) : (
          <div className="text-center text-slate-500 py-10 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">Belum ada keputusan yang tercatat. Mulai proses kotak masuk Anda!</div>
        )}
      </div>
    </div>
  );
}
