import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, API_BASE } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import AuditLogViewer from './admin/AuditLogViewer';
import SystemHealthWidget from './admin/SystemHealthWidget';
import DecisionLogViewer from './DecisionLogViewer';
import Skeleton from './common/Skeleton';

const BroadcastModal = ({ isOpen, onClose, mutation, users }) => {
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [channels, setChannels] = useState(['email']); // Default email
    const [targetType, setTargetType] = useState('all'); // all | selected
    const [selectedUserIds, setSelectedUserIds] = useState([]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        const targets = targetType === 'all' ? ['all'] : selectedUserIds;
        mutation.mutate({
            subject,
            message,
            channels,
            targets
        });
    };

    const toggleChannel = (channel) => {
        if (channels.includes(channel)) {
            setChannels(channels.filter(c => c !== channel));
        } else {
            setChannels([...channels, channel]);
        }
    };

    const toggleUser = (id) => {
        if (selectedUserIds.includes(id)) {
            setSelectedUserIds(selectedUserIds.filter(uid => uid !== id));
        } else {
            setSelectedUserIds([...selectedUserIds, id]);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden relative flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>📢</span> Broadcast Pesan
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">✕</button>
                </div>
                
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                    <form id="broadcast-form" onSubmit={handleSubmit} className="space-y-6">
                        {/* Target Selection */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Penerima</label>
                            <div className="flex gap-4 mb-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="radio" 
                                        name="targetType" 
                                        value="all" 
                                        checked={targetType === 'all'} 
                                        onChange={() => setTargetType('all')}
                                        className="text-teal-500 focus:ring-teal-500"
                                    />
                                    <span className="text-sm">Semua User ({users.length})</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="radio" 
                                        name="targetType" 
                                        value="selected" 
                                        checked={targetType === 'selected'} 
                                        onChange={() => setTargetType('selected')}
                                        className="text-teal-500 focus:ring-teal-500"
                                    />
                                    <span className="text-sm">Pilih User Manual</span>
                                </label>
                            </div>
                            
                            {targetType === 'selected' && (
                                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-700 max-h-40 overflow-y-auto custom-scrollbar">
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                        {users.map(u => (
                                            <label key={u.id} className="flex items-center gap-2 p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedUserIds.includes(u.id)}
                                                    onChange={() => toggleUser(u.id)}
                                                    className="rounded text-teal-500 focus:ring-teal-500"
                                                />
                                                <span className="text-xs truncate">{u.username}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Channels */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Saluran Pengiriman</label>
                            <div className="flex flex-wrap gap-3">
                                {[
                                    { id: 'email', label: 'Email', icon: '📧' },
                                    { id: 'whatsapp', label: 'WhatsApp', icon: '📱' },
                                    { id: 'telegram', label: 'Telegram', icon: '✈️' }
                                ].map(ch => (
                                    <button
                                        key={ch.id}
                                        type="button"
                                        onClick={() => toggleChannel(ch.id)}
                                        className={`px-4 py-2 rounded-lg border flex items-center gap-2 transition-all ${
                                            channels.includes(ch.id)
                                                ? 'bg-teal-500 text-white border-teal-600 shadow-md'
                                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-teal-500'
                                        }`}
                                    >
                                        <span>{ch.icon}</span>
                                        <span className="font-medium text-sm">{ch.label}</span>
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-slate-500 mt-2">
                                * Pesan hanya akan terkirim jika user memiliki data kontak yang sesuai.
                            </p>
                        </div>

                        {/* Subject */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Subjek / Judul</label>
                            <input 
                                type="text" 
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                placeholder="Contoh: Pengumuman Pemeliharaan Sistem"
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
                                required
                            />
                        </div>

                        {/* Message */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Isi Pesan</label>
                            <textarea 
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Tulis pesan Anda di sini..."
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all min-h-[150px] resize-y"
                                required
                            />
                            <p className="text-xs text-slate-500 mt-2">
                                * Mendukung format teks biasa. Untuk WhatsApp/Telegram, format Markdown dasar didukung.
                            </p>
                        </div>
                    </form>
                </div>

                <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3">
                    <button 
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl text-slate-500 font-bold hover:bg-slate-200 dark:hover:bg-slate-800 transition-all"
                    >
                        Batal
                    </button>
                    <button 
                        type="submit"
                        form="broadcast-form"
                        disabled={mutation.isPending || channels.length === 0 || !subject || !message}
                        className="px-6 py-2.5 bg-teal-500 hover:bg-teal-600 text-white rounded-xl font-bold shadow-lg shadow-teal-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {mutation.isPending ? (
                            <>
                                <span className="animate-spin">⏳</span> Mengirim...
                            </>
                        ) : (
                            <>
                                <span>🚀</span> Kirim Broadcast
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default function AdminPanel({ user }) {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('users');
  const [editingUser, setEditingUser] = useState(null);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');
  const [resetPasswordValue, setResetPasswordValue] = useState('');

  // Team State
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');
  const [newTeamUnitId, setNewTeamUnitId] = useState('');

  // Business Units List
  const { data: businessUnits = [], refetch: refetchUnits } = useQuery({
    queryKey: ['business_units'],
    queryFn: async () => {
      const res = await apiGet(`${API_BASE}?action=business_unit_list`);
      return res.ok ? res.data.units : [];
    }
  });

  // Teams List
  const { data: teams = [], refetch: refetchTeams } = useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const res = await apiGet(`${API_BASE}?action=team_list`);
      return res.ok ? res.data.teams : [];
    }
  });

  // Business Unit Mutations
  const createUnitMutation = useMutation({
    mutationFn: async (name) => {
      const res = await apiPost(`${API_BASE}?action=business_unit_create`, { name });
      if (!res.ok) throw new Error(res.data.error || 'Gagal membuat unit');
      return res.data;
    },
    onSuccess: () => {
      refetchUnits();
      setNewUnitName('');
      addToast('Unit bisnis berhasil dibuat', 'success');
    },
    onError: (err) => addToast(err.message, 'error')
  });

  const deleteUnitMutation = useMutation({
    mutationFn: async (id) => {
      const res = await apiPost(`${API_BASE}?action=business_unit_delete`, { id });
      if (!res.ok) throw new Error(res.data.error || 'Gagal menghapus unit');
      return res.data;
    },
    onSuccess: () => {
      refetchUnits();
      addToast('Unit bisnis berhasil dihapus', 'success');
    },
    onError: (err) => addToast(err.message, 'error')
  });

  // Team Mutations
  const createTeamMutation = useMutation({
    mutationFn: async (data) => {
      const res = await apiPost(`${API_BASE}?action=team_create`, data);
      if (!res.ok) throw new Error(res.data.error || 'Gagal membuat tim');
      return res.data;
    },
    onSuccess: () => {
      refetchTeams();
      setNewTeamName('');
      setNewTeamDesc('');
      setNewTeamUnitId('');
      addToast('Tim berhasil dibuat', 'success');
    },
    onError: (err) => addToast(err.message, 'error')
  });

  const deleteTeamMutation = useMutation({
    mutationFn: async (id) => {
      const res = await apiPost(`${API_BASE}?action=team_delete`, { id });
      if (!res.ok) throw new Error(res.data.error || 'Gagal menghapus tim');
      return res.data;
    },
    onSuccess: () => {
      refetchTeams();
      addToast('Tim berhasil dihapus', 'success');
    },
    onError: (err) => addToast(err.message, 'error')
  });

  // System Operations Mutations
  const resetAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiPost(`${API_BASE}?action=reset_all`);
      if (!res.ok) throw new Error(res.data.error || 'Reset gagal');
      return res.data;
    },
    onSuccess: () => {
      addToast('Reset sistem selesai. Semua data telah dihapus.', 'success');
      window.location.reload();
    },
    onError: (err) => addToast(err.message, 'error')
  });

  // Backups List
  const { data: backups = [], refetch: refetchBackups } = useQuery({
    queryKey: ['admin_backups'],
    queryFn: async () => {
      const res = await apiGet(`${API_BASE}?action=admin_backups_list`);
      return res.ok ? res.data.backups : [];
    },
    enabled: activeTab === 'system'
  });

  // Backup Mutations
  const createBackupMutation = useMutation({
    mutationFn: async () => {
      const res = await apiPost(`${API_BASE}?action=admin_backups_create`);
      if (!res.ok) throw new Error(res.data.error || 'Gagal membuat backup');
      return res.data;
    },
    onSuccess: () => {
      refetchBackups();
      addToast('Backup berhasil dibuat', 'success');
    },
    onError: (err) => addToast(err.message, 'error')
  });

  const restoreBackupMutation = useMutation({
    mutationFn: async (filename) => {
      const res = await apiPost(`${API_BASE}?action=admin_backups_restore`, { filename });
      if (!res.ok) throw new Error(res.data.error || 'Gagal memulihkan backup');
      return res.data;
    },
    onSuccess: () => {
      addToast('Sistem berhasil dipulihkan', 'success');
      window.location.reload();
    },
    onError: (err) => addToast(err.message, 'error')
  });

  const deleteBackupMutation = useMutation({
    mutationFn: async (filename) => {
      const res = await apiPost(`${API_BASE}?action=admin_backups_delete`, { filename });
      if (!res.ok) throw new Error(res.data.error || 'Gagal menghapus backup');
      return res.data;
    },
    onSuccess: () => {
      refetchBackups();
      addToast('Backup berhasil dihapus', 'success');
    },
    onError: (err) => addToast(err.message, 'error')
  });

  const handleCreateBackup = () => {
    createBackupMutation.mutate();
  };

  const handleRestoreBackup = (filename) => {
    if (window.confirm(`Apakah Anda yakin ingin memulihkan dari "${filename}"? Data saat ini akan diganti.`)) {
      restoreBackupMutation.mutate(filename);
    }
  };

  const handleDeleteBackup = (filename) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus backup "${filename}"?`)) {
      deleteBackupMutation.mutate(filename);
    }
  };

  const handleExport = () => {
    window.open(`${API_BASE}?action=export_all`, '_blank');
  };

  const handleDeleteUnit = (id, name) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus "${name}"? Tindakan ini tidak dapat dibatalkan.`)) {
      deleteUnitMutation.mutate(id);
    }
  };

  const handleDeleteTeam = (id, name) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus tim "${name}"? Tindakan ini tidak dapat dibatalkan.`)) {
      deleteTeamMutation.mutate(id);
    }
  };

  const handleCreateUnit = (e) => {
    e.preventDefault();
    if (!newUnitName.trim()) return;
    createUnitMutation.mutate(newUnitName);
  };

  const handleCreateTeam = (e) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    createTeamMutation.mutate({
        name: newTeamName,
        description: newTeamDesc,
        business_unit_id: newTeamUnitId || null
    });
  };

  const handleResetSystem = () => {
    if (window.confirm('BAHAYA: Ini akan menghapus SEMUA data (tugas, proyek, dll). Apakah Anda benar-benar yakin?')) {
      if (window.confirm('Konfirmasi Terakhir: Tindakan ini tidak dapat dikembalikan. Lanjutkan?')) {
        resetAllMutation.mutate();
      }
    }
  };

  // Users List
  const { data: users, isLoading } = useQuery({
    queryKey: ['admin_users'],
    queryFn: async () => {
      const res = await apiGet(`${API_BASE}?action=admin_users_list`);
      return res.ok ? res.data.users : [];
    },
    enabled: activeTab === 'users'
  });

  const updateUserMutation = useMutation({
    mutationFn: async (userData) => {
      const res = await apiPost(`${API_BASE}?action=admin_users_update`, userData);
      if (!res.ok) throw new Error(res.data.error || 'Gagal memperbarui pengguna');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admin_users']);
      addToast('Pengguna berhasil diperbarui', 'success');
      setEditingUser(null);
    },
    onError: (err) => {
      addToast(err.message, 'error');
    }
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ id, password }) => {
      const res = await apiPost(`${API_BASE}?action=admin_reset_password`, { id, password });
      if (!res.ok) throw new Error(res.data.error || 'Gagal mereset kata sandi');
      return res.data;
    },
    onSuccess: () => {
      addToast('Kata sandi berhasil direset', 'success');
      setResetPasswordValue('');
    },
    onError: (err) => addToast(err.message, 'error')
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id) => {
      const res = await apiPost(`${API_BASE}?action=admin_users_delete`, { id });
      if (!res.ok) throw new Error(res.data.error || 'Gagal menghapus pengguna');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admin_users']);
      addToast('Pengguna berhasil dihapus', 'success');
    },
    onError: (err) => {
      addToast(err.message, 'error');
    }
  });

  const broadcastMutation = useMutation({
    mutationFn: async (data) => {
      const res = await apiPost(`${API_BASE}?action=admin_broadcast`, data);
      if (!res.ok) throw new Error(res.data.error || 'Gagal mengirim broadcast');
      return res.data;
    },
    onSuccess: (data) => {
      addToast(`Broadcast terkirim: Email(${data.stats.email}), WA(${data.stats.whatsapp}), Telegram(${data.stats.telegram})`, 'success');
      setIsBroadcastModalOpen(false);
    },
    onError: (err) => {
      addToast(err.message, 'error');
    }
  });

  const handleEditClick = (u) => {
    setEditingUser({
      ...u,
      assigned_units: u.assigned_units || []
    });
    setResetPasswordValue('');
  };

  const handleDeleteUser = (id, username) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus pengguna "${username}"? Tindakan ini tidak dapat dibatalkan.`)) {
        deleteUserMutation.mutate(id);
    }
  };

  const handleUnitToggle = (unitName) => {
    if (!editingUser) return;
    const currentUnits = editingUser.assigned_units || [];
    let newUnits;
    if (currentUnits.includes(unitName)) {
      newUnits = currentUnits.filter(u => u !== unitName);
    } else {
      newUnits = [...currentUnits, unitName];
    }
    setEditingUser({ ...editingUser, assigned_units: newUnits });
  };

  const handleSaveUser = () => {
    if (!editingUser) return;
    updateUserMutation.mutate({
      id: editingUser.id,
      role: editingUser.role,
      assigned_units: editingUser.assigned_units,
      job_title: editingUser.job_title
    });
  };

  // Settings
  const { data: settings, refetch: refetchSettings } = useQuery({
    queryKey: ['admin_settings'],
    queryFn: async () => {
      const res = await apiGet(`${API_BASE}?action=admin_settings_get`);
      return res.ok ? res.data.settings : {};
    },
    enabled: activeTab === 'settings'
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings) => {
      const res = await apiPost(`${API_BASE}?action=admin_settings_update`, newSettings);
      if (!res.ok) throw new Error(res.data.error || 'Gagal memperbarui pengaturan');
      return res.data;
    },
    onSuccess: () => {
      refetchSettings();
      addToast('Pengaturan berhasil diperbarui', 'success');
    },
    onError: (err) => addToast(err.message, 'error')
  });

  const handleToggleRegistration = async () => {
    updateSettingsMutation.mutate({
      registration_enabled: !settings?.registration_enabled
    });
  };

  if (!user || user.role !== 'admin') {
    return <div className="p-8 text-center text-red-500">Akses Ditolak</div>;
  }

  return (
    <div className="flex-1 h-screen overflow-y-auto bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">
              Panel Admin
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              Konfigurasi Sistem & Kontrol Akses
            </p>
          </div>
          <div className="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-xs font-medium">
            Mode Administrator
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
          {['users', 'units', 'teams', 'audit', 'system', 'decisions', 'settings'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab 
                  ? 'border-teal-500 text-teal-600 dark:text-teal-400' 
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {tab === 'units' ? 'Unit Bisnis' : 
               tab === 'teams' ? 'Tim Kerja' :
               tab === 'audit' ? 'Log Audit' :
               tab === 'system' ? 'Operasi Sistem' :
               tab === 'decisions' ? 'Log Keputusan' :
               tab === 'settings' ? 'Pengaturan' :
               'Manajemen Pengguna'}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === 'settings' && (
           <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                <span className="text-xl">⚙️</span> Pengaturan Sistem
              </h3>
              
              <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div>
                          <h4 className="font-semibold text-slate-800 dark:text-white">Pendaftaran Pengguna Baru</h4>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                              Izinkan pengguna baru untuk mendaftar mandiri. Matikan untuk keamanan ekstra.
                          </p>
                      </div>
                      <button
                          onClick={handleToggleRegistration}
                          disabled={updateSettingsMutation.isPending}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
                              settings?.registration_enabled ? 'bg-teal-600' : 'bg-slate-200 dark:bg-slate-700'
                          }`}
                      >
                          <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  settings?.registration_enabled ? 'translate-x-6' : 'translate-x-1'
                              }`}
                          />
                      </button>
                  </div>
              </div>
           </div>
        )}
        {activeTab === 'units' && (
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
               <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xl p-6">
                  <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
                                <span className="text-teal-500">🏢</span> Kelola Unit
                            </h3>
                  
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                    {businessUnits?.length === 0 && <p className="text-slate-400 text-sm italic">Tidak ada unit bisnis ditemukan.</p>}
                    {businessUnits?.map((unit) => (
                      <div key={unit.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 group hover:border-teal-500/30 transition-all">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{unit.name}</span>
                        <button 
                          onClick={() => handleDeleteUnit(unit.id, unit.name)}
                          disabled={deleteUnitMutation.isPending}
                          className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                          title="Hapus Unit"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
               </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xl p-6">
                  <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
                    <span className="text-emerald-500">➕</span> Tambah Unit Baru
                  </h3>
                  <form onSubmit={handleCreateUnit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Nama Unit</label>
                      <input 
                        type="text" 
                        value={newUnitName}
                        onChange={(e) => setNewUnitName(e.target.value)}
                        placeholder="contoh: divisi_teknis"
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
                        autoFocus
                      />
                      <p className="text-xs text-slate-500 mt-2">
                        * Nama unit sebaiknya huruf kecil dan tanpa spasi.
                      </p>
                    </div>
                    <button 
                      type="submit"
                      disabled={!newUnitName.trim() || createUnitMutation.isPending}
                      className="w-full py-3 bg-teal-500 hover:bg-teal-600 text-white font-bold rounded-xl shadow-lg shadow-teal-500/30 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {createUnitMutation.isPending ? 'Membuat...' : 'Buat Unit'}
                    </button>
                  </form>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'teams' && (
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
               <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xl p-6">
                  <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
                    <span className="text-teal-500">👥</span> Kelola Tim
                  </h3>
                  
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                    {teams?.length === 0 && (
                        <div className="text-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                            <div className="text-3xl mb-2">👥</div>
                            <p className="text-slate-500 font-medium">Belum ada tim</p>
                            <p className="text-xs text-slate-400 mt-1">Buat tim pertama Anda di panel sebelah kanan</p>
                        </div>
                    )}
                    {teams?.map((team) => (
                      <div key={team.id} className="flex flex-col p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 group hover:border-teal-500/30 transition-all">
                        <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-slate-700 dark:text-slate-200">{team.name}</span>
                            <button 
                              onClick={() => handleDeleteTeam(team.id, team.name)}
                              disabled={deleteTeamMutation.isPending}
                              className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                              title="Hapus Tim"
                            >
                              ✕
                            </button>
                        </div>
                        <div className="flex justify-between mt-1">
                            <span className="text-xs text-slate-500 dark:text-slate-400 italic truncate pr-2">
                                {team.description || '-'}
                            </span>
                            {team.business_unit_name && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-500 border border-teal-500/20 font-mono">
                                    {team.business_unit_name}
                                </span>
                            )}
                        </div>
                      </div>
                    ))}
                  </div>
               </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xl p-6">
                  <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
                    <span className="text-green-500">➕</span> Tambah Tim Baru
                  </h3>
                  <form onSubmit={handleCreateTeam} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Nama Tim</label>
                      <input 
                        type="text" 
                        value={newTeamName}
                        onChange={(e) => setNewTeamName(e.target.value)}
                        placeholder="contoh: Tim Alpha"
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Deskripsi</label>
                      <textarea 
                        value={newTeamDesc}
                        onChange={(e) => setNewTeamDesc(e.target.value)}
                        placeholder="Deskripsi singkat..."
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all h-20 resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Unit Bisnis (Opsional)</label>
                      <select
                        value={newTeamUnitId}
                        onChange={(e) => setNewTeamUnitId(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
                      >
                        <option value="">-- Pilih Unit --</option>
                        {businessUnits?.map(unit => (
                            <option key={unit.id} value={unit.id}>{unit.name}</option>
                        ))}
                      </select>
                    </div>
                    <button 
                      type="submit"
                      disabled={!newTeamName.trim() || createTeamMutation.isPending}
                      className="w-full py-3 bg-teal-500 hover:bg-teal-600 text-white font-bold rounded-xl shadow-lg shadow-teal-500/30 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {createTeamMutation.isPending ? 'MEMBUAT...' : 'BUAT TIM'}
                    </button>
                  </form>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-6">
            
            <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <h3 className="font-bold text-slate-700 dark:text-slate-200">Daftar Pengguna ({users?.length || 0})</h3>
                <button
                    onClick={() => setIsBroadcastModalOpen(true)}
                    className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-bold text-sm shadow-lg shadow-indigo-500/30 transition-all flex items-center gap-2"
                >
                    <span>📢</span> Broadcast Pesan
                </button>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
                {isLoading ? (
                    <div className="p-8 text-center text-slate-500 italic">Memuat data...</div>
                ) : users?.map((u) => (
                    <div key={u.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-800 dark:text-white">{u.username}</span>
                                    {u.id === user.id && <span className="text-[10px] bg-teal-500/20 text-teal-500 px-1.5 py-0.5 rounded">Anda</span>}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{u.job_title || 'Tanpa Jabatan'}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex gap-2">
                                    {u.email && <span title={u.email}>📧</span>}
                                    {u.phone && <span title={u.phone}>📱</span>}
                                    {u.telegram_chat_id && <span title="Telegram Connected">✈️</span>}
                                </div>
                            </div>
                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide ${
                                u.role === 'admin' 
                                    ? 'bg-red-500/10 text-red-600' 
                                    : u.role === 'manager'
                                    ? 'bg-emerald-500/10 text-emerald-600'
                                    : 'bg-blue-500/10 text-blue-600'
                            }`}>
                                {u.role}
                            </span>
                        </div>
                        
                        {u.assigned_units && u.assigned_units.length > 0 && (
                            <div className="mb-4">
                                <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Unit Ditugaskan</div>
                                <div className="flex flex-wrap gap-1">
                                    {u.assigned_units.map((unit, idx) => (
                                        <span key={idx} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-[10px] font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                                            {unit}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                            <button 
                                onClick={() => handleEditClick(u)}
                                className="px-3 py-1.5 bg-teal-50 text-teal-600 rounded-lg text-xs font-bold"
                            >
                                Edit Akses
                            </button>
                            {u.id !== user.id && (
                                <button 
                                    onClick={() => handleDeleteUser(u.id, u.username)}
                                    disabled={deleteUserMutation.isPending}
                                    className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold"
                                >
                                    Hapus
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                      <th className="p-4 text-sm font-semibold text-slate-600 dark:text-slate-400">Nama Pengguna</th>
                      <th className="p-4 text-sm font-semibold text-slate-600 dark:text-slate-400">Jabatan</th>
                      <th className="p-4 text-sm font-semibold text-slate-600 dark:text-slate-400">Peran</th>
                      <th className="p-4 text-sm font-semibold text-slate-600 dark:text-slate-400">Unit Ditugaskan</th>
                      <th className="p-4 text-sm font-semibold text-slate-600 dark:text-slate-400 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {isLoading ? (
                      [1, 2, 3, 4, 5].map((i) => (
                          <tr key={i}>
                              <td className="p-4"><Skeleton className="h-5 w-32" /></td>
                              <td className="p-4"><Skeleton className="h-4 w-24" /></td>
                              <td className="p-4"><Skeleton className="h-6 w-16 rounded" /></td>
                              <td className="p-4"><Skeleton className="h-5 w-20" /></td>
                              <td className="p-4 text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
                          </tr>
                      ))
                    ) : users?.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="p-4 font-medium text-sm text-slate-700 dark:text-slate-200">
                          {u.username}
                          {u.id === user.id && <span className="ml-2 text-[10px] bg-teal-500/20 text-teal-500 px-1.5 py-0.5 rounded">Anda</span>}
                        </td>
                        <td className="p-4 text-sm text-slate-600 dark:text-slate-300">
                          {u.job_title || '-'}
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            u.role === 'admin' 
                              ? 'bg-red-500/10 text-red-600' 
                              : u.role === 'manager'
                                ? 'bg-emerald-500/10 text-emerald-600'
                                : 'bg-blue-500/10 text-blue-600'
                          }`}>
                            {u.role === 'member' ? 'Anggota' : u.role}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-1">
                            {u.assigned_units && u.assigned_units.length > 0 ? (
                              u.assigned_units.map((unit, idx) => (
                                <span key={idx} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-[10px] font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                                  {unit}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-400 text-xs italic">Tidak ada unit</span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-3">
                            <button 
                              onClick={() => handleEditClick(u)}
                              className="text-xs font-medium text-teal-600 hover:text-teal-500 hover:underline"
                            >
                              Edit Akses
                            </button>
                            {u.id !== user.id && (
                                <button 
                                  onClick={() => handleDeleteUser(u.id, u.username)}
                                  disabled={deleteUserMutation.isPending}
                                  className="text-xs font-medium text-red-600 hover:text-red-500 hover:underline"
                                >
                                  Hapus
                                </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Edit User Modal */}
        {editingUser && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden relative max-h-[90vh] overflow-y-auto custom-scrollbar">
                    <div className="p-6">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                            Edit User: <span className="text-teal-500">{editingUser.username}</span>
                        </h3>
                        
                        <div className="space-y-6">
                            {/* Role Selection */}
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Peran / Role</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['member', 'manager', 'admin'].map(role => (
                                        <button
                                            key={role}
                                            onClick={() => setEditingUser({...editingUser, role})}
                                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                                                editingUser.role === role
                                                    ? role === 'admin' ? 'bg-red-500/20 text-red-600 border-red-500' 
                                                    : role === 'manager' ? 'bg-emerald-500/20 text-emerald-600 border-emerald-500'
                                                    : 'bg-teal-500/20 text-teal-600 border-teal-500'
                                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-transparent hover:border-slate-300 dark:hover:border-slate-600'
                                            }`}
                                        >
                                            {role === 'member' ? 'Anggota' : role}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Job Title */}
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Jabatan</label>
                                <input 
                                    type="text"
                                    value={editingUser.job_title || ''}
                                    onChange={(e) => setEditingUser({...editingUser, job_title: e.target.value})}
                                    placeholder="e.g. Senior Developer"
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
                                />
                            </div>

                            {/* Unit Assignment */}
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Unit Ditugaskan</label>
                                <div className="flex flex-wrap gap-2 p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-700">
                                    {businessUnits?.length === 0 && <span className="text-slate-400 text-xs italic">Belum ada unit bisnis.</span>}
                                    {businessUnits?.map(unit => (
                                        <button
                                            key={unit.id}
                                            onClick={() => handleUnitToggle(unit.name)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                                                editingUser.assigned_units?.includes(unit.name)
                                                    ? 'bg-teal-500/20 text-teal-600 border-teal-500'
                                                    : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-teal-500/50'
                                            }`}
                                        >
                                            {unit.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Password Reset */}
                            <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Reset Password (Opsional)</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={resetPasswordValue}
                                        onChange={(e) => setResetPasswordValue(e.target.value)}
                                        placeholder="Password baru..."
                                        className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-sm focus:outline-none focus:border-teal-500"
                                    />
                                    <button
                                        onClick={() => resetPasswordMutation.mutate({ id: editingUser.id, password: resetPasswordValue })}
                                        disabled={!resetPasswordValue || resetPasswordValue.length < 6 || resetPasswordMutation.isPending}
                                        className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold disabled:opacity-50"
                                    >
                                        RESET
                                    </button>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button 
                                    onClick={() => setEditingUser(null)}
                                    className="flex-1 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                                >
                                    BATAL
                                </button>
                                <button 
                                    onClick={handleSaveUser}
                                    disabled={updateUserMutation.isPending}
                                    className="flex-1 py-3 bg-teal-500 hover:bg-teal-600 text-white rounded-xl font-bold shadow-lg shadow-teal-500/30 transition-all"
                                >
                                    {updateUserMutation.isPending ? 'MENYIMPAN...' : 'SIMPAN PERUBAHAN'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'audit' && (
          <AuditLogViewer />
        )}

        {activeTab === 'system' && (
           <div className="space-y-8">
             <SystemHealthWidget />
             
             <div className="grid md:grid-cols-2 gap-8">
               <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xl p-8 space-y-6">
                <div className="flex items-center gap-4 text-red-500 mb-2">
                  <span className="text-3xl">💣</span>
                  <h3 className="text-xl font-bold">Zona Bahaya</h3>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Lakukan reset total sistem. Ini akan menghapus semua tugas, proyek, item inbox, dan log. Akun pengguna akan tetap ada.
                </p>
                <button 
                  onClick={handleResetSystem}
                  disabled={resetAllMutation.isPending}
                  className="w-full py-4 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/50 rounded-xl font-bold uppercase tracking-wider transition-all"
                >
                  {resetAllMutation.isPending ? 'MERESET...' : 'RESET DATA SISTEM'}
                </button>
             </div>

             <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xl p-8 space-y-6">
                <div className="flex items-center gap-4 text-blue-500 mb-2">
                  <span className="text-3xl">💾</span>
                  <h3 className="text-xl font-bold">Backup Server (Otomatis & Manual)</h3>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Kelola file backup yang tersimpan di server. Anda dapat membuat backup baru atau memulihkan dari backup yang ada.
                </p>
                
                <button 
                  onClick={handleCreateBackup}
                  disabled={createBackupMutation.isPending}
                  className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 transition-all flex items-center justify-center gap-2"
                >
                  {createBackupMutation.isPending ? 'Memproses...' : '➕ Buat Backup Baru di Server'}
                </button>

                <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar border border-slate-200 dark:border-slate-700 rounded-xl p-2 bg-slate-50 dark:bg-slate-900">
                  {backups.length === 0 && (
                    <p className="text-center text-slate-400 py-4 italic">Belum ada file backup di server.</p>
                  )}
                  {backups.map((backup) => (
                    <div key={backup.filename} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-500/30 transition-all">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{backup.filename}</span>
                        <span className="text-xs text-slate-500">Ukuran: {backup.size} • Dibuat: {backup.created_at}</span>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleRestoreBackup(backup.filename)}
                          disabled={restoreBackupMutation.isPending}
                          className="px-3 py-1.5 text-xs font-medium bg-teal-500/10 text-teal-600 hover:bg-teal-500 hover:text-white rounded transition-colors"
                          title="Pulihkan Data"
                        >
                          Restore
                        </button>
                        <button 
                          onClick={() => handleDeleteBackup(backup.filename)}
                          disabled={deleteBackupMutation.isPending}
                          className="px-3 py-1.5 text-xs font-medium bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white rounded transition-colors"
                          title="Hapus File"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
             </div>

             <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xl p-8 space-y-6">
                <div className="flex items-center gap-4 text-indigo-500 mb-2">
                  <span className="text-3xl">📥</span>
                  <h3 className="text-xl font-bold">Backup Lokal (Export/Import)</h3>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Unduh data sistem ke komputer Anda (format JSON) atau pulihkan dari file lokal.
                </p>
                <div className="flex gap-2">
                    <button 
                      onClick={handleExport}
                      className="flex-1 py-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl font-medium shadow-sm transition-all flex items-center justify-center gap-2"
                    >
                      <span>⬇️</span> Unduh JSON
                    </button>
                    <label className="flex-1 py-3 bg-teal-500 hover:bg-teal-600 text-white border border-teal-600 rounded-xl font-medium shadow-sm transition-all text-center cursor-pointer flex items-center justify-center gap-2">
                        <span>⬆️</span> Pulihkan JSON
                        <input 
                            type="file" 
                            accept=".json"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = async (ev) => {
                                    try {
                                        const data = JSON.parse(ev.target.result);
                                        const res = await apiPost(`${API_BASE}?action=import_all`, data);
                                        if (res.ok) {
                                            addToast('Data berhasil dipulihkan', 'success');
                                            window.location.reload();
                                        } else {
                                            throw new Error(res.data.error || 'Import failed');
                                        }
                                    } catch (err) {
                                        addToast('Gagal memproses file backup: ' + err.message, 'error');
                                    }
                                };
                                reader.readAsText(file);
                            }}
                        />
                    </label>
                </div>
                
                <div className="pt-4 border-t border-slate-200 dark:border-slate-700 mt-4">
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Database Mentah (SQLite)</h4>
                    <button 
                      onClick={() => window.open(`${API_BASE}?action=admin_backup_download`, '_blank')}
                      className="w-full py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-xl font-medium shadow-sm transition-all flex items-center justify-center gap-2"
                    >
                      <span>🗄️</span> Unduh File .sqlite
                    </button>
                    <p className="text-xs text-slate-500 mt-2">
                        * Gunakan ini untuk backup fisik database. Hanya bekerja jika menggunakan SQLite.
                    </p>
                </div>
             </div>
           </div>
           </div>
        )}

        

        {activeTab === 'decisions' && (
          <DecisionLogViewer />
        )}

      </div>
    </div>
  );
}
