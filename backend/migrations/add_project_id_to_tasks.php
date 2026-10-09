<?php
require_once dirname(__DIR__) . '/core/Database.php';

try {
    $pdo = Database::connection();
    
    echo "Checking 'tasks' table for 'project_id' column...\n";
    
    // Check if column exists
    $stmt = $pdo->query("SHOW COLUMNS FROM tasks LIKE 'project_id'");
    $hasColumn = $stmt->fetch();
    
    if (!$hasColumn) {
        echo "Adding 'project_id' column...\n";
        $pdo->exec("ALTER TABLE tasks ADD COLUMN project_id INT NULL COMMENT 'Link to projects table'");
        $pdo->exec("CREATE INDEX idx_tasks_project_id ON tasks(project_id)");
        echo "Column added successfully.\n";
    } else {
        echo "'project_id' column already exists.\n";
    }
    
    echo "Migration completed.\n";

} catch (PDOException $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
}
