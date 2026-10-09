import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, API_BASE } from '../services/api';
import { useToast } from '../contexts/ToastContext';

export default function TaskComments({ taskId }) {
    const { addToast } = useToast();
    const queryClient = useQueryClient();
    const [newComment, setNewComment] = useState('');

    // Fetch Comments
    const { data: comments = [], isLoading } = useQuery({
        queryKey: ['task_comments', taskId],
        queryFn: async () => {
            const res = await apiGet(`${API_BASE}?action=task_comments_list&taskId=${taskId}`);
            return res.ok ? (res.data.comments || []) : [];
        },
        enabled: !!taskId,
        refetchInterval: 10000 // Poll every 10s for real-time-ish feel
    });

    // Add Comment Mutation
    const addCommentMutation = useMutation({
        mutationFn: async (content) => {
            const res = await apiPost(`${API_BASE}?action=task_comments_add`, { 
                taskId, 
                content 
            });
            if (!res.ok) throw new Error(res.data.error || 'Gagal mengirim komentar');
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['task_comments', taskId]);
            setNewComment('');
            addToast('Komentar ditambahkan', 'success');
        },
        onError: (err) => {
            addToast(err.message, 'error');
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!newComment.trim()) return;
        addCommentMutation.mutate(newComment);
    };

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleString('id-ID', { 
            day: 'numeric', 
            month: 'short', 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    };

    return (
        <div className="flex flex-col h-full">
            <h4 className="text-xs font-bold text-slate-500 mb-4 flex items-center gap-2">
                <span className="text-lg">💬</span> Diskusi & Catatan
            </h4>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 max-h-[200px] custom-scrollbar">
                {isLoading ? (
                    <div className="text-slate-500 text-xs animate-pulse">Memuat komentar...</div>
                ) : comments.length === 0 ? (
                    <div className="text-slate-400 text-xs italic">Belum ada catatan.</div>
                ) : (
                    comments.map((comment) => (
                        <div key={comment.id} className="group flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0 group-hover:border-teal-500/50 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                                {comment.author ? comment.author.substring(0, 2) : '??'}
                            </div>
                            <div className="flex-1 bg-slate-50 dark:bg-slate-900/50 rounded-r-xl rounded-bl-xl border border-slate-100 dark:border-slate-800 p-3 hover:border-slate-200 dark:hover:border-slate-700 transition-colors">
                                <div className="flex justify-between items-start mb-1">
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{comment.author}</span>
                                    <span className="text-[10px] text-slate-400">{formatDate(comment.created_at)}</span>
                                </div>
                                <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed">{comment.content}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Input Area */}
            <div className="flex gap-2">
                <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Tulis catatan..."
                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 placeholder:text-slate-400"
                    onKeyPress={(e) => e.key === 'Enter' && handleSubmit(e)}
                />
                <button
                    onClick={handleSubmit}
                    disabled={!newComment.trim()}
                    className="bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Kirim
                </button>
            </div>
        </div>
    );
}
