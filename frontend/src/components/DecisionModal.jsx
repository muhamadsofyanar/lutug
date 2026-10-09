import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, API_BASE } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import BusinessUnitModal from './BusinessUnitModal';

export default function DecisionModal({ item, onClose }) {
  const queryClient = useQueryClient();
  const [decision, setDecision] = useState('today'); // today, later, project, reference, trash
  const [title, setTitle] = useState(item.content);
  const [firstAction, setFirstAction] = useState('');
  const [businessUnit, setBusinessUnit] = useState(item.business_unit || '');
  const [assignedTo, setAssignedTo] = useState('');
  const [tags, setTags] = useState('');
  const [dailyLimit, setDailyLimit] = useState(7);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const { addToast } = useToast();

  const formatYMD = (d) => {
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - (offset * 60 * 1000));
    return local.toISOString().split('T')[0];
  };
  const getTomorrow = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return formatYMD(d);
  };
  const getNextMonday = () => {
    const d = new Date();
    const day = d.getDay(); // 0=Sun,1=Mon,...6=Sat
    const delta = ((1 - day + 7) % 7) || 7; // days until next Monday
    d.setDate(d.getDate() + delta);
    return formatYMD(d);
  };

  const { data: businessUnits = [] } = useQuery({
    queryKey: ['business_units'],
    queryFn: async () => {
        const result = await apiGet(`${API_BASE}?action=business_unit_list`);
        if (result.ok) return result.data.units || [];
        return [];
    }
  });

  const { data: peopleList = [] } = useQuery({
    queryKey: ['people_list'],
    queryFn: async () => {
        const result = await apiGet(`${API_BASE}?action=people_list`);
        if (result.ok) return result.data.people || [];
        return [];
    }
  });

  const mutation = useMutation({
    mutationFn: async (payload) => {
      const result = await apiPost(`${API_BASE}?action=inbox_process`, payload);
      if (!result.ok) throw new Error(result.data.error || "Gagal memproses keputusan");
      return result.data;
    },
    onSuccess: (data) => {
      if (data.code === 'TODAY_FULL') {
        addToast("Jadwal Penuh. Dialihkan ke Aksi Lanjutan.", "warning");
      } else {
        addToast("Protokol Berhasil Dijalankan", "success");
      }
      
      // Invalidate everything to ensure full sync
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
      queryClient.invalidateQueries({ queryKey: ['today'] });
      queryClient.invalidateQueries({ queryKey: ['next_actions'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['references'] });
      
      onClose();
    },
    onError: (error) => {
      addToast("Kegagalan Protokol: " + error.message, "error");
    }
  });

  const handleSubmit = () => {
    const payload = {
        inboxId: item.id,
        decision: decision,
        title: title,
        firstActionTitle: firstAction,
        businessUnit: businessUnit,
        assignedTo: assignedTo,
        tags: tags,
        dailyLimit: dailyLimit,
        scheduleDate: scheduleDate
    };

    // Validasi sederhana
    if (!title.trim()) {
        addToast("Data Error: Judul Wajib Diisi", "error");
        return;
    }

    if (decision === 'project' && !firstAction.trim()) {
        addToast("Error Protokol: Aksi Pertama Wajib untuk Inisialisasi Proyek", "error");
        return;
    }

    if (decision === 'schedule' && !scheduleDate) {
        addToast("Tanggal jadwal wajib diisi", "error");
        return;
    }

    mutation.mutate(payload);
  };

  const isSubmitting = mutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-300 overflow-hidden flex flex-col max-h-[90vh] relative">
        
        <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
          <div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <span className="text-teal-500">✨</span> Proses Tugas
            </h3>
            <p className="text-xs text-slate-500 mt-1">ID: {item.id}</p>
          </div>
          <button 
            className="text-slate-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200"
            onClick={onClose}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6 bg-white dark:bg-slate-800">
            <div className="group">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">
                  Judul Tugas
                </label>
                <textarea 
                    className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all text-sm text-slate-800 dark:text-slate-200 resize-none font-sans"
                    rows="2"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Apa yang perlu dilakukan?"
                />
            </div>

            <div className="group">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">
                Tindakan
              </label>
              <div className="relative">
                <select 
                    value={decision} 
                    onChange={(e) => setDecision(e.target.value)}
                    className="w-full p-3 pr-10 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all text-slate-800 dark:text-slate-200 appearance-none text-sm font-medium cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                    <option value="today">⚡ Kerjakan Hari Ini</option>
                    <option value="later">📅 Kerjakan Nanti (Next Action)</option>
                    <option value="schedule">🗓️ Jadwalkan Tanggal</option>
                    <option value="project">🏗️ Buat Proyek Baru</option>
                    <option value="reference">🗂️ Simpan sebagai Referensi</option>
                    <option value="trash">🗑️ Hapus</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
              </div>
            </div>

            {/* Daily Capacity Selector */}
            {decision === 'today' && (
                <div className="group animate-in slide-in-from-top-2 duration-300">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">
                        Batas Harian
                    </label>
                    <div className="flex gap-2">
                        {[5, 7, 999].map(limit => (
                            <button
                                key={limit}
                                onClick={() => setDailyLimit(limit)}
                                className={`flex-1 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                                    dailyLimit === limit
                                    ? 'bg-teal-50 dark:bg-teal-900/30 border-teal-200 dark:border-teal-700 text-teal-700 dark:text-teal-300'
                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-teal-300 dark:hover:border-teal-700'
                                }`}
                            >
                                {limit === 999 ? 'Tak Terbatas' : `${limit} Item`}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Business Unit & Delegation - Global for relevant actions */}
            {(decision === 'today' || decision === 'later' || decision === 'schedule' || decision === 'project' || decision === 'reference') && (
                <div className="group animate-in slide-in-from-top-2 duration-300 grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">
                            Unit Bisnis
                        </label>
                        <div className="flex gap-2">
                             <select
                                value={businessUnit}
                                onChange={(e) => setBusinessUnit(e.target.value)}
                                className="flex-1 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all text-slate-800 dark:text-slate-200 text-sm appearance-none"
                            >
                                <option value="">-- Umum --</option>
                                {businessUnits.map(u => (
                                    <option key={u.id || u.name} value={u.name}>{u.name}</option>
                                ))}
                            </select>
                            <button
                                onClick={() => setShowUnitModal(true)}
                                className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-teal-50 dark:hover:bg-teal-900/30 hover:text-teal-600 hover:border-teal-200 px-3 rounded-xl font-bold text-lg transition-all"
                                title="Buat Unit Baru"
                            >
                                +
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">
                            Delegasi
                        </label>
                        <select
                            value={assignedTo}
                            onChange={(e) => setAssignedTo(e.target.value)}
                            className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all text-slate-800 dark:text-slate-200 text-sm appearance-none"
                        >
                            <option value="">-- Saya Sendiri --</option>
                            {peopleList.map((person, idx) => (
                                <option key={idx} value={person.name}>
                                    {person.name}
                                    {person.job_title ? ` (${person.job_title})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            {decision === 'schedule' && (
              <div className="animate-in slide-in-from-top-2 duration-300">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">Tanggal Jadwal</label>
                <input
                  type="date"
                  className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all text-slate-800 dark:text-slate-200 text-sm"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                />
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => setScheduleDate(getTomorrow())}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 hover:border-teal-300 hover:text-teal-600 transition-all"
                  >
                    Besok
                  </button>
                  <button
                    onClick={() => setScheduleDate(getNextMonday())}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 hover:border-teal-300 hover:text-teal-600 transition-all"
                  >
                    Senin Depan
                  </button>
                </div>
              </div>
            )}

            {decision === 'project' && (
              <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3 animate-in slide-in-from-top-2 duration-300">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">Langkah Pertama</label>
                  <input 
                    type="text" 
                    className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all text-slate-800 dark:text-slate-200 text-sm"
                    placeholder="Apa langkah konkret pertama?"
                    value={firstAction}
                    onChange={(e) => setFirstAction(e.target.value)}
                  />
                </div>
              </div>
            )}

            {decision === 'reference' && (
                <div className="animate-in slide-in-from-top-2 duration-300">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">Tag / Kata Kunci</label>
                    <input 
                        type="text" 
                        className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all text-slate-800 dark:text-slate-200 text-sm"
                        placeholder="Contoh: dokumen, ide, penting..."
                        value={tags}
                        onChange={(e) => setTags(e.target.value)}
                    />
                </div>
            )}

            {(decision === 'today' || decision === 'later' || decision === 'schedule') && (
               <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800 text-teal-700 dark:text-teal-300 p-4 rounded-xl text-xs flex items-start gap-3 animate-in slide-in-from-top-2 duration-300">
                 <span className="text-lg">ℹ️</span>
                 <p className="mt-0.5 leading-relaxed">
                    {decision === 'today' 
                    ? "Akan ditambahkan ke daftar 'Hari Ini' untuk dikerjakan segera."
                    : decision === 'schedule'
                      ? "Akan dibuat tugas pada tanggal yang dipilih."
                      : "Akan disimpan di 'Tugas Mendatang' untuk dijadwalkan nanti."}
                 </p>
               </div>
            )}

            {decision === 'trash' && (
               <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 text-red-600 dark:text-red-300 p-4 rounded-xl text-xs flex items-start gap-3 animate-in slide-in-from-top-2 duration-300">
                 <span className="text-lg">⚠️</span>
                 <p className="mt-0.5 leading-relaxed font-bold">Peringatan: Item ini akan dihapus secara permanen.</p>
               </div>
            )}
        </div>

        <div className="p-6 border-t border-slate-100 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 flex justify-end gap-3 z-10 backdrop-blur-sm">
          <button 
            className="px-5 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors font-bold text-sm"
            onClick={onClose} 
            disabled={isSubmitting}
          >
            Batal
          </button>
          <button 
            className="px-6 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl shadow-lg shadow-teal-500/20 hover:shadow-teal-500/30 transition-all font-bold disabled:opacity-50 flex items-center gap-2 text-sm"
            onClick={handleSubmit} 
            disabled={isSubmitting}
          >
            {isSubmitting ? (
                <span className="animate-spin">⏳</span>
            ) : (
                <span>Simpan Keputusan</span>
            )}
          </button>
        </div>
      </div>
      
      {showUnitModal && <BusinessUnitModal onClose={() => setShowUnitModal(false)} />}
    </div>
  );
}
