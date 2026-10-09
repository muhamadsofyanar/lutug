<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/core/Utils.php';
require_once dirname(__DIR__) . '/core/BackupManager.php';
require_once dirname(__DIR__) . '/core/Mailer.php';
require_once dirname(__DIR__) . '/core/WhatsAppNotifier.php';
require_once dirname(__DIR__) . '/core/TelegramNotifier.php';

class AdminController
{
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    public function getSettings(): void
    {
        $role = $_SESSION['role'] ?? 'member';
        if ($role !== 'admin') {
            Utils::sendError('Akses ditolak', '', 403);
            return;
        }
        $settings = AppHelper::getSystemSettings($this->pdo);
        Utils::sendSuccess(['settings' => $settings]);
    }

    public function updateSettings(): void
    {
        $role = $_SESSION['role'] ?? 'member';
        if ($role !== 'admin') {
            Utils::sendError('Akses ditolak', '', 403);
            return;
        }
        $body = Utils::readJsonBody();
        $boolKeys = [
            'registration_enabled',
            'gamification_enabled',
            'oracle_enabled',
            'weekly_insights_enabled',
            'knowledge_graph_enabled',
            'whatsapp_enabled',
            'telegram_enabled'
        ];
        foreach ($boolKeys as $key) {
            if (array_key_exists($key, $body)) {
                AppHelper::updateSystemSetting($this->pdo, $key, (bool)$body[$key]);
            }
        }
        
        Utils::sendSuccess(['message' => 'Pengaturan berhasil diperbarui', 'settings' => AppHelper::getSystemSettings($this->pdo)]);
    }

    public function getAuditLogs(): void
    {
        $role = $_SESSION['role'] ?? 'member';
        if ($role !== 'admin') {
            Utils::sendError('Akses ditolak. Hanya admin.', '', 403);
            return;
        }

        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 100;
        $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
        
        // Filters
        $user_id = isset($_GET['user_id']) && $_GET['user_id'] !== '' ? (int)$_GET['user_id'] : null;
        $action = isset($_GET['filter_action']) && $_GET['filter_action'] !== '' ? $_GET['filter_action'] : null;
        $date_from = isset($_GET['date_from']) && $_GET['date_from'] !== '' ? $_GET['date_from'] : null;
        $date_to = isset($_GET['date_to']) && $_GET['date_to'] !== '' ? $_GET['date_to'] : null;

        $where = ["1=1"];
        $params = [];

        if ($user_id) {
            $where[] = "al.user_id = :user_id";
            $params[':user_id'] = $user_id;
        }
        if ($action) {
            $where[] = "al.action LIKE :action";
            $params[':action'] = "%$action%";
        }
        if ($date_from) {
            $where[] = "al.created_at >= :date_from";
            $params[':date_from'] = $date_from . " 00:00:00";
        }
        if ($date_to) {
            $where[] = "al.created_at <= :date_to";
            $params[':date_to'] = $date_to . " 23:59:59";
        }

        $whereSql = implode(' AND ', $where);

        $sql = "SELECT al.*, u.username 
                FROM audit_logs al 
                LEFT JOIN users u ON al.user_id = u.id 
                WHERE $whereSql
                ORDER BY al.created_at DESC 
                LIMIT :limit OFFSET :offset";
                
        $stmt = $this->pdo->prepare($sql);
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        
        foreach ($params as $key => $val) {
            $stmt->bindValue($key, $val);
        }
        
        $stmt->execute();
        
        $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Decode details
        foreach ($logs as &$log) {
            if ($log['details']) {
                $log['details'] = json_decode($log['details'], true);
            }
        }
        
        // Count total with filters
        $countSql = "SELECT COUNT(*) FROM audit_logs al WHERE $whereSql";
        $countStmt = $this->pdo->prepare($countSql);
        foreach ($params as $key => $val) {
            $countStmt->bindValue($key, $val);
        }
        $countStmt->execute();
        $total = $countStmt->fetchColumn();

        Utils::sendSuccess(['logs' => $logs, 'total' => $total]);
    }

