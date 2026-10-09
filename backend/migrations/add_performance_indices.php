<?php

require_once dirname(__DIR__) . '/core/Database.php';

try {
    $pdo = Database::connection();
    
    echo "Adding indices for performance optimization...\n";

    // task_comments
    try {
        $pdo->exec("CREATE INDEX idx_task_comments_task_id ON task_comments(task_id)");
        echo "- Added idx_task_comments_task_id\n";
    } catch (PDOException $e) {
        echo "- idx_task_comments_task_id might already exist or failed: " . $e->getMessage() . "\n";
    }

    // daily_updates
    try {
        $pdo->exec("CREATE INDEX idx_daily_updates_user_date ON daily_updates(user_id, date)");
        echo "- Added idx_daily_updates_user_date\n";
    } catch (PDOException $e) {
        echo "- idx_daily_updates_user_date might already exist or failed: " . $e->getMessage() . "\n";
    }

    // projects
    try {
        $pdo->exec("CREATE INDEX idx_projects_bu_status ON projects(business_unit, status)");
        echo "- Added idx_projects_bu_status\n";
    } catch (PDOException $e) {
        echo "- idx_projects_bu_status might already exist or failed: " . $e->getMessage() . "\n";
    }
    
    try {
        $pdo->exec("CREATE INDEX idx_projects_created_by ON projects(created_by)");
        echo "- Added idx_projects_created_by\n";
    } catch (PDOException $e) {
        echo "- idx_projects_created_by might already exist or failed: " . $e->getMessage() . "\n";
    }

    echo "Optimization complete.\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
