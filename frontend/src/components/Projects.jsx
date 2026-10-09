import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, API_BASE } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import CompletionLogModal from './CompletionLogModal';
import AttachmentManager from './AttachmentManager';
import KanbanBoard from './KanbanBoard';
import Skeleton from './common/Skeleton';

export default function Projects({ viewParams }) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  
  // UI State
  const [showModal, setShowModal] = useState(false);
  const [expandedProject, setExpandedProject] = useState(null); 
  const [activeTab, setActiveTab] = useState('steps'); // 'steps' or 'kanban'
  const [steps, setSteps] = useState({}); // Map of projectId -> steps[]
  const [loadingSteps, setLoadingSteps] = useState(false);
  const [highlightedId, setHighlightedId] = useState(null);
  const [terminationModal, setTerminationModal] = useState({
    isOpen: false,
    projectId: null,
    projectTitle: ''
  });
  
  // Form State
  const [title, setTitle] = useState('');
  const [objective, setObjective] = useState(''); 
  const [businessUnit, setBusinessUnit] = useState('');
  const [newStep, setNewStep] = useState('');
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState('ALL');


  // 1. Fetch Projects
  const { data: projects = [], isLoading, error } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const result = await apiGet(`${API_BASE}?action=project_list`);
      if (result.ok) return result.data.projects || [];
      throw new Error(result.data.error || "Gagal memuat proyek");
    }
  });

  // 2. Mutations
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
  };

  const createProjectMutation = useMutation({
    mutationFn: async (payload) => {
      const result = await apiPost(`${API_BASE}?action=project_create`, payload);
      if (!result.ok) throw new Error(result.data.error || "Gagal membuat proyek");
      return result.data;
    },
    onSuccess: () => {
      setShowModal(false);
      setTitle('');
      setObjective('');
      setBusinessUnit('');
      addToast("Protokol Diinisialisasi", "success");
      invalidateAll();
    },
    onError: (err) => addToast(err.message, "error")
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      const result = await apiPost(`${API_BASE}?action=project_update`, { id, status });
      if (!result.ok) throw new Error("Gagal memperbarui status");
      return result.data;
    },
    onSuccess: (_, { status }) => {
      addToast(`Status Protokol: ${status}`, "success");
      invalidateAll();
    },
    onError: (err) => addToast(err.message, "error")
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (id) => {
      const result = await apiPost(`${API_BASE}?action=project_delete`, { projectId: id });
      if (!result.ok) throw new Error(result.data.error || "Gagal menghapus proyek");
      return result.data;
    },
    onSuccess: () => {
      addToast("Protokol Diterminasi", "success");
      invalidateAll();
    },
    onError: (err) => addToast(err.message, "error")
  });

  const terminateProjectMutation = useMutation({
    mutationFn: async ({ projectId, reason }) => {
      const result = await apiPost(`${API_BASE}?action=project_terminate`, { projectId, reason });
      if (!result.ok) throw new Error(result.data.error || "Gagal menterminasi proyek");
      return result.data;
    },
    onSuccess: () => {
      addToast("Protokol Diterminasi", "success");
      setTerminationModal(prev => ({ ...prev, isOpen: false }));
      invalidateAll();
    },
    onError: (err) => addToast(err.message, "error")
  });

  // Steps Logic
  const loadSteps = async (projectId) => {
    setLoadingSteps(true);
    const result = await apiGet(`${API_BASE}?action=project_steps_list&projectId=${projectId}`);
    if (result.ok) {
        setSteps(prev => ({...prev, [projectId]: result.data.steps || []}));
    } else {
        addToast("Gagal memuat sub-rutin", "error");
    }
    setLoadingSteps(false);
  };

  // Deep linking effect
  useEffect(() => {
    if (viewParams?.id && projects.length > 0) {
      setHighlightedId(parseInt(viewParams.id));
      const proj = projects.find(p => p.id == viewParams.id);
      if (proj && expandedProject !== proj.id) {
        setExpandedProject(proj.id);
        loadSteps(proj.id);
        
        // Try to scroll to element
        setTimeout(() => {
            const element = document.getElementById(`project-${viewParams.id}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 500);
      }
    }
  }, [viewParams, projects]);

  const addStepMutation = useMutation({
    mutationFn: async ({ projectId, title }) => {
       const result = await apiPost(`${API_BASE}?action=project_steps_add`, { projectId, title });
       if (!result.ok) throw new Error("Gagal menambahkan langkah");
       return result.data;
    },
    onSuccess: (_, { projectId }) => {
        setNewStep('');
        addToast("Sub-rutin ditambahkan", "success");
        loadSteps(projectId);
    },
    onError: (err) => addToast(err.message, "error")
  });

  const deleteStepMutation = useMutation({
      mutationFn: async ({ stepId }) => {
          const result = await apiPost(`${API_BASE}?action=project_steps_delete`, { stepId });
          if(!result.ok) throw new Error("Gagal menghapus langkah");
          return result.data;
      },
      onSuccess: (_, { projectId }) => {
          addToast("Sub-rutin dihapus", "success");
          loadSteps(projectId);
      },
      onError: (err) => addToast(err.message, "error")
  });

  const promoteStepMutation = useMutation({
    mutationFn: async ({ stepId }) => {
       const result = await apiPost(`${API_BASE}?action=project_step_promote`, { stepId });
       if (!result.ok) throw new Error(result.data.error || "Gagal mempromosikan langkah");
       return result.data;
    },
    onSuccess: (data, { projectId }) => {
        if (data.code === 'TODAY_FULL') {
             addToast("Hari Ini Penuh (Max 20)", "error");
        } else {
             addToast("Langkah dipromosikan ke Hari Ini", "success");
             loadSteps(projectId);
             queryClient.invalidateQueries(['project_tasks', projectId]);
             queryClient.invalidateQueries(['dashboard_stats']);
        }
    },
    onError: (err) => addToast(err.message, "error")
  });

  // Handlers
  const handleCreate = (e) => {
    e.preventDefault();
    createProjectMutation.mutate({ title, nextAction: objective, businessUnit });
  };

  const handleUpdateStatus = (id, newStatus) => {
    updateStatusMutation.mutate({ id, status: newStatus });
  };

  const handleRequestTerminate = (project) => {
    setTerminationModal({
      isOpen: true,
      projectId: project.id,
      projectTitle: project.title
    });
  };

  const handleConfirmTermination = (reason) => {
    terminateProjectMutation.mutate({
      projectId: terminationModal.projectId,
      reason: reason
    });
  };

  const handleDelete = (id) => {
    // Legacy delete (admin only or special case), now we prefer terminate
    // But for now, let's just redirect to terminate if called, or keep as hard delete option?
    // Let's replace the delete button action in UI to call handleRequestTerminate
    // If we keep this function, maybe rename or remove usage.
    // For safety, let's keep it but not use it in the main UI flow unless explicit "Delete Forever" is needed.
    if (confirm("PERINGATAN: Hapus proyek ini secara permanen? Tindakan ini tidak dapat dibatalkan.")) {
      deleteProjectMutation.mutate(id);
    }
  };

  const handleAddStep = (projectId) => {
      if(!newStep.trim()) return;
      addStepMutation.mutate({ projectId, title: newStep });
  };

  const handleDeleteStep = (stepId, projectId) => {
      if(confirm("Hapus sub-rutin ini?")) {
          deleteStepMutation.mutate({ stepId, projectId });
      }
  };

  const handlePromoteStep = (stepId, projectId) => {
      promoteStepMutation.mutate({ stepId, projectId });
  };

  const toggleExpand = (id) => {
    if (expandedProject === id) {
      setExpandedProject(null);
    } else {
      setExpandedProject(id);
      setActiveTab('steps');
      loadSteps(id);
    }
  };

  // Business Unit Logic
  const businessUnits = ['ALL', ...new Set(projects.map(p => p.business_unit).filter(Boolean))];
  
  const activeProjectsRaw = projects.filter(p => p.status !== 'completed' && p.status !== 'archived' && p.status !== 'terminated');
  const activeProjects = selectedBusinessUnit === 'ALL' 
    ? activeProjectsRaw 
    : activeProjectsRaw.filter(p => p.business_unit === selectedBusinessUnit);
    
  const completedProjects = projects.filter(p => p.status === 'completed' || p.status === 'archived' || p.status === 'terminated');

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto animate-in fade-in zoom-in-95 duration-500 pb-24">
      {/* Header */}
      <div className="flex justify-between items-end mb-10 relative">
        <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
                <div className="h-3 w-3 bg-teal-500 rounded-full"></div>
                <span className="text-xs font-bold text-teal-600 dark:text-teal-400">Manajemen Proyek</span>
            </div>
            <h2 className="text-4xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                Daftar Proyek
            </h2>
            <div className="flex items-center gap-4 mt-4">
                <p className="text-slate-500 dark:text-slate-400 text-sm flex items-center gap-2">
                    Proyek Aktif: <span className="text-teal-600 dark:text-teal-400 font-bold bg-teal-50 dark:bg-teal-900/30 px-2 py-0.5 rounded">{activeProjects.length}</span>
                </p>
            </div>
        </div>
        
        <button 
            className="group relative px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl transition-all font-medium text-sm shadow-sm hover:shadow-md flex items-center gap-2" 
            onClick={() => setShowModal(true)}
        >
            <span className="text-xl">+</span> 
            Buat Proyek Baru
        </button>
      </div>
      
      {error && (
        <div className="bg-red-50 text-red-600 p-6 rounded-xl mb-8 border border-red-100 animate-in slide-in-from-top-2 shadow-sm relative overflow-hidden">
            <span className="font-bold text-xl mr-2">⚠️</span> Error: {error.message}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-8 pb-10">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 md:p-8">
               <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-8">
                   <div className="space-y-3 w-full max-w-lg">
                       <Skeleton className="h-8 w-3/4" />
                       <div className="flex gap-2">
                           <Skeleton className="h-4 w-16" />
                           <Skeleton className="h-4 w-24" />
                       </div>
                   </div>
                   <div className="flex gap-2">
                       <Skeleton className="h-10 w-10 rounded-lg" />
                       <Skeleton className="h-10 w-10 rounded-lg" />
                       <Skeleton className="h-10 w-10 rounded-lg" />
                   </div>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <Skeleton className="h-32 w-full rounded-xl" />
                   <Skeleton className="h-32 w-full rounded-xl" />
               </div>
            </div>
          ))}
        </div>
      ) : (
        <>
            {activeProjects.length === 0 && completedProjects.length === 0 ? (
                <div className="text-center py-32 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 animate-in fade-in duration-700">
                    <div className="w-24 h-24 bg-teal-50 dark:bg-teal-900/20 rounded-full flex items-center justify-center mb-6 mx-auto">
                        <span className="text-4xl">🌱</span>
                    </div>
                    <h3 className="text-xl font-medium text-slate-900 dark:text-slate-100 mb-2">Kanvas Kosong</h3>
                    <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-sm mx-auto text-sm italic">
                        "Mulai niat baik baru dengan Bismillah."
                    </p>
                    <button 
                        className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl transition-all font-medium text-sm shadow-sm hover:shadow-md inline-flex items-center gap-2" 
                        onClick={() => setShowModal(true)}
                    >
                        <span className="text-xl">+</span>
                        Buat Proyek Baru
                    </button>
                </div>
            ) : (
                <>
                    {/* Sector Filter Bar */}
                    {businessUnits.length > 1 && (
                        <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600">
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
                                    {unit === 'ALL' ? 'Semua' : unit}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-8 pb-10">
                        {activeProjects.map((project, index) => (
                            <div 
                                key={project.id} 
                                id={`project-${project.id}`}
                                className={`group relative bg-white dark:bg-slate-800 rounded-2xl border transition-all duration-300 shadow-sm hover:shadow-md ${
                                project.is_stagnant 
                                    ? 'border-red-200 dark:border-red-900/30' 
                                    : 'border-slate-200 dark:border-slate-700 hover:border-teal-500/50'
                                } ${highlightedId === project.id ? 'ring-2 ring-teal-500' : ''}`}
                            style={{ animationDelay: `${index * 100}ms` }}
                        >
                            {/* Stagnation Alert */}
                            {project.is_stagnant && (
                                <div className="absolute top-0 right-0 bg-red-50 dark:bg-red-900/20 border-l border-b border-red-200 dark:border-red-800 px-3 py-1.5 rounded-bl-xl z-20">
                                    <span className="text-[10px] font-bold text-red-600 dark:text-red-400 tracking-wide flex items-center gap-2">
                                        <span className="text-lg">⚠️</span> Tidak aktif: {project.days_inactive} hari
                                    </span>
                                </div>
                            )}

                            <div className="p-6 md:p-8 relative z-10">
                                <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-8">
                                    <div>
                                        <div className="flex items-center gap-4 mb-2">
                                            <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors tracking-tight">
                                                {project.title}
                                            </h3>
                                            <div className={`px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide rounded-full border ${
                                                project.status === 'active' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' : 
                                                'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800'
                                            } flex items-center gap-2`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${project.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                                                {project.status === 'active' ? 'Aktif' : 
                                                 project.status === 'on_hold' ? 'Ditunda' : 
                                                 project.status === 'completed' ? 'Selesai' : 
                                                 project.status === 'terminated' ? 'Dihentikan' : 
                                                 project.status}
                                            </div>
                                        </div>
                                        {project.business_unit && (
                                            <p className="text-xs text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                                <span className="text-slate-400">•</span> Unit: <span className="text-slate-700 dark:text-slate-300 font-medium">{project.business_unit}</span>
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex gap-2 self-end md:self-auto">
                                        <button 
                                            onClick={() => handleUpdateStatus(project.id, project.status === 'active' ? 'on_hold' : 'active')}
                                            className="p-3 bg-slate-50 dark:bg-slate-700/50 hover:bg-teal-50 dark:hover:bg-teal-900/20 text-slate-500 hover:text-teal-600 border border-slate-200 dark:border-slate-600 hover:border-teal-200 dark:hover:border-teal-700 rounded-lg transition-all"
                                            title={project.status === 'active' ? 'Pause Proyek' : 'Lanjutkan Proyek'}
                                        >
                                            {project.status === 'active' ? '⏸️' : '▶️'}
                                        </button>
                                        <button 
                                            onClick={() => {
                                                if(confirm('Tandai proyek ini sebagai SELESAI? Proyek akan dipindahkan ke arsip.')) {
                                                    handleUpdateStatus(project.id, 'completed');
                                                }
                                            }}
                                            className="p-3 bg-slate-800/50 hover:bg-green-500/20 text-slate-400 hover:text-green-400 border border-slate-700 hover:border-green-500/30 rounded-lg transition-all"
                                            title="Selesaikan Protokol"
                                        >
                                            ✅
                                        </button>
                                        <button 
                                            onClick={() => handleRequestTerminate(project)}
                                            className="p-3 bg-slate-800/50 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-500/30 rounded-lg transition-all"
                                            title="Terminasi Protokol"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="flex flex-col gap-4">
                                        <div className="relative group/obj">
                                            <div className="absolute -inset-1 bg-gradient-to-r from-teal-500/10 to-emerald-500/10 rounded-xl blur opacity-0 group-hover/obj:opacity-100 transition duration-500"></div>
                                            <div className="relative bg-slate-50 dark:bg-black/20 p-5 rounded-xl border border-slate-200 dark:border-white/5 group-hover/obj:border-teal-500/20 transition-colors h-full">
                                                <p className="text-xs font-bold text-teal-600 dark:text-teal-500 mb-3 flex items-center gap-2">
                                                    <span className="w-1.5 h-1.5 bg-teal-500 rounded-full"></span>
                                                    Fokus Utama
                                                </p>
                                                <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                                                    {project.next_action || "Belum ada arahan spesifik."}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Estimation Section */}
                                        {project.oracle && (
                                            <div className={`p-5 rounded-xl border transition-all ${
                                                project.oracle.color === 'red' ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30 text-red-700 dark:text-red-400' :
                                                project.oracle.color === 'yellow' ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 text-amber-700 dark:text-amber-400' :
                                                project.oracle.color === 'emerald' ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                                                'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-400'
                                            }`}>
                                                <div className="flex justify-between items-start mb-3">
                                                    <span className="text-sm font-bold flex items-center gap-2">
                                                        <span>📅</span> Estimasi & Prediksi
                                                    </span>
                                                    <div className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${
                                                        project.oracle.color === 'red' ? 'bg-white/50 border-red-200' :
                                                        project.oracle.color === 'emerald' ? 'bg-white/50 border-emerald-200' :
                                                        'bg-white/50 border-slate-200'
                                                    }`}>
                                                        {project.oracle.status}
                                                    </div>
                                                </div>
                                                
                                                <div className="text-sm leading-relaxed mb-4">
                                                    {project.oracle.message}
                                                </div>
                                                
                                                <div className="grid grid-cols-2 gap-4 text-xs pt-4 border-t border-black/5 dark:border-white/5">
                                                    <div>
                                                        <span className="opacity-70 block mb-1">Kecepatan Rata-rata</span>
                                                        <span className="font-bold text-sm">{project.oracle.velocity} <span className="opacity-70 font-normal">tugas/minggu</span></span>
                                                    </div>
                                                    {project.oracle.estimated_days !== null && (
                                                        <div className="text-right">
                                                            <span className="opacity-70 block mb-1">Perkiraan Selesai</span>
                                                            <span className="font-bold text-sm">{project.oracle.estimated_days} <span className="opacity-70 font-normal">hari lagi</span></span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <button 
                                            onClick={() => toggleExpand(project.id)}
                                            className={`w-full flex items-center justify-between p-4 ${expandedProject === project.id ? 'bg-teal-50 dark:bg-teal-900/10 border-teal-200 dark:border-teal-500/30' : 'bg-slate-50 dark:bg-black/20 border-slate-200 dark:border-white/5'} hover:bg-slate-100 dark:hover:bg-teal-900/20 rounded-xl border transition-all group/btn`}
                                        >
                                            <span className="text-xs font-bold text-slate-600 dark:text-teal-400 uppercase tracking-wide flex items-center gap-2">
                                                <span className="text-lg opacity-50">📋</span> Detail Proyek & Kanban
                                            </span>
                                            <span className={`text-slate-400 dark:text-teal-400 transform transition-transform duration-300 ${expandedProject === project.id ? 'rotate-180' : ''}`}>
                                                ▼
                                            </span>
                                        </button>

                                        {expandedProject === project.id && (
                                            <div className="mt-4 pl-4 border-l-2 border-teal-500/10 animate-in slide-in-from-top-4 duration-300">
                                                
                                                {/* Tab Navigation */}
                                                <div className="flex gap-6 mb-6 border-b border-slate-200 dark:border-white/5 pb-1">
                                                    <button 
                                                        onClick={() => setActiveTab('steps')}
                                                        className={`text-xs font-bold uppercase tracking-wide pb-2 transition-all relative ${
                                                            activeTab === 'steps' 
                                                                ? 'text-teal-600 dark:text-teal-400' 
                                                                : 'text-slate-500 hover:text-teal-500 dark:hover:text-teal-300'
                                                        }`}
                                                    >
                                                        Daftar Tugas
                                                        {activeTab === 'steps' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-teal-500 shadow-sm"></div>}
                                                    </button>
                                                    <button 
                                                        onClick={() => setActiveTab('kanban')}
                                                        className={`text-xs font-bold uppercase tracking-wide pb-2 transition-all relative ${
                                                            activeTab === 'kanban' 
                                                                ? 'text-teal-600 dark:text-teal-400' 
                                                                : 'text-slate-500 hover:text-teal-500 dark:hover:text-teal-300'
                                                        }`}
                                                    >
                                                        Papan Kanban
                                                        {activeTab === 'kanban' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-teal-500 shadow-sm"></div>}
                                                    </button>
                                                </div>

                                                {/* Steps View */}
                                                {activeTab === 'steps' && (
                                                    <div className="animate-in fade-in duration-300">
                                                        <div className="space-y-2 mb-4 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                                                            {loadingSteps ? (
                                                                <div className="space-y-2 py-2">
                                                                    {[1, 2, 3].map(i => (
                                                                        <div key={i} className="flex items-center gap-3 p-3 border border-transparent">
                                                                            <Skeleton className="h-4 w-6 rounded" />
                                                                            <Skeleton className="h-4 w-full rounded" />
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                steps[project.id]?.map((step, idx) => (
                                                                    <div key={step.id} className="flex items-center justify-between group/step p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-teal-500/5 border border-transparent hover:border-slate-200 dark:hover:border-teal-500/10 transition-all">
                                                                        <span className="text-sm text-slate-700 dark:text-slate-300 flex items-center gap-3">
                                                                            <span className="text-teal-600 dark:text-teal-500 text-xs font-bold">{String(idx + 1).padStart(2, '0')}</span>
                                                                            {step.title}
                                                                        </span>
                                                                        <div className="flex items-center gap-2 opacity-0 group-hover/step:opacity-100 transition-opacity">
                                                                            <button 
                                                                                onClick={() => handlePromoteStep(step.id, project.id)}
                                                                                className="text-green-600 dark:text-green-400 text-[10px] hover:bg-green-50 dark:hover:bg-green-950/30 px-2 py-1 rounded font-bold border border-transparent hover:border-green-200 dark:hover:border-green-500/30 transition-all"
                                                                                title="Jadwalkan untuk Hari Ini"
                                                                            >
                                                                                Hari Ini
                                                                            </button>
                                                                            <button 
                                                                                onClick={() => handleDeleteStep(step.id, project.id)}
                                                                                className="text-red-600 dark:text-red-400 text-[10px] hover:bg-red-50 dark:hover:bg-red-950/30 px-2 py-1 rounded font-bold border border-transparent hover:border-red-200 dark:hover:border-red-500/30 transition-all"
                                                                            >
                                                                                Hapus
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <input 
                                                                type="text" 
                                                                value={newStep}
                                                                onChange={(e) => setNewStep(e.target.value)}
                                                                placeholder="Tulis tugas baru..."
                                                                className="flex-1 bg-white dark:bg-black/30 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 placeholder-slate-400 dark:placeholder-slate-600 transition-all"
                                                                onKeyDown={(e) => e.key === 'Enter' && handleAddStep(project.id)}
                                                            />
                                                            <button 
                                                                onClick={() => handleAddStep(project.id)}
                                                                className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-all text-xs font-bold shadow-sm"
                                                            >
                                                                Tambah
                                                            </button>
                                                        </div>
                                                        
                                                        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-teal-900/30">
                                                            <AttachmentManager entityType="project" entityId={project.id} />
                                                        </div>
                                                    </div>
                                                )}


                                                {/* Kanban View */}
                                                {activeTab === 'kanban' && (
                                                    <div className="animate-in fade-in duration-300">
                                                        <KanbanBoard projectId={project.id} />
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                </>
            )}
        </>
      )}

      {/* Termination Modal */}
      {terminationModal.isOpen && (
        <CompletionLogModal
            task={{ title: terminationModal.projectTitle }}
            mode="terminate"
            onClose={() => setTerminationModal(prev => ({ ...prev, isOpen: false }))}
            onConfirm={handleConfirmTermination}
            isSubmitting={terminateProjectMutation.isPending}
        />
      )}

      {/* Modal - Human Style */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden relative">
                <div className="p-8">
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
                        Buat Proyek Baru
                    </h3>
                    
                    <form onSubmit={handleCreate} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nama Proyek</label>
                            <input 
                                type="text" 
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white focus:outline-none focus:border-teal-500 transition-all"
                                placeholder="Nama proyek..."
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tujuan / Deskripsi</label>
                            <textarea 
                                value={objective}
                                onChange={(e) => setObjective(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white focus:outline-none focus:border-teal-500 transition-all min-h-[100px]"
                                placeholder="Deskripsi proyek..."
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Unit Bisnis</label>
                            <input 
                                type="text" 
                                value={businessUnit}
                                onChange={(e) => setBusinessUnit(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white focus:outline-none focus:border-teal-500 transition-all"
                                placeholder="Nama unit bisnis..."
                            />
                        </div>
                        
                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <button 
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="px-6 py-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-sm font-medium"
                            >
                                Batal
                            </button>
                            <button 
                                type="submit"
                                className="px-8 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-bold shadow-lg shadow-teal-500/20 transition-all"
                            >
                                Buat Proyek
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
