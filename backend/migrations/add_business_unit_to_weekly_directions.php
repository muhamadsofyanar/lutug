<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/core/Database.php';

try {
    $pdo = Database::connection();
    echo "Migrating database (Adding business_unit to weekly_directions)...\n";

    $isSqlite = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite';

    if ($isSqlite) {
        // SQLite
        $cols = $pdo->query("PRAGMA table_info(weekly_directions)")->fetchAll(PDO::FETCH_ASSOC);
        $hasUnit = false;
        foreach ($cols as $col) {
            if ($col['name'] === 'business_unit') {
                $hasUnit = true;
                break;
            }
        }
        if (!$hasUnit) {
            echo "Adding business_unit to weekly_directions (SQLite)...\n";
            $pdo->exec("ALTER TABLE weekly_directions ADD COLUMN business_unit TEXT DEFAULT NULL");
        }
    } else {
        // MySQL
        $stmt = $pdo->query("SHOW COLUMNS FROM weekly_directions LIKE 'business_unit'");
        if (!$stmt->fetch()) {
            echo "Adding business_unit to weekly_directions (MySQL)...\n";
            $pdo->exec("ALTER TABLE weekly_directions ADD COLUMN business_unit VARCHAR(80) DEFAULT NULL");
        }
    }

    echo "Migration completed successfully.\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}
