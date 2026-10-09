import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet, API_BASE } from '../../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function AnalyticsDashboard() {
  // 1. Fetch Team Performance
  const { data: performanceData = [], isLoading: loadingPerf } = useQuery({
    queryKey: ['analytics_performance'],
    queryFn: async () => {
      const res = await apiGet(`${API_BASE}?action=analytics_team_performance`);
      return res.ok ? res.data.performance : [];
    }
  });

  // 2. Fetch Burnout Heatmap Data
  const { data: heatmapData = {}, isLoading: loadingHeatmap } = useQuery({
    queryKey: ['analytics_heatmap'],
    queryFn: async () => {
      const res = await apiGet(`${API_BASE}?action=analytics_burnout_heatmap`);
      return res.ok ? res.data.heatmap : {};
    }
  });

  // Process Heatmap Data for Grid Display
  // We need a grid of Users (Rows) x Last 30 Days (Columns)
  const heatmapGrid = useMemo(() => {
    if (!heatmapData || Object.keys(heatmapData).length === 0) return null;

    // Get all unique dates from all users to ensure alignment
    const allDates = new Set();
    Object.values(heatmapData).forEach(userEntries => {
        userEntries.forEach(entry => allDates.add(entry.date));
    });
    const sortedDates = Array.from(allDates).sort();

    return {
        dates: sortedDates,
        users: Object.keys(heatmapData).map(username => ({
            username,
            data: heatmapData[username]
        }))
    };
  }, [heatmapData]);

  // Helper to get color based on energy level
  const getEnergyColor = (value) => {
    if (value >= 80) return 'bg-emerald-500';
    if (value >= 60) return 'bg-lime-500';
    if (value >= 40) return 'bg-yellow-500';
    if (value >= 20) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Advanced Reporting</h2>
        <p className="text-slate-500 dark:text-slate-400">Analitik performa tim dan monitoring risiko burnout.</p>
      </div>

      {/* Team Performance Chart */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
        <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-6">Performa Tim (30 Hari Terakhir)</h3>
        
        {loadingPerf ? (
             <div className="h-64 flex items-center justify-center text-slate-400">Memuat data performa...</div>
        ) : (
            <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={performanceData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={true} stroke="#475569" opacity={0.1} />
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="username" width={100} tick={{fill: '#64748b'}} />
                        <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            cursor={{fill: 'transparent'}}
                        />
                        <Legend />
                        <Bar dataKey="completed" name="Tugas Selesai" fill="#14b8a6" radius={[0, 4, 4, 0]} barSize={20} />
                        <Bar dataKey="total" name="Total Tugas" fill="#94a3b8" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        )}
      </div>

      {/* Burnout Heatmap */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200">Burnout Heatmap (Energy Level)</h3>
            <div className="flex gap-2 text-xs">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500"></span> Critical</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-500"></span> Warning</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-500"></span> Good</span>
            </div>
        </div>

        {loadingHeatmap ? (
            <div className="space-y-4">
                <div className="flex gap-2 mb-8">
                     {[...Array(10)].map((_, i) => (
                         <Skeleton key={i} className="h-4 w-8 -rotate-45" />
                     ))}
                </div>
                {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center gap-4">
                        <Skeleton className="h-4 w-32" />
                        <div className="flex gap-1">
                             {[...Array(15)].map((_, j) => (
                                 <Skeleton key={j} className="h-8 w-8 rounded-sm" />
                             ))}
                        </div>
                    </div>
                ))}
            </div>
        ) : heatmapGrid && heatmapGrid.dates.length > 0 ? (
            <div className="overflow-x-auto pb-4">
                <div className="min-w-max">
                    {/* Header Row (Dates) */}
                    <div className="flex">
                        <div className="w-32 flex-shrink-0"></div> {/* Spacer for usernames */}
                        {heatmapGrid.dates.map(date => (
                            <div key={date} className="w-8 flex-shrink-0 text-[10px] text-slate-400 -rotate-45 origin-bottom-left translate-x-4 mb-8">
                                {date.split('-').slice(1).join('/')}
                            </div>
                        ))}
                    </div>

                    {/* Data Rows */}
                    {heatmapGrid.users.map(user => (
                        <div key={user.username} className="flex items-center mb-1">
                            <div className="w-32 flex-shrink-0 text-xs font-bold text-slate-600 dark:text-slate-300 truncate pr-4 text-right">
                                {user.username}
                            </div>
                            {heatmapGrid.dates.map(date => {
                                const entry = user.data.find(d => d.date === date);
                                return (
                                    <div key={date} className="w-8 h-8 flex-shrink-0 p-0.5">
                                        <div 
                                            className={`w-full h-full rounded ${entry ? getEnergyColor(entry.value) : 'bg-slate-100 dark:bg-slate-700'}`}
                                            title={entry ? `${user.username} on ${date}: Energy ${entry.value}` : 'No Data'}
                                        ></div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
        ) : (
            <div className="text-center py-10 text-slate-500">Belum ada data energi yang cukup untuk ditampilkan.</div>
        )}
      </div>
    </div>
  );
}
