import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, API_BASE } from '../services/api';
import { useToast } from '../contexts/ToastContext';

export default function People({ user }) {
    const queryClient = useQueryClient();
    const { addToast } = useToast();
    const [newName, setNewName] = useState('');
    const [registerModal, setRegisterModal] = useState({ isOpen: false, name: '' });
    const [regPassword, setRegPassword] = useState('');
    const [editModal, setEditModal] = useState({ isOpen: false, person: null });
    const [editForm, setEditForm] = useState({ job_title: '', team_id: '' });
    
    // Team Creation State
    const [teamModal, setTeamModal] = useState({ isOpen: false, name: '', description: '', business_unit_id: '' });
    
    // View Mode: 'people' | 'teams'
    const [viewMode, setViewMode] = useState('people');

    const [filterUnit, setFilterUnit] = useState('all'); // 'all' or 'my_units'

    // Fetch Business Units (for Team creation)
    const { data: businessUnits = [] } = useQuery({
        queryKey: ['business_units'],
        queryFn: async () => {
            const res = await apiGet(`${API_BASE}?action=business_unit_list`);
            return res.ok ? res.data.units : [];
        }
    });

    // Fetch Teams
    const { data: teams = [], refetch: refetchTeams } = useQuery({
        queryKey: ['teams'],
        queryFn: async () => {
            const res = await apiGet(`${API_BASE}?action=team_list`);
            return res.ok ? res.data.teams : [];
        }
    });

    const { data: people = [], isLoading } = useQuery({
        queryKey: ['people'],
        queryFn: async () => {
            const result = await apiGet(`${API_BASE}?action=people_list`);
            // Handle both old (array of strings) and new (array of objects) formats during transition
            const raw = result.ok ? result.data.people || [] : [];
            if (raw.length > 0 && typeof raw[0] === 'string') {
                return raw.map(name => ({ name, is_user: false, is_person: true }));
            }
            return raw;
        }
    });

    const filteredPeople = React.useMemo(() => {
        if (!user || user.role === 'admin' || filterUnit === 'all') return people;
        
        const myUnits = user.assigned_units || [];
        if (myUnits.length === 0) return people; 

        return people.filter(p => {
            if (!p.is_user) return true; 
            const theirUnits = p.assigned_units || [];
            return theirUnits.some(u => myUnits.includes(u));
        });
    }, [people, user, filterUnit]);

    const addMutation = useMutation({
        mutationFn: async (name) => {
            const result = await apiPost(`${API_BASE}?action=people_create`, { name });
            if (!result.ok) throw new Error(result.data.error || "Gagal menambah orang");
            return result.data;
        },
        onSuccess: () => {
            addToast("Orang berhasil ditambahkan", "success");
            setNewName('');
            queryClient.invalidateQueries(['people']);
        },
        onError: (err) => {
            addToast(err.message, "error");
        }
    });

    const updateMutation = useMutation({
        mutationFn: async (data) => {
             const result = await apiPost(`${API_BASE}?action=people_update`, data);
             if (!result.ok) throw new Error(result.data.error || "Gagal update");
             return result.data;
        },
        onSuccess: () => {
             addToast("Data berhasil diperbarui", "success");
             setEditModal({ isOpen: false, person: null });
             queryClient.invalidateQueries(['people']);
        },
        onError: (err) => {
            addToast(err.message, "error");
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (name) => {
            if(!window.confirm(`Hapus ${name} dari daftar?`)) return;
            const result = await apiPost(`${API_BASE}?action=people_delete`, { name });
            if (!result.ok) throw new Error(result.data.error || "Gagal menghapus");
            return result.data;
        },
        onSuccess: () => {
            addToast("Dihapus", "success");
            queryClient.invalidateQueries(['people']);
        },
        onError: (err) => {
            addToast(err.message, "error");
        }
    });

    const registerMutation = useMutation({
        mutationFn: async ({ username, password }) => {
            const result = await apiPost(`${API_BASE}?action=auth_register`, { username, password });
            if (!result.ok) throw new Error(result.data.error || "Gagal mendaftar user");
            return result.data;
        },
        onSuccess: () => {
            addToast("User berhasil dibuat! Silakan atur akses di Panel Admin.", "success");
            setRegisterModal({ isOpen: false, name: '' });
            setRegPassword('');
            queryClient.invalidateQueries(['people']);
        },
        onError: (err) => addToast(err.message, "error")
    });

    const createTeamMutation = useMutation({
        mutationFn: async (data) => {
            const res = await apiPost(`${API_BASE}?action=team_create`, data);
            if (!res.ok) throw new Error(res.data.error || 'Gagal membuat tim');
            return res.data;
        },
        onSuccess: () => {
            addToast('Tim berhasil dibuat', 'success');
            setTeamModal({ isOpen: false, name: '', description: '', business_unit_id: '' });
            refetchTeams();
            setViewMode('teams'); // Switch to teams view to show the new team
        },
        onError: (err) => addToast(err.message, 'error')
    });

    const deleteTeamMutation = useMutation({
        mutationFn: async (id) => {
            if (!window.confirm('Yakin ingin menghapus tim ini?')) throw new Error('Dibatalkan');
            const res = await apiPost(`${API_BASE}?action=team_delete`, { id });
            if (!res.ok) throw new Error(res.data.error || 'Gagal menghapus tim');
            return res.data;
        },
        onSuccess: () => {
            addToast('Tim berhasil dihapus', 'success');
            refetchTeams();
        },
        onError: (err) => {
            if (err.message !== 'Dibatalkan') addToast(err.message, 'error');
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (newName.trim()) addMutation.mutate(newName);
    };

    const handleRegister = (e) => {
        e.preventDefault();
        if (!regPassword || regPassword.length < 6) {
            addToast("Password minimal 6 karakter", "error");
            return;
        }
        registerMutation.mutate({ username: registerModal.name, password: regPassword });
    };

    const handleCreateTeam = (e) => {
        e.preventDefault();
        if (!teamModal.name.trim()) return;
        createTeamMutation.mutate({
            name: teamModal.name,
            description: teamModal.description,
            business_unit_id: teamModal.business_unit_id || null
        });
    };

    const openEditModal = (person) => {
        setEditModal({ isOpen: true, person });
        setEditForm({
            job_title: person.job_title || '',
            team_id: person.team_id || ''
        });
    };

    const handleUpdate = (e) => {
        e.preventDefault();
        if (!editModal.person) return;
        updateMutation.mutate({
            name: editModal.person.name,
            job_title: editForm.job_title,
            team_id: editForm.team_id
        });
    };

    return (
        <div className="p-4 md:p-8 max-w-6xl mx-auto pb-24">
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-emerald-600 mb-2 tracking-tight">TIM & PERSONEL</h1>
            <p className="text-slate-500 dark:text-slate-400 mb-8 text-sm">Kelola struktur tim, jabatan, dan personel.</p>

            <div className="flex gap-4 mb-6 border-b border-slate-200 dark:border-slate-800">
                <button 
                    onClick={() => setViewMode('people')}
                    className={`pb-3 px-4 text-sm font-bold transition-all border-b-2 ${viewMode === 'people' ? 'border-teal-500 text-teal-600 dark:text-teal-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}`}
                >
                    Personel
                </button>
                <button 
                    onClick={() => setViewMode('teams')}
                    className={`pb-3 px-4 text-sm font-bold transition-all border-b-2 ${viewMode === 'teams' ? 'border-teal-500 text-teal-600 dark:text-teal-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}`}
                >
                    Daftar Tim
                </button>
            </div>

            <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm mb-8">
                <div className="flex flex-col md:flex-row gap-4">
                    {viewMode === 'people' ? (
                        <form onSubmit={handleSubmit} className="flex-1 flex gap-4">
                            <input 
                                type="text" 
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder="Nama personel baru..."
                                className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:border-teal-500 text-sm text-slate-900 dark:text-white transition-all"
                            />
                            <button 
                                type="submit" 
                                disabled={!newName.trim() || addMutation.isPending}
                                className="bg-teal-600 hover:bg-teal-700 text-white font-bold px-6 py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md text-sm whitespace-nowrap"
                            >
                                {addMutation.isPending ? '...' : '+ Personel'}
                            </button>
                        </form>
                    ) : (
                        <div className="flex-1 flex items-center text-slate-500 text-sm italic">
                            Kelola tim kerja untuk mengelompokkan personel.
                        </div>
                    )}
                    
                    <button 
                        onClick={() => setTeamModal({ ...teamModal, isOpen: true })}
                        className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold px-6 py-3 rounded-xl transition-all shadow-md text-sm whitespace-nowrap"
                    >
                        + Buat Tim Baru
                    </button>
                </div>
            </div>

            {viewMode === 'people' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredPeople.map((person, idx) => (
                        <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex flex-col justify-between group hover:border-teal-500/50 transition-all hover:shadow-lg relative">
                            <div className="flex items-start gap-3 mb-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shadow-inner shrink-0 ${person.is_user ? 'bg-teal-500/20 text-teal-600 dark:text-teal-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                                    {person.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-bold text-slate-700 dark:text-slate-200 truncate">
                                            {person.name}
                                        </span>
                                        {person.is_user && (
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
                                                person.role === 'admin' ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800' :
                                                person.role === 'manager' ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800' :
                                                'bg-teal-50 text-teal-600 border-teal-200 dark:bg-teal-900/20 dark:text-teal-400 dark:border-teal-800'
                                            }`} title={`Role: ${person.role}`}>
                                                {person.role === 'member' ? 'Pengguna' : (person.role || 'Pengguna')}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1 flex flex-col gap-0.5">
                                        <span className="flex items-center gap-1">
                                            <span className="opacity-50">💼</span> {person.job_title || 'Tanpa Jabatan'}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <span className="opacity-50">👥</span> {person.team_name || 'Tanpa Tim'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3 mt-auto">
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => openEditModal(person)}
                                        className="text-xs font-medium text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300 flex items-center gap-1 px-3 py-2 rounded hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors"
                                    >
                                        Edit Info
                                    </button>
                                    {!person.is_user && (
                                        <button 
                                            onClick={() => setRegisterModal({ isOpen: true, name: person.name })}
                                            className="text-xs font-medium text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                        >
                                            Jadikan User
                                        </button>
                                    )}
                                </div>
                                <button 
                                    onClick={() => deleteMutation.mutate(person.name)}
                                    className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                    title="Hapus"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    ))}
                    
                    {filteredPeople.length === 0 && !isLoading && (
                        <div className="col-span-full text-center py-12 text-slate-400 text-sm border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                            Belum ada data personel
                        </div>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {teams.map((team) => (
                        <div key={team.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex flex-col justify-between group hover:border-teal-500/50 transition-all hover:shadow-lg">
                            <div className="mb-4">
                                <div className="flex items-start justify-between">
                                    <h3 className="font-bold text-slate-900 dark:text-white text-lg">{team.name}</h3>
                                    {team.business_unit_name && (
                                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-1 rounded-full">
                                            {team.business_unit_name}
                                        </span>
                                    )}
                                </div>
                                {team.description && (
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 line-clamp-2">
                                        {team.description}
                                    </p>
                                )}
                            </div>
                            <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
                                <button 
                                    onClick={() => deleteTeamMutation.mutate(team.id)}
                                    className="text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1.5 rounded transition-colors"
                                >
                                    Hapus Tim
                                </button>
                            </div>
                        </div>
                    ))}
                    {teams.length === 0 && (
                        <div className="col-span-full text-center py-12 text-slate-400 text-sm border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                            Belum ada tim yang dibuat
                        </div>
                    )}
                </div>
            )}

            {/* Edit Modal */}
            {editModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden relative">
                        <div className="p-6">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                                Edit Info: <span className="text-teal-600 dark:text-teal-400">{editModal.person?.name}</span>
                            </h3>
                            <form onSubmit={handleUpdate} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">JABATAN</label>
                                    <input 
                                        type="text" 
                                        value={editForm.job_title}
                                        onChange={(e) => setEditForm({...editForm, job_title: e.target.value})}
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500 text-slate-900 dark:text-white transition-all"
                                        placeholder="e.g. Senior Developer"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">TIM</label>
                                    <select 
                                        value={editForm.team_id}
                                        onChange={(e) => setEditForm({...editForm, team_id: e.target.value})}
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500 text-slate-900 dark:text-white transition-all"
                                    >
                                        <option value="">-- Tidak ada Tim --</option>
                                        {teams.map(t => (
                                            <option key={t.id} value={t.id}>{t.name} {t.business_unit_name ? `(${t.business_unit_name})` : ''}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex gap-3 mt-6">
                                    <button 
                                        type="button"
                                        onClick={() => setEditModal({ isOpen: false, person: null })}
                                        className="flex-1 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm font-medium"
                                    >
                                        Batal
                                    </button>
                                    <button 
                type="submit"
                disabled={updateMutation.isPending}
                className="flex-1 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold transition-colors text-sm shadow-md"
              >
                {updateMutation.isPending ? 'Menyimpan...' : 'Simpan'}
              </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Team Creation Modal */}
            {teamModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden relative">
                        <div className="p-6">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                                Buat Tim Baru
                            </h3>
                            <form onSubmit={handleCreateTeam} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">NAMA TIM</label>
                                    <input 
                                        type="text" 
                                        value={teamModal.name}
                                        onChange={(e) => setTeamModal({...teamModal, name: e.target.value})}
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500 text-slate-900 dark:text-white transition-all"
                                        placeholder="Contoh: Tim Marketing"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">DESKRIPSI (Opsional)</label>
                                    <textarea 
                                        value={teamModal.description}
                                        onChange={(e) => setTeamModal({...teamModal, description: e.target.value})}
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500 text-slate-900 dark:text-white transition-all"
                                        placeholder="Penjelasan singkat tugas tim..."
                                        rows={2}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">UNIT BISNIS (Opsional)</label>
                                    <select 
                                        value={teamModal.business_unit_id}
                                        onChange={(e) => setTeamModal({...teamModal, business_unit_id: e.target.value})}
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500 text-slate-900 dark:text-white transition-all"
                                    >
                                        <option value="">-- Pilih Unit Bisnis --</option>
                                        {businessUnits.map(unit => (
                                            <option key={unit.id} value={unit.id}>{unit.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex gap-3 mt-6">
                                    <button 
                                        type="button"
                                        onClick={() => setTeamModal({ ...teamModal, isOpen: false })}
                                        className="flex-1 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm font-medium"
                                    >
                                        Batal
                                    </button>
                                    <button 
                                        type="submit"
                                        disabled={createTeamMutation.isPending}
                                        className="flex-1 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold transition-colors text-sm shadow-md"
                                    >
                                        {createTeamMutation.isPending ? 'Menyimpan...' : 'Buat Tim'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Register Modal */}
            {registerModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden relative">
                        <div className="p-6">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                                Jadikan <span className="text-teal-600 dark:text-teal-400">{registerModal.name}</span> sebagai User?
                            </h3>
                            <p className="text-slate-500 text-sm mb-4">User akan dapat login dan mengakses sistem.</p>
                            <form onSubmit={handleRegister} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">PASSWORD</label>
                                    <input 
                                        type="password" 
                                        value={regPassword}
                                        onChange={(e) => setRegPassword(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500 text-slate-900 dark:text-white transition-all"
                                        placeholder="Minimal 6 karakter"
                                        autoFocus
                                    />
                                </div>
                                <div className="flex gap-3 mt-6">
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            setRegisterModal({ isOpen: false, name: '' });
                                            setRegPassword('');
                                        }}
                                        className="flex-1 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm font-medium"
                                    >
                                        Batal
                                    </button>
                                    <button 
                                        type="submit"
                                        disabled={registerMutation.isPending}
                                        className="flex-1 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold transition-colors text-sm shadow-md"
                                    >
                                        {registerMutation.isPending ? 'Membuat...' : 'Buat User'}
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
