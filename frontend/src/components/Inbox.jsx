import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, API_BASE } from '../services/api';
import DecisionModal from './DecisionModal';
import EditInboxItemModal from './EditInboxItemModal';
import { useToast } from '../contexts/ToastContext';
import Skeleton from './common/Skeleton';

export default function Inbox({ viewParams }) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  
  // Local UI State
  const [newItemText, setNewItemText] = useState("");
  const [newBusinessUnit, setNewBusinessUnit] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [highlightedId, setHighlightedId] = useState(null);
  const [showHelp, setShowHelp] = useState(false);

  const [voiceStatus, setVoiceStatus] = useState('idle'); // idle, listening, processing, error
  const [voiceErrorMsg, setVoiceErrorMsg] = useState("");

  const { data: businessUnits = [] } = useQuery({
    queryKey: ['business_units'],
    queryFn: async () => {
      const res = await apiGet(`${API_BASE}?action=business_unit_list`);
      return res.ok ? res.data.units : [];
    },
    staleTime: 5 * 60 * 1000
  });

  // Smart Unit Detection
  useEffect(() => {
      if (newBusinessUnit) return; // Don't override if already set
      if (!businessUnits.length) return;

      const textUpper = newItemText.toUpperCase();
      
      const foundUnit = businessUnits.find(unit => textUpper.includes(unit.name.toUpperCase()));
      
      if (foundUnit) {
          setNewBusinessUnit(foundUnit.name);
          addToast(`Unit Terdeteksi: ${foundUnit.name}`, "info");
      }
  }, [newItemText, newBusinessUnit, addToast, businessUnits]);

  // Keyboard Shortcuts
  useEffect(() => {
      const handleKeyDown = (e) => {
          // Ctrl/Cmd + M to toggle Mic
          if ((e.ctrlKey || e.metaKey) && (e.key === 'm' || e.key === 'M')) {
              e.preventDefault();
              handleVoiceInput();
          }
      };
      
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRecording]); // Depend on isRecording state for toggle

  // Voice Input Handler
  const handleVoiceInput = () => {
    // 1. Manual Stop
    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
      setVoiceStatus('idle');
      setVoiceErrorMsg("");
      return;
    }

    // 2. Browser Check
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      addToast("Browser tidak mendukung Input Suara. Gunakan Chrome/Edge.", "error");
      return;
    }

    // 3. Start Recognition
    try {
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        
        // Capture initial text so we don't lose it during interim updates
        const baseText = newItemText; 
        setVoiceErrorMsg(""); // Reset error

        recognition.lang = 'id-ID'; // Changed to Indonesian
        recognition.continuous = true; // MANUAL MODE: Keep listening until user stops
        recognition.interimResults = true; // Show feedback immediately
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          setIsRecording(true);
          setVoiceStatus('listening');
          addToast("Mode Dikte Aktif. Klik lagi untuk berhenti.", "info");
        };

        recognition.onresult = (event) => {
          let finalTranscript = '';
          let interimTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }

          if (finalTranscript || interimTranscript) {
              const displayText = (baseText + " " + finalTranscript + " " + interimTranscript).replace(/\s+/g, ' ').trim();
              setNewItemText(displayText);
              setVoiceStatus('processing');
          }
        };

        recognition.onerror = (event) => {
          console.error("Voice Error:", event.error);
          if (event.error === 'no-speech') {
             return; 
          }
          
          setIsRecording(false);
          setVoiceStatus('error');
          setVoiceErrorMsg(event.error);
          
          if (event.error === 'network') {
             addToast("Error Jaringan. Cek koneksi internet.", "error");
          } else if (event.error === 'not-allowed') {
             addToast("Akses Mic Ditolak. Izinkan akses mikrofon.", "error");
          }
        };

        recognition.onend = () => {
          if (isRecording) {
             setIsRecording(false);
             setVoiceStatus('idle');
          }
        };

        recognition.start();
    } catch (e) {
        console.error("Start Error:", e);
        setIsRecording(false);
        setVoiceStatus('error');
    }
  };

  // 1. Fetch Inbox Items
  const { data: items = [], isLoading, error } = useQuery({
    queryKey: ['inbox'],
    queryFn: async () => {
      const result = await apiGet(`${API_BASE}?action=inbox_list`);
      if (result.ok) return result.data.items || [];
      throw new Error(result.data.error || "Gagal memuat Kotak Masuk");
    }
  });

  // Deep linking effect
  useEffect(() => {
    if (viewParams?.id && items.length > 0) {
      setHighlightedId(parseInt(viewParams.id));
      setTimeout(() => {
          const element = document.getElementById(`inbox-${viewParams.id}`);
          if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
      }, 500);
    }
  }, [viewParams, items]);

  // Helper to sync data
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['inbox'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
  };

  // 2. Add Item Mutation
  const addItemMutation = useMutation({
    mutationFn: async ({ text, unit }) => {
      const payload = { content: text };
      if (unit) payload.business_unit = unit;
      const result = await apiPost(`${API_BASE}?action=inbox_create`, payload);
      if (!result.ok) throw new Error(result.data.error || "Gagal menambahkan item");
      return result.data;
    },
    onSuccess: () => {
      setNewItemText("");
      setNewBusinessUnit("");
      addToast("Item Disimpan", "success");
      invalidateAll();
    },
    onError: (err) => addToast(err.message, "error")
  });

  const handleAddItem = (e) => {
    e.preventDefault();
    if (!newItemText.trim()) return;
    addItemMutation.mutate({ text: newItemText, unit: newBusinessUnit });
  };

  // 3. Delete Item Mutation
  const deleteItemMutation = useMutation({
    mutationFn: async (id) => {
      const result = await apiPost(`${API_BASE}?action=inbox_delete`, { id });
      if (!result.ok) throw new Error("Gagal menghapus item");
      return result.data;
    },
    onSuccess: () => {
      addToast("Item Dihapus", "success");
      invalidateAll();
    },
    onError: (err) => addToast(err.message, "error")
  });

  const handleDeleteItem = (id) => {
    if (!confirm("Hapus item ini?")) return;
    deleteItemMutation.mutate(id);
  };

  return (
    <div className="h-full flex flex-col max-w-4xl mx-auto p-4 md:p-8 animate-in fade-in zoom-in-95 duration-500">
      {/* Header */}
      <header className="mb-8 relative pl-6">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-teal-500 rounded-full"></div>
        <h2 className="text-4xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
          Kotak Masuk
        </h2>
        <div className="flex items-center gap-2 mt-2">
            <span className="h-2 w-2 bg-teal-500 rounded-full"></span>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
                {items?.length || 0} Item Pending
            </p>
            <button 
                onClick={() => setShowHelp(true)}
                className="ml-4 text-xs text-slate-500 hover:text-teal-600 border border-slate-200 dark:border-slate-700 hover:border-teal-500/50 rounded px-2 py-0.5 transition-all"
            >
                Bantuan
            </button>
        </div>
      </header>
      
      {/* Input Section */}
      <div className="mb-8 relative z-10 group">
        <form onSubmit={handleAddItem} className="relative bg-white dark:bg-slate-900 rounded-xl p-2 md:p-1 flex flex-col md:flex-row items-stretch md:items-center gap-2 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
           <div className="hidden md:block pl-4 text-slate-400">
             <span className="text-xl">✎</span>
           </div>
           
           <div className="flex-1 flex items-center gap-2">
               <span className="md:hidden pl-2 text-slate-400 text-lg">✎</span>
               <input
                type="text"
                className="flex-1 bg-transparent p-3 md:p-4 outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400 text-sm md:text-base"
                placeholder="Apa yang ada di pikiran Anda?"
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                disabled={addItemMutation.isPending}
                autoFocus
              />
           </div>

          {/* VOICE STATUS INDICATOR */}
          {voiceStatus !== 'idle' && (
              <div className="absolute top-12 left-0 right-0 text-center text-xs pointer-events-none z-50">
                  <span className={`px-3 py-1.5 rounded-full bg-slate-800 text-white shadow-lg ${
                      voiceStatus === 'error' ? 'bg-red-500' : 
                      voiceStatus === 'processing' ? 'bg-amber-500' : 
                      'bg-teal-600'
                  }`}>
                      {voiceStatus === 'listening' && "Mendengarkan..."}
                      {voiceStatus === 'processing' && "Memproses..."}
                      {voiceStatus === 'error' && `Error: ${
                        voiceErrorMsg === 'network' ? 'Jaringan' :
                        voiceErrorMsg === 'not-allowed' ? 'Mic Ditolak' :
                        voiceErrorMsg === 'no-speech' ? 'Hening' :
                        voiceErrorMsg === 'aborted' ? 'Dibatalkan' :
                        voiceErrorMsg === 'audio-capture' ? 'Mic Rusak' :
                        voiceErrorMsg || 'Unknown'
                      }`}
                  </span>
              </div>
          )}

          <button
            type="button"
            onClick={handleVoiceInput}
            className={`p-2 transition-all duration-300 ${isRecording ? 'text-red-500 scale-110' : 'text-slate-400 hover:text-teal-600'}`}
            title="Input Suara"
          >
            {isRecording ? '⏹️' : '🎙️'}
          </button>
          
          <input 
            type="text"
            className="w-24 bg-transparent p-4 outline-none text-slate-500 focus:text-teal-600 placeholder:text-slate-400 text-sm text-right border-l border-slate-100 dark:border-slate-800"
            placeholder="Unit"
            value={newBusinessUnit}
            onChange={(e) => setNewBusinessUnit(e.target.value.toUpperCase())}
            title="Unit Bisnis (Opsional)"
          />

          <button 
             type="submit"
             disabled={addItemMutation.isPending || !newItemText.trim()}
             className="mr-1 px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg transition-all text-sm flex items-center gap-2"
          >
             {addItemMutation.isPending ? 'Menyimpan...' : 'Simpan'}
          </button>
        </form>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg border border-red-100 flex items-center gap-2 text-sm">
          <span>⚠️ Error:</span>
          {error.message}
        </div>
      )}

      {/* List Section */}
      <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-3 pb-20 custom-scrollbar">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 space-y-3">
                        <Skeleton className="h-6 w-3/4" />
                        <div className="flex gap-2">
                            <Skeleton className="h-3 w-12" />
                            <Skeleton className="h-3 w-20" />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Skeleton className="h-10 w-10 rounded-lg" />
                        <Skeleton className="h-10 w-20 rounded-lg" />
                        <Skeleton className="h-10 w-10 rounded-lg" />
                    </div>
                </div>
              </div>
            ))}
          </div>
        ) : !items || items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-700 opacity-70">
            <div className="w-24 h-24 bg-teal-50 dark:bg-teal-900/20 rounded-full flex items-center justify-center mb-6">
              <span className="text-4xl">🍃</span>
            </div>
            <h3 className="text-xl font-medium text-slate-900 dark:text-slate-100 mb-2">Inbox Bersih</h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto text-sm italic">
              "Ketenangan bukan berarti berdiri di tempat yang bebas dari kegaduhan, tetapi mampu tetap tenang di tengah kesibukan."
            </p>
            <p className="text-xs text-slate-400 mt-2">Semua aman terkendali.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item, index) => {
              if (!item) return null; // Defensive check
              return (
              <div 
                key={item.id} 
                id={`inbox-${item.id}`}
                className={`group relative bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-teal-500/50 transition-all duration-300 hover:shadow-md ${highlightedId === item.id ? 'ring-2 ring-teal-500' : ''}`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                        <p className="text-slate-800 dark:text-slate-200 text-lg font-medium leading-relaxed">
                            {item.content}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-slate-400">
                            <span>#{item.id}</span>
                            <span className="text-slate-300">•</span>
                            <span>{new Date(item.created_at).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</span>
                            
                            {item.business_unit && (
                              <>
                                <span className="text-slate-300">•</span>
                                <span className="text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded text-[10px] font-medium border border-orange-100 dark:border-orange-800">
                                  {item.business_unit}
                                </span>
                              </>
                            )}
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all">
                        <button 
                            onClick={() => setEditingItem(item)}
                            className="p-3 text-slate-400 hover:text-teal-600 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-all"
                            title="Ubah"
                        >
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                        <button 
                            onClick={() => setSelectedItem(item)}
                            className="px-4 py-2 bg-teal-50 hover:bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 rounded-lg text-sm font-medium transition-all"
                            title="Proses Item Ini"
                        >
                            Proses
                        </button>
                        <button 
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                            title="Hapus"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </div>
              </div>
            );})}
          </div>
        )}
      </div>

      {selectedItem && (
        <DecisionModal 
          item={selectedItem} 
          onClose={() => {
            setSelectedItem(null);
            invalidateAll();
          }} 
        />
      )}
      
      {editingItem && (
        <EditInboxItemModal 
          item={editingItem} 
          onClose={() => {
            setEditingItem(null);
            invalidateAll();
          }} 
        />
      )}

      {showHelp && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-2xl w-full p-6 shadow-xl relative">
                <button 
                    onClick={() => setShowHelp(false)}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                    ✕
                </button>
                
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
                    Panduan Kotak Masuk
                </h3>
                
                <div className="space-y-6 text-sm text-slate-600 dark:text-slate-300">
                    <div className="flex gap-4">
                        <div className="text-2xl">1️⃣</div>
                        <div>
                            <h4 className="font-bold text-slate-900 dark:text-slate-100 mb-1">Tangkap Ide (Capture)</h4>
                            <p className="text-slate-500 dark:text-slate-400">
                                Masukkan ide, tugas, atau catatan mentah via Teks atau Suara (Mic). 
                                Jangan khawatir tentang format, cukup "tangkap" dulu apa yang ada di pikiran Anda.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <div className="text-2xl">2️⃣</div>
                        <div>
                            <h4 className="font-bold text-slate-900 dark:text-slate-100 mb-1">Proses & Klarifikasi</h4>
                            <p className="text-slate-500 dark:text-slate-400">
                                Klik tombol <span className="text-teal-600 dark:text-teal-400 font-medium bg-teal-50 dark:bg-teal-900/30 px-1.5 py-0.5 rounded">Proses</span> pada item.
                                Tentukan apakah ini:
                                <ul className="list-disc list-inside mt-2 ml-2">
                                    <li>Tugas yang bisa dikerjakan (Actionable)</li>
                                    <li>Referensi/Catatan saja</li>
                                    <li>Proyek besar</li>
                                    <li>Sampah</li>
                                </ul>
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <div className="text-2xl">3️⃣</div>
                        <div>
                            <h4 className="font-bold text-slate-900 dark:text-slate-100 mb-1">Organisasi</h4>
                            <p className="text-slate-500 dark:text-slate-400">
                                Setelah diproses, item akan pindah ke daftar yang sesuai (Tasks, Projects, dll) 
                                dan hilang dari Inbox. Usahakan Inbox <span className="text-green-600 dark:text-green-400 font-medium">Kosong</span> (Inbox Zero) setiap hari.
                            </p>
                        </div>
                    </div>

                    <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-3 text-xs uppercase tracking-wider">Tips & Shortcut</h4>
                        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-500 dark:text-slate-400">
                            <li className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 p-2 rounded border border-slate-200 dark:border-slate-700">
                                <span>Voice Input (Mic)</span>
                                <span className="font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 shadow-sm">Ctrl + M</span>
                            </li>
                            <li className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded border border-slate-200 dark:border-slate-700">
                                <div className="flex justify-between mb-1">
                                    <span>Deteksi Unit Otomatis</span>
                                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">Aktif</span>
                                </div>
                                <span className="text-[10px]">Sebut "Legaone", "Rizqhub", dll saat mendikte untuk set otomatis.</span>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="mt-8 flex justify-end">
                    <button 
                        onClick={() => setShowHelp(false)}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-all text-sm font-medium"
                    >
                        Tutup
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
