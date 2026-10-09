<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/core/Utils.php';
require_once dirname(__DIR__) . '/core/AppHelper.php';
require_once dirname(__DIR__) . '/core/AuditLogger.php';

require_once dirname(__DIR__) . '/core/Mailer.php';
require_once dirname(__DIR__) . '/core/WhatsAppNotifier.php';
require_once dirname(__DIR__) . '/core/TelegramNotifier.php';

use Core\Mailer;

class AuthController
{
    private PDO $pdo;
    private ?Mailer $mailer;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
        $this->mailer = new Mailer(); // Initialize Mailer
    }

    public function login(): void
    {
        $body = Utils::readJsonBody();
        
        // Debug Log
        // Never log authentication credentials.

        if (!isset($body['username']) || !isset($body['password'])) {
            Utils::sendError('Username dan password wajib diisi', '', 400);
            return;
        }

        $username = trim($body['username']);
        $password = $body['password'];

        $stmt = $this->pdo->prepare('SELECT * FROM users WHERE username = :username OR email = :username'); // Allow login by email
        $stmt->execute([':username' => $username]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user) {
            error_log("Login Failed: User not found - " . $username);
            AuditLogger::log('LOGIN_FAILED', 'user', null, ['username' => $username, 'reason' => 'User not found'], null);
            Utils::sendError('Username atau password salah', '', 401);
            return;
        }

        if (!password_verify($password, $user['password_hash'])) {
            error_log("Login Failed: Password mismatch - " . $username);
            AuditLogger::log('LOGIN_FAILED', 'user', null, ['username' => $username, 'reason' => 'Invalid credentials'], null);
            Utils::sendError('Username atau password salah', '', 401);
            return;
        }

        if (isset($user['is_verified']) && $user['is_verified'] == 0 && ($user['role'] ?? 'member') !== 'admin') {
             error_log("Login Failed: Unverified - " . $username);
             Utils::sendError('Akun belum diverifikasi. Silakan cek email Anda untuk kode OTP.', 'unverified_account', 403, ['user_id' => $user['id']]);
             return;
        }

        $_SESSION['user_id'] = $user['id'];
        $_SESSION['username'] = $user['username'];
        $_SESSION['role'] = $user['role'];
        $_SESSION['business_unit'] = $user['business_unit'] ?? null;
        $_SESSION['assigned_units'] = $user['assigned_units'] ? json_decode($user['assigned_units'], true) : [];

        AuditLogger::log('LOGIN_SUCCESS', 'user', $user['id'], null, $user['id']);

        Utils::sendSuccess([
            'result' => 'login_success',
            'message' => 'Login berhasil',
            'user' => [
                'id' => $user['id'],
                'username' => $user['username'],
                'role' => $user['role'],
                'business_unit' => $user['business_unit'] ?? null,
                'assigned_units' => $user['assigned_units'] ? json_decode($user['assigned_units'], true) : []
            ]
        ]);
    }

    public function register(): void
    {
        // Check settings
        $settings = AppHelper::getSystemSettings($this->pdo);
        if (isset($settings['registration_enabled']) && !$settings['registration_enabled']) {
            Utils::sendError('Pendaftaran pengguna baru dinonaktifkan oleh administrator.', '', 403);
            return;
        }

        $body = Utils::readJsonBody();
        if (!isset($body['username']) || !isset($body['password']) || !isset($body['email'])) {
            Utils::sendError('Username, email, dan password wajib diisi', '', 400);
            return;
        }

        $username = trim($body['username']);
        $email = trim($body['email']);
        $password = $body['password'];
        
        $phone = isset($body['phone']) ? trim($body['phone']) : null;
        $telegramChatId = isset($body['telegram_chat_id']) ? trim($body['telegram_chat_id']) : null;
        $otpMethod = isset($body['otp_method']) ? $body['otp_method'] : 'email';

        if (strlen($username) < 3) {
            Utils::sendError('Username minimal 3 karakter', '', 400);
            return;
        }
        if (strlen($password) < 6) {
            Utils::sendError('Password minimal 6 karakter', '', 400);
            return;
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Utils::sendError('Format email tidak valid', '', 400);
            return;
        }
        
        if ($otpMethod === 'whatsapp' && empty($phone)) {
            Utils::sendError('Nomor WhatsApp wajib diisi untuk metode OTP WhatsApp', '', 400);
            return;
        }
        if ($otpMethod === 'telegram' && empty($telegramChatId)) {
            Utils::sendError('ID Telegram wajib diisi untuk metode OTP Telegram', '', 400);
            return;
        }
        if ($otpMethod === 'whatsapp' && empty($settings['whatsapp_enabled'])) {
            Utils::sendError('OTP WhatsApp dinonaktifkan. Gunakan Email.', '', 400);
            return;
        }
        if ($otpMethod === 'telegram' && empty($settings['telegram_enabled'])) {
            Utils::sendError('OTP Telegram dinonaktifkan. Gunakan Email.', '', 400);
            return;
        }

        // Check if user exists (username or email)
        $stmt = $this->pdo->prepare('SELECT id FROM users WHERE username = :username OR email = :email');
        $stmt->execute([':username' => $username, ':email' => $email]);
        if ($stmt->fetch()) {
            Utils::sendError('Username atau email sudah digunakan', '', 400);
            return;
        }

        $hash = password_hash($password, PASSWORD_DEFAULT);
        $createdAt = Utils::now();
        
        // Generate OTP
        $otp = (string) rand(100000, 999999);
        $otpExpiry = date('Y-m-d H:i:s', strtotime('+15 minutes'));

        try {
            $insert = $this->pdo->prepare('INSERT INTO users (username, email, password_hash, role, created_at, otp_code, otp_expiry, is_verified, phone, telegram_chat_id) VALUES (:username, :email, :password_hash, :role, :created_at, :otp_code, :otp_expiry, 0, :phone, :telegram_chat_id)');
            $insert->execute([
                ':username' => $username,
                ':email' => $email,
                ':password_hash' => $hash,
                ':role' => 'member', // Default role
                ':created_at' => $createdAt,
                ':otp_code' => $otp,
                ':otp_expiry' => $otpExpiry,
                ':phone' => $phone,
                ':telegram_chat_id' => $telegramChatId
            ]);

            $newUserId = $this->pdo->lastInsertId();
            AuditLogger::log('REGISTER', 'user', $newUserId, ['username' => $username, 'email' => $email], $newUserId);

            // Send OTP
            $sentVia = 'email';
            if ($otpMethod === 'whatsapp') {
                $wa = new WhatsAppNotifier();
                $wa->sendMessage("Halo $username,\n\nKode verifikasi OTP InsyaRah Anda: *$otp*\n\nBerlaku 15 menit.", $phone);
                $sentVia = 'WhatsApp';
            } elseif ($otpMethod === 'telegram') {
                $tg = new TelegramNotifier();
                $tg->sendMessage("<b>Kode Verifikasi InsyaRah</b>\n\nHalo $username,\nKode OTP Anda: <code>$otp</code>\n\nBerlaku 15 menit.", $telegramChatId);
                $sentVia = 'Telegram';
            } else {
                // Email (Default)
                if ($this->mailer) {
                    $subject = "Kode Verifikasi Pendaftaran InsyaRah";
                    $message = "Halo $username,\n\nTerima kasih telah mendaftar di InsyaRah.\nKode verifikasi OTP Anda adalah: <b>$otp</b>\n\nKode ini berlaku selama 15 menit.\n\nSalam,\nTim InsyaRah";
                    try {
                        $this->mailer->send($email, $subject, nl2br($message));
                    } catch (Throwable $mailError) {
                        error_log("Failed to send registration email: " . $mailError->getMessage());
                    }
                }
            }

            Utils::sendSuccess([
                'result' => 'register_success', 
                'message' => "Registrasi berhasil. Silakan cek $sentVia untuk kode OTP.",
                'email' => $email,
                'user_id' => $newUserId
            ]);
        } catch (Throwable $e) {
            error_log("Register Error: " . $e->getMessage() . "\n" . $e->getTraceAsString());
            Utils::sendError('Gagal mendaftar user: ' . $e->getMessage(), '', 500);
        }
    }

    public function verifyOtp(): void
    {
        $body = Utils::readJsonBody();
        if (!isset($body['email']) || !isset($body['otp'])) {
            Utils::sendError('Email dan OTP wajib diisi', '', 400);
            return;
        }

        $email = trim($body['email']);
        $otp = trim($body['otp']);

        $stmt = $this->pdo->prepare('SELECT * FROM users WHERE email = :email');
        $stmt->execute([':email' => $email]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user) {
            Utils::sendError('User tidak ditemukan', '', 404);
            return;
        }

        if ($user['is_verified'] == 1) {
            Utils::sendSuccess(['message' => 'Akun sudah diverifikasi sebelumnya. Silakan login.']);
            return;
        }

        if ($user['otp_code'] !== $otp) {
            Utils::sendError('Kode OTP salah', '', 400);
            return;
        }

        if (strtotime($user['otp_expiry']) < time()) {
            Utils::sendError('Kode OTP sudah kadaluarsa. Silakan request ulang (Login untuk trigger ulang).', '', 400);
            return;
        }

        // Mark verified
        $update = $this->pdo->prepare('UPDATE users SET is_verified = 1, otp_code = NULL, otp_expiry = NULL WHERE id = :id');
        $update->execute([':id' => $user['id']]);
        
        AuditLogger::log('VERIFY_OTP', 'user', $user['id']);

        Utils::sendSuccess(['message' => 'Verifikasi berhasil. Silakan login.']);
    }

    public function logout(): void
    {
        if (isset($_SESSION['user_id'])) {
            AuditLogger::log('LOGOUT', 'user', $_SESSION['user_id']);
        }
        session_destroy();
        Utils::sendSuccess(['result' => 'logout_success', 'message' => 'Logout berhasil']);
    }

    public function me(): void
    {
        if (!isset($_SESSION['user_id'])) {
            Utils::sendSuccess(['user' => null]);
            return;
        }

        $stmt = $this->pdo->prepare('SELECT full_name, phone, telegram_chat_id FROM users WHERE id = :id');
        $stmt->execute([':id' => $_SESSION['user_id']]);
        $userData = $stmt->fetch(PDO::FETCH_ASSOC);

        Utils::sendSuccess([
            'user' => [
                'id' => $_SESSION['user_id'],
                'username' => $_SESSION['username'],
                'role' => $_SESSION['role'],
                'business_unit' => $_SESSION['business_unit'] ?? null,
                'assigned_units' => $_SESSION['assigned_units'] ?? [],
                'full_name' => $userData['full_name'] ?? null,
                'phone' => $userData['phone'] ?? null,
                'telegram_chat_id' => $userData['telegram_chat_id'] ?? null,
            ]
        ]);
    }

    public function updateProfile(): void
    {
        if (!isset($_SESSION['user_id'])) {
            Utils::sendError('Tidak terautentikasi', '', 401);
            return;
        }

        $body = Utils::readJsonBody();
        $updates = [];
        $params = [':id' => $_SESSION['user_id']];

        // Allow updating business_unit
        if (array_key_exists('business_unit', $body)) {
             $bu = strip_tags(trim((string)$body['business_unit']));
             $bu = $bu === '' ? null : $bu;
             $updates[] = 'business_unit = :bu';
             $params[':bu'] = $bu;
             $_SESSION['business_unit'] = $bu;
        }

        // Allow updating full_name
        if (isset($body['full_name'])) {
            $fullName = strip_tags(trim((string)$body['full_name']));
            $updates[] = 'full_name = :fn';
            $params[':fn'] = $fullName;
        }

        // Allow updating phone (WhatsApp)
        if (isset($body['phone'])) {
            $phone = strip_tags(trim((string)$body['phone']));
            $updates[] = 'phone = :phone';
            $params[':phone'] = $phone;
        }

        // Allow updating telegram_chat_id
        if (isset($body['telegram_chat_id'])) {
            $tgId = strip_tags(trim((string)$body['telegram_chat_id']));
            $updates[] = 'telegram_chat_id = :tg';
            $params[':tg'] = $tgId;
        }

        // Allow updating password
        if (isset($body['password']) && !empty($body['password'])) {
            $newPass = (string)$body['password'];
            if (strlen($newPass) < 6) {
                Utils::sendError('Password minimal 6 karakter', '', 400);
                return;
            }
            $hash = password_hash($newPass, PASSWORD_DEFAULT);
            $updates[] = 'password_hash = :hash';
            $params[':hash'] = $hash;
            AuditLogger::log('UPDATE_PASSWORD', 'user', $_SESSION['user_id']);
        }

        if (empty($updates)) {
            Utils::sendSuccess(['result' => 'nothing_changed', 'message' => 'Tidak ada perubahan']);
            return;
        }

        $sql = 'UPDATE users SET ' . implode(', ', $updates) . ' WHERE id = :id';
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);

        Utils::sendSuccess(['result' => 'updated', 'message' => 'Profil diperbarui']);
    }

    public function requestPasswordReset(): void
    {
        $body = Utils::readJsonBody();
        if (!isset($body['identity'])) {
            Utils::sendError('Username atau Email wajib diisi', '', 400);
            return;
        }

        $identity = trim($body['identity']);
        $method = isset($body['method']) ? $body['method'] : 'email'; // email, whatsapp, telegram
        $settings = AppHelper::getSystemSettings($this->pdo);

        // Find user
        $stmt = $this->pdo->prepare('SELECT * FROM users WHERE username = :id OR email = :id');
        $stmt->execute([':id' => $identity]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user) {
            // Security: Don't reveal if user exists. Pretend success.
            // But for better UX in this internal app, maybe reveal? 
            // Let's reveal for now as it helps debugging and it's an internal tool mostly.
            Utils::sendError('User tidak ditemukan', '', 404);
            return;
        }

        // Validate contact info for selected method
        if ($method === 'whatsapp' && empty($user['phone'])) {
            Utils::sendError('Nomor WhatsApp tidak terdaftar untuk akun ini. Gunakan Email.', '', 400);
            return;
        }
        if ($method === 'telegram' && empty($user['telegram_chat_id'])) {
            Utils::sendError('ID Telegram tidak terdaftar untuk akun ini. Gunakan Email.', '', 400);
            return;
        }
        if ($method === 'whatsapp' && empty($settings['whatsapp_enabled'])) {
            Utils::sendError('Reset via WhatsApp dinonaktifkan. Gunakan Email.', '', 400);
            return;
        }
        if ($method === 'telegram' && empty($settings['telegram_enabled'])) {
            Utils::sendError('Reset via Telegram dinonaktifkan. Gunakan Email.', '', 400);
            return;
        }

        // Generate OTP
        $otp = (string) rand(100000, 999999);
        $otpExpiry = date('Y-m-d H:i:s', strtotime('+15 minutes'));

        // Save OTP
        $update = $this->pdo->prepare('UPDATE users SET otp_code = :otp, otp_expiry = :exp WHERE id = :id');
        $update->execute([':otp' => $otp, ':exp' => $otpExpiry, ':id' => $user['id']]);

        // Send OTP
        $sentVia = 'Email';
        try {
            if ($method === 'whatsapp') {
                $wa = new WhatsAppNotifier();
                $wa->sendMessage("Reset Password InsyaRah\n\nHalo {$user['username']},\nKode OTP Reset Password: *$otp*\n\nJangan berikan kode ini ke siapapun.", $user['phone']);
                $sentVia = 'WhatsApp';
            } elseif ($method === 'telegram') {
                $tg = new TelegramNotifier();
                $tg->sendMessage("<b>Reset Password InsyaRah</b>\n\nHalo {$user['username']},\nKode OTP Reset Password: <code>$otp</code>\n\nJangan berikan kode ini ke siapapun.", $user['telegram_chat_id']);
                $sentVia = 'Telegram';
            } else {
                // Email
                if ($this->mailer) {
                    $subject = "Kode OTP Reset Password InsyaRah";
                    $message = "Halo {$user['username']},\n\nKami menerima permintaan reset password untuk akun Anda.\nKode OTP Anda: <b>$otp</b>\n\nKode ini berlaku 15 menit. Jika ini bukan Anda, abaikan email ini.\n\nSalam,\nTim InsyaRah";
                    $this->mailer->send($user['email'], $subject, nl2br($message));
                }
            }
        } catch (Throwable $e) {
            error_log("Failed to send reset OTP: " . $e->getMessage());
            Utils::sendError("Gagal mengirim kode OTP ke $sentVia. Coba metode lain.", '', 500);
            return;
        }

        AuditLogger::log('REQUEST_RESET', 'user', $user['id']);

        Utils::sendSuccess([
            'message' => "Kode OTP telah dikirim ke $sentVia Anda.",
            'method' => $method,
            'email_masked' => $this->maskEmail($user['email']) // Helper to show masked email
        ]);
    }

    public function resetPasswordWithOtp(): void
    {
        $body = Utils::readJsonBody();
        if (!isset($body['identity']) || !isset($body['otp']) || !isset($body['new_password'])) {
            Utils::sendError('Data tidak lengkap', '', 400);
            return;
        }

        $identity = trim($body['identity']);
        $otp = trim($body['otp']);
        $newPass = $body['new_password'];

        if (strlen($newPass) < 6) {
            Utils::sendError('Password minimal 6 karakter', '', 400);
            return;
        }

        $stmt = $this->pdo->prepare('SELECT * FROM users WHERE username = :id OR email = :id');
        $stmt->execute([':id' => $identity]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user) {
            Utils::sendError('User tidak ditemukan', '', 404);
            return;
        }

        if ($user['otp_code'] !== $otp) {
            Utils::sendError('Kode OTP salah', '', 400);
            return;
        }

        if (strtotime($user['otp_expiry']) < time()) {
            Utils::sendError('Kode OTP sudah kadaluarsa', '', 400);
            return;
        }

        // Update Password & Clear OTP
        $hash = password_hash($newPass, PASSWORD_DEFAULT);
        $update = $this->pdo->prepare('UPDATE users SET password_hash = :hash, otp_code = NULL, otp_expiry = NULL WHERE id = :id');
        $update->execute([':hash' => $hash, ':id' => $user['id']]);

        AuditLogger::log('RESET_PASSWORD_SUCCESS', 'user', $user['id']);

        Utils::sendSuccess(['message' => 'Password berhasil diubah. Silakan login dengan password baru.']);
    }

    private function maskEmail($email) {
        if (empty($email)) return 'unknown';
        $parts = explode('@', $email);
        if (count($parts) != 2) return $email;
        $name = $parts[0];
        $domain = $parts[1];
        $len = strlen($name);
        if ($len <= 2) return $email;
        $masked = substr($name, 0, 1) . str_repeat('*', $len - 2) . substr($name, -1);
        return $masked . '@' . $domain;
    }
}
