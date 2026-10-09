import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, API_BASE } from '../services/api';
import AttachmentManager from './AttachmentManager';
import TaskComments from './TaskComments';
import FocusTimer from './FocusTimer';

export default function TaskModal({ 
    task, 
    onClose, 
    onTerminate, 
    businessUnits, 
    onOpenUnitModal, 
    references 
}) {
    const queryClient = useQueryClient();
    const [editingTask, setEditingTask] = useState(task);
    const [refSearch, setRefSearch] = useState('');
    const [showFocusTimer, setShowFocusTimer] = useState(false);
    const [peopleList, setPeopleList] = useState([]);

    React.useEffect(() => {
        const loadPeople = async () => {
            const result = await apiGet(`${API_BASE}?action=people_list`);
            if (result.ok) {
                setPeopleList(result.data.people || []);
            }
        };
        loadPeople();
    }, []);

    const updateAttributesMutation = useMutation({
        mutationFn: async ({ taskId, energy_level, context_tags, business_unit, importance, urgency, linked_references, recurrence_pattern, assigned_to }) => {
            const result = await apiPost(`${API_BASE}?action=task_update_attributes`, {
                taskId,
                energy_level,
                context_tags,
                business_unit,
                importance,
                urgency,
                linked_references,
                recurrence_pattern,
                assigned_to
            });
            if (!result.ok) throw new Error("Gagal memperbarui atribut");
            return result.data;
        },
        onSuccess: () => {
             queryClient.invalidateQueries({ queryKey: ['today'] });
        }
    });

    const handleUpdate = (updates) => {
        // Optimistic update local state
        const updatedTask = { ...editingTask, ...updates };
        setEditingTask(updatedTask);
        
        // Trigger mutation
        updateAttributesMutation.mutate({
            taskId: editingTask.id,
            energy_level: updatedTask.energy_level,
            context_tags: updatedTask.context_tags,
            business_unit: updatedTask.business_unit,
            importance: updatedTask.importance,
            urgency: updatedTask.urgency,
            linked_references: updatedTask.linked_references,
            recurrence_pattern: updatedTask.recurrence_pattern,
            assigned_to: updatedTask.assigned_to
        });
    };

    const filteredPeople = peopleList;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-300 relative flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50 flex-shrink-0">
                    <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <span className="text-teal-500">📝</span> Detail Tugas
                    </h3>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowFocusTimer(true)}
                            className="text-xs bg-teal-50 dark:bg-teal-900/30 hover:bg-teal-100 dark:hover:bg-teal-900/50 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-500/30 px-3 py-1.5 rounded-lg transition-colors font-medium flex items-center gap-1"
                        >
                            ⚡ Fokus
                        </button>
                        <button 
                            onClick={() => onTerminate(editingTask)}
                            className="text-xs bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30 px-3 py-1.5 rounded-lg transition-colors font-medium"
                        >
                            Hapus
                        </button>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1">✕</button>
                    </div>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900">
                    {showFocusTimer && (
                        <FocusTimer 
                            isOpen={showFocusTimer} 
                            onClose={() => setShowFocusTimer(false)} 
                            task={editingTask} 
                        />
                    )}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Judul Tugas</label>
                        <input 
                            type="text" 
                            value={editingTask.title} 
                            readOnly
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-teal-500"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">Tingkat Energi</label>
                            <div className="flex gap-1">
                                {['high', 'medium', 'low'].map(level => (
                                    <button
                                        key={level}
                                        onClick={() => handleUpdate({ energy_level: level })}
                                        className={`flex-1 py-2 rounded-lg border transition-all text-xs font-medium ${
                                            editingTask.energy_level === level 
                                            ? 'bg-teal-50 dark:bg-teal-900/30 border-teal-500 text-teal-600 dark:text-teal-400' 
                                            : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                                        }`}
                                    >
                                        {level === 'high' ? 'Tinggi' : level === 'medium' ? 'Sedang' : 'Rendah'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">Konteks</label>
                            <select 
                                value={editingTask.context_tags || ''}
                                onChange={(e) => handleUpdate({ context_tags: e.target.value })}
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-teal-500 text-sm h-[38px]"
                            >
                                <option value="">Tanpa Konteks</option>
                                <option value="@laptop">@Laptop</option>
                                <option value="@phone">@HP</option>
                                <option value="@meeting">@Rapat</option>
                                <option value="@deep">@Fokus</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">Status</label>
                            <select 
                                value={editingTask.status || 'pending'}
                                onChange={(e) => handleUpdate({ status: e.target.value })}
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-teal-500 text-sm h-[38px]"
                            >
                                <option value="pending">Pending (Menunggu)</option>
                                <option value="in_progress">In Progress (Aktif)</option>
                            </select>
                        </div>
                    </div>

                    {/* Matrix (Eisenhower Matrix) */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-2">
                            <span className="text-lg">🎯</span> Matriks Prioritas (Penting vs Mendesak)
                        </label>
                        <div className="flex flex-col md:flex-row gap-6 bg-slate-50 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                            {/* Radar Visualization / Input */}
                            <div 
                                className="relative w-32 h-32 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg cursor-crosshair overflow-hidden group shadow-sm flex-shrink-0"
                                onClick={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const x = Math.min(10, Math.max(0, ((e.clientX - rect.left) / rect.width) * 10));
                                    const y = Math.min(10, Math.max(0, 10 - ((e.clientY - rect.top) / rect.height) * 10)); // Y inverted (top is 10)
                                    handleUpdate({ 
                                        importance: Math.round(x),
                                        urgency: Math.round(y)
                                    });
                                }}
                            >
                                {/* Grid Lines */}
                                <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 pointer-events-none">
                                    <div className="border-r border-b border-slate-100 dark:border-slate-800 bg-emerald-50/50 dark:bg-emerald-500/5"></div> {/* Q2: Schedule */}
                                    <div className="border-b border-slate-100 dark:border-slate-800 bg-rose-50/50 dark:bg-red-500/10"></div>   {/* Q1: Do */}
                                    <div className="border-r border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-500/5"></div>  {/* Q4: Eliminate */}
                                    <div className="bg-amber-50/50 dark:bg-yellow-500/5"></div>                                {/* Q3: Delegate */}
                                </div>
                                
                                {/* Axis Labels */}
                                <span className="absolute bottom-1 right-1 text-[8px] text-slate-400 font-medium">Mendesak &rarr;</span>
                                <span className="absolute top-1 left-1 text-[8px] text-slate-400 font-medium writing-mode-vertical">&uarr; Penting</span>

                                {/* Current Point */}
                                {(editingTask.importance !== undefined && editingTask.urgency !== undefined) ? (
                                    <div 
                                        className="absolute w-3 h-3 bg-teal-500 rounded-full shadow-sm transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 pointer-events-none z-10 border border-white dark:border-slate-900"
                                        style={{ 
                                            left: `${(editingTask.urgency || 0) * 10}%`, 
                                            top: `${(10 - (editingTask.importance || 0)) * 10}%` 
                                        }}
                                    >
                                    </div>
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <span className="text-[8px] text-slate-400">Klik untuk set</span>
                                    </div>
                                )}
                            </div>

                            {/* Legend / Info */}
                            <div className="flex flex-col justify-center gap-2 text-xs text-slate-500 dark:text-slate-400 py-1 flex-1">
                                <div className="space-y-1">
                                    <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1">
                                        <span className="text-slate-500">Penting</span>
                                        <span className="text-teal-600 dark:text-teal-400 font-bold">{editingTask.importance || 0}<span className="text-slate-400 font-normal">/10</span></span>
                                    </div>
                                    <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1">
                                        <span className="text-slate-500">Mendesak</span>
                                        <span className="text-teal-600 dark:text-teal-400 font-bold">{editingTask.urgency || 0}<span className="text-slate-400 font-normal">/10</span></span>
                                    </div>
                                </div>
                                
                                <div className="mt-2 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                                    <div className="text-slate-400 font-bold mb-1 text-[10px] uppercase tracking-wider flex items-center gap-1">
                                        <span className="text-teal-500">💡</span> Saran Sistem
                                    </div>
                                    <div className={`font-medium text-sm ${
                                        (editingTask.importance || 0) >= 5 && (editingTask.urgency || 0) >= 5 ? "text-rose-500 dark:text-red-400" :
                                        (editingTask.importance || 0) >= 5 ? "text-emerald-600 dark:text-emerald-400" :
                                        (editingTask.urgency || 0) >= 5 ? "text-amber-600 dark:text-yellow-400" :
                                        "text-slate-500 dark:text-slate-400"
                                    }`}>
                                        {(() => {
                                            const i = editingTask.importance || 0;
                                            const u = editingTask.urgency || 0;
                                            if (i === 0 && u === 0) return "Menunggu data...";
                                            if (i >= 5 && u >= 5) return "Kritis: Kerjakan Segera.";
                                            if (i >= 5 && u < 5) return "Strategis: Jadwalkan Waktu Fokus.";
                                            if (i < 5 && u >= 5) return "Taktis: Delegasikan / Minimalisir.";
                                            return "Non-Esensial: Pertimbangkan hapus?";
                                        })()}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">Ditugaskan Ke</label>
                            <select
                                value={editingTask.assigned_to || ''}
                                onChange={(e) => handleUpdate({ assigned_to: e.target.value })}
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-teal-500 text-sm h-[38px]"
                            >
                                <option value="">-- Kerjakan Sendiri --</option>
                                {filteredPeople.map((person, idx) => (
                                    <option key={idx} value={person.name}>
                                        {person.name} 
                                        {person.job_title ? ` (${person.job_title})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">Unit Bisnis</label>
                             <div className="flex gap-2">
                                <select
                                    value={editingTask.business_unit || ''}
                                    onChange={(e) => handleUpdate({ business_unit: e.target.value })}
                                    className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-teal-500 text-sm h-[38px]"
                                >
                                    <option value="">Tanpa Unit</option>
                                    {businessUnits.filter(u => u !== 'ALL').map(unit => (
                                        <option key={unit} value={unit}>{unit}</option>
                                    ))}
                                </select>
                                <button
                                    onClick={onOpenUnitModal}
                                    className="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 px-3 rounded-xl font-bold text-lg transition-all"
                                    title="Buat Unit Baru"
                                >
                                    +
                                </button>
                            </div>
                        </div>

                        {/* Recurrence */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-2">
                                <span>🔁</span> Pengulangan
                            </label>
                            <select 
                                value={editingTask.recurrence_pattern || ''}
                                onChange={(e) => handleUpdate({ recurrence_pattern: e.target.value })}
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-teal-500 text-sm h-[38px]"
                            >
                                <option value="">Tidak Ada</option>
                                <option value="daily">Harian</option>
                                <option value="weekly">Mingguan</option>
                                <option value="monthly">Bulanan</option>
                                <option value="yearly">Tahunan</option>
                            </select>
                        </div>
                    </div>

                    {/* Linked References */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-2">
                            <span>🔗</span> Referensi Kontekstual
                        </label>
                        <div className="bg-slate-50 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                            <div className="relative mb-3 group">
                                <input
                                    type="text"
                                    placeholder="Cari & Hubungkan Referensi..."
                                    value={refSearch}
                                    onChange={(e) => setRefSearch(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:border-teal-500 outline-none transition-all focus:shadow-[0_0_10px_rgba(20,184,166,0.2)]"
                                />
                                {refSearch && (
                                    <div className="absolute top-full left-0 right-0 bg-slate-900 border border-slate-700 rounded-lg mt-1 max-h-40 overflow-y-auto z-20 shadow-xl">
                                        {references
                                            .filter(r => r.title.toLowerCase().includes(refSearch.toLowerCase()))
                                            .filter(r => {
                                                const currentLinks = (() => {
                                                    try { return typeof editingTask.linked_references === 'string' ? JSON.parse(editingTask.linked_references || '[]') : (editingTask.linked_references || []); } catch { return []; }
                                                })();
                                                return !currentLinks.includes(r.id);
                                            })
                                            .slice(0, 5)
                                            .map(ref => (
                                                <button
                                                    key={ref.id}
                                                    onClick={() => {
                                                        const currentLinks = (() => {
                                                            try { return typeof editingTask.linked_references === 'string' ? JSON.parse(editingTask.linked_references || '[]') : (editingTask.linked_references || []); } catch { return []; }
                                                        })();
                                                        const newLinks = [...currentLinks, ref.id];
                                                        handleUpdate({ linked_references: newLinks });
                                                        setRefSearch('');
                                                    }}
                                                    className="w-full text-left px-3 py-2 text-xs font-mono text-slate-400 hover:bg-teal-900/20 hover:text-teal-400 border-b border-slate-800 last:border-0"
                                                >
                                                    {ref.title}
                                                </button>
                                            ))}
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {(() => {
                                    const currentLinks = (() => {
                                        try { 
                                            const parsed = typeof editingTask.linked_references === 'string' ? JSON.parse(editingTask.linked_references || '[]') : (editingTask.linked_references || []);
                                            return Array.isArray(parsed) ? parsed : [];
                                        } catch { return []; }
                                    })();
                                    
                                    if (currentLinks.length === 0) return <span className="text-[10px] text-slate-600 font-mono italic">Tidak ada referensi tertaut.</span>;

                                    return currentLinks.map(linkId => {
                                        const ref = references.find(r => r.id === linkId);
                                        if (!ref) return null;
                                        return (
                                            <div key={linkId} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs font-mono text-slate-600 dark:text-slate-300 group hover:border-teal-500/50 transition-colors">
                                                <span className="truncate max-w-[150px] cursor-pointer hover:text-teal-600 dark:hover:text-teal-400" title={ref.title}>{ref.title}</span>
                                                <button
                                                    onClick={() => {
                                                         const newLinks = currentLinks.filter(id => id !== linkId);
                                                         handleUpdate({ linked_references: newLinks });
                                                    }}
                                                    className="text-slate-600 hover:text-red-400 ml-1"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <AttachmentManager entityType="task" entityId={editingTask.id} />
                        </div>
                        <div className="border-t md:border-t-0 md:border-l border-slate-800 pt-4 md:pt-0 md:pl-6">
                            <TaskComments taskId={editingTask.id} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}