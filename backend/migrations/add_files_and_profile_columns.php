<?php
require_once dirname(__DIR__) . '/core/Database.php';

try {
    $pdo = Database::connection();
    echo "Starting migration: Attachments & User Profile...\n";

    $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
    
    // 1. Add full_name to users
    echo "Checking users.full_name...\n";
    $hasColumn = false;
    if ($driver === 'sqlite') {
        $cols = $pdo->query("PRAGMA table_info(users)")->fetchAll(PDO::FETCH_ASSOC);
        foreach ($cols as $col) {
            if ($col['name'] === 'full_name') $hasColumn = true;
        }
        if (!$hasColumn) {
            $pdo->exec("ALTER TABLE users ADD COLUMN full_name TEXT DEFAULT NULL");
            echo "Added full_name to users (SQLite)\n";
        }
    } else {
        $cols = $pdo->query("SHOW COLUMNS FROM users LIKE 'full_name'")->fetchAll();
        if (count($cols) === 0) {
            $pdo->exec("ALTER TABLE users ADD COLUMN full_name VARCHAR(150) DEFAULT NULL");
            echo "Added full_name to users (MySQL)\n";
        }
    }

    // 2. Create attachments table
    echo "Creating attachments table...\n";
    if ($driver === 'sqlite') {
        $pdo->exec("CREATE TABLE IF NOT EXISTS attachments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entity_type TEXT NOT NULL,
            entity_id INTEGER NOT NULL,
            file_name TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_type TEXT,
            file_size INTEGER,
            uploaded_by INTEGER,
            created_at TEXT NOT NULL
        )");
    } else {
        $pdo->exec("CREATE TABLE IF NOT EXISTS attachments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            entity_type VARCHAR(50) NOT NULL, -- 'task', 'project'
            entity_id INT NOT NULL,
            file_name VARCHAR(255) NOT NULL,
            file_path VARCHAR(255) NOT NULL,
            file_type VARCHAR(100),
            file_size INT,
            uploaded_by INT,
            created_at DATETIME NOT NULL,
            INDEX idx_entity (entity_type, entity_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    }
    echo "Attachments table created/verified.\n";

    echo "Migration completed.\n";

} catch (Exception $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}
