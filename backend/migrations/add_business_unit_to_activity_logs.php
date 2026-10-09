<?php

require_once __DIR__ . '/../core/Database.php';

try {
    $pdo = Database::connection();
    $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
    echo "Driver detected: $driver\n";

    // Check if column exists
    $columns = [];
    if ($driver === 'sqlite') {
        $stmt = $pdo->query("PRAGMA table_info(activity_logs)");
        $columns = array_map(fn($c) => $c['name'], $stmt->fetchAll(PDO::FETCH_ASSOC));
    } else {
        $stmt = $pdo->query("SHOW COLUMNS FROM activity_logs");
        $columns = array_map(fn($c) => $c['Field'], $stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    if (!in_array('business_unit', $columns)) {
        echo "Adding business_unit column to activity_logs...\n";
        if ($driver === 'sqlite') {
            $pdo->exec("ALTER TABLE activity_logs ADD COLUMN business_unit TEXT DEFAULT NULL");
        } else {
            $pdo->exec("ALTER TABLE activity_logs ADD COLUMN business_unit VARCHAR(100) DEFAULT NULL");
        }
        echo "Column added successfully.\n";
    } else {
        echo "Column business_unit already exists in activity_logs.\n";
    }

} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}
