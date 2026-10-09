import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import { apiGet, apiPost, apiUpload, API_BASE } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import KnowledgeGraph from './KnowledgeGraph';
import AttachmentManager from './AttachmentManager';

export default function References({ viewParams }) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  
  // UI State
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [highlightedId, setHighlightedId] = useState(null);
  const [activeTab, setActiveTab] = useState('modules'); // 'modules' | 'files' | 'graph'
  
  // Form State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [businessUnit, setBusinessUnit] = useState('');
  const [modalTab, setModalTab] = useState('write'); // 'write' | 'preview' | 'upload'
  const [file, setFile] = useState(null);
  
  // Filter State
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState('ALL');

  // 1. Fetch References (Modules)
  const { data: references = [], isLoading: isLoadingRefs, error: errorRefs } = useQuery({
    queryKey: ['references'],
    queryFn: async () => {
      const result = await apiGet(`${API_BASE}?action=reference_list`);
      if (result.ok) return result.data.items || [];
      throw new Error(result.data.error || "Gagal memuat referensi");
    }
  });

  // 1.a Fetch Business Units
  const { data: businessUnitList = [] } = useQuery({
    queryKey: ['business_units'],
    queryFn: async () => {
      const result = await apiGet(`${API_BASE}?action=business_unit_list`);
      if (result.ok) return result.data.units || [];
      return [];
    }
  });

  // 1.b Fetch All Files (Archives)
  const { data: allFiles = [], isLoading: isLoadingFiles, error: errorFiles } = useQuery({
    queryKey: ['all_attachments'],
    queryFn: async () => {
      const result = await apiGet(`${API_BASE}?action=attachment_list_all`);
      if (result.ok) return result.data.files || [];
      throw new Error(result.data.error || "Gagal memuat arsip");
    },
    enabled: activeTab === 'files'
  });

  // Feature Flags (from dashboard stats)
  const { data: flagsStats } = useQuery({
    queryKey: ['dashboard_stats_flags'],
    queryFn: async () => {
      const result = await apiGet(`${API_BASE}?action=dashboard_stats`);
      if (result.ok) return result.data.stats.feature_flags || {};
      return {};
    },
    staleTime: 30000
  });
  const knowledgeGraphEnabled = flagsStats?.knowledge_graph_enabled ?? false;

  // Helper: Format Size
  const formatSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Helper: Get Unique Tags
  const availableTags = [...new Set(references.flatMap(r => (r.tags || '').split(',').map(t => t.trim()).filter(Boolean)))];

  // Group Files Logic
  const groupedFiles = allFiles.reduce((acc, file) => {
    const unit = file.business_unit || 'Umum';
    if (!acc[unit]) acc[unit] = [];
    acc[unit].push(file);
    return acc;
  }, {});

  // 2. Mutations
  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['references'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
  };

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const result = await apiPost(`${API_BASE}?action=reference_create`, payload);
      if (!result.ok) throw new Error(result.data.error);
      return result.data;
    },
    onSuccess: () => {
      addToast("Data baru diarsipkan", "success");
      setShowModal(false);
      invalidateQueries();
    },
    onError: (err) => {
      addToast("Gagal menulis: " + err.message, "error");
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (payload) => {
      const result = await apiPost(`${API_BASE}?action=reference_update`, payload);
      if (!result.ok) throw new Error(result.data.error);
      return result.data;
    },
    onSuccess: () => {
      addToast("Modul data diperbarui", "success");
      setShowModal(false);
      invalidateQueries();
    },
    onError: (err) => {
      addToast("Gagal memperbarui: " + err.message, "error");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const result = await apiPost(`${API_BASE}?action=reference_delete`, { id });
      if (!result.ok) throw new Error(result.data.error);
      return result.data;
    },
    onSuccess: () => {
      addToast("Modul data dimusnahkan", "success");
      invalidateQueries();
    },
    onError: (err) => {
      addToast("Gagal menghapus: " + err.message, "error");
    }
  });

  // Handlers
  const handleOpenModal = (item = null) => {
    setModalTab('write');
    setFile(null); // Reset file state
    if (item) {
      setEditingItem(item);
      setTitle(item.title);
      setContent(item.content || '');
      setTags(item.tags || '');
      setBusinessUnit(item.business_unit || '');
    } else {
      setEditingItem(null);
      setTitle('');
      setContent('');
      setTags('');
      setBusinessUnit('');
    }
    setShowModal(true);
  };

  // Deep linking effect
  useEffect(() => {
    if (viewParams?.id && references.length > 0) {
      setHighlightedId(parseInt(viewParams.id));
      const item = references.find(r => r.id == viewParams.id);
      if (item) {
        handleOpenModal(item);
      }
      setTimeout(() => {
          const element = document.getElementById(`reference-${viewParams.id}`);
          if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
      }, 500);
    }
  }, [viewParams, references]);

  const uploadMutation = useMutation({
    mutationFn: async ({ id, file }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entity_type', 'reference');
      formData.append('entity_id', id);
      const result = await apiUpload(`${API_BASE}?action=attachment_upload`, formData);
      if (!result.ok) throw new Error(result.data.error || "Gagal upload file");
      return result.data;
    },
    onSuccess: () => {
      addToast("File berhasil diupload", "success");
      setFile(null); // Reset file
      invalidateQueries();
    },
    onError: (err) => {
      addToast("Gagal upload file: " + err.message, "error");
    }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      title,
      content,
      tags,
      businessUnit,
      ...(editingItem && { id: editingItem.id })
    };

    try {
      let targetId;
      
      // 1. Create or Update Reference Data
      if (editingItem) {
        await updateMutation.mutateAsync(payload);
        targetId = editingItem.id;
      } else {
        const res = await createMutation.mutateAsync(payload);
        // apiPost returns { data: { item: { id: ... } } } for create
        targetId = res.item.id;
      }

      // 2. Upload File if present
      if (file && targetId) {
        await uploadMutation.mutateAsync({ id: targetId, file });
      }

      // Close modal if all successful
      setShowModal(false);

    } catch (err) {
      // Errors handled by individual mutations
      console.error(err);
    }
  };

  const handleDelete = (id) => {
    if (confirm("Musnahkan modul data ini secara permanen?")) {
      deleteMutation.mutate(id);
    }
  };

  // Filter Logic
  const businessUnits = ['ALL', ...new Set(references.map(ref => ref.business_unit).filter(Boolean))];
  const filteredReferences = selectedBusinessUnit === 'ALL'
    ? references
    : references.filter(ref => ref.business_unit === selectedBusinessUnit);

  return (
    <div className="h-full flex flex-col p-6 max-w-7xl mx-auto custom-scrollbar overflow-y-auto animate-in fade-in zoom-in-95 duration-500">
      {/* Header HUD */}
      <div className="flex justify-between items-end mb-10 relative">
        <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
                <div className="flex gap-1">
                    <span className="h-1.5 w-1.5 bg-teal-500 rounded-full"></span>
                    <span className="h-1.5 w-1.5 bg-teal-500 rounded-full opacity-50"></span>
                    <span className="h-1.5 w-1.5 bg-teal-500 rounded-full opacity-25"></span>
                </div>
                <span className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase">Referensi & Dokumen</span>
            </div>
            <h2 className="text-4xl font-bold text-slate-800 dark:text-white tracking-tight">
                Perpustakaan
            </h2>
            <div className="flex items-center gap-4 mt-4">
                <div className="h-px w-20 bg-slate-200 dark:bg-slate-700"></div>
                <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wide flex items-center gap-2">
                    Total Dokumen: <span className="text-slate-900 dark:text-white font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">{references.length}</span>
                </p>
            </div>
        </div>
        <button 
            className="group relative px-6 py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-xl transition-all font-bold text-sm shadow-sm hover:shadow-md"
            onClick={() => handleOpenModal()}
        >
            <span className="relative z-10 flex items-center gap-2">
                <span className="text-lg">+</span> Arsipkan Data Baru
            </span>
        </button>
      </div>
      
      {/* Tabs */}
      <div className="flex gap-6 mb-8 border-b border-slate-200 dark:border-slate-700">
          <button 
              onClick={() => setActiveTab('modules')}
              className={`pb-3 px-2 text-sm font-bold transition-all border-b-2 ${activeTab === 'modules' ? 'border-teal-500 text-teal-600 dark:text-teal-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
              Dokumen ({references.length})
          </button>
          <button 
              onClick={() => setActiveTab('files')}
              className={`pb-3 px-2 text-sm font-bold transition-all border-b-2 ${activeTab === 'files' ? 'border-teal-500 text-teal-600 dark:text-teal-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
              Arsip File
          </button>
          {knowledgeGraphEnabled && (
            <button 
                onClick={() => setActiveTab('graph')}
                className={`pb-3 px-2 text-sm font-bold transition-all border-b-2 ${activeTab === 'graph' ? 'border-teal-500 text-teal-600 dark:text-teal-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
                Peta Hubungan
            </button>
          )}
      </div>

      {(errorRefs && activeTab === 'modules') && (
        <div className="mb-8 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-800 flex items-center gap-3">
            <span className="text-xl">⚠️</span> 
            <span className="font-medium">{errorRefs.message}</span>
        </div>
      )}
      
      {(errorFiles && activeTab === 'files') && (
        <div className="mb-8 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-800 flex items-center gap-3">
            <span className="text-xl">⚠️</span> 
            <span className="font-medium">{errorFiles.message}</span>
        </div>
      )}

      <div className="flex-1 pb-20">
        {activeTab === 'graph' && knowledgeGraphEnabled ? (
             <div className="h-[600px] animate-in fade-in duration-500 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <KnowledgeGraph references={references} onNodeClick={handleOpenModal} />
             </div>
        ) : activeTab === 'modules' ? (
            isLoadingRefs ? (
                <div className="flex flex-col items-center justify-center py-24">
                    <div className="w-12 h-12 border-4 border-slate-200 border-t-teal-500 rounded-full animate-spin mb-4"></div>
                    <p className="text-slate-500 font-medium text-sm">Memuat referensi...</p>
                </div>
            ) : references.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700">
                <div className="text-6xl mb-4 opacity-20">📚</div>
                <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">Perpustakaan Kosong</h3>
                <p className="text-slate-500 max-w-sm leading-relaxed text-sm">
                Mulai arsipkan dokumen penting, catatan, atau referensi untuk memudahkan pencarian di masa depan.
                </p>
            </div>
            ) : (
            <>
                {/* Sector Filter Bar */}
                {businessUnits.length > 1 && (
                    <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                        {businessUnits.map(unit => (
                            <button
                                key={unit}
                                onClick={() => setSelectedBusinessUnit(unit)}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
                                    selectedBusinessUnit === unit
                                        ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                                        : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-teal-500 hover:text-teal-600'
                                }`}
                            >
                                {unit === 'ALL' ? 'Semua Sektor' : unit}
                            </button>
                        ))}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredReferences.map((ref, idx) => (
                    <div 
                        key={ref.id} 
                        className="group relative bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-teal-500/50 hover:shadow-lg transition-all duration-300 flex flex-col h-full animate-in fade-in slide-in-from-bottom-4"
                        style={{ animationDelay: `${idx * 50}ms` }}
                    >
                        <div className="flex justify-between items-start mb-4 relative z-10">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 line-clamp-2 leading-tight group-hover:text-teal-600 transition-colors tracking-tight">
                            {ref.title}
                        </h3>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <button 
                                onClick={() => handleOpenModal(ref)} 
                                className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded-lg transition-all"
                                title="Edit Dokumen"
                            >
                                ✏️
                            </button>
                            <button 
                                onClick={() => handleDelete(ref.id)} 
                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"
                                title="Hapus Dokumen"
                            >
                                🗑️
                            </button>
                        </div>
                        </div>

                        {ref.business_unit && (
                            <div className="mb-4 relative z-10">
                                <span className="inline-block px-2.5 py-0.5 border border-slate-200 dark:border-slate-700 rounded-full bg-slate-50 dark:bg-slate-800/50 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                                    {ref.business_unit}
                                </span>
                            </div>
                        )}
                        
                        {ref.tags && (
                        <div className="flex flex-wrap gap-2 mb-4 relative z-10">
                            {ref.tags.split(',').map((tag, i) => (
                            <span key={i} className="px-2 py-0.5 bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 rounded text-[10px] font-medium border border-teal-100 dark:border-teal-800/50">
                                #{tag.trim()}
                            </span>
                            ))}
                        </div>
                        )}
                        
                        <div className="flex-1 relative z-10">
                            <div className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-100 dark:border-slate-700/50 h-full max-h-[200px] overflow-hidden relative">
                                <div className="prose prose-slate dark:prose-invert prose-sm max-w-none">
                                    <ReactMarkdown>
                                        {ref.content}
                                    </ReactMarkdown>
                                </div>
                                <div className="absolute bottom-0 left-0 w-full h-12 bg-gradient-to-t from-slate-50 dark:from-slate-900/90 to-transparent pointer-events-none"></div>
                            </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-slate-800/50 flex justify-between items-center relative z-10">
                            <div className="flex items-center gap-1.5 text-[10px] text-teal-600/80 uppercase">
                                <span>📅</span> {new Date(ref.created_at).toLocaleDateString()}
                            </div>
                        </div>
                    </div>
                    ))}
                </div>
            </>
            )
        ) : (
            // FILES VIEW
            isLoadingFiles ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="bg-slate-900/40 border border-slate-700/50 p-4 rounded-xl relative overflow-hidden h-24 flex items-center gap-4">
                            <Skeleton className="h-12 w-12 rounded-lg bg-slate-800" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-3/4 bg-slate-800" />
                                <Skeleton className="h-3 w-1/2 bg-slate-800" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : allFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
                    <div className="text-6xl mb-4 opacity-20">🗂️</div>
                    <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">Arsip Kosong</h3>
                    <p className="text-slate-500 max-w-sm leading-relaxed text-sm">
                        Belum ada file yang diupload ke sistem.
                    </p>
                </div>
            ) : (
                <div className="space-y-12">
                    {Object.entries(groupedFiles).map(([unit, files]) => (
                        <div key={unit} className="animate-in fade-in slide-in-from-bottom-4">
                            <div className="flex items-center gap-4 mb-6 border-b border-slate-200 dark:border-slate-700 pb-2">
                                <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 flex items-center gap-3">
                                    <span className="text-2xl">📂</span> {unit}
                                </h3>
                                <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800"></div>
                                <span className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full font-medium">
                                    {files.length} FILES
                                </span>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {files.map((file, idx) => (
                                    <div 
                                        key={file.id} 
                                        className="bg-slate-900/40 border border-slate-700/50 hover:border-teal-500/50 p-4 rounded-xl group transition-all hover:bg-slate-900/60 hover:shadow-[0_0_20px_rgba(20,184,166,0.1)] relative overflow-hidden"
                                        style={{ animationDelay: `${idx * 50}ms` }}
                                    >
                                        <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-teal-500/5 to-transparent rounded-bl-full group-hover:from-teal-500/10 transition-all"></div>
                                        
                                        <div className="flex items-start gap-4 relative z-10">
                                            <div className="p-3 bg-slate-950/50 rounded-lg border border-slate-800 group-hover:border-teal-500/30 transition-colors">
                                                <span className="text-2xl">📄</span>
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <a 
                                                    href={`${API_BASE.replace('backend/api/index.php', 'public/')}${file.file_path}`} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="block text-slate-200 font-bold hover:text-teal-400 truncate transition-colors text-sm mb-1"
                                                    title={file.file_name}
                                                >
                                                    {file.file_name}
                                                </a>
                                                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mb-2">
                                                    <span className="bg-slate-800/50 px-1.5 py-0.5 rounded">{formatSize(file.file_size)}</span>
                                                    <span>•</span>
                                                    <span>{new Date(file.created_at).toLocaleDateString()}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[10px] text-teal-600/80 uppercase tracking-wide">
                                                    <span>↳</span>
                                                    <span className="truncate max-w-[150px]">{file.entity_title || 'Unknown Entity'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl w-full max-w-2xl shadow-[0_0_50px_rgba(245,158,11,0.2)] overflow-hidden relative group flex flex-col max-h-[90vh]">
            {/* Scanner Line */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent animate-scan"></div>
            
            <div className="flex justify-between items-center p-6 border-b border-slate-800 bg-slate-950/50">
              <h3 className="text-xl font-bold text-white flex items-center gap-3">
                  <span className="text-amber-500 text-2xl">◈</span>
                  <span className="font-mono uppercase tracking-wider">{editingItem ? 'Edit Modul Data' : 'Inisialisasi Arsip Baru'}</span>
              </h3>
              <button 
                className="text-slate-500 hover:text-red-400 transition-colors"
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>
            
            <div className="overflow-y-auto custom-scrollbar p-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-mono text-amber-500 uppercase tracking-wider ml-1">Judul Modul</label>
                    <input 
                      type="text" 
                      className="w-full bg-slate-950/50 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-amber-500 focus:shadow-[0_0_15px_rgba(245,158,11,0.1)] transition-all font-mono placeholder-slate-600"
                      value={title} 
                      onChange={e => setTitle(e.target.value)} 
                      required 
                      autoFocus
                      placeholder="Masukkan nama modul..."
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs font-mono text-amber-500 uppercase tracking-wider ml-1">Unit Bisnis</label>
                    <div className="relative">
                        <select 
                            className="w-full bg-slate-950/50 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-amber-500 focus:shadow-[0_0_15px_rgba(245,158,11,0.1)] transition-all font-mono appearance-none"
                            value={businessUnit} 
                            onChange={e => setBusinessUnit(e.target.value)} 
                        >
                            <option value="">-- PILIH SEKTOR --</option>
                            {businessUnitList.map(unit => (
                                <option key={unit.id} value={unit.name}>{unit.name}</option>
                            ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">▼</div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs font-mono text-amber-500 uppercase tracking-wider ml-1">Meta Tag</label>
                    <div className="relative">
                        <input 
                            type="text" 
                            className="w-full bg-slate-950/50 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-amber-500 focus:shadow-[0_0_15px_rgba(245,158,11,0.1)] transition-all font-mono placeholder-slate-600"
                            value={tags} 
                            onChange={e => setTags(e.target.value)} 
                            placeholder="protokol, intel, panduan"
                            list="tag-suggestions"
                        />
                        <datalist id="tag-suggestions">
                            {availableTags.map(tag => (
                                <option key={tag} value={tag} />
                            ))}
                        </datalist>
                    </div>
                    {availableTags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                            {availableTags.slice(0, 8).map(tag => (
                                <button
                                    key={tag}
                                    type="button"
                                    onClick={() => setTags(prev => {
                                        const parts = prev.split(',').map(p => p.trim()).filter(Boolean);
                                        if (!parts.includes(tag)) {
                                            return [...parts, tag].join(', ');
                                        }
                                        return prev;
                                    })}
                                    className="text-[10px] px-2 py-1 rounded bg-slate-800 border border-slate-700 hover:border-amber-500 text-slate-400 hover:text-amber-400 transition-colors font-mono uppercase"
                                >
                                    +{tag}
                                </button>
                            ))}
                        </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <label className="text-xs font-mono text-amber-500 uppercase tracking-wider ml-1">Konten Data (Mendukung Markdown)</label>
                        <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
                            <button
                                type="button"
                                onClick={() => setModalTab('write')}
                                className={`px-3 py-1 rounded text-xs font-mono uppercase transition-colors ${modalTab === 'write' ? 'bg-amber-500 text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                Tulis
                            </button>
                            <button
                                type="button"
                                onClick={() => setModalTab('preview')}
                                className={`px-3 py-1 rounded text-xs font-mono uppercase transition-colors ${modalTab === 'preview' ? 'bg-amber-500 text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                Pratinjau
                            </button>
                            <button
                                type="button"
                                onClick={() => setModalTab('upload')}
                                className={`px-3 py-1 rounded text-xs font-mono uppercase transition-colors ${modalTab === 'upload' ? 'bg-amber-500 text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                Upload
                            </button>
                        </div>
                    </div>
                    
                    {modalTab === 'upload' ? (
                        editingItem ? (
                            <div className="w-full bg-slate-950/50 border border-slate-700 rounded-lg p-4 min-h-[300px]">
                                <AttachmentManager entityType="reference" entityId={editingItem.id} />
                            </div>
                        ) : (
                            <div className="w-full bg-slate-950/50 border border-slate-700 rounded-lg p-8 text-center flex flex-col items-center justify-center min-h-[300px] border-dashed">
                                <div className="text-4xl mb-4">📎</div>
                                <p className="text-slate-400 font-mono text-sm mb-4">
                                    {file ? `File terpilih: ${file.name}` : "Pilih file untuk dilampirkan ke modul ini"}
                                </p>
                                <label className="cursor-pointer bg-slate-800 hover:bg-slate-700 text-amber-500 px-6 py-2 rounded-lg transition-colors font-mono text-xs uppercase tracking-wider border border-slate-600 hover:border-amber-500">
                                    Pilih File
                                    <input 
                                        type="file" 
                                        className="hidden" 
                                        onChange={e => setFile(e.target.files[0])}
                                    />
                                </label>
                                {file && (
                                    <button 
                                        type="button"
                                        onClick={() => setFile(null)}
                                        className="mt-4 text-red-500 hover:text-red-400 text-xs font-mono"
                                    >
                                        Batalkan Pilihan
                                    </button>
                                )}
                                <p className="mt-6 text-slate-600 text-[10px] font-mono max-w-xs">
                                    * File akan diupload otomatis setelah modul dibuat.
                                </p>
                            </div>
                        )
                    ) : modalTab === 'write' ? (
                        <textarea 
                          className="w-full bg-slate-950/50 border border-slate-700 rounded-lg p-4 text-white focus:outline-none focus:border-amber-500 focus:shadow-[0_0_15px_rgba(245,158,11,0.1)] transition-all font-mono text-sm leading-relaxed placeholder-slate-600 min-h-[300px]"
                          value={content} 
                          onChange={e => setContent(e.target.value)}
                          placeholder="# Judul\n\nData Anda di sini..." 
                        />
                    ) : (
                        <div className="w-full bg-slate-950/50 border border-slate-700 rounded-lg p-4 text-slate-300 min-h-[300px] prose prose-invert prose-amber prose-sm max-w-none overflow-y-auto custom-scrollbar">
                            <div className="prose-p:font-mono prose-headings:font-sans prose-headings:text-amber-500">
                                <ReactMarkdown>
                                    {content || '*Tidak ada konten untuk pratinjau*'}
                                </ReactMarkdown>
                            </div>
                        </div>
                    )}
                  </div>
                  
                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                    <button 
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="px-6 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors font-mono text-sm"
                    >
                      BATAL
                    </button>
                    <button 
                      type="submit"
                      disabled={createMutation.isPending || updateMutation.isPending}
                      className="px-6 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:shadow-[0_0_30px_rgba(245,158,11,0.5)] transition-all font-mono text-sm font-bold uppercase tracking-wider flex items-center gap-2"
                    >
                      {(createMutation.isPending || updateMutation.isPending) ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                          MEMPROSES...
                        </>
                      ) : (
                        <>
                          <span className="text-lg">💾</span> SIMPAN_MODUL
                        </>
                      )}
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
