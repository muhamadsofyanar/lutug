import React from 'react';

export default function FocusStatsWidget({ focusStats }) {
    if (!focusStats) return null;

    return (
        <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
           {/* Total Focus */}
           <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 flex items-center gap-4 group transition-all hover:-translate-y-1 shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center text-2xl border border-teal-100 dark:border-teal-800 group-hover:scale-110 transition-transform">
                    🧠
                </div>
                <div>
                    <div className="text-2xl font-bold text-slate-800 dark:text-white tabular-nums tracking-tight">
                        {Math.floor(focusStats.total_minutes / 60)}<span className="text-sm font-normal text-slate-500 ml-0.5 mr-1">j</span>
                        {focusStats.total_minutes % 60}<span className="text-sm font-normal text-slate-500 ml-0.5">m</span>
                    </div>
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">Total Fokus</div>
                </div>
           </div>

           {/* Today's Focus */}
           <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 flex items-center gap-4 group transition-all hover:-translate-y-1 shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-2xl border border-emerald-100 dark:border-emerald-800 group-hover:scale-110 transition-transform">
                    ⚡
                </div>
                <div>
                    <div className="text-2xl font-bold text-slate-800 dark:text-white tabular-nums tracking-tight">
                        {focusStats.today_minutes}<span className="text-sm font-normal text-slate-500 ml-0.5">m</span>
                    </div>
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">Fokus Hari Ini</div>
                </div>
           </div>

           {/* Sessions Today */}
           <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 flex items-center gap-4 group transition-all hover:-translate-y-1 shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-700/30 flex items-center justify-center text-2xl border border-slate-100 dark:border-slate-600 group-hover:scale-110 transition-transform">
                    🧘
                </div>
                <div>
                    <div className="text-2xl font-bold text-slate-800 dark:text-white tabular-nums tracking-tight">
                        {focusStats.today_sessions}
                    </div>
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">Sesi Selesai</div>
                </div>
           </div>
        </div>
    );
}
