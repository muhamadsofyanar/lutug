<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/core/Database.php';

try {
    $pdo = Database::connection();
    echo "Migrating database (MySQL)...\n";

    // Check if column exists
    $stmt = $pdo->query("SHOW COLUMNS FROM daily_updates LIKE 'energy_level'");
    $exists = $stmt->fetch();

    if (!$exists) {
        echo "Adding energy_level to daily_updates...\n";
        $pdo->exec("ALTER TABLE daily_updates ADD COLUMN energy_level INT DEFAULT 70");
    } else {
        echo "energy_level already exists.\n";
    }

    echo "Done.\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
