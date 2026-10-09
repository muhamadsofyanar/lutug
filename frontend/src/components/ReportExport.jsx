import React, { useState } from 'react';
import { apiGet, API_BASE } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export default function ReportExport() {
    const [activeTab, setActiveTab] = useState('daily'); // daily, weekly, project
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [previewData, setPreviewData] = useState(null);
    const { addToast } = useToast();

    const fetchReportData = async () => {
        setLoading(true);
        try {
            let url = `${API_BASE}?action=report_export&type=${activeTab}&start_date=${startDate}&end_date=${endDate}`;
            const result = await apiGet(url);

            if (!result.ok) {
                throw new Error(result.error || 'Gagal mengambil data laporan');
            }

            return result.data.data;
        } catch (error) {
            addToast(error.message, "error");
            console.error(error);
            return null;
        } finally {
            setLoading(false);
        }
    };

    const handlePreview = async () => {
        const data = await fetchReportData();
        if (data) setPreviewData(data);
    };

    const handleExport = async (format) => {
        const data = previewData || await fetchReportData();
        if (!data) return;
        
        try {
            if (format === 'pdf') {
                generatePDF(data, activeTab);
            } else if (format === 'excel') {
                generateExcel(data, activeTab);
            }
            addToast("Laporan berhasil diunduh", "success");
        } catch (error) {
            addToast("Gagal export: " + error.message, "error");
        }
    };

    const generatePDF = (data, type) => {
        const doc = new jsPDF();
        
        // Header
        doc.setFontSize(18);
        doc.text("Laporan InsyaRah", 14, 22);
        doc.setFontSize(12);
        doc.text(data.title || 'Laporan', 14, 30);
        
        doc.setFontSize(10);
        doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 14, 38);

        let startY = 50;

        if (type === 'daily') {
            // Stats
            doc.text(`Total Selesai: ${data.stats.total_completed}`, 14, startY);
            startY += 10;

            // Tasks Table
            autoTable(doc, {
                startY: startY,
                head: [['Waktu', 'Tugas', 'Unit', 'Status']],
                body: data.completed_tasks.map(t => [
                    t.completed_at ? t.completed_at.split(' ')[1] : '-',
                    t.title,
                    t.business_unit || '-',
                    t.status
                ]),
            });
            
            // Updates
            if (data.daily_updates.length > 0) {
                const finalY = doc.lastAutoTable.finalY + 10;
                doc.text("Catatan Harian:", 14, finalY);
                data.daily_updates.forEach((u, i) => {
                    doc.text(`- Plan: ${u.today_plan || '-'}`, 14, finalY + 10 + (i * 15));
                    doc.text(`  Done: ${u.done || '-'}`, 14, finalY + 15 + (i * 15));
                    doc.text(`  Blocker: ${u.blocker || '-'}`, 14, finalY + 20 + (i * 15));
                });
            }

        } else if (type === 'weekly') {
            doc.text(`Periode: ${data.range[0]} s/d ${data.range[1]}`, 14, startY);
            startY += 10;
            
            autoTable(doc, {
                startY: startY,
                head: [['Tanggal', 'Tugas', 'Unit']],
                body: data.tasks.map(t => [
                    t.completed_at ? t.completed_at.split(' ')[0] : '-',
                    t.title,
                    t.business_unit || '-'
                ]),
            });
        } else if (type === 'project') {
             autoTable(doc, {
                startY: startY,
                head: [['Proyek', 'Status', 'Selesai', 'Pending', 'Next Action']],
                body: data.projects.map(p => [
                    p.title,
                    p.status,
                    p.done_tasks,
                    p.pending_tasks,
                    p.next_action || '-'
                ]),
            });
        }

        doc.save(`Laporan_${type}_${startDate}.pdf`);
    };

    const generateExcel = (data, type) => {
        const wb = XLSX.utils.book_new();
        let wsData = [];

        if (type === 'daily') {
            wsData.push(['Laporan Harian', data.date]);
            wsData.push([]);
            wsData.push(['ID', 'Waktu Selesai', 'Tugas', 'Unit Bisnis', 'Status']);
            data.completed_tasks.forEach(t => {
                wsData.push([t.id, t.completed_at, t.title, t.business_unit, t.status]);
            });
        } else if (type === 'weekly') {
             wsData.push(['Laporan Mingguan', `${data.range[0]} - ${data.range[1]}`]);
             wsData.push([]);
             wsData.push(['ID', 'Tanggal Selesai', 'Tugas', 'Unit Bisnis']);
             data.tasks.forEach(t => {
                wsData.push([t.id, t.completed_at, t.title, t.business_unit]);
            });
        } else if (type === 'project') {
             wsData.push(['Laporan Proyek']);
             wsData.push([]);
             wsData.push(['ID', 'Proyek', 'Status', 'Tugas Selesai', 'Tugas Pending', 'Langkah Selanjutnya']);
             data.projects.forEach(p => {
                wsData.push([p.id, p.title, p.status, p.done_tasks, p.pending_tasks, p.next_action]);
            });
        }

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, "Laporan");
        XLSX.writeFile(wb, `Laporan_${type}_${startDate}.xlsx`);
    };

    return (
        <div className="p-6 pb-24 max-w-4xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">Jejak Amal 📋</h1>
                <p className="text-slate-500 dark:text-slate-400">Export data kegiatan dan pencapaian Anda.</p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
                
                {/* Tabs */}
                <div className="flex flex-wrap gap-2 mb-8 border-b border-slate-100 dark:border-slate-700 pb-4">
                    {['daily', 'weekly', 'project'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-3 rounded-lg font-medium text-sm transition-all ${
                                activeTab === tab 
                                ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300' 
                                : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'
                            }`}
                        >
                            {tab === 'daily' && 'Laporan Harian'}
                            {tab === 'weekly' && 'Laporan Mingguan'}
                            {tab === 'project' && 'Status Proyek'}
                        </button>
                    ))}
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    {activeTab !== 'project' && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-2">Dari Tanggal</label>
                            <input 
                                type="date" 
                                className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                    )}
                    
                    {activeTab === 'weekly' && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-2">Sampai Tanggal</label>
                            <input 
                                type="date" 
                                className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex flex-col md:flex-row gap-4">
                    <button 
                        onClick={handlePreview}
                        disabled={loading}
                        className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-bold shadow-sm transition-all flex items-center justify-center gap-2"
                    >
                        {loading ? '...' : (
                            <>
                                <span>👁️</span> Preview Data
                            </>
                        )}
                    </button>
                    <button 
                        onClick={() => handleExport('pdf')}
                        disabled={loading}
                        className="flex-1 py-4 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-bold shadow-sm transition-all flex items-center justify-center gap-2"
                    >
                        {loading ? 'Memproses...' : (
                            <>
                                <span>📄</span> Download PDF
                            </>
                        )}
                    </button>
                    <button 
                        onClick={() => handleExport('excel')}
                        disabled={loading}
                        className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-sm transition-all flex items-center justify-center gap-2"
                    >
                        {loading ? 'Memproses...' : (
                            <>
                                <span>📊</span> Download Excel
                            </>
                        )}
                    </button>
                </div>

            </div>

            {previewData && (
                <div className="mt-8 bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="font-bold text-lg text-slate-800 dark:text-white">Preview Laporan</h3>
                            <p className="text-sm text-slate-500">
                                {activeTab === 'daily' && `Total Selesai: ${previewData.stats?.total_completed || 0}`}
                                {activeTab === 'weekly' && `Periode: ${previewData.range?.[0]} - ${previewData.range?.[1]}`}
                        </p>
                    </div>
                    <button onClick={() => setPreviewData(null)} className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                        ✕ Tutup
                    </button>
                </div>

                    {/* Daily View */}
                    {activeTab === 'daily' && previewData.completed_tasks && (
                        <>
                            {/* Desktop Table */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-700/50">
                                        <tr>
                                            <th className="px-4 py-3 rounded-l-lg">Waktu</th>
                                            <th className="px-4 py-3">Tugas</th>
                                            <th className="px-4 py-3">Unit</th>
                                            <th className="px-4 py-3 rounded-r-lg">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                        {previewData.completed_tasks.map((t, i) => (
                                            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                                <td className="px-4 py-3 font-mono text-xs">{t.completed_at?.split(' ')[1]}</td>
                                                <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{t.title}</td>
                                                <td className="px-4 py-3 text-slate-500">{t.business_unit}</td>
                                                <td className="px-4 py-3">
                                                    <span className="px-2 py-1 text-xs rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                                        {t.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Cards */}
                            <div className="md:hidden space-y-4">
                                {previewData.completed_tasks.map((t, i) => (
                                    <div key={i} className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-mono text-xs text-slate-500">{t.completed_at?.split(' ')[1]}</span>
                                            <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                                {t.status}
                                            </span>
                                        </div>
                                        <h4 className="font-bold text-slate-900 dark:text-white mb-1">{t.title}</h4>
                                        <p className="text-xs text-slate-500">{t.business_unit || 'No Unit'}</p>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {/* Weekly View */}
                    {activeTab === 'weekly' && previewData.tasks && (
                        <>
                             {/* Desktop Table */}
                             <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-700/50">
                                        <tr>
                                            <th className="px-4 py-3 rounded-l-lg">Tanggal</th>
                                            <th className="px-4 py-3">Tugas</th>
                                            <th className="px-4 py-3 rounded-r-lg">Unit</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                        {previewData.tasks.map((t, i) => (
                                            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                                <td className="px-4 py-3 font-mono text-xs">{t.completed_at?.split(' ')[0]}</td>
                                                <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{t.title}</td>
                                                <td className="px-4 py-3 text-slate-500">{t.business_unit}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Cards */}
                            <div className="md:hidden space-y-4">
                                {previewData.tasks.map((t, i) => (
                                    <div key={i} className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-mono text-xs text-slate-500">{t.completed_at?.split(' ')[0]}</span>
                                            <span className="text-xs text-slate-500">{t.business_unit}</span>
                                        </div>
                                        <h4 className="font-bold text-slate-900 dark:text-white">{t.title}</h4>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {/* Project View */}
                    {activeTab === 'project' && previewData.projects && (
                        <>
                             {/* Desktop Table */}
                             <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-700/50">
                                        <tr>
                                            <th className="px-4 py-3 rounded-l-lg">Proyek</th>
                                            <th className="px-4 py-3">Status</th>
                                            <th className="px-4 py-3 text-center">Selesai</th>
                                            <th className="px-4 py-3 text-center">Pending</th>
                                            <th className="px-4 py-3 rounded-r-lg">Next Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                        {previewData.projects.map((p, i) => (
                                            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                                <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{p.title}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-1 text-xs rounded-full ${
                                                        p.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                                        p.status === 'completed' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                        'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                                                    }`}>
                                                        {p.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center font-bold text-emerald-600">{p.done_tasks}</td>
                                                <td className="px-4 py-3 text-center font-bold text-amber-600">{p.pending_tasks}</td>
                                                <td className="px-4 py-3 text-slate-500 text-xs max-w-xs truncate" title={p.next_action}>
                                                    {p.next_action || '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Cards */}
                            <div className="md:hidden space-y-4">
                                {previewData.projects.map((p, i) => (
                                    <div key={i} className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                                        <div className="flex justify-between items-start mb-3">
                                            <h4 className="font-bold text-slate-900 dark:text-white text-lg">{p.title}</h4>
                                            <span className={`px-2 py-1 text-xs rounded-full ${
                                                p.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                                p.status === 'completed' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                                            }`}>
                                                {p.status}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 mb-3">
                                            <div className="bg-white dark:bg-slate-800 p-2 rounded-lg text-center border border-slate-100 dark:border-slate-600">
                                                <div className="text-xs text-slate-500">Selesai</div>
                                                <div className="font-bold text-emerald-600 text-lg">{p.done_tasks}</div>
                                            </div>
                                            <div className="bg-white dark:bg-slate-800 p-2 rounded-lg text-center border border-slate-100 dark:border-slate-600">
                                                <div className="text-xs text-slate-500">Pending</div>
                                                <div className="font-bold text-amber-600 text-lg">{p.pending_tasks}</div>
                                            </div>
                                        </div>
                                        {p.next_action && (
                                            <div className="text-xs text-slate-500 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-600">
                                                <span className="font-bold text-slate-700 dark:text-slate-300">Next:</span> {p.next_action}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {(!previewData.completed_tasks?.length && !previewData.tasks?.length && !previewData.projects?.length) && (
                        <div className="text-center py-8 text-slate-400">
                            Tidak ada data untuk periode ini
                        </div>
                    )}
                </div>
            )}

            <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-800">
                <h3 className="font-bold text-blue-700 dark:text-blue-300 mb-2">Tips Jejak Amal</h3>
                <p className="text-sm text-blue-600 dark:text-blue-400">
                    Gunakan laporan ini untuk evaluasi mingguan (Muhasabah) atau sebagai lampiran laporan kinerja ke atasan/klien Anda.
                    Data yang rapi adalah awal dari ketenangan pikiran.
                </p>
            </div>
        </div>
    );
}
