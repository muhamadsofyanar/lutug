import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, API_BASE } from '../services/api';
import Skeleton from './common/Skeleton';
import { useToast } from '../contexts/ToastContext';

export default function DailyUpdate({ viewParams }) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  
  // Local State for Form
  const [selectedUnit, setSelectedUnit] = useState('');
  const [highlightedId, setHighlightedId] = useState(null);
  const [formData, setFormData] = useState({
    today_plan: '',
    done: '',
    blocker: '',
    energy_level: 70
  });

  // Fetch Business Units
  const { data: businessUnits = [] } = useQuery({
    queryKey: ['business_units'],
    queryFn: async () => {
        const result = await apiGet(`${API_BASE}?action=business_unit_list`);
        if (result.ok) return result.data.units || [];
        return [];
    }
  });

  // 1. Fetch Today's Update (Personal or Business Unit)
  const { data: myUpdate, isLoading: loadingMyUpdate } = useQuery({
    queryKey: ['daily_update_today', selectedUnit],
    queryFn: async () => {
      const result = await apiGet(`${API_BASE}?action=daily_update_today&business_unit=${encodeURIComponent(selectedUnit)}`);
      if (result.ok) {
        const data = result.data.update;
        // Update form state immediately
        if (data) {
            setFormData({
                today_plan: data.today_plan || '',
                done: data.done || '',
                blocker: data.blocker || '',
                energy_level: data.energy_level !== undefined ? data.energy_level : 70
            });
        } else {
            // Reset if no data found for this unit
            setFormData({
                today_plan: '',
                done: '',
                blocker: '',
                energy_level: 70
            });
        }
        return data;
      }
      return null;
    },
    refetchOnWindowFocus: false
  });

  // 2. Fetch Team Updates (Feed)
  const { data: teamUpdates = [], isLoading: loadingFeed } = useQuery({
    queryKey: ['daily_update_list'],
    queryFn: async () => {
      const result = await apiGet(`${API_BASE}?action=daily_update_list`);
      if (result.ok) return result.data.updates || [];
      return [];
    }
  });

  // Deep linking effect
  useEffect(() => {
    if (viewParams?.id && teamUpdates.length > 0) {
      setHighlightedId(parseInt(viewParams.id));
      setTimeout(() => {
          const element = document.getElementById(`update-${viewParams.id}`);
          if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
      }, 500);
    }
  }, [viewParams, teamUpdates]);

  // 3. Save Mutation
  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      const result = await apiPost(`${API_BASE}?action=daily_update_save`, payload);
      if (!result.ok) {
        const msg = result.data?.error?.message || result.data?.error || "Gagal menyimpan update";
        throw new Error(msg);
      }
      return result.data;
    },
    onSuccess: () => {
      addToast("Entri Log Disimpan", "success");
      queryClient.invalidateQueries({ queryKey: ['daily_update_list'] });
    },
    onError: (error) => {
      addToast(error.message, "error");
    }
  });

  const handleSave = () => {
    saveMutation.mutate({ ...formData, business_unit: selectedUnit });
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getAvatarColor = (name) => {
      const colors = ['bg-slate-500', 'bg-zinc-500', 'bg-neutral-500', 'bg-stone-500', 'bg-teal-600', 'bg-emerald-600'];
      let hash = 0;
      if (!name) return colors[0];
      for (let i = 0; i < name.length; i++) {
          hash = name.charCodeAt(i) + ((hash << 5) - hash);
      }
      return colors[Math.abs(hash) % colors.length];
  };

  const getEnergyColor = (level) => {
    if (level < 30) return 'text-red-500';
    if (level < 70) return 'text-yellow-500';
    return 'text-emerald-500';
  };

  const getEnergyGradient = (level) => {
    if (level < 30) return 'bg-gradient-to-r from-red-600 to-red-400';
    if (level < 70) return 'bg-gradient-to-r from-yellow-600 to-yellow-400';
    return 'bg-gradient-to-r from-emerald-600 to-emerald-400';
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto h-full overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="mb-8 border-b border-slate-200 dark:border-slate-800 pb-4">
        <h2 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">
            Log Harian & Komunikasi Tim
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
            Sistem tersinkronisasi
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: My Update Form (5 cols) */}
        <div className="lg:col-span-5 space-y-6 animate-in slide-in-from-left-4 duration-700 delay-150">
            <div className="relative bg-white dark:bg-slate-900/50 backdrop-blur-xl p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden group hover:shadow-md transition-all">
                
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                    <span className="text-teal-500">●</span> Laporan Saya
                </h3>
              
              <div className="space-y-5">
                  {/* Business Unit Selector */}
                  <div className="group/field">
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
                        Unit Kerja
                    </label>
                    <select
                        value={selectedUnit}
                        onChange={(e) => setSelectedUnit(e.target.value)}
                        className="w-full p-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-lg focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-teal-500 outline-none transition-all text-sm text-slate-700 dark:text-slate-300"
                    >
                        <option value="">Pribadi (Default)</option>
                        {businessUnits.map(u => (
                            <option key={u.id} value={u.name}>{u.name}</option>
                        ))}
                    </select>
                  </div>

                  {/* Energy Level */}
                  <div className="group/field">
                    <div className="flex justify-between items-end mb-2">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                            Tingkat Energi
                        </label>
                        <span className={`text-xl font-bold ${getEnergyColor(formData.energy_level)}`}>
                            {formData.energy_level}%
                        </span>
                    </div>
                    <div className="relative h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden group cursor-pointer border border-slate-200 dark:border-slate-700">
                        <div 
                            className={`absolute top-0 left-0 h-full transition-all duration-300 rounded-full ${getEnergyGradient(formData.energy_level)}`}
                            style={{ width: `${formData.energy_level}%` }}
                        >
                        </div>
                        <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={formData.energy_level} 
                            onChange={(e) => handleChange('energy_level', parseInt(e.target.value))}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />

                        {/* Grid lines */}
                        <div className="absolute inset-0 flex justify-between px-2 pointer-events-none opacity-20">
                            {[...Array(20)].map((_, i) => (
                                <div key={i} className="w-[1px] h-full bg-black dark:bg-white"></div>
                            ))}
                        </div>
                    </div>
                  </div>

                  <div className="group/field">
                    <label className="block text-[10px] font-bold text-teal-600 dark:text-teal-400 mb-2 uppercase tracking-wider">
                        Target Fokus (Rencana)
                    </label>
                    <textarea 
                      rows="3"
                      className="w-full p-4 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-lg focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all resize-none text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-500 font-mono"
                      placeholder="Definisikan tujuan utama..."
                      value={formData.today_plan}
                      onChange={(e) => handleChange('today_plan', e.target.value)}
                    />
                  </div>

                  <div className="group/field">
                    <label className="block text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mb-2 uppercase tracking-wider">
                        Pencapaian (Selesai)
                    </label>
                    <textarea 
                      rows="3"
                      className="w-full p-4 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-lg focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all resize-none text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-500 font-mono"
                      placeholder="Catat tugas yang selesai..."
                      value={formData.done}
                      onChange={(e) => handleChange('done', e.target.value)}
                    />
                  </div>

                  <div className="group/field">
                    <label className="block text-[10px] font-bold text-red-600 dark:text-red-400 mb-2 uppercase tracking-wider">
                        Hambatan (Blocker)
                    </label>
                    <textarea 
                      rows="2"
                      className={`w-full p-4 bg-slate-50 dark:bg-slate-950/50 border rounded-lg focus:bg-white dark:focus:bg-slate-900 focus:ring-1 outline-none transition-all resize-none text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-500 font-mono ${formData.blocker ? 'border-red-500/50 focus:border-red-500' : 'border-slate-200 dark:border-slate-800 focus:border-red-500'}`}
                      placeholder="Identifikasi hambatan..."
                      value={formData.blocker}
                      onChange={(e) => handleChange('blocker', e.target.value)}
                    />
                  </div>

                  <button 
                    className="w-full py-4 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-bold font-mono text-sm uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(20,184,166,0.3)] hover:shadow-[0_0_30px_rgba(20,184,166,0.5)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group/btn relative overflow-hidden"
                    onClick={handleSave} 
                    disabled={saveMutation.isPending}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-1000"></div>
                    {saveMutation.isPending ? (
                        <>
                            <span className="animate-spin">⏳</span> MENGIRIM...
                        </>
                    ) : (
                        <>
                            <span>KIRIM UPDATE</span>
                            <span className="text-xl leading-none">»</span>
                        </>
                    )}
                  </button>
              </div>
            </div>
        </div>

        {/* Right: Team Feed (7 cols) */}
        <div className="lg:col-span-7 animate-in slide-in-from-right-4 duration-700 delay-300">
          <div className="bg-slate-50/50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 backdrop-blur-sm overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-white/50 dark:bg-slate-800/50">
                  <h3 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 font-mono text-sm uppercase tracking-wider">
                      <span className="text-teal-500">📡</span> Fleet Activity Feed
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-1 bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 font-mono">
                      LIVE FEED
                  </span>
              </div>
              
              <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar">
                  {loadingFeed ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="bg-white dark:bg-slate-800 p-5 rounded-lg border border-slate-200 dark:border-slate-700">
                                <div className="flex items-start gap-4">
                                    <Skeleton className="w-10 h-10 rounded" />
                                    <div className="flex-1 space-y-3">
                                        <div className="flex justify-between">
                                            <Skeleton className="h-4 w-32" />
                                            <Skeleton className="h-4 w-16" />
                                        </div>
                                        <div className="space-y-2">
                                            <Skeleton className="h-3 w-full" />
                                            <Skeleton className="h-3 w-3/4" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                  ) : teamUpdates.length === 0 ? (
                    <div className="text-center py-16 bg-white/5 dark:bg-slate-800/50 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 animate-in fade-in duration-500">
                        <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center mb-4 mx-auto">
                             <span className="text-2xl">⚡</span>
                        </div>
                        <h3 className="text-sm font-bold text-slate-600 dark:text-slate-400 font-mono uppercase">Energi Hening</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-500 mt-2 italic">"Bagaimana energi Anda hari ini?"</p>
                    </div>
                  ) : (
                    teamUpdates.map((update, index) => (
                        <div 
                            key={update.id} 
                            id={`update-${update.id}`}
                            className={`bg-white dark:bg-slate-800 p-5 rounded-lg border-l-2 border-slate-200 dark:border-slate-700 hover:border-teal-500 transition-all shadow-sm group animate-in slide-in-from-bottom-2 fill-mode-backwards ${highlightedId === update.id ? 'ring-2 ring-teal-500 shadow-[0_0_20px_rgba(20,184,166,0.3)]' : ''}`}
                            style={{ animationDelay: `${index * 100}ms` }}
                        >
                            <div className="flex items-start gap-4">
                                <div className={`w-10 h-10 rounded bg-gradient-to-br ${getAvatarColor(update.user_name)} to-slate-700 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-teal-500/20 font-mono border border-white/10`}>
                                    {update.user_name ? update.user_name.charAt(0).toUpperCase() : '?'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-slate-800 dark:text-white text-sm font-mono">{update.user_name || 'Unknown User'}</h4>
                                                {update.business_unit && (
                                                    <span className="px-1.5 py-0.5 bg-orange-500/10 text-orange-500 text-[10px] font-bold rounded border border-orange-500/20 uppercase">
                                                        {update.business_unit}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">
                                                {new Date(update.created_at).toLocaleDateString('en-US', { hour: '2-digit', minute: '2-digit' })} • LOG ENTRY #{update.id}
                                            </p>
                                        </div>
                                        {update.energy_level !== undefined && (
                                            <div className={`flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 ${getEnergyColor(update.energy_level)}`}>
                                                <span className="animate-pulse">🔋</span>
                                                <span className="font-mono font-bold text-xs">{update.energy_level}%</span>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="mt-4 grid gap-4">
                                        {update.today_plan && (
                                            <div className="relative pl-4 border-l border-teal-500/30">
                                                <div className="text-[10px] font-bold text-teal-500 mb-1 uppercase tracking-wider">Fokus</div>
                                                <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{update.today_plan}</p>
                                            </div>
                                        )}
                                        {update.done && (
                                            <div className="relative pl-4 border-l border-emerald-500/30">
                                                <div className="text-[10px] font-bold text-emerald-500 mb-1 uppercase tracking-wider">Selesai</div>
                                                <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{update.done}</p>
                                            </div>
                                        )}
                                        {update.blocker && (
                                            <div className="relative pl-4 border-l border-red-500/30 bg-red-50/50 dark:bg-red-900/10 p-2 rounded-r">
                                                <div className="text-[10px] font-bold text-red-500 mb-1 uppercase tracking-wider">Peringatan</div>
                                                <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{update.blocker}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                  )}
              </div>
          </div>
        </div>
      </div>
    </div>
  );
}
