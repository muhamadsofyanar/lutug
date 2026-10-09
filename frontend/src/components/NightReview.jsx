import React, { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, API_BASE } from '../services/api';
import { useToast } from '../contexts/ToastContext';

export default function NightReview() {
  const [tasks, setTasks] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [completedCount, setCompletedCount] = useState(0);
  const [shrinkMode, setShrinkMode] = useState(false);
  const [shrinkTitle, setShrinkTitle] = useState("");
  const [projectMode, setProjectMode] = useState(false);
  const [projectTitle, setProjectTitle] = useState("");
  const [isFinished, setIsFinished] = useState(false);
  const [businessUnits, setBusinessUnits] = useState([]);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const { addToast } = useToast();

  useEffect(() => {
    loadTasks();
    loadBusinessUnits();
  }, [selectedUnit]);

  // Keyboard shortcuts
  useEffect(() => {
      const handleKeyDown = (e) => {
          if (loading || isFinished || shrinkMode || projectMode || tasks.length === 0) return;
          
          switch(e.key) {
              case '1': handleDecision('done'); break;
              case '2': handleDecision('tomorrow'); break;
              case '3': setShrinkMode(true); break;
              case '4': setProjectMode(true); break;
              case '5': 
                if(confirm("Yakin hapus/arsipkan?")) handleDecision('archive'); 
                break;
              default: break;
          }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loading, isFinished, shrinkMode, projectMode, tasks, currentIndex]);

  const loadBusinessUnits = async () => {
    const result = await apiGet(`${API_BASE}?action=business_unit_list`);
    if (result.ok) {
        setBusinessUnits(result.data.units || []);
    }
  };

  const loadTasks = async () => {
    setLoading(true);
    let url = `${API_BASE}?action=task_list`;
    if (selectedUnit) {
        url += `&business_unit=${encodeURIComponent(selectedUnit)}`;
    }
    const result = await apiGet(url);
    if (result.ok) {
      const allTasks = result.data.tasks || [];
      const pending = allTasks.filter(t => t.status === 'pending');
      setTasks(pending);
    } else {
        addToast("Gagal memuat data review", "error");
    }
    setLoading(false);
  };

  const currentTask = tasks[currentIndex];

  const handleDecision = async (decision, extraData = {}) => {
    if (!currentTask) return;

    let action = 'night_review_decide';
    let payload = { taskId: currentTask.id, decision, ...extraData };

    if (decision === 'done') {
        action = 'task_complete';
        payload = { taskId: currentTask.id };
    }

    // Optimistic update
    if (decision === 'done') setCompletedCount(c => c + 1);
    nextTask();

    // Fire and forget (or handle error quietly)
    apiPost(`${API_BASE}?action=${action}`, payload).then(result => {
        if (!result.ok) {
            addToast("Gagal menyimpan keputusan (error sinkronisasi)", "error");
        }
    });
  };

  const nextTask = () => {
    setShrinkMode(false);
    setShrinkTitle("");
    setProjectMode(false);
    setProjectTitle("");
    if (currentIndex < tasks.length - 1) {
      setCurrentIndex(c => c + 1);
    } else {
      setIsFinished(true);
    }
  };

  if (loading) return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 animate-in fade-in duration-700">
          <div className="relative mb-4">
              <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-teal-500 animate-spin"></div>
          </div>
          <p className="font-medium text-sm text-slate-400">Menyiapkan review...</p>
      </div>
  );

  if (isFinished || tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full max-w-3xl mx-auto p-6 text-center animate-in fade-in zoom-in duration-500">
        <div className="bg-white dark:bg-slate-800 p-10 rounded-3xl border border-slate-200 dark:border-slate-700 max-w-lg w-full relative overflow-hidden shadow-sm">
            
            <div className="text-6xl mb-6">✨</div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Review Selesai</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-8 text-sm">Semua tugas hari ini telah diproses.</p>
            
            <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-800">
                    <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mb-1">{completedCount}</div>
                    <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">Diselesaikan</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/30 p-5 rounded-2xl border border-slate-100 dark:border-slate-600">
                    <div className="text-3xl font-bold text-slate-600 dark:text-slate-300 mb-1">{tasks.length - completedCount}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-bold">Ditunda/Lainnya</div>
                </div>
            </div>

            <button 
                className="w-full py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 font-bold text-sm transition-all shadow-sm" 
                onClick={() => window.location.reload()}
            >
                Mulai Ulang Review
            </button>
        </div>
      </div>
    );
  }

  const progress = ((currentIndex) / tasks.length) * 100;

  return (
    <div className="h-full flex flex-col max-w-4xl mx-auto p-6 relative">
      {/* Business Unit Selector */}
      <div className="absolute top-6 right-6 z-50">
        <select 
            className="bg-white/80 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 shadow-sm"
            value={selectedUnit || ''}
            onChange={(e) => {
                setSelectedUnit(e.target.value || null);
                setCurrentIndex(0);
                setIsFinished(false);
            }}
        >
            <option value="">Semua Unit</option>
            {businessUnits.map(u => (
                <option key={u.id} value={u.name}>{u.name}</option>
            ))}
        </select>
      </div>

      {/* Header & Progress */}
      <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
        <div className="flex justify-between items-end mb-6">
            <div>
                <div className="flex items-center gap-2 mb-2">
                    <span className="h-2 w-2 bg-teal-500 rounded-full"></span>
                    <span className="text-sm font-medium text-slate-500">Evaluasi Harian</span>
                </div>
                <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
                    Review Malam
                </h2>
            </div>
            <div className="text-right">
                <span className="text-4xl font-bold text-teal-600 dark:text-teal-400">{String(currentIndex + 1)}</span>
                <span className="text-slate-400 text-lg"> / {tasks.length}</span>
            </div>
        </div>
        
        {/* Progress Bar */}
        <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div 
                className="h-full bg-teal-500 transition-all duration-500 ease-out rounded-full"
                style={{ width: `${progress}%` }}
            ></div>
        </div>
      </div>

      {/* Main Card */}
      <div className="flex-1 flex items-center justify-center mb-6 md:mb-10">
        <div className="w-full bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden relative min-h-[400px] md:min-h-[450px] flex flex-col transition-all duration-500 animate-in fade-in">
            
            {/* Task Content */}
            <div className="flex-1 p-6 md:p-10 flex flex-col items-center justify-center text-center relative overflow-hidden z-10">
                <div className="relative z-10 w-full max-w-2xl">
                    <div className="mb-8">
                        <span className="inline-block px-4 py-1.5 bg-teal-50 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300 rounded-full text-xs font-medium">
                            Fokus Sekarang
                        </span>
                    </div>
                    <h3 className="text-3xl md:text-4xl font-bold text-slate-800 dark:text-white leading-tight mb-8">
                        {currentTask.title}
                    </h3>
                    <div className="flex items-center justify-center gap-3 flex-wrap">
                        {currentTask.business_unit && (
                            <p className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                                <span>🏢</span>
                                <span className="font-medium">{currentTask.business_unit}</span>
                            </p>
                        )}
                        {currentTask.slot && (
                            <p className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                                <span>◈</span>
                                <span className="font-medium">{currentTask.slot}</span>
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Actions Area */}
            <div className="bg-slate-50 dark:bg-slate-900/50 p-6 border-t border-slate-100 dark:border-slate-700/50 z-20">
                {shrinkMode ? (
                  <div className="max-w-xl mx-auto animate-in slide-in-from-bottom duration-300">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Perinci Tugas:</label>
                    <div className="flex gap-2 mb-4">
                        <div className="relative flex-1">
                            <input 
                              type="text" 
                              className="w-full p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-lg text-slate-800 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all placeholder-slate-400" 
                              value={shrinkTitle}
                              onChange={(e) => setShrinkTitle(e.target.value)}
                              placeholder="Langkah kecil pertama..."
                              autoFocus
                              onKeyDown={(e) => e.key === 'Enter' && shrinkTitle.trim() && handleDecision('shrink', { smallerTitle: shrinkTitle })}
                            />
                        </div>
                    </div>
                    <div className="flex gap-3">
                      <button 
                        className="flex-1 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-xl font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors" 
                        onClick={() => setShrinkMode(false)}
                      >
                        Batal
                      </button>
                      <button 
                        className="flex-1 py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-bold text-sm shadow-sm hover:shadow-md transition-all" 
                        onClick={() => shrinkTitle.trim() && handleDecision('shrink', { smallerTitle: shrinkTitle })}
                      >
                        Konfirmasi
                      </button>
                    </div>
                  </div>
                ) : projectMode ? (
                  <div className="max-w-xl mx-auto animate-in slide-in-from-bottom duration-300">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Jadikan Proyek:</label>
                    <div className="flex gap-2 mb-4">
                        <div className="relative flex-1">
                            <input 
                              type="text" 
                              className="w-full p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-lg text-slate-800 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all placeholder-slate-400" 
                              value={projectTitle}
                              onChange={(e) => setProjectTitle(e.target.value)}
                              placeholder="Langkah pertama (opsional)..."
                              autoFocus
                              onKeyDown={(e) => e.key === 'Enter' && handleDecision('project', { firstActionTitle: projectTitle })}
                            />
                        </div>
                    </div>
                    <div className="flex gap-3">
                      <button 
                        className="flex-1 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-xl font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors" 
                        onClick={() => setProjectMode(false)}
                      >
                        Batal
                      </button>
                      <button 
                        className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-sm shadow-sm hover:shadow-md transition-all" 
                        onClick={() => handleDecision('project', { firstActionTitle: projectTitle })}
                      >
                        Buat Proyek
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-3 max-w-5xl mx-auto">
                    <button 
                        onClick={() => handleDecision('done')}
                        title="Tekan 1"
                        className="group relative p-4 bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 border border-slate-200 dark:border-slate-700 hover:border-emerald-200 dark:hover:border-emerald-700 rounded-xl transition-all hover:-translate-y-1 hover:shadow-sm"
                    >
                        <div className="text-2xl mb-1 transition-transform group-hover:scale-110">✅</div>
                        <div className="text-xs font-medium text-slate-600 dark:text-slate-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">Selesai</div>
                    </button>

                    <button 
                            onClick={() => handleDecision('tomorrow')}
                            title="Tekan 2"
                            className="group relative p-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-xl transition-all hover:-translate-y-1 hover:shadow-sm"
                        >
                            <div className="text-2xl mb-1 transition-transform group-hover:scale-110">➡️</div>
                            <div className="text-xs font-medium text-slate-600 dark:text-slate-300 group-hover:text-slate-800 dark:group-hover:text-slate-100">Tunda</div>
                        </button>

                    <button 
                        onClick={() => setShrinkMode(true)}
                        title="Tekan 3"
                        className="group relative p-4 bg-white dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-900/20 border border-slate-200 dark:border-slate-700 hover:border-teal-200 dark:hover:border-teal-700 rounded-xl transition-all hover:-translate-y-1 hover:shadow-sm"
                    >
                        <div className="text-2xl mb-1 transition-transform group-hover:scale-110">📉</div>
                        <div className="text-xs font-medium text-slate-600 dark:text-slate-300 group-hover:text-teal-600 dark:group-hover:text-teal-400">Perinci</div>
                    </button>

                    <button 
                        onClick={() => setProjectMode(true)}
                        title="Tekan 4"
                        className="group relative p-4 bg-white dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-900/20 border border-slate-200 dark:border-slate-700 hover:border-purple-200 dark:hover:border-purple-700 rounded-xl transition-all hover:-translate-y-1 hover:shadow-sm"
                    >
                        <div className="text-2xl mb-1 transition-transform group-hover:scale-110">🚀</div>
                        <div className="text-xs font-medium text-slate-600 dark:text-slate-300 group-hover:text-purple-600 dark:group-hover:text-purple-400">Proyek</div>
                    </button>

                    <button 
                        onClick={() => { if(confirm("Hapus tugas ini?")) handleDecision('archive'); }}
                        title="Tekan 5"
                        className="group relative p-4 bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/20 border border-slate-200 dark:border-slate-700 hover:border-red-200 dark:hover:border-red-700 rounded-xl transition-all hover:-translate-y-1 hover:shadow-sm"
                    >
                        <div className="text-2xl mb-1 transition-transform group-hover:scale-110">🗑️</div>
                        <div className="text-xs font-medium text-slate-600 dark:text-slate-300 group-hover:text-red-600 dark:group-hover:text-red-400">Hapus</div>
                    </button>
                  </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}
