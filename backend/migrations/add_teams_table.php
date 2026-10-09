<?php
require_once dirname(__DIR__) . '/core/Database.php';

try {
    $pdo = Database::connection();
    $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
    
    echo "Database Driver: $driver\n";

    // Create teams table
    if ($driver === 'mysql') {
        $pdo->exec("CREATE TABLE IF NOT EXISTS teams (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            business_unit_id INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    } else {
        $pdo->exec("CREATE TABLE IF NOT EXISTS teams (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            business_unit_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )");
    }
    
    echo "Table 'teams' checked/created.\n";

    // Helper to check column existence
    $checkColumn = function($pdo, $table, $column) use ($driver) {
        if ($driver === 'mysql') {
            $stmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?");
            $stmt->execute([$table, $column]);
            return $stmt->fetchColumn() > 0;
        } else {
            // SQLite
            $cols = $pdo->query("PRAGMA table_info($table)")->fetchAll(PDO::FETCH_ASSOC);
            foreach ($cols as $col) {
                if ($col['name'] === $column) return true;
            }
            return false;
        }
    };

    // Add team_id to people if not exists
    if (!$checkColumn($pdo, 'people', 'team_id')) {
        if ($driver === 'mysql') {
            $pdo->exec("ALTER TABLE people ADD COLUMN team_id INT DEFAULT NULL");
        } else {
            $pdo->exec("ALTER TABLE people ADD COLUMN team_id INTEGER DEFAULT NULL");
        }
        echo "Column 'team_id' added to 'people'.\n";
    } else {
        echo "Column 'team_id' already exists in 'people'.\n";
    }

    // Add job_title to people if not exists
    if (!$checkColumn($pdo, 'people', 'job_title')) {
        if ($driver === 'mysql') {
            $pdo->exec("ALTER TABLE people ADD COLUMN job_title VARCHAR(255) DEFAULT NULL");
        } else {
            $pdo->exec("ALTER TABLE people ADD COLUMN job_title TEXT DEFAULT NULL");
        }
        echo "Column 'job_title' added to 'people'.\n";
    } else {
        echo "Column 'job_title' already exists in 'people'.\n";
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
