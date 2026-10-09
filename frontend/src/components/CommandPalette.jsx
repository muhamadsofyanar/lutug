import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { apiGet, API_BASE } from '../services/api';

export default function CommandPalette({ setView, isOpen, onClose, toggleTheme, onLogout }) {
    const [query, setQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef(null);
    const listRef = useRef(null);

    const commands = [
        { id: 'dashboard', label: 'Beranda', icon: '🌐', type: 'navigation', desc: 'Halaman utama' },
        { id: 'inbox', label: 'Kotak Masuk', icon: '📥', type: 'navigation', desc: 'Kelola pesan masuk' },
        { id: 'today', label: 'Hari Ini', icon: '⚡', type: 'navigation', desc: 'Fokus dan prioritas hari ini' },
        { id: 'projects', label: 'Proyek', icon: '🚀', type: 'navigation', desc: 'Daftar proyek aktif' },
        { id: 'next_actions', label: 'Rencana Taktis', icon: '▶️', type: 'navigation', desc: 'Daftar tugas berikutnya' },
        { id: 'references', label: 'Referensi', icon: '📚', type: 'navigation', desc: 'Perpustakaan dokumen & file' },
        { id: 'daily_update', label: 'Jurnal Harian', icon: '📝', type: 'navigation', desc: 'Catatan & update harian' },
        { id: 'night_review', label: 'Evaluasi Malam', icon: '🌙', type: 'navigation', desc: 'Refleksi akhir hari' },
        { id: 'activity', label: 'Aktivitas', icon: '📊', type: 'navigation', desc: 'Riwayat aktivitas terbaru' },
        // System Actions
        { id: 'theme_toggle', label: 'Ganti Tema', icon: '🌗', type: 'action', desc: 'Ubah mode tampilan (Terang/Gelap)', action: toggleTheme },
        { id: 'logout', label: 'Keluar Aplikasi', icon: '🚪', type: 'action', desc: 'Akhiri sesi anda', action: onLogout },
    ];

    const filteredCommands = commands.filter(cmd => 
        cmd.label.toLowerCase().includes(query.toLowerCase()) || 
        cmd.desc.toLowerCase().includes(query.toLowerCase())
    );

    // Global Search Logic
    useEffect(() => {
        if (!query || query.length < 2) {
            setSearchResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const result = await apiGet(`${API_BASE}?action=global_search&q=${encodeURIComponent(query)}`);
                if (result.ok) {
                    setSearchResults(result.data.results || []);
                }
            } catch (err) {
                console.error("Search failed", err);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [query]);

    const getIconForType = (type) => {
        switch(type) {
            case 'project': return '🚀';
            case 'reference': return '📚';
            case 'inbox': return '📥';
            case 'daily_log': return '📝';
            case 'task': return '⚡';
            default: return '🔍';
        }
    };

    const allItems = [
        ...filteredCommands,
        ...searchResults.map(r => {
            const typeMap = {
                'project': 'Proyek',
                'reference': 'Referensi',
                'inbox': 'Kotak Masuk',
                'daily_log': 'Jurnal Harian',
                'task': 'Tugas'
            };
            const typeLabel = typeMap[r.type] || r.type;
            
            return {
                id: `search_${r.type}_${r.id}`,
                label: r.title,
                desc: r.snippet || `Hasil dari ${typeLabel}`,
                icon: getIconForType(r.type),
                type: 'search_result',
                originalType: r.type,
                originalId: r.id
            };
        })
    ];

    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedIndex(0);
            setSearchResults([]);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!isOpen) return;

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setSelectedIndex(prev => (prev + 1) % allItems.length);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setSelectedIndex(prev => (prev - 1 + allItems.length) % allItems.length);
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (allItems[selectedIndex]) {
                        executeCommand(allItems[selectedIndex]);
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    onClose();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, allItems, selectedIndex]);

    const executeCommand = (command) => {
        if (command.type === 'navigation') {
            setView(command.id);
        } else if (command.type === 'action' && command.action) {
            command.action();
        } else if (command.type === 'search_result') {
            if (command.originalType === 'project') {
                setView('projects', { id: command.originalId });
            } else if (command.originalType === 'reference') {
                setView('references', { id: command.originalId });
            } else if (command.originalType === 'inbox') {
                setView('inbox', { id: command.originalId });
            } else if (command.originalType === 'daily_log') {
                setView('daily_update', { id: command.originalId });
            } else if (command.originalType === 'task') {
                setView('today', { id: command.originalId });
            }
        }
        onClose();
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh] bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div 
                className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-top-4 duration-300 relative"
                onClick={e => e.stopPropagation()}
            >
                {/* Search Input */}
                <div className="relative border-b border-slate-200 dark:border-slate-700 p-4 flex items-center gap-3">
                    <span className="text-slate-400 text-xl">🔍</span>
                    <input
                        ref={inputRef}
                        type="text"
                        className="w-full bg-transparent text-slate-800 dark:text-slate-200 text-lg font-medium placeholder:text-slate-400 focus:outline-none"
                        placeholder="Ketik perintah atau cari..."
                        value={query}
                        onChange={e => {
                            setQuery(e.target.value);
                            setSelectedIndex(0);
                        }}
                    />
                    <div className="flex gap-2">
                        <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 font-medium">ESC</span>
                    </div>
                </div>

                {/* Results List */}
                <div className="max-h-[60vh] overflow-y-auto custom-scrollbar p-2" ref={listRef}>
                    {allItems.map((command, index) => (
                        <div
                            key={command.id}
                            className={`flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-all ${
                                index === selectedIndex 
                                    ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300' 
                                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                            onClick={() => executeCommand(command)}
                            onMouseEnter={() => setSelectedIndex(index)}
                        >
                            <span className="text-2xl opacity-80">{command.icon}</span>
                            <div className="flex-1 min-w-0">
                                <div className={`text-sm font-bold ${
                                    index === selectedIndex ? 'text-teal-700 dark:text-teal-300' : 'text-slate-700 dark:text-slate-200'
                                }`}>
                                    {command.label}
                                </div>
                                <div className={`text-xs truncate ${
                                    index === selectedIndex ? 'text-teal-600/70 dark:text-teal-400/70' : 'text-slate-500'
                                }`}>
                                    {command.desc}
                                </div>
                            </div>
                            {index === selectedIndex && (
                                <span className="text-xs font-medium text-teal-600 dark:text-teal-400 px-2">
                                    ↵
                                </span>
                            )}
                        </div>
                    ))}
                    
                    {allItems.length === 0 && (
                        <div className="p-12 text-center text-slate-400 dark:text-slate-500 text-sm">
                            {query ? (isSearching ? 'Mencari data...' : 'Tidak ditemukan hasil.') : 'Ketik untuk mencari...'}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 p-2 flex justify-between items-center px-4">
                    <div className="flex gap-4 text-[10px] text-slate-500 font-medium">
                        <span><strong className="text-slate-600 dark:text-slate-400">↑↓</strong> Navigasi</span>
                        <span><strong className="text-slate-600 dark:text-slate-400">↵</strong> Pilih</span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium">
                        InsyaRah
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}