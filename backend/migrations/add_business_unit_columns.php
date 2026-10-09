<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/core/Database.php';

try {
    $pdo = Database::connection();
    echo "Migrating database (Adding business_unit to tasks and inbox_items)...\n";

    // 1. tasks table
    echo "Checking tasks table...\n";
    // Check if column exists (MySQL syntax, adjusting for SQLite if needed logic)
    // Since we use MySQL primarily based on previous logs, we use SHOW COLUMNS.
    // But to be safe for both, we can try catch.
    
    $isSqlite = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite';

    if ($isSqlite) {
        // SQLite
        $cols = $pdo->query("PRAGMA table_info(tasks)")->fetchAll(PDO::FETCH_ASSOC);
        $hasUnit = false;
        foreach ($cols as $col) {
            if ($col['name'] === 'business_unit') {
                $hasUnit = true;
                break;
            }
        }
        if (!$hasUnit) {
            echo "Adding business_unit to tasks (SQLite)...\n";
            $pdo->exec("ALTER TABLE tasks ADD COLUMN business_unit TEXT DEFAULT NULL");
        }
        
        // inbox_items
        $cols = $pdo->query("PRAGMA table_info(inbox_items)")->fetchAll(PDO::FETCH_ASSOC);
        $hasUnit = false;
        foreach ($cols as $col) {
            if ($col['name'] === 'business_unit') {
                $hasUnit = true;
                break;
            }
        }
        if (!$hasUnit) {
            echo "Adding business_unit to inbox_items (SQLite)...\n";
            $pdo->exec("ALTER TABLE inbox_items ADD COLUMN business_unit TEXT DEFAULT NULL");
        }

    } else {
        // MySQL
        $stmt = $pdo->query("SHOW COLUMNS FROM tasks LIKE 'business_unit'");
        if (!$stmt->fetch()) {
            echo "Adding business_unit to tasks (MySQL)...\n";
            $pdo->exec("ALTER TABLE tasks ADD COLUMN business_unit VARCHAR(80) DEFAULT NULL");
        }

        $stmt = $pdo->query("SHOW COLUMNS FROM inbox_items LIKE 'business_unit'");
        if (!$stmt->fetch()) {
            echo "Adding business_unit to inbox_items (MySQL)...\n";
            $pdo->exec("ALTER TABLE inbox_items ADD COLUMN business_unit VARCHAR(80) DEFAULT NULL");
        }
    }

    echo "Migration completed successfully.\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}
