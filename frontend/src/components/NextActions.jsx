import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, API_BASE } from '../services/api';
import DecisionModal from './DecisionModal';
import { useToast } from '../contexts/ToastContext';

export default function NextActions({ viewParams }) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState('ALL');
  const [highlightedId, setHighlightedId] = useState(null);

  // 1. Fetch Next Actions
  const { data, isLoading, error } = useQuery({
    queryKey: ['next_actions'],
    queryFn: async () => {
      const result = await apiGet(`${API_BASE}?action=inbox_next_actions`);
      if (result.ok) return result.data;
      throw new Error(result.data.error || "Gagal memuat Daftar Tugas");
    },
  });

  const items = data?.items || [];
  const energyState = data?.energy_state; // 'low', 'medium', 'high'

  // Deep linking effect
  useEffect(() => {
    if (viewParams?.id && items.length > 0) {
      setHighlightedId(parseInt(viewParams.id));
      // Try to scroll to element
      setTimeout(() => {
          const element = document.getElementById(`next-action-${viewParams.id}`);
          if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
              // Optional: open modal if supported
              const item = items.find(i => i.id == viewParams.id);
              if (item) setSelectedItem(item);
          }
      }, 500);
    }
  }, [viewParams, items]);

  // Helper to sync
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['next_actions'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
  };

  // 2. Delete Mutation
  const deleteItemMutation = useMutation({
    mutationFn: async (id) => {
      const result = await apiPost(`${API_BASE}?action=inbox_delete`, { id });
      if (!result.ok) throw new Error("Gagal menghapus item");
      return result.data;
    },
    onSuccess: () => {
      addToast("Tugas dihapus dari daftar", "success");
      invalidateAll();
    },
    onError: (err) => addToast(err.message, "error")
  });

  const updateItemMutation = useMutation({
      mutationFn: async ({ id, ...updates }) => {
          const result = await apiPost(`${API_BASE}?action=inbox_update`, { id, ...updates });
          if (!result.ok) throw new Error("Gagal memperbarui data tugas");
          return result.data;
      },
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['next_actions'] });
          addToast("Data tugas diperbarui", "success");
      },
      onError: (err) => addToast(err.message, "error")
  });

  const handleDeleteItem = (id) => {
    if (!confirm("Hapus tugas ini?")) return;
    deleteItemMutation.mutate(id);
  };

  const businessUnits = ['ALL', ...new Set(items.map(item => item.business_unit).filter(Boolean))];
  const filteredItems = selectedBusinessUnit === 'ALL' 
    ? items 
    : items.filter(item => item.business_unit === selectedBusinessUnit);

  const isSmartPick = (itemEnergy) => {
      if (!energyState || !itemEnergy) return false;
      if (energyState === 'high') return true; // High energy can do anything
      if (energyState === 'medium') return itemEnergy === 'medium' || itemEnergy === 'low';
      if (energyState === 'low') return itemEnergy === 'low';
      return false;
  };

  return (
    <div className="p-6 max-w-6xl mx-auto h-full overflow-y-auto animate-in fade-in duration-500 custom-scrollbar">
      {/* Header HUD */}
      <div className="flex justify-between items-end mb-10 relative">
        <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
                <span className="h-2 w-2 bg-teal-500 rounded-full"></span>
                <span className="text-sm font-medium text-slate-500 pb-1">Daftar Tugas</span>
            </div>
            <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
                Tugas Mendatang
            </h2>
            <div className="flex items-center gap-4 mt-4">
                <p className="text-slate-500 dark:text-slate-400 text-sm flex items-center gap-2">
                    <span className="font-medium bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">{items.length} Tugas</span>
                </p>
                {energyState && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full animate-in fade-in slide-in-from-left-4">
                         <span className="text-sm text-slate-500 font-medium">Kondisi Energi:</span>
                         <span className={`text-sm font-bold capitalize ${
                             energyState === 'high' ? 'text-emerald-600 dark:text-emerald-400' : 
                             energyState === 'medium' ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'
                         }`}>
                             {energyState === 'high' ? 'Tinggi' : energyState === 'medium' ? 'Sedang' : 'Rendah'}
                         </span>
                    </div>
                )}
            </div>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-50 text-red-600 p-6 rounded-xl mb-8 border border-red-200 animate-in slide-in-from-top-2 shadow-sm">
            <span className="font-bold text-xl mr-2">⚠️</span> {error.message}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4 pb-10">
            {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row items-center gap-6">
                    <Skeleton className="h-10 w-10 rounded-full hidden md:block" />
                    <div className="flex-1 w-full space-y-3">
                        <Skeleton className="h-6 w-3/4 rounded" />
                        <div className="flex gap-3">
                            <Skeleton className="h-4 w-20 rounded" />
                            <Skeleton className="h-4 w-20 rounded" />
                            <Skeleton className="h-4 w-20 rounded" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-32 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-700 animate-in fade-in duration-700">
            <div className="text-6xl mb-6 opacity-50">✨</div>
            <p className="text-slate-800 dark:text-slate-200 mb-2 font-bold text-lg">Tidak ada tugas</p>
            <p className="text-slate-500 text-sm">Semua tugas mendatang telah diselesaikan.</p>
        </div>
      ) : (
        <div className="space-y-4 pb-10">
            {/* Sector Filter Bar */}
            {businessUnits.length > 1 && (
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-teal-500/20">
                    {businessUnits.map(unit => (
                        <button
                            key={unit}
                            onClick={() => setSelectedBusinessUnit(unit)}
                            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all border ${
                                selectedBusinessUnit === unit
                                    ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                                    : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-teal-500 hover:text-teal-600'
                            }`}
                        >
                            {unit === 'ALL' ? 'Semua Unit' : unit}
                        </button>
                    ))}
                </div>
            )}

            {filteredItems.map((item, index) => {
              const smartPick = isSmartPick(item);
              return (
              <div 
                key={item.id}
                id={`next-action-${item.id}`} 
                className={`group relative bg-white dark:bg-slate-800 p-6 rounded-xl border transition-all duration-300 flex flex-col md:flex-row items-start md:items-center gap-6 animate-in slide-in-from-bottom-2 fill-mode-backwards hover:shadow-md ${
                    highlightedId === item.id ? 'ring-2 ring-teal-500 shadow-xl' : ''
                } ${
                    smartPick 
                    ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10' 
                    : 'border-slate-200 dark:border-slate-700 hover:border-teal-300 dark:hover:border-teal-700'
                }`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                
                {/* ID/Index Marker */}
                <div className={`hidden md:flex flex-col items-center justify-center w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 transition-colors ${smartPick ? 'group-hover:border-emerald-500/30' : 'group-hover:border-teal-500/30'}`}>
                    <span className={`text-sm font-medium ${smartPick ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-teal-400'}`}>{index + 1}</span>
                </div>

                <div className="flex-1 relative z-10 w-full">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                        <p className={`text-lg font-medium leading-relaxed transition-colors ${smartPick ? 'text-emerald-900 dark:text-emerald-100' : 'text-slate-800 dark:text-slate-200 group-hover:text-teal-700 dark:group-hover:text-teal-300'}`}>
                            {item.content}
                        </p>
                        {/* Task Controls */}
                        <div className="flex flex-wrap items-center gap-4 mt-3 opacity-60 group-hover:opacity-100 transition-opacity duration-300">
                             {/* Energy Level */}
                             <div className="flex items-center gap-2">
                                 <span className="text-xs font-medium text-slate-400">Energi:</span>
                                 <div className="flex gap-1">
                                     {['low', 'medium', 'high'].map(lvl => (
                                         <button
                                            key={lvl}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                updateItemMutation.mutate({ id: item.id, energy_level: lvl });
                                            }}
                                            className={`w-5 h-5 flex items-center justify-center text-[10px] font-bold uppercase rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border ${
                                                item.energy_level === lvl 
                                                ? (lvl === 'high' ? 'text-red-600 bg-red-50 border-red-200' : lvl === 'medium' ? 'text-yellow-600 bg-yellow-50 border-yellow-200' : 'text-emerald-600 bg-emerald-50 border-emerald-200')
                                                : 'text-slate-400 border-transparent'
                                            }`}
                                            title={`Energi: ${lvl}`}
                                         >
                                             {lvl[0].toUpperCase()}
                                         </button>
                                     ))}
                                 </div>
                             </div>

                             {/* Importance */}
                             <div className="flex items-center gap-2">
                                 <span className="text-xs font-medium text-slate-400">Penting:</span>
                                 <div className="flex gap-1">
                                     {[2, 5, 8].map((val, i) => {
                                         const label = ['R', 'S', 'T'][i];
                                         const isSelected = (val === 2 && (item.importance || 0) <= 3) ||
                                                            (val === 5 && (item.importance || 0) >= 4 && (item.importance || 0) <= 7) ||
                                                            (val === 8 && (item.importance || 0) >= 8);
                                         return (
                                         <button
                                            key={label}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                updateItemMutation.mutate({ id: item.id, importance: val });
                                            }}
                                            className={`w-5 h-5 flex items-center justify-center text-[10px] font-bold uppercase rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border ${
                                                isSelected
                                                ? 'text-teal-600 bg-teal-50 border-teal-200'
                                                : 'text-slate-400 border-transparent'
                                            }`}
                                            title={`Penting: ${label}`}
                                         >
                                             {label}
                                         </button>
                                     )})}
                                 </div>
                             </div>

                             {/* Urgency */}
                             <div className="flex items-center gap-2">
                                 <span className="text-xs font-medium text-slate-400">Mendesak:</span>
                                 <div className="flex gap-1">
                                     {[2, 5, 8].map((val, i) => {
                                         const label = ['R', 'S', 'T'][i];
                                         const isSelected = (val === 2 && (item.urgency || 0) <= 3) ||
                                                            (val === 5 && (item.urgency || 0) >= 4 && (item.urgency || 0) <= 7) ||
                                                            (val === 8 && (item.urgency || 0) >= 8);
                                         return (
                                         <button
                                            key={label}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                updateItemMutation.mutate({ id: item.id, urgency: val });
                                            }}
                                            className={`w-5 h-5 flex items-center justify-center text-[10px] font-bold uppercase rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border ${
                                                isSelected
                                                ? 'text-orange-600 bg-orange-50 border-orange-200'
                                                : 'text-slate-400 border-transparent'
                                            }`}
                                            title={`Mendesak: ${label}`}
                                         >
                                             {label}
                                         </button>
                                     )})}
                                 </div>
                             </div>
                        </div>
                    </div>
                    {item.business_unit && (
                        <span className="shrink-0 px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-medium text-slate-500 tracking-wide">
                            {item.business_unit}
                        </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-3">
                    <div className={`flex items-center gap-2 px-2 py-1 rounded text-[10px] font-medium tracking-wide ${
                        smartPick 
                        ? 'bg-emerald-100 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
                        : 'bg-slate-100 dark:bg-slate-950/30 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                    }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${smartPick ? 'bg-emerald-500' : 'bg-slate-500'}`}></span>
                        {smartPick ? 'Rekomendasi' : 'Menunggu'}
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium tracking-wide flex items-center gap-2">
                      <span className="text-slate-500 dark:text-slate-600">Dibuat:</span>
                      {new Date(item.created_at || Date.now()).toLocaleDateString('id-ID')}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 w-full md:w-auto mt-4 md:mt-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all transform md:translate-x-4 md:group-hover:translate-x-0 relative z-10">
                  <button 
                    onClick={() => setSelectedItem(item)}
                    className={`flex-1 md:flex-none px-5 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 group/btn ${
                        smartPick
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-100 dark:hover:bg-emerald-500/20'
                        : 'bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-500/30 hover:bg-teal-100 dark:hover:bg-teal-500/20'
                    }`}
                  >
                    Kerjakan
                  </button>
                  <button 
                    onClick={() => handleDeleteItem(item.id)}
                    className="px-3 py-2 bg-white dark:bg-slate-800/50 text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-red-200 dark:hover:border-red-500/50 hover:text-red-400 rounded-lg transition-all"
                    title="Hapus Tugas"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              );
            })}
        </div>
      )}

      {selectedItem && (
        <DecisionModal 
          item={selectedItem} 
          onClose={() => {
            setSelectedItem(null);
            invalidateAll();
          }} 
        />
      )}
    </div>
  );
}
