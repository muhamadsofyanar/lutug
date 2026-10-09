<?php
require_once dirname(__DIR__) . '/core/Database.php';

try {
    $pdo = Database::connection();
    
    echo "Checking 'tasks' table columns...\n";
    
    // Check if columns exist (MySQL specific, but works for Laragon)
    $stmt = $pdo->query("SHOW COLUMNS FROM tasks LIKE 'importance'");
    $hasImportance = $stmt->fetch();
    
    if (!$hasImportance) {
        echo "Adding 'importance' column...\n";
        $pdo->exec("ALTER TABLE tasks ADD COLUMN importance TINYINT DEFAULT 0 COMMENT '0-10 Scale'");
    } else {
        echo "'importance' column already exists.\n";
    }

    $stmt = $pdo->query("SHOW COLUMNS FROM tasks LIKE 'urgency'");
    $hasUrgency = $stmt->fetch();
    
    if (!$hasUrgency) {
        echo "Adding 'urgency' column...\n";
        $pdo->exec("ALTER TABLE tasks ADD COLUMN urgency TINYINT DEFAULT 0 COMMENT '0-10 Scale'");
    } else {
        echo "'urgency' column already exists.\n";
    }
    
    echo "Migration completed successfully.\n";

} catch (PDOException $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
}
