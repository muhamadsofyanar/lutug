<?php

require_once dirname(__DIR__) . '/core/Database.php';

try {
    $pdo = Database::connection();
    echo "Checking reference_items table for business_unit column...\n";

    $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
    $addColumn = false;

    if ($driver === 'sqlite') {
        $stmt = $pdo->query("PRAGMA table_info(reference_items)");
        $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $hasColumn = false;
        foreach ($columns as $col) {
            if ($col['name'] === 'business_unit') {
                $hasColumn = true;
                break;
            }
        }
        if (!$hasColumn) {
            $addColumn = true;
        }
    } else {
        // MySQL/MariaDB
        $stmt = $pdo->query("SHOW COLUMNS FROM reference_items LIKE 'business_unit'");
        if ($stmt->rowCount() === 0) {
            $addColumn = true;
        }
    }

    if ($addColumn) {
        echo "Adding business_unit column to reference_items...\n";
        $pdo->exec("ALTER TABLE reference_items ADD COLUMN business_unit VARCHAR(100) DEFAULT NULL");
        echo "Column added successfully.\n";
    } else {
        echo "Column business_unit already exists in reference_items.\n";
    }

} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}
