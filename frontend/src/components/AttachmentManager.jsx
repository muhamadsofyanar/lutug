import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, API_BASE } from '../services/api';
import { useToast } from '../contexts/ToastContext';

export default function AttachmentManager({ entityType, entityId }) {
    const { addToast } = useToast();
    const queryClient = useQueryClient();
    const [isUploading, setIsUploading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    // Fetch Attachments
    const { data: attachments = [], isLoading } = useQuery({
        queryKey: ['attachments', entityType, entityId],
        queryFn: async () => {
            const res = await apiGet(`${API_BASE}?action=attachment_list&entity_type=${entityType}&entity_id=${entityId}`);
            return res.ok ? (res.data.files || []) : [];
        },
        enabled: !!entityId
    });

    // Upload Mutation
    const uploadMutation = useMutation({
        mutationFn: async (file) => {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('entity_type', entityType);
            formData.append('entity_id', entityId);

            // Use fetch directly for FormData as apiPost helper might assume JSON
            // Assuming API_BASE is relative or absolute URL
            // We need to construct the URL manually or use a helper that supports FormData
            // Let's check api.js first. If it sets Content-Type to json, we need to bypass it or override.
            // For now, let's assume we can use fetch directly.
            
            // Get token from storage if needed (assuming api.js handles auth via cookie or header)
            // But usually, FormData needs no Content-Type header (browser sets it with boundary).
            
            const response = await fetch(`${API_BASE}?action=attachment_upload`, {
                method: 'POST',
                body: formData
                // Note: Do NOT set Content-Type header, browser does it automatically for FormData
            });
            
            const result = await response.json();
            if (!response.ok || !result.ok) {
                throw new Error(result.data?.error || result.error || 'Upload failed');
            }
            return result.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['attachments', entityType, entityId]);
            addToast('File berhasil diunggah', 'success');
            setIsUploading(false);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        },
        onError: (err) => {
            addToast(err.message, 'error');
            setIsUploading(false);
        }
    });

    // Delete Mutation
    const deleteMutation = useMutation({
        mutationFn: async (attachmentId) => {
            const res = await apiPost(`${API_BASE}?action=attachment_delete`, { id: attachmentId });
            if (!res.ok) throw new Error(res.data.error || 'Delete failed');
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['attachments', entityType, entityId]);
            addToast('File dihapus', 'success');
        },
        onError: (err) => addToast(err.message, 'error')
    });

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        if (file.size > 10 * 1024 * 1024) {
            addToast('File terlalu besar (Maks 10MB)', 'error');
            return;
        }

        setIsUploading(true);
        uploadMutation.mutate(file);
        e.target.value = null; // Reset input
    };

    const formatSize = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
        </svg>
        Lampiran <span className="text-slate-400 text-xs font-normal">({attachments.length})</span>
      </label>
                <div className="relative">
                    <input
                        type="file"
                        onChange={handleFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        disabled={isUploading}
                    />
                    <button 
                        className={`px-3 py-1 bg-teal-900/30 border border-teal-500/30 text-teal-400 rounded text-xs font-mono hover:bg-teal-900/50 transition-colors flex items-center gap-2 ${isUploading ? 'opacity-50 cursor-not-allowed' : ''} ${showSuccess ? 'border-emerald-500/50 text-emerald-400 bg-emerald-900/30' : ''}`}
                    >
                        {isUploading ? (
                            <>
                                <span className="animate-spin h-3 w-3 border-2 border-teal-500 border-t-transparent rounded-full"></span>
                                <span className="animate-pulse">MENGUNGGAH...</span>
                            </>
                        ) : showSuccess ? (
                            <>
                                <span className="text-sm">✅</span>
                                <span className="font-bold">TERSIMPAN!</span>
                            </>
                        ) : (
                            <>
                                <span>📎</span>
                                <span>UNGGAH FILE</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {isUploading && (
                <div className="w-full bg-slate-900/50 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-teal-500 h-full animate-progress-indeterminate origin-left"></div>
                </div>
            )}

            <div className="grid gap-2">
                {isLoading ? (
                    <div className="text-center py-2 text-slate-500 text-xs font-mono">Memuat...</div>
                ) : attachments.length === 0 ? (
                    <div className="text-center py-4 border border-dashed border-slate-700 rounded-lg text-slate-500 text-xs font-mono">
                        Tidak ada file terlampir. Unggah dokumen seperti NPWP, SK, NIB di sini.
                    </div>
                ) : (
                    attachments.map(file => (
                        <div key={file.id} className="flex items-center justify-between p-2 bg-slate-900/50 border border-slate-800 rounded group hover:border-teal-500/30 transition-colors">
                            <div className="flex items-center gap-3 min-w-0">
                                <span className="text-lg">📄</span>
                                <div className="min-w-0">
                                    <a 
                                        href={`${API_BASE.replace('backend/api/index.php', 'public/')}${file.file_path}`} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="block text-sm text-slate-300 font-mono truncate hover:text-teal-400 hover:underline"
                                    >
                                        {file.file_name}
                                    </a>
                                    <div className="text-[10px] text-slate-500 font-mono flex gap-2">
                                        <span>{formatSize(file.file_size)}</span>
                                        <span>•</span>
                                        <span>{new Date(file.created_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    if(window.confirm('Hapus file ini?')) {
                                        deleteMutation.mutate(file.id);
                                    }
                                }}
                                className="p-1 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                title="Hapus File"
                            >
                                ✕
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
