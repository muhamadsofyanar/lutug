import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, API_BASE } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import CompletionLogModal from './CompletionLogModal';
import BusinessUnitModal from './BusinessUnitModal';
import AttachmentManager from './AttachmentManager';
import TaskComments from './TaskComments';
import EnergyAuditModal from './EnergyAuditModal';
import TaskModal from './TaskModal';

export default function Today({ viewParams }) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [editingTask, setEditingTask] = useState(null);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [completionModal, setCompletionModal] = useState({
    isOpen: false,
    taskId: null,
    mode: 'complete', // 'complete' | 'terminate'
    taskTitle: ''
  });
  const [showDirection, setShowDirection] = useState(true);
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState('ALL');
  const [highlightedId, setHighlightedId] = useState(null);
  const [sortMode, setSortMode] = useState('default'); // 'default', 'importance', 'urgency', 'score'
  const [refSearch, setRefSearch] = useState(''); // Search state for references
  const [isRadarView, setIsRadarView] = useState(false); // Toggle for Radar View
  const [showEnergyAudit, setShowEnergyAudit] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const getWeekDays = (baseYmd) => {
    const d = new Date(baseYmd);
    const day = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
    const days = [];
    for (let i = 0; i < 7; i++) {
      const di = new Date(monday);
      di.setDate(monday.getDate() + i);
      days.push(di.toISOString().split('T')[0]);
    }
    return days;
  };

  // 1. Fetch Today's Data
  const { data, isLoading, error } = useQuery({
    queryKey: ['today', selectedDate],
    queryFn: async () => {
      const result = await apiGet(`${API_BASE}?action=task_list&date=${encodeURIComponent(selectedDate)}`);
      if (result.ok) return result.data;
      throw new Error(result.data.error || "Gagal memuat tugas hari ini");
    }
  });

  // Fetch Business Units
  const { data: fetchedUnits = [] } = useQuery({
    queryKey: ['business_units'],
    queryFn: async () => {
        const result = await apiGet(`${API_BASE}?action=business_unit_list`);
        if (result.ok) return result.data.units || [];
        return [];
    }
  });

  // 2. Fetch Weekly Direction for Banner
  const { data: directions = [] } = useQuery({
    queryKey: ['weekly_directions', selectedBusinessUnit],
    queryFn: async () => {
        const unit = selectedBusinessUnit === 'ALL' ? '' : selectedBusinessUnit;
        const result = await apiGet(`${API_BASE}?action=weekly_list&business_unit=${encodeURIComponent(unit)}`);
        if (result.ok) return result.data.weekly_directions || [];
        return [];
    }
  });

  // Fetch References for Contextual Linking
  const { data: references = [] } = useQuery({
    queryKey: ['references'],
    queryFn: async () => {
        const result = await apiGet(`${API_BASE}?action=reference_list`);
        if (result.ok) return result.data.items || [];
        return [];
    }
  });

  // Helper to get current week's direction
  const getCurrentDirection = () => {
      const today = new Date();
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1); 
      const monday = new Date(today.setDate(diff));
      monday.setHours(0, 0, 0, 0);
      const offset = monday.getTimezoneOffset();
      const mondayStr = new Date(monday.getTime() - (offset*60*1000)).toISOString().split('T')[0];
      
      return directions.find(d => d.week_start === mondayStr)?.content || null;
  };

  const currentDirection = getCurrentDirection();

  const tasks = data?.tasks || [];
  
  // Deep linking effect
  useEffect(() => {
    if (viewParams?.id && tasks.length > 0) {
      setHighlightedId(parseInt(viewParams.id));
      const task = tasks.find(t => t.id == viewParams.id);
      
      // Auto-open modal if task exists
      if (task) {
          setEditingTask(task);
      }
      
      // Try to scroll to element
      setTimeout(() => {
          const element = document.getElementById(`task-${viewParams.id}`);
          if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
      }, 500);
    }
  }, [viewParams, tasks]);

  // Business Unit Logic
  const businessUnits = ['ALL', ...new Set([...(fetchedUnits.map(u => u.name)), ...tasks.map(t => t.business_unit).filter(Boolean)])];
  
  // Sorting & Filtering Logic
  const filteredTasks = React.useMemo(() => {
    let result = tasks;
    if (selectedBusinessUnit !== 'ALL') {
        result = result.filter(t => t.business_unit === selectedBusinessUnit);
    }
    return result;
  }, [tasks, selectedBusinessUnit]);

  const sortedTasks = React.useMemo(() => {
    if (sortMode === 'default') return filteredTasks;
    
    return [...filteredTasks].sort((a, b) => {
        const impA = a.importance || 0;
        const impB = b.importance || 0;
        const urgA = a.urgency || 0;
        const urgB = b.urgency || 0;
        
        if (sortMode === 'importance') return impB - impA; // High to Low
        if (sortMode === 'urgency') return urgB - urgA;    // High to Low
        if (sortMode === 'score') return (impB + urgB) - (impA + urgA); // High Matrix Score to Low
        return 0;
    });
  }, [filteredTasks, sortMode]);

  const summary = {
    total: data?.total_decisions || 0,
    date: data?.date || ''
  };

  // Progress Calculation
  const totalOps = filteredTasks.length + summary.total;
  const progressPercent = totalOps === 0 ? 0 : Math.round((summary.total / totalOps) * 100);
  const strokeDashoffset = 100 - progressPercent;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['today', selectedDate] });
    queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
  };

  // Mutations
  const completeTaskMutation = useMutation({
    mutationFn: async ({ taskId, reason, mode }) => {
      const action = mode === 'terminate' ? 'task_terminate' : 'task_complete';
      const result = await apiPost(`${API_BASE}?action=${action}`, { 
        taskId: taskId,
        reason: reason,
        actor: "Me" 
      });
      if (!result.ok) throw new Error(result.data?.error || `Gagal menyelesaikan/menterminasi tugas`);
      return result.data;
    },
    onMutate: async ({ taskId }) => {
      await queryClient.cancelQueries({ queryKey: ['today', selectedDate] });
      const previousData = queryClient.getQueryData(['today', selectedDate]);
      queryClient.setQueryData(['today', selectedDate], (old) => {
        if (!old) return old;
        return {
          ...old,
          tasks: old.tasks.filter(t => t.id !== taskId)
        };
      });
      return { previousData };
    },
    onError: (err, variables, context) => {
      addToast(`Gagal memperbarui tugas: ${err.message}`, "error");
      if (context?.previousData) {
        queryClient.setQueryData(['today', selectedDate], context.previousData);
      }
    },
    onSettled: () => {
      invalidateAll();
      setCompletionModal(prev => ({ ...prev, isOpen: false }));
    },
    onSuccess: (data, variables) => {
      const msg = variables.mode === 'terminate' ? "Tugas diterminasi" : "Tugas selesai!";
      addToast(msg, "success");
    }
  });

  const updateAttributesMutation = useMutation({
    mutationFn: async ({ taskId, energy_level, context_tags, business_unit, importance, urgency, linked_references }) => {
      const result = await apiPost(`${API_BASE}?action=task_update_attributes`, {
        taskId,
        energy_level,
        context_tags,
        business_unit,
        importance,
        urgency,
        linked_references
      });
      if (!result.ok) throw new Error("Gagal memperbarui atribut");
      return result.data;
    },
    onSuccess: () => {
      invalidateAll();
      // Don't close modal, just refresh data
      // We need to update local state of editingTask to reflect changes if we want live update
      // But invalidateAll will re-fetch. 
      // Ideally we update editingTask with new values.
      addToast("Konteks disimpan", "success");
    },
    onMutate: async (newAttributes) => {
        // Optimistic update for editingTask
        setEditingTask(prev => ({ ...prev, ...newAttributes }));
    },
    onError: () => {
      addToast("Gagal memperbarui atribut", "error");
    }
  });

  const handleRequestComplete = (task) => {
    setCompletionModal({
      isOpen: true,
      taskId: task.id,
      mode: 'complete',
      taskTitle: task.title
    });
  };

  const handleRequestTerminate = (task) => {
    if (!task) return;
    setCompletionModal({
      isOpen: true,
      taskId: task.id,
      mode: 'terminate',
      taskTitle: task.title
    });
  };

  const handleConfirmCompletion = (reason) => {
    completeTaskMutation.mutate({
      taskId: completionModal.taskId,
      reason: reason,
      mode: completionModal.mode
    });
  };

  const getEnergyIcon = (level) => {
    switch(level) {
      case 'high': return '🔋';
      case 'medium': return '⚡';
      case 'low': return '🪫';
      default: return '⚡';
    }
  };

  const getContextIcon = (tag) => {
    if (!tag) return null;
    const lower = tag.toLowerCase();
    if (lower.includes('laptop')) return '💻';
    if (lower.includes('hp') || lower.includes('phone')) return '📱';
    if (lower.includes('meeting')) return '🗣️';
    if (lower.includes('deep')) return '🧠';
    return '🏷️';
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

  const generateTacticalPlan = () => {
      // AI Logic: Sort by Score (Importance * 1.5 + Urgency) + Energy Factor
      addToast("Menganalisis prioritas...", "info");
      
      setTimeout(() => {
        setSortMode('score');
        addToast("Prioritas tugas diurutkan berdasarkan dampak", "success");
      }, 800);
  };

  const renderMarkdownSnippet = (text) => {
      if (!text) return null;
      const firstLines = text.split('\n').slice(0, 3);
      return (
          <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
              {firstLines.map((line, idx) => (
                  <p key={idx} className="truncate">{line.replace(/^#+\s/, '').replace(/^[-*]\s/, '• ')}</p>
              ))}
              {text.split('\n').length > 3 && <p className="text-xs text-teal-500 mt-1">...selengkapnya</p>}
          </div>
      );
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto h-full overflow-y-auto overflow-x-hidden animate-in fade-in zoom-in-95 duration-500">
      {/* HUD Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 relative gap-4 md:gap-0">
        <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
                <span className="h-2 w-2 bg-emerald-500 rounded-full"></span>
                <span className="text-xs font-medium text-slate-500 uppercase">Hari Ini</span>
            </div>
            <h2 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">
                Fokus Hari Ini
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                {new Date(selectedDate).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
        </div>
        
        {/* HUD Stat Box */}
        <div className="relative group">
            <div className="relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl flex items-center gap-4 min-w-[200px] shadow-sm">
                <div className="relative h-16 w-16 flex items-center justify-center">
                    <svg className="h-full w-full rotate-[-90deg]" viewBox="0 0 36 36">
                        {/* Background Track */}
                        <path className="text-slate-100 dark:text-slate-700" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                        {/* Progress Ring */}
                        <path 
                            className="text-teal-500 transition-all duration-1000 ease-out" 
                            strokeDasharray="100, 100" 
                            strokeDashoffset={strokeDashoffset}
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="3" 
                            strokeLinecap="round"
                        />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center flex-col">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{progressPercent}%</span>
                    </div>
                </div>
                <div>
                    <div className="text-[10px] text-slate-500 uppercase font-bold mb-0.5">Progres</div>
                    <div className="text-2xl font-bold text-slate-800 dark:text-white leading-none">
                        {summary.total} <span className="text-sm text-slate-400 font-medium">/ {totalOps} Selesai</span>
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* Energy Advice (Phase 5) */}
      {data?.energy_advice && (
          <div className="mb-6 relative overflow-hidden rounded-xl border border-yellow-200 bg-yellow-50 p-4">
               <div className="relative flex items-start gap-3">
                   <span className="text-xl">💡</span>
                   <p className="text-sm text-yellow-800 leading-relaxed">
                       {data.energy_advice}
                   </p>
               </div>
          </div>
      )}

      {/* Weekly Direction Hologram */}
      {currentDirection && (
          <div className="relative group mb-8 overflow-hidden rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="relative p-6 z-10">
                  <div className="flex justify-between items-center mb-3">
                      <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-2">
                          <span className="w-2 h-2 bg-teal-500 rounded-full"></span>
                          Arahan Minggu Ini
                      </h3>
                      <button 
                        onClick={() => setShowDirection(!showDirection)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors text-xs font-medium px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                          {showDirection ? 'Sembunyikan' : 'Tampilkan'}
                      </button>
                  </div>
                  {showDirection && (
                      <div className="animate-in slide-in-from-top-2 duration-300 pl-4 border-l-2 border-slate-200 dark:border-slate-700">
                          {renderMarkdownSnippet(currentDirection)}
                      </div>
                  )}
              </div>
          </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 border border-red-100 flex items-center gap-3 animate-in slide-in-from-top-2">
            <span className="text-xl">⚠️</span>
            <span className="font-medium">{error.message}</span>
        </div>
      )}

      {/* Filter & Sort Bar (Phase 6) */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          {/* Business Unit Filter */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 no-scrollbar max-w-full">
               <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap">Unit:</span>
               {businessUnits.map(unit => (
                   <button
                       key={unit}
                       onClick={() => setSelectedBusinessUnit(unit)}
                       className={`px-3 py-1 rounded text-xs font-medium transition-all whitespace-nowrap ${
                           selectedBusinessUnit === unit
                           ? 'bg-teal-500 text-white shadow-sm'
                           : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                       }`}
                   >
                       {unit}
                   </button>
               ))}
          </div>

          {/* Controls: View, Sort, AI */}
          <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                  <button 
                      onClick={() => {
                          const d = new Date(selectedDate);
                          d.setDate(d.getDate() - 1);
                          setSelectedDate(d.toISOString().split('T')[0]);
                      }} 
                      className="px-2 py-1 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                  >
                      ←
                  </button>
                  <input 
                      type="date" 
                      value={selectedDate} 
                      onChange={(e) => setSelectedDate(e.target.value)} 
                      className="px-2 py-1 rounded text-[12px] bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 focus:border-teal-500 outline-none"
                  />
                  <button 
                      onClick={() => {
                          const d = new Date(selectedDate);
                          d.setDate(d.getDate() + 1);
                          setSelectedDate(d.toISOString().split('T')[0]);
                      }} 
                      className="px-2 py-1 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                  >
                      →
                  </button>
              </div>
              <div className="hidden md:flex items-center gap-1 bg-slate-100 dark:bg-slate-900 rounded-lg p-1">
                {getWeekDays(selectedDate).map((ymd) => {
                  const isActive = ymd === selectedDate;
                  const label = new Date(ymd).toLocaleDateString('id-ID', { weekday: 'short' }).substring(0, 2);
                  const dayNum = new Date(ymd).getDate();
                  return (
                    <button
                      key={ymd}
                      onClick={() => setSelectedDate(ymd)}
                      className={`px-2 py-1 rounded text-[10px] font-medium transition-all flex items-center gap-1 ${
                        isActive ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                      }`}
                      title={new Date(ymd).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    >
                      <span>{label}</span>
                      <span className="text-[10px] text-slate-400">·</span>
                      <span>{dayNum}</span>
                    </button>
                  );
                })}
              </div>
              {/* View Toggle */}
              <div className="flex bg-slate-100 dark:bg-slate-900 rounded-lg p-1 gap-1">
                 <button 
                    onClick={() => setIsRadarView(false)}
                    className={`px-2 py-1 rounded text-[10px] font-medium transition-all flex items-center gap-1 ${!isRadarView ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                 >
                    <span>📋</span> <span className="hidden sm:inline">Daftar</span>
                 </button>
                 <button 
                    onClick={() => setIsRadarView(true)}
                    className={`px-2 py-1 rounded text-[10px] font-medium transition-all flex items-center gap-1 ${isRadarView ? 'bg-white dark:bg-slate-700 text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                 >
                    <span>🎯</span> <span className="hidden sm:inline">Radar</span>
                 </button>
              </div>

              <div className="w-px h-6 bg-slate-200 dark:bg-slate-700"></div>

              {/* Sort Controls */}
              <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap hidden lg:inline">Urut:</span>
                  <div className="flex bg-slate-100 dark:bg-slate-900 rounded-lg p-1 gap-1">
                      {[
                          { id: 'default', label: 'Waktu', icon: '🕒' },
                          { id: 'importance', label: 'Penting', icon: '⭐' },
                          { id: 'urgency', label: 'Mendesak', icon: '🔥' },
                          { id: 'score', label: 'Skor', icon: '💎' }
                      ].map(mode => (
                          <button
                              key={mode.id}
                              onClick={() => setSortMode(mode.id)}
                              disabled={isRadarView}
                              className={`px-2 py-1 rounded text-[10px] font-medium transition-all flex items-center gap-1 ${
                                  sortMode === mode.id
                                  ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-sm'
                                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                              } ${isRadarView ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                              <span>{mode.icon}</span>
                              <span className="hidden sm:inline">{mode.label}</span>
                          </button>
                      ))}
                  </div>
              </div>

              <div className="w-px h-6 bg-slate-300 dark:bg-slate-700"></div>

              <button 
                onClick={generateTacticalPlan}
                className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-500 text-[10px] hover:bg-amber-500/20 transition-all flex items-center gap-2 font-medium shadow-sm"
              >
                <span>🤖</span> <span className="hidden sm:inline">Buat Rencana</span>
              </button>

              <button 
                onClick={() => setShowEnergyAudit(true)}
                className="px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-500 text-[10px] font-mono hover:bg-green-500/20 transition-all flex items-center gap-2 font-bold shadow-sm"
              >
                <span>🔋</span> <span className="hidden sm:inline">AUDIT</span>
              </button>
          </div>
        </div>

      {/* Task List or Radar View */}
      {isRadarView ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden min-h-[500px]">
            {/* Radar Grid */}
            <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 pointer-events-none">
                <div className="border-r border-b border-slate-800/50 bg-green-900/5 relative">
                     <span className="absolute top-2 left-2 text-green-500/30 text-xs font-mono font-bold uppercase">Jadwalkan (Q2)</span>
                </div>
                <div className="border-b border-slate-800/50 bg-red-900/5 relative">
                     <span className="absolute top-2 right-2 text-red-500/30 text-xs font-mono font-bold uppercase">Kerjakan (Q1)</span>
                </div>
                <div className="border-r border-slate-800/50 bg-slate-800/5 relative">
                     <span className="absolute bottom-2 left-2 text-slate-500/30 text-xs font-mono font-bold uppercase">Eliminasi (Q4)</span>
                </div>
                <div className="bg-yellow-900/5 relative">
                     <span className="absolute bottom-2 right-2 text-yellow-500/30 text-xs font-mono font-bold uppercase">Delegasikan (Q3)</span>
                </div>
            </div>

            {/* Axis Labels */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 -rotate-90 text-xs text-slate-600 font-mono tracking-widest">PENTING</div>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-xs text-slate-600 font-mono tracking-widest">MENDESAK</div>

            {/* Tasks Plot */}
            <div className="relative h-full w-full">
                {filteredTasks.map(task => {
                    const imp = task.importance || 0;
                    const urg = task.urgency || 0;
                    // Y axis: Importance (0-10). 10 is top.
                    // X axis: Urgency (0-10). 10 is right.
                    const topPos = (10 - imp) * 10; 
                    const leftPos = urg * 10;
                    
                    return (
                        <div 
                            key={task.id}
                            className="absolute transform -translate-x-1/2 -translate-y-1/2 group cursor-pointer transition-all duration-500 ease-out hover:z-20"
                            style={{ top: `${topPos}%`, left: `${leftPos}%` }}
                            onClick={() => {
                                setEditingTask(task);
                                setHighlightedId(task.id);
                            }}
                        >
                            <div className={`w-3 h-3 rounded-full border shadow-lg ${
                                imp >= 5 && urg >= 5 ? 'bg-red-500 border-red-300 shadow-red-500/50' :
                                imp >= 5 ? 'bg-green-500 border-green-300 shadow-green-500/50' :
                                urg >= 5 ? 'bg-yellow-500 border-yellow-300 shadow-yellow-500/50' :
                                'bg-slate-500 border-slate-300 shadow-slate-500/50'
                            }`}></div>
                            
                            {/* Tooltip */}
                            <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-900 border border-slate-700 px-2 py-1 rounded text-[10px] text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none shadow-xl">
                                <span className="font-bold text-white">{task.title}</span>
                                <span className="block text-slate-500 text-[9px]">{task.business_unit || 'TANPA_UNIT'}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
      ) : (
      /* Task List Grid */
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
              <div className="relative w-16 h-16 mb-4">
                  <div className="absolute inset-0 border-4 border-teal-500/20 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-teal-500 rounded-full border-t-transparent animate-spin"></div>
              </div>
              <p className="font-mono text-teal-500 animate-pulse tracking-widest">MEMUAT DATA STREAM...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-20 bg-white/5 dark:bg-slate-900/50 backdrop-blur-md rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 animate-in fade-in duration-700 group hover:border-teal-500/50 transition-colors">
            <div className="text-7xl mb-6 opacity-80 group-hover:scale-110 transition-transform duration-500 filter drop-shadow-[0_0_15px_rgba(20,184,166,0.3)]">✨</div>
            <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-2 font-mono">SEMUA SISTEM BERSIH</h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto font-mono text-sm">
              Tidak ada perintah aktif. Standby untuk order baru di <span className="text-teal-500">Inbox</span>.
            </p>
          </div>
        ) : sortedTasks.length === 0 ? (
            <div className="text-center py-12 bg-slate-100/50 dark:bg-slate-900/30 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                <p className="font-mono text-slate-500 dark:text-slate-400">TIDAK ADA TUGAS TAKTIS DITEMUKAN</p>
                <button onClick={() => { setSelectedBusinessUnit('ALL'); setSortMode('default'); }} className="mt-2 text-xs text-teal-500 hover:underline">RESET FILTER</button>
            </div>
        ) : (
          sortedTasks.map((task, index) => (
            <div 
                key={task.id} 
                id={`task-${task.id}`}
                className={`group relative bg-white dark:bg-slate-900/80 backdrop-blur-sm rounded-xl border p-1 hover:border-teal-500/50 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(20,184,166,0.15)] animate-in slide-in-from-bottom-2 fill-mode-backwards ${
                    highlightedId === task.id ? 'ring-2 ring-teal-500 shadow-[0_0_30px_rgba(20,184,166,0.3)] border-transparent' : 
                    task.urgency > 8 ? 'border-red-500/30 dark:border-red-500/30' : 
                    task.importance > 8 ? 'border-amber-500/30 dark:border-amber-500/30' :
                    'border-slate-200 dark:border-slate-800'
                }`}
                style={{ animationDelay: `${index * 75}ms` }}
                onClick={(e) => {
                    if (e.target.closest('button[role="checkbox"]')) return;
                    setEditingTask(task);
                }}
            >
              {/* Corner Accents */}
              <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-transparent group-hover:border-teal-500 transition-colors duration-300 rounded-tl-lg"></div>
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-transparent group-hover:border-teal-500 transition-colors duration-300 rounded-br-lg"></div>

              <div className="flex items-start gap-4 p-4 rounded-lg bg-slate-50/50 dark:bg-slate-800/30">
                  <button 
                    role="checkbox"
                    className="mt-1 w-6 h-6 rounded bg-slate-200 dark:bg-slate-800 border-2 border-slate-400 dark:border-slate-600 hover:border-teal-500 hover:shadow-[0_0_10px_rgba(20,184,166,0.5)] flex items-center justify-center transition-all group/checkbox relative overflow-hidden"
                    onClick={() => handleRequestComplete(task)}
                    disabled={completeTaskMutation.isPending}
                  >
                     <span className="opacity-0 group-hover/checkbox:opacity-100 text-teal-500 text-xs font-bold">✓</span>
                     {completeTaskMutation.isPending && completeTaskMutation.variables?.taskId === task.id && (
                         <div className="absolute inset-0 bg-teal-500 animate-ping opacity-20"></div>
                     )}
                  </button>
                  
                  <div className="flex-1 min-w-0">
                      <h4 className="text-slate-800 dark:text-slate-100 font-bold text-lg leading-tight mb-2 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors truncate font-sans">
                          {task.title}
                      </h4>
                      
                      <div className="flex flex-wrap gap-2 items-center">
                          <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] rounded uppercase tracking-wider font-mono">
                              {task.slot || 'BACKLOG'}
                          </span>

                          {task.status === 'in_progress' && (
                              <span className="px-2 py-0.5 bg-teal-600 text-white text-[10px] rounded uppercase tracking-wider font-mono animate-pulse shadow-[0_0_10px_rgba(20,184,166,0.5)] flex items-center gap-1">
                                  <span className="animate-spin text-[8px]">⏳</span> SEDANG DIKERJAKAN
                              </span>
                          )}

                          {task.recurrence_pattern && (
                                            <span className="px-2 py-0.5 bg-emerald-900/30 border border-emerald-500/30 text-emerald-400 text-[10px] rounded uppercase tracking-wider font-mono flex items-center gap-1" title={`Repeats: ${task.recurrence_pattern}`}>
                                                <span>🔁</span> {task.recurrence_pattern === 'daily' ? 'HARIAN' : task.recurrence_pattern === 'weekly' ? 'MINGGUAN' : task.recurrence_pattern === 'monthly' ? 'BULANAN' : 'ULANG'}
                                            </span>
                                        )}
                          
                          {task.energy_level && (
                              <span className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border uppercase font-bold tracking-wider font-mono ${
                                  task.energy_level === 'high' ? 'bg-green-900/20 text-green-400 border-green-500/30' :
                                  task.energy_level === 'medium' ? 'bg-yellow-900/20 text-yellow-400 border-yellow-500/30' :
                                  'bg-red-900/20 text-red-400 border-red-500/30'
                              }`}>
                                  {getEnergyIcon(task.energy_level)} {task.energy_level === 'high' ? 'TINGGI' : task.energy_level === 'medium' ? 'SEDANG' : 'RENDAH'}
                              </span>
                          )}

                          {task.context_tags && (
                              <span className="flex items-center gap-1 text-[10px] text-teal-400 bg-teal-900/20 px-2 py-0.5 rounded border border-teal-500/30 font-mono uppercase tracking-wider">
                                  {getContextIcon(task.context_tags)} {task.context_tags}
                              </span>
                          )}
                      </div>
                  </div>

                  <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col gap-1">
                      <span className="text-[10px] text-teal-500 font-mono">[EDIT]</span>
                  </div>
                </div>
            </div>
          ))
        )}
      </div>
      )}

      {/* Futuristic Modal */}
      {showEnergyAudit && <EnergyAuditModal onClose={() => setShowEnergyAudit(false)} />}
      
      {editingTask && (
        <TaskModal 
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onTerminate={(task) => {
             handleRequestTerminate(task);
             setEditingTask(null);
          }}
          businessUnits={businessUnits}
          onOpenUnitModal={() => setShowUnitModal(true)}
          references={references}
        />
      )}


      {/* Decision Log Modal */}
      {completionModal.isOpen && (
        <CompletionLogModal
            task={{ title: completionModal.taskTitle }}
            mode={completionModal.mode}
            onClose={() => setCompletionModal(prev => ({ ...prev, isOpen: false }))}
            onConfirm={handleConfirmCompletion}
            isSubmitting={completeTaskMutation.isPending}
        />
      )}

      {showUnitModal && <BusinessUnitModal onClose={() => setShowUnitModal(false)} />}
    </div>
  );
}
