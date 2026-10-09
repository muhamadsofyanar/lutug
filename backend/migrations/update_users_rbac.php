<?php
require_once dirname(__DIR__) . '/core/Database.php';
require_once dirname(__DIR__) . '/core/Utils.php';

try {
    $pdo = Database::connection();
    echo "Connected to DB via " . $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) . "\n";

    // 1. Add assigned_units column if not exists
    $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
    $colExists = false;
    
    if ($driver === 'sqlite') {
        $cols = $pdo->query("PRAGMA table_info(users)")->fetchAll(PDO::FETCH_ASSOC);
        foreach ($cols as $col) {
            if ($col['name'] === 'assigned_units') $colExists = true;
        }
        if (!$colExists) {
            $pdo->exec("ALTER TABLE users ADD COLUMN assigned_units TEXT DEFAULT NULL");
            echo "Added assigned_units column (SQLite)\n";
        }
    } else {
        // MySQL
        $cols = $pdo->query("DESCRIBE users")->fetchAll(PDO::FETCH_ASSOC);
        foreach ($cols as $col) {
            if ($col['Field'] === 'assigned_units') $colExists = true;
        }
        if (!$colExists) {
            $pdo->exec("ALTER TABLE users ADD COLUMN assigned_units TEXT DEFAULT NULL");
            echo "Added assigned_units column (MySQL)\n";
        }
    }

    // 2. Seed Users
    $users = [
        [
            'username' => 'andi',
            'password' => 'password123', // Default password
            'role' => 'user',
            'assigned_units' => json_encode(['darmutiara', 'legaone'])
        ],
        [
            'username' => 'agus',
            'password' => 'password123',
            'role' => 'user',
            'assigned_units' => json_encode(['mutiaragenetika', 'dayainsan'])
        ],
        [
            'username' => 'arif',
            'password' => 'password123',
            'role' => 'user',
            'assigned_units' => json_encode(['rizqhub', 'legaone'])
        ],
        [
            'username' => 'admin',
            'password' => 'admin123',
            'role' => 'admin',
            'assigned_units' => json_encode(['ALL']) // Special flag or just empty implies all for admin
        ]
    ];

    foreach ($users as $u) {
        // Check if user exists
        $stmt = $pdo->prepare("SELECT id FROM users WHERE username = ?");
        $stmt->execute([$u['username']]);
        $exists = $stmt->fetch();

        if ($exists) {
            echo "Updating user {$u['username']}...\n";
            $update = $pdo->prepare("UPDATE users SET role = ?, assigned_units = ? WHERE username = ?");
            $update->execute([$u['role'], $u['assigned_units'], $u['username']]);
        } else {
            echo "Creating user {$u['username']}...\n";
            $hash = password_hash($u['password'], PASSWORD_DEFAULT);
            $insert = $pdo->prepare("INSERT INTO users (username, password_hash, role, assigned_units, created_at) VALUES (?, ?, ?, ?, ?)");
            $insert->execute([$u['username'], $hash, $u['role'], $u['assigned_units'], date('Y-m-d H:i:s')]);
        }
    }

    echo "Migration & Seeding completed.\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
