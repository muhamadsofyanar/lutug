<?php

require_once __DIR__ . '/../core/Database.php';

try {
    $pdo = Database::connection();
    
    echo "Creating focus_sessions table...\n";
    
    // Check if table exists
    $stmt = $pdo->query("SHOW TABLES LIKE 'focus_sessions'");
    if ($stmt->rowCount() > 0) {
        echo "Table focus_sessions already exists.\n";
    } else {
        $sql = "CREATE TABLE focus_sessions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            task_id INT NULL,
            start_time DATETIME NOT NULL,
            end_time DATETIME NULL,
            duration_minutes INT DEFAULT 0,
            status VARCHAR(50) DEFAULT 'running', -- completed, interrupted, running
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_user_id (user_id),
            INDEX idx_task_id (task_id),
            INDEX idx_start_time (start_time)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";
        
        $pdo->exec($sql);
        echo "Table focus_sessions created successfully.\n";
    }

    // Add 'focus_count' and 'total_focus_minutes' to users table if not exists (for caching/leaderboards later)
    // Maybe unnecessary now, can compute on fly.

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}
