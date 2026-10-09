import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { apiPost, API_BASE } from '../services/api';

const FocusTimer = ({ isOpen, onClose, task }) => {
    const queryClient = useQueryClient();
    const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 minutes
    const [isActive, setIsActive] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const [mode, setMode] = useState('focus'); // focus | break
    const [showReport, setShowReport] = useState(false);
    const [reportData, setReportData] = useState(null);

    const intervalRef = useRef(null);

    useEffect(() => {
        if (isActive && timeLeft > 0) {
            intervalRef.current = setInterval(() => {
                setTimeLeft((prev) => prev - 1);
            }, 1000);
        } else if (timeLeft === 0) {
            handleComplete();
        }

        return () => clearInterval(intervalRef.current);
    }, [isActive, timeLeft]);

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const handleStart = async () => {
        try {
            const res = await apiPost(`${API_BASE}?action=focus_start`, {
                task_id: task?.id
            });
            // apiPost returns { ok, data } where data is the raw response usually, but let's check api.js
            // api.js: returns { ok: res.ok && json.success, data: json.data }
            // But my PHP returns { success: true, session_id: ... } directly.
            // If PHP returns simple JSON without 'data' wrapper, api.js might handle it differently.
            // Let's check handleResponse in api.js again.
            // "if ('success' in json && 'data' in json) ..."
            // My PHP returns { success: true, session_id: ... }. No 'data' key.
            // So it might fall through.
            
            // I should update FocusController to return data in 'data' key or update FocusTimer to handle raw.
            // Wait, api.js handleResponse logic:
            /*
            if ('success' in json && 'data' in json) { return ... }
            if ('success' in json && 'error' in json ...) { ... }
            if ('error' in json ...) { ... }
            */
           
           // If my PHP returns { success: true, session_id: 123 }, api.js returns:
           // { ok: res.ok, data: json } (implicit default return if no matches?)
           
           // Let's check api.js full content to see default return.
            if (res.ok) {
                // Backend returns { success: true, data: { session_id: ... } }
                // api.js returns { ok: true, data: { session_id: ... } }
                setSessionId(res.data.session_id);
                setIsActive(true);
                
                // Refresh tasks to reflect status change (pending -> in_progress)
                queryClient.invalidateQueries(['today_tasks']);
                queryClient.invalidateQueries(['project_tasks']);
                queryClient.invalidateQueries(['dashboard_stats']);
            }
        } catch (error) {
            console.error('Failed to start focus session', error);
        }
    };

    const handleStop = async () => {
        if (!sessionId) {
            setIsActive(false);
            setTimeLeft(25 * 60);
            return;
        }

        try {
            const res = await apiPost(`${API_BASE}?action=focus_stop`, {
                session_id: sessionId
            });
            if (res.ok) {
                setReportData(res.data);
                setShowReport(true);
                setIsActive(false);
                setSessionId(null);
                queryClient.invalidateQueries(['gamification']); // Update XP/Level
            }
        } catch (error) {
            console.error('Failed to stop focus session', error);
        }
    };

    const handleCancel = async () => {
        if (sessionId) {
            try {
                await apiPost(`${API_BASE}?action=focus_cancel`, {
                    session_id: sessionId
                });
            } catch (error) {
                console.error('Failed to cancel session', error);
            }
        }
        setIsActive(false);
        setSessionId(null);
        setTimeLeft(25 * 60);
        onClose();
    };

    const handleComplete = async () => {
        clearInterval(intervalRef.current);
        // Auto-stop to save session
        await handleStop();
        // Play sound?
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden">
                
                {/* Header */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                        <span className="text-xl">⚡</span>
                        <h2 className="font-bold tracking-tight text-lg">Mode Fokus</h2>
                    </div>
                    <button onClick={handleCancel} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">✕</button>
                </div>

                {/* Content */}
                <div className="p-8 flex flex-col items-center justify-center relative">
                    {/* Background Elements */}
                    <div className={`absolute inset-0 bg-gradient-to-b from-teal-50/50 to-transparent dark:from-teal-900/10 pointer-events-none transition-opacity duration-1000 ${isActive ? 'opacity-100' : 'opacity-0'}`}></div>
                    
                    {/* Timer Circle */}
                    <div className="relative w-64 h-64 mb-8 flex items-center justify-center">
                        <div className="absolute inset-0 border-4 border-slate-100 dark:border-slate-800 rounded-full"></div>
                        <div 
                            className={`absolute inset-0 border-4 border-teal-500 rounded-full transition-all duration-1000 ${isActive ? 'animate-spin-slow' : ''}`} 
                            style={{ clipPath: isActive ? 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' : 'polygon(0 0, 100% 0, 100% 0, 0 0)' }}
                        ></div>
                        <div className="absolute inset-2 border border-slate-100 dark:border-slate-800 rounded-full flex items-center justify-center bg-white dark:bg-slate-900 shadow-sm">
                            <div className="text-center">
                                <div className="text-6xl font-bold text-slate-800 dark:text-white tracking-tighter tabular-nums">
                                    {formatTime(timeLeft)}
                                </div>
                                <div className="text-slate-500 dark:text-slate-400 text-sm mt-2 font-medium uppercase tracking-wide">
                                    {isActive ? 'Sedang Fokus' : 'Siap'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Task Info */}
                    {task && (
                        <div className="mb-8 text-center max-w-xs">
                            <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Target Saat Ini</div>
                            <div className="text-slate-800 dark:text-slate-200 font-medium truncate">{task.title || task.content}</div>
                        </div>
                    )}

                    {/* Controls */}
                    {!isActive ? (
                        <button 
                            onClick={handleStart}
                            className="w-full py-4 bg-teal-600 hover:bg-teal-500 text-white font-bold text-lg rounded-xl shadow-lg shadow-teal-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                            <span>🚀</span> Mulai Fokus
                        </button>
                    ) : (
                        <button 
                            onClick={handleStop}
                            className="w-full py-4 bg-red-500 hover:bg-red-400 text-white font-bold text-lg rounded-xl shadow-lg shadow-red-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                            <span>🛑</span> Selesaikan Sesi
                        </button>
                    )}
                </div>

                {/* Report Modal (Overlay) */}
                {showReport && reportData && (
                    <div className="absolute inset-0 z-10 bg-white/95 dark:bg-slate-900/95 flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 duration-300">
                        <div className="text-4xl mb-4">🎉</div>
                        <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Sesi Selesai</h3>
                        <p className="text-slate-500 mb-6">Fokus yang luar biasa!</p>
                        
                        <div className="grid grid-cols-2 gap-4 w-full max-w-xs mb-8">
                            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                <div className="text-2xl font-bold text-teal-600 dark:text-teal-400">{reportData.duration_minutes}m</div>
                                <div className="text-xs text-slate-500 font-bold uppercase">Waktu</div>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">+{reportData.xp_earned} XP</div>
                                <div className="text-xs text-slate-500 font-bold uppercase">Hadiah</div>
                            </div>
                        </div>

                        {reportData.gamification?.level_up && (
                            <div className="mb-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50 rounded-xl w-full">
                                <div className="text-yellow-600 dark:text-yellow-400 font-bold text-lg">Naik Level! ⬆️</div>
                                <div className="text-slate-700 dark:text-yellow-200">Level {reportData.gamification.new_level}</div>
                            </div>
                        )}

                        {reportData.gamification?.new_badges && reportData.gamification.new_badges.length > 0 && (
                            <div className="mb-6 w-full">
                                <div className="text-sm text-slate-500 font-bold mb-2 tracking-wide uppercase text-center border-b border-slate-200 dark:border-slate-800 pb-1">
                                    Lencana Baru
                                </div>
                                <div className="flex flex-wrap justify-center gap-2">
                                    {reportData.gamification.new_badges.map(badgeId => (
                                        <div key={badgeId} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 flex items-center gap-2 shadow-sm">
                                            <span className="text-xl">
                                                {/* Map Badge Icons locally or just show generic if unknown */}
                                                {badgeId === 'focus_novice' ? '🧘' : 
                                                 badgeId === 'focus_marathon' ? '🌊' : 
                                                 badgeId === 'focus_master' ? '🧠' : '🏅'}
                                            </span>
                                            <div className="text-left">
                                                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                                    {badgeId === 'focus_novice' ? 'Pemula Fokus' : 
                                                     badgeId === 'focus_marathon' ? 'Selam Dalam' : 
                                                     badgeId === 'focus_master' ? 'Master Fokus' : badgeId.replace('_', ' ').toUpperCase()}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <button 
                            onClick={() => {
                                setShowReport(false);
                                onClose();
                            }}
                            className="px-8 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-colors"
                        >
                            Tutup
                        </button>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

export default FocusTimer;
