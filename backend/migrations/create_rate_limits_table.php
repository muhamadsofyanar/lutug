<?php
require_once __DIR__ . '/../core/Database.php';

try {
    $pdo = Database::connection();
    
    // SQLite syntax for TIMESTAMP is different, but we use MySQL compatible if possible.
    // For broader compatibility, we'll use INTEGER for timestamps or TEXT.
    // Assuming MySQL given 'laragon' environment usually implies MySQL.
    
    $sql = "CREATE TABLE IF NOT EXISTS rate_limits (
        `key` VARCHAR(255) PRIMARY KEY,
        `requests` INT DEFAULT 1,
        `reset_at` INT,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )";
    
    $pdo->exec($sql);
    echo "Migration successful: rate_limits table created.\n";
    
} catch (PDOException $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
}
