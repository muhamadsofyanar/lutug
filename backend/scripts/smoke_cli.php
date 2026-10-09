<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/config/config.php';
require_once dirname(__DIR__) . '/core/Database.php';
require_once dirname(__DIR__) . '/controllers/DashboardController.php';
require_once dirname(__DIR__) . '/core/Utils.php';

session_start();

try {
    $pdo = Database::connection();
    $stmt = $pdo->prepare("SELECT id, username, role, business_unit, assigned_units FROM users WHERE username = :u LIMIT 1");
    $stmt->execute([':u' => 'admin']);
    $admin = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$admin) {
        echo "ERROR: admin user not found\n";
        exit(1);
    }
    $_SESSION['user_id'] = (int)$admin['id'];
    $_SESSION['username'] = $admin['username'];
    $_SESSION['role'] = $admin['role'] ?? 'admin';
    $_SESSION['business_unit'] = $admin['business_unit'] ?? null;
    $_SESSION['assigned_units'] = !empty($admin['assigned_units']) ? json_decode($admin['assigned_units'], true) : [];

    ob_start();
    (new DashboardController($pdo))->stats();
    $out = ob_get_clean();
    echo $out;
    exit(0);
} catch (Throwable $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    exit(1);
}

