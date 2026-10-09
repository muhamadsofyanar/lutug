import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost, API_BASE } from '../services/api';
import { useToast } from '../contexts/ToastContext';

export default function BusinessUnitModal({ onClose }) {
    const [name, setName] = useState('');
    const queryClient = useQueryClient();
    const { addToast } = useToast();

    const mutation = useMutation({
        mutationFn: async (newName) => {
            const result = await apiPost(`${API_BASE}?action=business_unit_create`, { name: newName });
            if (!result.ok) throw new Error(result.data.error || "Gagal membuat unit");
            return result.data;
        },
        onSuccess: () => {
            addToast("Unit Bisnis Dibuat", "success");
            queryClient.invalidateQueries({ queryKey: ['business_units'] });
            onClose();
        },
        onError: (error) => {
            addToast(error.message, "error");
        }
    });

    const handleSubmit = () => {
        if (!name.trim()) return;
        mutation.mutate(name);
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-300 overflow-hidden flex flex-col relative">
                
                <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <span className="text-xl">🏢</span> Unit Bisnis Baru
                    </h3>
                </div>

                <div className="p-6">
                    <div className="group">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">
                            Nama Unit
                        </label>
                        <input 
                            type="text"
                            className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 font-sans"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Contoh: Pemasaran"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                        />
                    </div>
                </div>

                <div className="p-6 border-t border-slate-100 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 flex justify-end gap-3 backdrop-blur-sm">
                    <button 
                        className="px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-sm font-bold"
                        onClick={onClose}
                        disabled={mutation.isPending}
                    >
                        Batal
                    </button>
                    <button 
                        className="px-6 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl shadow-lg shadow-teal-500/20 hover:shadow-teal-500/30 transition-all font-bold text-sm flex items-center gap-2"
                        onClick={handleSubmit}
                        disabled={mutation.isPending || !name.trim()}
                    >
                        {mutation.isPending ? 'Menyimpan...' : 'Simpan Unit'}
                    </button>
                </div>
            </div>
        </div>
    );
}
