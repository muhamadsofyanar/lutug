import React, { useState } from 'react';

export default function CompletionLogModal({ task, mode = 'complete', onClose, onConfirm, isSubmitting }) {
    const [reason, setReason] = useState('');

    const isComplete = mode === 'complete';
    const title = isComplete ? 'Selesaikan Tugas' : 'Hentikan Tugas';
    const actionLabel = isComplete ? 'Selesaikan' : 'Hentikan';
    
    // Calm & Light Theme Classes
    const containerClasses = "bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col relative";
        
    const headerClasses = isComplete
        ? "p-6 border-b border-slate-100 dark:border-slate-800 bg-teal-50/50 dark:bg-teal-900/10"
        : "p-6 border-b border-slate-100 dark:border-slate-800 bg-red-50/50 dark:bg-red-900/10";
        
    const titleClasses = isComplete
        ? "text-lg font-bold text-teal-700 dark:text-teal-400 flex items-center gap-2"
        : "text-lg font-bold text-red-700 dark:text-red-400 flex items-center gap-2";
        
    const subtitleClasses = "text-sm text-slate-500 mt-1";

    const labelClasses = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2";

    const textareaClasses = "w-full p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-teal-500 outline-none transition-all text-sm text-slate-800 dark:text-slate-200 resize-none placeholder-slate-400";

    const footerClasses = "p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end gap-3";

    const confirmBtnClasses = isComplete
        ? "px-6 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl shadow-lg shadow-teal-500/20 transition-all font-bold text-sm flex items-center gap-2"
        : "px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl shadow-lg shadow-red-500/20 transition-all font-bold text-sm flex items-center gap-2";
    
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className={containerClasses}>
                
                <div className={headerClasses}>
                    <h3 className={titleClasses}>
                        <span>{isComplete ? '✅' : '🛑'}</span> {title}
                    </h3>
                    <p className={subtitleClasses}>
                        {task.title}
                    </p>
                </div>

                <div className="p-6 space-y-4">
                    <div className="group">
                        <label className={labelClasses}>
                            Catatan {isComplete ? 'Penyelesaian' : 'Penghentian'} (Opsional)
                        </label>
                        <textarea 
                            className={textareaClasses}
                            rows="4"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder={isComplete ? "Apa yang telah dicapai..." : "Alasan dihentikan..."}
                            autoFocus
                        />
                    </div>
                </div>

                <div className={footerClasses}>
                    <button 
                        className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm font-medium"
                        onClick={onClose}
                        disabled={isSubmitting}
                    >
                        Batal
                    </button>
                    <button 
                        className={confirmBtnClasses}
                        onClick={() => onConfirm(reason)}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <span className="animate-spin">⏳</span>
                        ) : (
                            <span>{actionLabel}</span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
