<?php
// Run only from the Coolify container terminal.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once dirname(__DIR__) . '/core/Database.php';
$username = getenv('ADMIN_USERNAME') ?: '';
$password = getenv('ADMIN_PASSWORD') ?: '';
if ($username === '' || strlen($password) < 12) {
    fwrite(STDERR, "Set ADMIN_USERNAME and ADMIN_PASSWORD (minimum 12 characters).\n");
    exit(1);
}
$pdo = Database::connection();
$stmt = $pdo->prepare('INSERT INTO users (username, password_hash, role, is_verified, created_at) VALUES (?, ?, ?, 1, ?)');
$stmt->execute([$username, password_hash($password, PASSWORD_DEFAULT), 'admin', date('Y-m-d H:i:s')]);
echo "Admin created. Remove ADMIN_PASSWORD from environment settings.\n";
