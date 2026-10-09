import React from 'react';

export default function Help() {
    return (
        <div className="p-6 md:p-8 max-w-5xl mx-auto h-full overflow-y-auto custom-scrollbar animate-in fade-in duration-700">
            <div className="mb-8">
                <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-600 mb-2">
                    PANDUAN OPERATOR
                </h1>
                <p className="text-slate-400 text-lg">Manual penggunaan sistem operasi InsyaRah.</p>
            </div>

            <div className="grid gap-8">
                {/* 1. Filosofi */}
                <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
                    <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                        <span className="text-teal-400">01</span>
                        Filosofi Sistem
                    </h2>
                    <p className="text-slate-300 leading-relaxed mb-4">
                        Sistem ini dirancang bukan sekadar untuk mencatat tugas, tapi untuk <strong>menyelaraskan ritme kerja dengan energi biologis Anda</strong>.
                        Jangan memaksakan diri saat "Low Battery", dan manfaatkan momentum saat "High Energy".
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                            <div className="text-teal-400 font-bold mb-2">CAPTURE (Tangkap)</div>
                            <div className="text-xs text-slate-400">Jangan simpan ide di kepala. Lempar semua ke <strong>Kotak Masuk</strong>.</div>
                        </div>
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                            <div className="text-emerald-400 font-bold mb-2">CLARIFY (Perjelas)</div>
                            <div className="text-xs text-slate-400">Tentukan langkah konkret. Apakah ini Proyek? Atau sekadar Referensi?</div>
                        </div>
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                            <div className="text-amber-400 font-bold mb-2">ENGAGE (Eksekusi)</div>
                            <div className="text-xs text-slate-400">Kerjakan apa yang ada di <strong>Misi Hari Ini</strong> sesuai level energi.</div>
                        </div>
                    </div>
                </section>

                {/* 2. Navigasi Menu */}
                <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
                    <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                        <span className="text-teal-400">02</span>
                        Navigasi & Menu
                    </h2>
                    <div className="space-y-4">
                        <div className="flex gap-4 items-start">
                            <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center text-xl shrink-0">🌐</div>
                            <div>
                                <h3 className="font-bold text-slate-200">Pusat Komando (Dashboard)</h3>
                                <p className="text-sm text-slate-400">Panel utama untuk memantau kesehatan bisnis, skor burnout (The Oracle), dan ringkasan tugas.</p>
                            </div>
                        </div>
                        <div className="flex gap-4 items-start">
                            <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center text-xl shrink-0">📥</div>
                            <div>
                                <h3 className="font-bold text-slate-200">Kotak Masuk (Inbox)</h3>
                                <p className="text-sm text-slate-400">Gerbang awal semua informasi. Masukkan semua ide, tugas, atau hal random di sini sebelum diproses.</p>
                            </div>
                        </div>
                        <div className="flex gap-4 items-start">
                            <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center text-xl shrink-0">📅</div>
                            <div>
                                <h3 className="font-bold text-slate-200">Misi Hari Ini (Today)</h3>
                                <p className="text-sm text-slate-400">Daftar tugas yang <strong>wajib</strong> diselesaikan hari ini. Jangan overload halaman ini.</p>
                            </div>
                        </div>
                        <div className="flex gap-4 items-start">
                            <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center text-xl shrink-0">🔜</div>
                            <div>
                                <h3 className="font-bold text-slate-200">Aksi Lanjutan (Next Actions)</h3>
                                <p className="text-sm text-slate-400">Daftar tugas yang "siap dikerjakan" tapi belum dijadwalkan untuk hari ini.</p>
                            </div>
                        </div>
                        <div className="flex gap-4 items-start">
                            <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center text-xl shrink-0">🏗️</div>
                            <div>
                                <h3 className="font-bold text-slate-200">Proyek (Projects)</h3>
                                <p className="text-sm text-slate-400">Pekerjaan besar yang membutuhkan lebih dari satu langkah untuk selesai.</p>
                            </div>
                        </div>
                        <div className="flex gap-4 items-start">
                            <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center text-xl shrink-0">📝</div>
                            <div>
                                <h3 className="font-bold text-slate-200">Jurnal Harian (Journal)</h3>
                                <p className="text-sm text-slate-400">Catat level energi, rencana pagi, dan refleksi sore untuk melatih AI mengenali pola kerjamu.</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 3. Fitur Canggih */}
                <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
                    <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                        <span className="text-amber-400">03</span>
                        Fitur Cerdas (Fase 11)
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-gradient-to-br from-teal-900/20 to-slate-900 border border-teal-500/20 p-5 rounded-xl">
                            <h3 className="font-bold text-teal-300 mb-2 flex items-center gap-2">
                                🔮 The Oracle (Sang Peramal)
                            </h3>
                            <p className="text-sm text-slate-400">
                                Sistem prediksi burnout yang menganalisis tren energi Anda selama 14 hari terakhir. 
                                Jika grafik energi menurun drastis, Oracle akan memberi peringatan "KEBOCORAN ENERGI" atau "BAHAYA BURNOUT".
                            </p>
                        </div>
                        <div className="bg-gradient-to-br from-emerald-900/20 to-slate-900 border border-emerald-500/20 p-5 rounded-xl">
                            <h3 className="font-bold text-emerald-300 mb-2 flex items-center gap-2">
                                📊 Skor Kesehatan Bisnis
                            </h3>
                            <p className="text-sm text-slate-400">
                                Skor 0-100 untuk setiap unit bisnis. Skor turun jika banyak <strong>Proyek Stagnan</strong> (tidak disentuh &gt; 1 minggu) atau <strong>Tugas Terlambat</strong>.
                            </p>
                        </div>
                    </div>
                </section>

                {/* 4. Panduan Teknis */}
                <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
                    <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                        <span className="text-rose-400">04</span>
                        Panduan Teknis (Admin)
                    </h2>
                    <div className="space-y-4">
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                            <h3 className="font-bold text-slate-200 mb-2 flex items-center gap-2">
                                💾 Backup & Restore
                            </h3>
                            <ul className="list-disc list-inside text-sm text-slate-400 space-y-1">
                                <li>Masuk ke <strong>Admin Panel</strong> untuk mengakses menu Backup.</li>
                                <li>Klik <strong>Backup Database</strong> untuk menyimpan snapshot data saat ini.</li>
                                <li>Tombol <strong>Restore</strong> akan mengembalikan data ke titik tersebut (Hati-hati: Data baru akan tertimpa).</li>
                                <li>Selalu download file backup penting ke komputer lokal Anda.</li>
                            </ul>
                        </div>

                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                            <h3 className="font-bold text-slate-200 mb-2 flex items-center gap-2">
                                ⚠️ Reset Sistem
                            </h3>
                            <p className="text-sm text-slate-400 mb-2">
                                Fitur <strong>Reset Data Sistem</strong> di Admin Panel berguna untuk memulai lembaran baru.
                            </p>
                            <div className="text-xs text-rose-400 bg-rose-900/20 p-2 rounded border border-rose-900/50">
                                <strong>Catatan:</strong> Reset hanya menghapus data transaksi (Tugas, Inbox, Proyek). Data User dan Unit Bisnis aman.
                            </div>
                        </div>

                        <div className="mt-4 p-3 bg-blue-900/20 border border-blue-800/50 rounded-lg flex gap-3 items-center">
                            <div className="text-2xl">📘</div>
                            <div>
                                <div className="text-blue-400 font-bold text-sm">Butuh panduan lebih lengkap?</div>
                                <div className="text-slate-400 text-xs">
                                    Silakan baca file <code>USER_GUIDE.md</code> yang tersedia di root folder proyek untuk detail langkah demi langkah.
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
