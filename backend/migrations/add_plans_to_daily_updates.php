<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/core/Database.php';

try {
    $pdo = Database::connection();
    echo "Migrating daily_updates (Adding plans/reflection)...\n";

    $columns = ['morning_plan', 'evening_reflection'];
    
    foreach ($columns as $col) {
        $stmt = $pdo->query("SHOW COLUMNS FROM daily_updates LIKE '$col'");
        if (!$stmt->fetch()) {
            echo "Adding $col...\n";
            $pdo->exec("ALTER TABLE daily_updates ADD COLUMN $col TEXT NULL");
        } else {
            echo "$col already exists.\n";
        }
    }

    echo "Migration Complete.\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
