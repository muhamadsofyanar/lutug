<?php
require_once __DIR__ . '/../core/Database.php';

echo "Starting Database Optimization (Indexing)...\n";

try {
    $pdo = Database::connection();

    $indexes = [
        // Inbox
        "CREATE INDEX IF NOT EXISTS idx_inbox_user_status ON inbox_items(created_by, status)",
        "CREATE INDEX IF NOT EXISTS idx_inbox_bu_status ON inbox_items(business_unit, status)",
        
        // Tasks
        "CREATE INDEX IF NOT EXISTS idx_tasks_user_status_date ON tasks(created_by, status, date)",
        "CREATE INDEX IF NOT EXISTS idx_tasks_bu_status ON tasks(business_unit, status)",
        "CREATE INDEX IF NOT EXISTS idx_tasks_status_completed ON tasks(status, completed_at)", // For velocity
        "CREATE INDEX IF NOT EXISTS idx_tasks_date_completed ON tasks(date(completed_at))", // For Oracle Engine (function index)
        
        // Projects
        "CREATE INDEX IF NOT EXISTS idx_projects_user_status ON projects(created_by, status)",
        "CREATE INDEX IF NOT EXISTS idx_projects_bu_status ON projects(business_unit, status)",
        "CREATE INDEX IF NOT EXISTS idx_projects_status_updated ON projects(status, updated_at)", // For zombies
        
        // Daily Updates
        "CREATE INDEX IF NOT EXISTS idx_daily_user_date ON daily_updates(user_id, date)",
        
        // Focus Sessions
        "CREATE INDEX IF NOT EXISTS idx_focus_user_status_date ON focus_sessions(user_id, status, start_time)",
        
        // References
        "CREATE INDEX IF NOT EXISTS idx_refs_user ON reference_items(created_by)",
        "CREATE INDEX IF NOT EXISTS idx_refs_user_created ON reference_items(created_by, created_at DESC)",
        
        // Users (Login Speed)
        "CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)",
        "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)",

        // Comments & Attachments (Performance Fixes)
        "CREATE INDEX IF NOT EXISTS idx_comments_task ON task_comments(task_id)",
        "CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments(entity_type, entity_id)",
        "CREATE INDEX IF NOT EXISTS idx_decisions_user ON decision_logs(user_id)"
    ];

    foreach ($indexes as $sql) {
        echo "Executing: $sql ... ";
        try {
            $pdo->exec($sql);
            echo "OK\n";
        } catch (Exception $e) {
            echo "FAILED (" . $e->getMessage() . ")\n";
        }
    }

    echo "\nVerifying Indexes:\n";
    $tables = ['inbox_items', 'tasks', 'projects', 'daily_updates', 'focus_sessions', 'reference_items'];
    foreach ($tables as $table) {
        $count = $pdo->query("SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND tbl_name='$table'")->fetchColumn();
        echo "Table '$table' now has $count indexes.\n";
    }

    echo "\nOptimization Complete.\n";

} catch (Exception $e) {
    die("Error: " . $e->getMessage());
}
