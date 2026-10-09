<?php
require_once __DIR__ . '/../core/Database.php';

try {
    $pdo = Database::connection();
    
    // Create decision_logs table
    $sql = "CREATE TABLE IF NOT EXISTS decision_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        entity_type VARCHAR(50) NOT NULL, -- 'inbox', 'project', 'task'
        entity_id INT NOT NULL,
        decision_type VARCHAR(50) NOT NULL, -- 'processed', 'deferred', 'killed', 'delegated'
        reason TEXT,
        meta_data JSON, -- Stores snapshot like energy level, original title, etc.
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX (user_id),
        INDEX (entity_type, entity_id),
        INDEX (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";
    
    $pdo->exec($sql);
    echo "Table 'decision_logs' created successfully.\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
