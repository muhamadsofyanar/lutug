import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost, API_BASE } from '../services/api';
import { useToast } from '../contexts/ToastContext';

export default function UserProfile({ user, onClose }) {
    const { addToast } = useToast();
    const queryClient = useQueryClient();
    
    const [fullName, setFullName] = useState(user.full_name || '');
    const [phone, setPhone] = useState(user.phone || '');
    const [telegramChatId, setTelegramChatId] = useState(user.telegram_chat_id || '');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [mode, setMode] = useState('profile'); // 'profile' | 'security'

    const updateProfileMutation = useMutation({
        mutationFn: async (data) => {
            const res = await apiPost(`${API_BASE}?action=auth_update_profile`, data);
            if (!res.ok) throw new Error(res.data.error || 'Pembaruan gagal');
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['auth_user']);
            // Update local state if needed or force reload
            // Ideally we should refetch user data.
            addToast('Profil berhasil diperbarui', 'success');
        },
        onError: (err) => addToast(err.message, 'error')
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        
        if (mode === 'profile') {
            updateProfileMutation.mutate({ 
                full_name: fullName,
                phone: phone,
                telegram_chat_id: telegramChatId
            });
        } else {
            if (password.length < 6) {
                addToast('Kata sandi minimal 6 karakter', 'error');
                return;
            }
            if (password !== confirmPassword) {
                addToast('Kata sandi tidak cocok', 'error');
                return;
            }
            updateProfileMutation.mutate({ password: password });
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative" onClick={e => e.stopPropagation()}>
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 to-emerald-600"></div>
                
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">Profil Pengguna</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:hover:text-white transition-colors">✕</button>
                </div>

                <div className="flex border-b border-slate-200 dark:border-slate-800">
                    <button 
                        onClick={() => setMode('profile')}
                        className={`flex-1 py-3 text-sm font-medium transition-colors ${mode === 'profile' ? 'text-teal-600 dark:text-teal-400 bg-slate-50 dark:bg-slate-800/50 border-b-2 border-teal-500' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        Info Umum
                    </button>
                    <button 
                        onClick={() => setMode('security')}
                        className={`flex-1 py-3 text-sm font-medium transition-colors ${mode === 'security' ? 'text-teal-600 dark:text-teal-400 bg-slate-50 dark:bg-slate-800/50 border-b-2 border-teal-500' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        Keamanan
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {mode === 'profile' ? (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">Nama Pengguna</label>
                                <input 
                                    type="text" 
                                    value={user.username} 
                                    disabled 
                                    className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-500 text-sm cursor-not-allowed"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-teal-600 dark:text-teal-400 mb-1">Nama Lengkap</label>
                                <input 
                                    type="text" 
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder="Masukkan nama lengkap Anda"
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-teal-600 dark:text-teal-400 mb-1">Nomor WhatsApp</label>
                                <input 
                                    type="text" 
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="Contoh: 08123456789"
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                                />
                                <p className="text-xs text-slate-500 mt-1">Digunakan untuk notifikasi via WhatsApp.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-teal-600 dark:text-teal-400 mb-1">ID Chat Telegram</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={telegramChatId}
                                        onChange={(e) => setTelegramChatId(e.target.value)}
                                        placeholder="Contoh: 123456789"
                                        className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                                    />
                                    <a 
                                        href="https://t.me/userinfobot" 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center"
                                        title="Cari ID via Bot"
                                    >
                                        🔍 Cari ID
                                    </a>
                                </div>
                                <p className="text-xs text-slate-500 mt-1">
                                    Mulai chat dengan bot kami untuk mengaktifkan notifikasi. 
                                    <br/>
                                    (Pastikan bot sudah di-start: <a href="https://t.me/InsyaRahBot" className="text-teal-500 hover:underline">@InsyaRahBot</a> atau sesuai konfigurasi)
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">Peran</label>
                                <div className="px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg text-slate-600 dark:text-slate-400 text-sm inline-block capitalize">
                                    {user.role}
                                </div>
                            </div>
                            {user.assigned_units && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">Unit Ditugaskan</label>
                                    <div className="flex flex-wrap gap-1">
                                        {user.assigned_units.map(u => (
                                            <span key={u} className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-md text-sm text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                                {u}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                             <div>
                                <label className="block text-sm font-medium text-teal-600 dark:text-teal-400 mb-1">Kata Sandi Baru</label>
                                <input 
                                    type="password" 
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Min 6 karakter"
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-teal-600 dark:text-teal-400 mb-1">Konfirmasi Kata Sandi</label>
                                <input 
                                    type="password" 
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Ulangi kata sandi"
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                                />
                            </div>
                        </div>
                    )}

                    <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                        <button 
                            type="submit" 
                            disabled={updateProfileMutation.isPending}
                            className="bg-teal-600 hover:bg-teal-500 text-white font-bold py-2 px-6 rounded-lg shadow-lg shadow-teal-500/20 transition-all text-sm"
                        >
                            {updateProfileMutation.isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
