import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, API_BASE } from '../services/api';
import { useToast } from '../contexts/ToastContext';

export default function KanbanBoard({ projectId, onTaskClick }) {
    const { addToast } = useToast();
    const queryClient = useQueryClient();
    const [draggedTask, setDraggedTask] = useState(null);

    const { data: tasks = [], isLoading } = useQuery({
        queryKey: ['project_tasks', projectId],
        queryFn: async () => {
            const res = await apiGet(`${API_BASE}?action=project_get_tasks&projectId=${projectId}`);
            if (!res.ok) throw new Error("Gagal memuat tugas taktis");
            return res.data.tasks;
        }
    });

    const updateStatusMutation = useMutation({
        mutationFn: async ({ taskId, status }) => {
            let action = 'task_update_attributes';
            let payload = { taskId, status };
            
            if (status === 'done') {
                action = 'task_complete';
                payload = { taskId, reason: "Dipindahkan ke Selesai via Kanban" };
            }

            const res = await apiPost(`${API_BASE}?action=${action}`, payload);
            if (!res.ok) throw new Error("Gagal memperbarui status");
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['project_tasks', projectId]);
            queryClient.invalidateQueries(['dashboard_stats']);
            addToast("Status Taktis Diperbarui", "success");
        },
        onError: () => addToast("Gagal memperbarui status", "error")
    });

    const onDragStart = (e, task) => {
        setDraggedTask(task);
        e.dataTransfer.effectAllowed = 'move';
        // Optional: Custom drag image
    };

    const onDragOver = (e) => {
        e.preventDefault(); // Essential for onDrop to fire
    };

    const onDrop = (e, status) => {
        e.preventDefault();
        if (draggedTask && draggedTask.status !== status) {
            updateStatusMutation.mutate({ taskId: draggedTask.id, status });
        }
        setDraggedTask(null);
    };

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">Memuat data...</div>;
  }

  const columns = {
    todo: { title: 'Akan Dikerjakan', items: tasks.filter(t => t.status === 'pending') },
    in_progress: { title: 'Sedang Dikerjakan', items: tasks.filter(t => t.status === 'in_progress') },
    done: { title: 'Selesai', items: tasks.filter(t => t.status === 'completed') }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 overflow-x-auto pb-4">
      {Object.entries(columns).map(([id, col]) => (
        <div key={id} className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4 min-h-[500px] flex flex-col">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">
            <h3 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${
                id === 'todo' ? 'bg-slate-400' : 
                id === 'in_progress' ? 'bg-amber-400' : 
                'bg-emerald-400'
              }`}></span>
              {col.title}
            </h3>
            <span className="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs px-2 py-1 rounded-full font-medium">
              {col.items.length}
            </span>
          </div>
          
          <div className="space-y-3 flex-1">
            {col.items.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm italic border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                Tidak ada tugas
              </div>
            ) : (
              col.items.map(task => (
                <div 
                  key={task.id} 
                  className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
                  onClick={() => onTaskClick && onTaskClick(task)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                      task.priority === 'high' ? 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30' :
                      task.priority === 'medium' ? 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/30' :
                      'bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-900/20 dark:text-slate-400 dark:border-slate-700'
                    }`}>
                      {task.priority === 'high' ? 'Penting' : task.priority === 'medium' ? 'Sedang' : 'Biasa'}
                    </span>
                    {task.energy_level && (
                      <span className="text-xs text-slate-400">⚡ {task.energy_level}</span>
                    )}
                  </div>
                  <h4 className="text-slate-800 dark:text-slate-200 font-medium text-sm mb-1 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                    {task.title}
                  </h4>
                  {task.project && (
                    <div className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                      {task.project.name}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
