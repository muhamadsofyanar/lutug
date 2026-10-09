import React, { useState } from 'react';
import { apiPost, API_BASE } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { getFriendlyErrorMessage } from '../utils/errorHelpers';

export default function Login({ onLoginSuccess }) {
  // Views: login, register, register_otp, forgot_request, forgot_reset
  const [view, setView] = useState('login');
  
  // Login & Register States
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  
  const [phone, setPhone] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [otpMethod, setOtpMethod] = useState('email');

  // Forgot Password States
  const [forgotIdentity, setForgotIdentity] = useState('');
  const [forgotMethod, setForgotMethod] = useState('email');
  const [newPassword, setNewPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  const handleLogin = async () => {
    if (!username || !password) {
      addToast("Username dan password wajib diisi", "error");
      return;
    }
    setLoading(true);
    try {
      const result = await apiPost(`${API_BASE}?action=auth_login`, { username, password });
      if (result.ok) {
        addToast("Akses Diberikan", "success");
        if (onLoginSuccess) onLoginSuccess(result.data.user);
      } else {
        if (result.data.code === 'unverified_account') {
           // Auto switch to verify OTP if unverified
           setEmail(result.data.email || email); // Assuming backend sends email back or we use what we have
           // Wait, backend doesn't send email in error. User needs to check email.
           // But to verify OTP we need email. 
           // If login failed due to unverified, we might not have email if they logged in with username.
           // For now, just show error.
           addToast(getFriendlyErrorMessage(result.data.error), "error");
        } else {
           addToast(getFriendlyErrorMessage(result.data.error || "Akses Ditolak"), "error");
        }
      }
    } catch (err) {
      addToast(getFriendlyErrorMessage(err.message || "Network Error"), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!username || !email || !password) {
      addToast("Semua kolom wajib diisi", "error");
      return;
    }
    setLoading(true);
    try {
      const payload = { username, email, password, phone, telegram_chat_id: telegramChatId, otp_method: otpMethod };
      const result = await apiPost(`${API_BASE}?action=auth_register`, payload);
      if (result.ok) {
        addToast(result.data.message || "Registrasi berhasil. Cek kode OTP.", "success");
        setView('register_otp');
      } else {
        addToast(getFriendlyErrorMessage(result.data.error || "Registrasi gagal"), "error");
      }
    } catch (err) {
      addToast(getFriendlyErrorMessage(err.message || "Network Error"), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyRegisterOtp = async () => {
    if (!otp) {
      addToast("Kode OTP wajib diisi", "error");
      return;
    }
    setLoading(true);
    try {
      const result = await apiPost(`${API_BASE}?action=auth_verify_otp`, { email, otp });
      if (result.ok) {
        addToast("Verifikasi berhasil! Silakan login.", "success");
        setView('login');
        setOtp('');
        setPassword('');
      } else {
        addToast(result.data.error || "Verifikasi gagal", "error");
      }
    } catch (err) {
      addToast("Gagal menghubungi server", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotRequest = async () => {
    if (!forgotIdentity) {
      addToast("Username atau Email wajib diisi", "error");
      return;
    }
    setLoading(true);
    try {
      const result = await apiPost(`${API_BASE}?action=auth_request_reset`, { 
        identity: forgotIdentity, 
        method: forgotMethod 
      });
      if (result.ok) {
        addToast(result.data.message, "success");
        setView('forgot_reset');
        setOtp(''); // Clear OTP input
      } else {
        addToast(result.data.error || "Permintaan gagal", "error");
      }
    } catch (err) {
      addToast("Gagal menghubungi server", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotReset = async () => {
    if (!otp || !newPassword) {
      addToast("OTP dan Password baru wajib diisi", "error");
      return;
    }
    setLoading(true);
    try {
      const result = await apiPost(`${API_BASE}?action=auth_reset_password`, { 
        identity: forgotIdentity, 
        otp, 
        new_password: newPassword 
      });
      if (result.ok) {
        addToast("Password berhasil diubah. Silakan login.", "success");
        setView('login');
        setPassword('');
        setOtp('');
        setNewPassword('');
      } else {
        addToast(getFriendlyErrorMessage(result.data.error || "Reset password gagal"), "error");
      }
    } catch (err) {
      addToast(getFriendlyErrorMessage(err.message || "Network Error"), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (view === 'login') handleLogin();
    else if (view === 'register') handleRegister();
    else if (view === 'register_otp') handleVerifyRegisterOtp();
    else if (view === 'forgot_request') handleForgotRequest();
    else if (view === 'forgot_reset') handleForgotReset();
  };

  const renderLogo = () => (
    <div className="text-center mb-8 relative">
      <div className="inline-flex items-center justify-center w-24 h-24 mb-4">
          <img src="/assets/logo-insyarah.png" alt="InsyaRah Logo" className="w-full h-full object-contain drop-shadow-lg" onError={(e) => {
              e.target.onerror = null;
              e.target.style.display = 'none';
              e.target.parentElement.innerHTML = '<span class="text-5xl">🛡️</span>';
          }} />
      </div>
      <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-1">
        {view === 'login' && 'Selamat Datang'}
        {view === 'register' && 'Buat Akun'}
        {view === 'register_otp' && 'Verifikasi OTP'}
        {view === 'forgot_request' && 'Lupa Password'}
        {view === 'forgot_reset' && 'Reset Password'}
      </h1>
      <p className="text-slate-500 dark:text-slate-400 text-sm">
        {view === 'login' && 'Masuk ke InsyaRah'}
        {view === 'register' && 'Mulai perjalanan produktivitas Anda'}
        {view === 'register_otp' && `Kode dikirim ke ${otpMethod === 'email' ? email : (otpMethod === 'whatsapp' ? phone : telegramChatId)}`}
        {view === 'forgot_request' && 'Masukkan detail akun Anda untuk reset'}
        {view === 'forgot_reset' && 'Buat password baru Anda'}
      </p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-4 relative overflow-hidden transition-colors duration-500">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-teal-50/50 via-white to-emerald-50/50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900"></div>
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-teal-200/20 dark:bg-teal-500/10 rounded-full blur-[100px]"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-emerald-200/20 dark:bg-emerald-600/10 rounded-full blur-[100px]"></div>

      <div className="w-full max-w-md bg-white dark:bg-slate-800/80 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-slate-700 p-8 animate-in fade-in zoom-in duration-700 z-10 relative shadow-xl">
        
        {renderLogo()}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* LOGIN VIEW */}
          {view === 'login' && (
            <div className="animate-in fade-in slide-in-from-right-8 duration-300">
              <div className="space-y-4">
                <div className="group relative">
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1 ml-1">ID Pengguna</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 pl-4"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Username atau Email"
                      disabled={loading}
                      autoFocus
                    />
                </div>
                <div className="group relative">
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1 ml-1">Kata Sandi</label>
                    <div className="relative">
                        <input 
                        type="password" 
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all text-slate-800 dark:text-teal-100 placeholder-slate-400 dark:placeholder-slate-600 pl-10"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        disabled={loading}
                        />
                        <span className="absolute left-3 top-3.5 text-slate-400 dark:text-teal-500/50 text-xs">🔒</span>
                    </div>
                </div>
                <div className="flex justify-end">
                    <button type="button" onClick={() => setView('forgot_request')} className="text-xs text-teal-600 hover:text-teal-500 hover:underline">
                        Lupa Password?
                    </button>
                </div>
              </div>
            </div>
          )}

          {/* REGISTER VIEW */}
          {view === 'register' && (
            <div className="animate-in fade-in slide-in-from-right-8 duration-300 space-y-4">
                <div className="group relative">
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1 ml-1">ID Pengguna</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 pl-4"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Buat Username"
                      disabled={loading}
                    />
                </div>
                <div className="group relative">
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1 ml-1">Email</label>
                    <input 
                      type="email" 
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 pl-4"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nama@email.com"
                      disabled={loading}
                    />
                </div>
                <div className="group relative">
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1 ml-1">Kata Sandi</label>
                    <input 
                      type="password" 
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 pl-4"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      disabled={loading}
                    />
                </div>
                
                {/* OTP Method Selector */}
                <div className="group relative mt-4">
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1 ml-1">Metode Verifikasi</label>
                    <div className="flex gap-2">
                        {['email', 'whatsapp', 'telegram'].map(m => (
                            <button
                                key={m}
                                type="button"
                                onClick={() => setOtpMethod(m)}
                                className={`flex-1 py-2 rounded-lg text-xs font-medium border capitalize ${otpMethod === m ? 'bg-teal-50 border-teal-500 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                </div>

                {otpMethod === 'whatsapp' && (
                    <div className="group relative mt-2">
                        <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1 ml-1">Nomor WhatsApp</label>
                        <input 
                        type="text" 
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 pl-4"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Contoh: 08123456789"
                        disabled={loading}
                        />
                    </div>
                )}

                {otpMethod === 'telegram' && (
                    <div className="group relative mt-2">
                        <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1 ml-1">ID Telegram</label>
                        <div className="flex gap-2">
                            <input 
                            type="text" 
                            className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 pl-4"
                            value={telegramChatId}
                            onChange={(e) => setTelegramChatId(e.target.value)}
                            placeholder="ID Chat"
                            disabled={loading}
                            />
                            <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-sm border border-slate-200 dark:border-slate-700 flex items-center">🔍</a>
                        </div>
                    </div>
                )}
            </div>
          )}

          {/* REGISTER OTP VIEW */}
          {view === 'register_otp' && (
             <div className="animate-in fade-in slide-in-from-right-8 duration-300">
                <div className="group relative">
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1 ml-1">Kode OTP</label>
                    <input 
                    type="text" 
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 pl-4 text-center tracking-widest text-lg font-mono"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="123456"
                    disabled={loading}
                    autoFocus
                    maxLength={6}
                    />
                    <p className="text-xs text-center mt-2 text-slate-500">Cek kotak masuk {otpMethod} Anda.</p>
                </div>
             </div>
          )}

          {/* FORGOT REQUEST VIEW */}
          {view === 'forgot_request' && (
            <div className="animate-in fade-in slide-in-from-right-8 duration-300 space-y-4">
                <div className="group relative">
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1 ml-1">Username atau Email</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 pl-4"
                      value={forgotIdentity}
                      onChange={(e) => setForgotIdentity(e.target.value)}
                      placeholder="Masukkan ID Akun"
                      disabled={loading}
                      autoFocus
                    />
                </div>
                <div className="group relative mt-4">
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1 ml-1">Kirim OTP via</label>
                    <div className="flex gap-2">
                        {['email', 'whatsapp', 'telegram'].map(m => (
                            <button
                                key={m}
                                type="button"
                                onClick={() => setForgotMethod(m)}
                                className={`flex-1 py-2 rounded-lg text-xs font-medium border capitalize ${forgotMethod === m ? 'bg-teal-50 border-teal-500 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                    <p className="text-xs text-slate-400 mt-2 ml-1">*Pastikan kontak sudah terdaftar di profil Anda.</p>
                </div>
            </div>
          )}

          {/* FORGOT RESET VIEW */}
          {view === 'forgot_reset' && (
            <div className="animate-in fade-in slide-in-from-right-8 duration-300 space-y-4">
                 <div className="group relative">
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1 ml-1">Kode OTP</label>
                    <input 
                    type="text" 
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 pl-4 text-center tracking-widest text-lg font-mono"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="123456"
                    disabled={loading}
                    maxLength={6}
                    />
                </div>
                <div className="group relative">
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1 ml-1">Password Baru</label>
                    <input 
                      type="password" 
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 pl-4"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimal 6 karakter"
                      disabled={loading}
                    />
                </div>
            </div>
          )}

          {/* ACTION BUTTON */}
          <div className="pt-4">
            <button 
              type="submit" 
              className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 dark:bg-teal-600 dark:hover:bg-teal-500 text-white rounded-lg transition-all shadow-lg shadow-teal-500/20 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm flex items-center justify-center gap-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span>
                  Memproses...
                </>
              ) : (
                <>
                    {view === 'login' && 'Masuk'}
                    {view === 'register' && 'Daftar Sekarang'}
                    {view === 'register_otp' && 'Verifikasi OTP'}
                    {view === 'forgot_request' && 'Kirim Kode OTP'}
                    {view === 'forgot_reset' && 'Ubah Password'}
                </>
              )}
            </button>
          </div>
          
          {/* NAVIGATION LINKS */}
          <div className="text-center pt-6 border-t border-slate-100 dark:border-slate-800">
            {view === 'login' && (
                <button type="button" className="text-sm text-slate-500 hover:text-teal-600 transition-colors" onClick={() => setView('register')}>
                    Belum punya akun? <span className="underline">Daftar</span>
                </button>
            )}
            {(view === 'register' || view === 'forgot_request') && (
                <button type="button" className="text-sm text-slate-500 hover:text-teal-600 transition-colors" onClick={() => setView('login')}>
                    Sudah punya akun? <span className="underline">Login</span>
                </button>
            )}
            {(view === 'register_otp') && (
                <button type="button" className="text-sm text-slate-500 hover:text-teal-600 transition-colors" onClick={() => setView('register')}>
                    Salah email/nomor? <span className="underline">Daftar Ulang</span>
                </button>
            )}
             {(view === 'forgot_reset') && (
                <button type="button" className="text-sm text-slate-500 hover:text-teal-600 transition-colors" onClick={() => setView('forgot_request')}>
                    Tidak terima kode? <span className="underline">Kirim Ulang</span>
                </button>
            )}
          </div>
        </form>
      </div>
      
      <div className="mt-8 text-center">
        <p className="text-xs text-slate-400 dark:text-slate-600">InsyaRah v2.1 • Productivity for Peace</p>
      </div>
    </div>
  );
}