    public function listUsers(): void
    {
        $role = $_SESSION['role'] ?? 'member';
        if ($role !== 'admin') {
            Utils::sendError('Akses ditolak', '', 403);
            return;
        }

        $stmt = $this->pdo->query("SELECT id, username, full_name, email, phone, telegram_chat_id, role, job_title, business_unit, assigned_units, created_at FROM users ORDER BY username ASC");
        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Decode assigned_units for frontend
        foreach ($users as &$u) {
            $u['assigned_units'] = $u['assigned_units'] ? json_decode($u['assigned_units'], true) : [];
        }

        Utils::sendSuccess(['users' => $users]);
    }

    public function updateUser(): void
    {
        $role = $_SESSION['role'] ?? 'member';
        if ($role !== 'admin') {
            Utils::sendError('Akses ditolak', '', 403);
            return;
        }

        $body = Utils::readJsonBody();
        $id = $body['id'] ?? null;
        
        if (!$id) {
            Utils::sendError('ID Pengguna wajib diisi');
            return;
        }

        // Prepare fields
        $updates = [];
        $params = [':id' => $id];

        if (isset($body['role'])) {
            $updates[] = "role = :role";
            $params[':role'] = $body['role'];
        }

        if (isset($body['job_title'])) {
            $updates[] = "job_title = :job_title";
            $params[':job_title'] = $body['job_title'];
        }

        if (isset($body['assigned_units'])) {
            $updates[] = "assigned_units = :assigned_units";
            $params[':assigned_units'] = json_encode($body['assigned_units']);
        }
        
        // Reset password if requested
        if (!empty($body['new_password'])) {
            $updates[] = "password = :password";
            $params[':password'] = password_hash($body['new_password'], PASSWORD_DEFAULT);
        }

        if (empty($updates)) {
            Utils::sendSuccess(['message' => 'Tidak ada perubahan']);
            return;
        }

        $sql = "UPDATE users SET " . implode(', ', $updates) . " WHERE id = :id";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);

