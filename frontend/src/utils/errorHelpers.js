/**
 * Menerjemahkan pesan error teknis menjadi bahasa yang lebih manusiawi dan menenangkan.
 * Sesuai prinsip "Calm & Light" InsyaRah.
 * 
 * @param {string} technicalError - Pesan error asli dari backend/system
 * @returns {string} - Pesan yang lebih ramah
 */
export const getFriendlyErrorMessage = (technicalError) => {
    if (!technicalError) return "Terjadi kesalahan yang tidak terduga.";

    const error = technicalError.toLowerCase();

    // Login & Auth
    if (error.includes('invalid password') || error.includes('password incorrect')) {
        return "Kata sandi tidak cocok. Coba ingat-ingat lagi ya.";
    }
    if (error.includes('user not found') || error.includes('account not found')) {
        return "Akun tidak ditemukan. Pastikan username/email benar.";
    }
    if (error.includes('unverified')) {
        return "Akun belum diverifikasi. Cek kode OTP di email/WA Anda.";
    }
    if (error.includes('access denied') || error.includes('unauthorized')) {
        return "Maaf, Anda tidak memiliki akses ke area ini.";
    }

    // Registration
    if (error.includes('duplicate') || error.includes('already exists')) {
        if (error.includes('email')) return "Email ini sudah terdaftar. Coba login saja?";
        if (error.includes('username')) return "Username ini sudah dipakai orang lain. Pilih yang lain ya.";
        return "Data ini sepertinya sudah ada dalam sistem.";
    }
    if (error.includes('weak password')) {
        return "Kata sandi terlalu mudah ditebak. Gunakan kombinasi huruf dan angka.";
    }

    // Network & Server
    if (error.includes('network error') || error.includes('failed to fetch')) {
        return "Koneksi terputus. Coba periksa internet Anda.";
    }
    if (error.includes('database error') || error.includes('sql')) {
        return "Sedang ada gangguan di sistem. Coba beberapa saat lagi.";
    }
    if (error.includes('timeout')) {
        return "Server butuh waktu lama merespon. Coba refresh halaman.";
    }

    // Validation
    if (error.includes('required') || error.includes('empty')) {
        return "Ada kolom yang belum diisi. Mohon lengkapi dulu ya.";
    }
    if (error.includes('invalid email')) {
        return "Format email sepertinya kurang tepat.";
    }
    if (error.includes('invalid phone')) {
        return "Nomor telepon tidak valid. Gunakan format angka.";
    }

    // Default fallback (jika error tidak dikenali, tapi coba diperhalus)
    return `Ada sedikit kendala: ${technicalError}`;
};