        AppHelper::logActivity($this->pdo, 'admin_update_user', 'user', (int)$id, 'Admin mengubah data user ID: ' . $id);
        Utils::sendSuccess(['message' => 'Pengguna berhasil diperbarui']);
    }

    public function deleteUser(): void
    {
        $role = $_SESSION['role'] ?? 'member';
        if ($role !== 'admin') {
            Utils::sendError('Akses ditolak', '', 403);
            return;
        }

        $body = Utils::readJsonBody();
        $id = $body['id'] ?? null;

        if (!$id) {
            Utils::sendError('ID Pengguna wajib diisi');
            return;
        }

        // Prevent self-deletion
        if ($id == $_SESSION['user_id']) {
            Utils::sendError('Tidak dapat menghapus diri sendiri');
            return;
        }

        $stmt = $this->pdo->prepare("DELETE FROM users WHERE id = :id");
        $stmt->execute([':id' => $id]);

        AppHelper::logActivity($this->pdo, 'admin_delete_user', 'user', (int)$id, 'Admin menghapus user ID: ' . $id);
        Utils::sendSuccess(['message' => 'Pengguna berhasil dihapus']);
    }

    public function downloadBackup(): void
    {
        $role = $_SESSION['role'] ?? 'member';
        if ($role !== 'admin') {
            http_response_code(403);
            die("Akses Ditolak");
        }

        $connection = env('DB_CONNECTION', 'sqlite');
        if ($connection !== 'sqlite') {
             // For JSON response, we can use Utils, but here we expect a file download or error
             // If this is called via AJAX for checking, we return JSON. 
             // If called via window.location, we output text.
             // Let's assume frontend handles error or we just output text.
             http_response_code(400);
             die("Unduhan backup hanya tersedia untuk SQLite. Untuk MySQL, gunakan phpMyAdmin.");
        }

        $dbPath = INSYARAH_DB_PATH;
        if (!file_exists($dbPath)) {
            http_response_code(404);
            die("File database tidak ditemukan.");
        }

        $filename = 'backup_insyarah_' . date('Y-m-d_H-i-s') . '.sqlite';

        // Log activity before download
        AppHelper::logActivity($this->pdo, 'admin_backup_download', 'system', 0, 'Admin mengunduh file database SQLite');

        // Clear any previous output
        if (ob_get_level()) ob_end_clean();

        header('Content-Description: File Transfer');
        header('Content-Type: application/octet-stream');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Expires: 0');
        header('Cache-Control: must-revalidate');
        header('Pragma: public');
        header('Content-Length: ' . filesize($dbPath));
        
        readfile($dbPath);
        exit;
    }

    public function resetPassword(): void
    {
        $role = $_SESSION['role'] ?? 'member';
        if ($role !== 'admin') {
            Utils::sendError('Akses ditolak. Hanya admin.', '', 403);
            return;
        }

        $body = Utils::readJsonBody();
        $id = Utils::validateInt($body, 'id');
        $newPass = trim((string)($body['password'] ?? ''));

        if (!$id || $newPass === '') {
            Utils::sendError('ID dan Password baru wajib diisi', '', 400);
            return;
        }

        if (strlen($newPass) < 6) {
            Utils::sendError('Password minimal 6 karakter', '', 400);
            return;
        }

        $hash = password_hash($newPass, PASSWORD_DEFAULT);
        $stmt = $this->pdo->prepare('UPDATE users SET password_hash = :hash WHERE id = :id');
        $stmt->execute([':hash' => $hash, ':id' => $id]);
        
        AppHelper::logActivity($this->pdo, 'admin_reset_password', 'user', $id, 'Admin mereset password user ID: ' . $id);
        
        Utils::sendSuccess(['result' => 'password_reset']);
    }

    public function resetAll(): void
    {
        $role = $_SESSION['role'] ?? 'member';
        if ($role !== 'admin') {
            Utils::sendError('Akses ditolak. Hanya admin yang bisa melakukan ini.', '', 403);
            return;
        }

        $this->pdo->beginTransaction();
        try {
            $this->pdo->exec('DELETE FROM task_comments');
            $this->pdo->exec('DELETE FROM tasks');
            $this->pdo->exec('DELETE FROM projects');
            $this->pdo->exec('DELETE FROM project_steps');
            $this->pdo->exec('DELETE FROM inbox_items');
            $this->pdo->exec('DELETE FROM reference_items');
            $this->pdo->exec('DELETE FROM decision_logs');
            $this->pdo->exec('DELETE FROM people');
            $this->pdo->exec('DELETE FROM business_units'); // Note: Users and audit_logs are preserved
            
            AppHelper::logActivity($this->pdo, 'admin_system_reset', 'system', 0, 'Admin melakukan RESET TOTAL data sistem');
            
            $this->pdo->commit();
            Utils::sendSuccess(['result' => 'reset_done', 'message' => 'Sistem berhasil direset total']);
        } catch (Throwable $e) {
            $this->pdo->rollBack();
            Utils::sendError('Gagal mereset data: ' . $e->getMessage(), '', 500);
        }
    }

    public function exportAll(): void
    {
        $role = $_SESSION['role'] ?? 'member';
        if ($role !== 'admin') {
            Utils::sendError('Akses ditolak. Hanya admin yang bisa melakukan ini.', '', 403);
            return;
        }

        try {
            $manager = new BackupManager($this->pdo);
            $result = $manager->createBackup(false);
            $data = $result['data'];
            
            AppHelper::logActivity($this->pdo, 'admin_export_json', 'system', 0, 'Admin mengekspor data (JSON)');

            header('Content-Type: application/json');
            header('Content-Disposition: attachment; filename="insyarah_backup_' . date('Y-m-d') . '.json"');
            echo json_encode($data, JSON_PRETTY_PRINT);
        } catch (Exception $e) {
            Utils::sendError('Ekspor gagal: ' . $e->getMessage(), '', 500);
        }
    }

    public function importAll(): void
    {
        $role = $_SESSION['role'] ?? 'member';
        if ($role !== 'admin') {
            Utils::sendError('Akses ditolak. Hanya admin yang bisa melakukan ini.', '', 403);
            return;
        }

        $body = Utils::readJsonBody();
        if (!isset($body['inbox_items']) && !isset($body['tasks']) && !isset($body['exported_at'])) {
            Utils::sendError('Format backup tidak dikenali', '', 400);
            return;
        }

        try {
            $manager = new BackupManager($this->pdo);
            $manager->restoreBackup($body);
            
            AppHelper::logActivity($this->pdo, 'admin_import_json', 'system', 0, 'Admin memulihkan data dari JSON');
            
            Utils::sendSuccess(['result' => 'import_done']);
        } catch (Throwable $e) {
            Utils::sendError('Import gagal: ' . $e->getMessage(), '', 500);
        }
    }

    public function checkHealth(): void
    {
        $role = $_SESSION['role'] ?? 'member';
        if ($role !== 'admin') {
            Utils::sendError('Akses ditolak. Hanya admin.', '', 403);
            return;
        }

        $health = [
            'database' => 'ok',
            'tables' => [],
            'writable' => [],
            'errors' => []
        ];

        // 1. Database & Tables Check
        try {
            $requiredTables = ['users', 'tasks', 'projects', 'inbox_items', 'audit_logs', 'business_units', 'focus_sessions'];
            foreach ($requiredTables as $table) {
                try {
                    $stmt = $this->pdo->query("SELECT COUNT(*) FROM $table");
                    $count = $stmt->fetchColumn();
                    $health['tables'][$table] = ['status' => 'ok', 'count' => $count];
                } catch (Throwable $e) {
                    $health['tables'][$table] = ['status' => 'missing', 'error' => $e->getMessage()];
                    $health['database'] = 'warning';
                }
            }
        } catch (Throwable $e) {
            $health['database'] = 'error';
            $health['errors'][] = 'DB Connection Error: ' . $e->getMessage();
        }

        // 2. Writable Directories
        $dirs = [
            'uploads' => dirname(__DIR__, 2) . '/public/uploads',
        ];

        foreach ($dirs as $name => $path) {
            if (file_exists($path)) {
                $health['writable'][$name] = is_writable($path) ? 'ok' : 'not_writable';
            } else {
                $health['writable'][$name] = 'missing';
            }
        }

        Utils::sendSuccess(['health' => $health]);
    }

    public function getBackups(): void
    {
        $role = $_SESSION['role'] ?? 'member';
        if ($role !== 'admin') {
            Utils::sendError('Akses ditolak', '', 403);
            return;
        }
        $manager = new BackupManager($this->pdo);
        Utils::sendSuccess(['backups' => $manager->getBackups()]);
    }

    public function createBackup(): void
    {
        $role = $_SESSION['role'] ?? 'member';
        if ($role !== 'admin') {
            Utils::sendError('Akses ditolak', '', 403);
            return;
        }
        $manager = new BackupManager($this->pdo);
        try {
            $result = $manager->createBackup(true);
            
            AppHelper::logActivity($this->pdo, 'admin_backup_create', 'system', 0, 'Admin membuat backup server manual');
            
            Utils::sendSuccess(['message' => 'Backup berhasil dibuat', 'backup' => $result]);
        } catch (Exception $e) {
            Utils::sendError('Backup gagal: ' . $e->getMessage());
        }
    }

    public function restoreBackup(): void
    {
        $role = $_SESSION['role'] ?? 'member';
        if ($role !== 'admin') {
            Utils::sendError('Akses ditolak', '', 403);
            return;
        }
        $body = Utils::readJsonBody();
        $filename = $body['filename'] ?? null;
        if (!$filename) {
            Utils::sendError('Nama file wajib diisi');
            return;
        }
        
        if (basename($filename) !== $filename) {
             Utils::sendError('Nama file tidak valid');
             return;
        }

        $path = dirname(__DIR__) . '/backups/' . $filename;
        if (!file_exists($path)) {
            Utils::sendError('File backup tidak ditemukan');
            return;
        }

        $manager = new BackupManager($this->pdo);
        try {
            $json = file_get_contents($path);
            $data = json_decode($json, true);
            if (!$data) {
                 throw new Exception("Format JSON tidak valid");
            }
            $manager->restoreBackup($data);
            
            AppHelper::logActivity($this->pdo, 'admin_backup_restore', 'system', 0, 'Admin memulihkan backup server: ' . $filename);
            
            Utils::sendSuccess(['message' => 'Backup berhasil dipulihkan']);
        } catch (Exception $e) {
            Utils::sendError('Pemulihan gagal: ' . $e->getMessage());
        }
    }

    public function deleteBackup(): void
    {
        $role = $_SESSION['role'] ?? 'member';
        if ($role !== 'admin') {
            Utils::sendError('Akses ditolak', '', 403);
            return;
        }
        $body = Utils::readJsonBody();
        $filename = $body['filename'] ?? null;
        if (!$filename) {
            Utils::sendError('Nama file wajib diisi');
            return;
        }
         if (basename($filename) !== $filename) {
             Utils::sendError('Nama file tidak valid');
             return;
        }
        
        $path = dirname(__DIR__) . '/backups/' . $filename;
        if (file_exists($path)) {
            unlink($path);
        }
        
        AppHelper::logActivity($this->pdo, 'admin_backup_delete', 'system', 0, 'Admin menghapus file backup: ' . $filename);
        
        Utils::sendSuccess(['message' => 'Backup berhasil dihapus']);
    }

    public function broadcastMessage(): void
    {
        $role = $_SESSION['role'] ?? 'member';
        if ($role !== 'admin') {
            Utils::sendError('Akses ditolak', '', 403);
            return;
        }

        $body = Utils::readJsonBody();
        $message = trim($body['message'] ?? '');
        $subject = trim($body['subject'] ?? 'Pengumuman Admin');
        $channels = $body['channels'] ?? []; // ['email', 'whatsapp', 'telegram']
        $targetIds = $body['targets'] ?? []; // ['all'] or [1, 2, 3]

        if (empty($message)) {
            Utils::sendError('Pesan tidak boleh kosong');
            return;
        }

        if (empty($channels)) {
            Utils::sendError('Pilih minimal satu saluran pengiriman');
            return;
        }

        // Determine targets
        $users = [];
        if (in_array('all', $targetIds)) {
            $stmt = $this->pdo->query("SELECT id, username, email, phone, telegram_chat_id FROM users");
            $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } else {
            if (empty($targetIds)) {
                Utils::sendError('Target penerima tidak boleh kosong');
                return;
            }
            $placeholders = implode(',', array_fill(0, count($targetIds), '?'));
            $stmt = $this->pdo->prepare("SELECT id, username, email, phone, telegram_chat_id FROM users WHERE id IN ($placeholders)");
            $stmt->execute($targetIds);
            $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
        }

        $results = [
            'email' => 0,
            'whatsapp' => 0,
            'telegram' => 0,
            'failed' => 0
        ];

        // Initialize Notifiers
        $mailer = in_array('email', $channels) ? new Mailer() : null;
        $waNotifier = in_array('whatsapp', $channels) ? new WhatsAppNotifier() : null;
        $tgNotifier = in_array('telegram', $channels) ? new TelegramNotifier() : null;

        foreach ($users as $user) {
            // Email
            if ($mailer && !empty($user['email'])) {
                try {
                    $mailer->send($user['email'], $subject, nl2br($message));
                    $results['email']++;
                } catch (Throwable $e) {
                    error_log("Broadcast Email Failed for {$user['username']}: " . $e->getMessage());
                }
            }

            // WhatsApp
            if ($waNotifier && !empty($user['phone'])) {
                try {
                    $waMsg = "*$subject*\n\n$message";
                    $waNotifier->sendMessage($waMsg, $user['phone']);
                    $results['whatsapp']++;
                } catch (Throwable $e) {
                    error_log("Broadcast WA Failed for {$user['username']}: " . $e->getMessage());
                }
            }

            // Telegram
            if ($tgNotifier && !empty($user['telegram_chat_id'])) {
                try {
                    $tgMsg = "<b>$subject</b>\n\n$message";
                    $tgNotifier->sendMessage($tgMsg, $user['telegram_chat_id']);
                    $results['telegram']++;
                } catch (Throwable $e) {
                    error_log("Broadcast Telegram Failed for {$user['username']}: " . $e->getMessage());
                }
            }
        }

        AppHelper::logActivity($this->pdo, 'admin_broadcast', 'system', 0, "Admin mengirim broadcast ke " . count($users) . " user");
        
        Utils::sendSuccess([
            'message' => 'Broadcast selesai diproses',
            'stats' => $results
        ]);
    }
}
