<?php

declare(strict_types=1);

require_once __DIR__ . '/Utils.php';

class BackupManager
{
    private PDO $pdo;
    private string $backupDir;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
        $this->backupDir = dirname(__DIR__) . '/backups';
        if (!is_dir($this->backupDir)) {
            mkdir($this->backupDir, 0755, true);
        }
    }

    public function createBackup(bool $saveToFile = true): array
    {
        $tables = ['users', 'inbox_items', 'tasks', 'projects', 'task_comments', 'people', 'business_units', 'audit_logs', 'settings', 'focus_sessions'];
        $data = ['exported_at' => Utils::now()];

        foreach ($tables as $table) {
            try {
                $stmt = $this->pdo->query("SELECT * FROM $table");
                $data[$table] = $stmt->fetchAll(PDO::FETCH_ASSOC);
            } catch (Exception $e) {
                // Table might not exist, skip
                $data[$table] = [];
            }
        }

        $filename = null;
        $path = null;

        if ($saveToFile) {
            $filename = 'backup_' . date('Y-m-d_H-i-s') . '.json';
            $path = $this->backupDir . '/' . $filename;
            file_put_contents($path, json_encode($data, JSON_PRETTY_PRINT));
            $files = glob($this->backupDir . '/*.json');
            usort($files, fn($a, $b) => filemtime($b) - filemtime($a));
            $limit = 5;
            if (count($files) > $limit) {
                for ($i = $limit; $i < count($files); $i++) {
                    @unlink($files[$i]);
                }
            }
        }

        return [
            'filename' => $filename,
            'path' => $path,
            'data' => $data
        ];
    }

    public function restoreBackup(array $data): void
    {
        $this->pdo->beginTransaction();
        try {
            // 1. Clear existing data (Order matters for foreign keys if enforced, though SQLite usually permissive by default unless enabled)
            // We'll follow the order: comments -> focus -> tasks -> projects -> inbox -> people -> units -> audit -> users
            $tablesToDelete = ['task_comments', 'focus_sessions', 'tasks', 'projects', 'inbox_items', 'people', 'business_units', 'audit_logs', 'settings'];
            // We DO NOT delete users automatically to prevent lockout, unless we are sure.
            // For now, let's skip users restore to be safe, or only restore if users table is empty?
            // Let's skip users in restore for this iteration to match AdminController behavior + safety.
            
            foreach ($tablesToDelete as $table) {
                try {
                    $this->pdo->exec("DELETE FROM $table");
                } catch (Exception $e) {
                    // Ignore if table doesn't exist yet
                }
            }

            // 2. Insert Data
            
            // Business Units
            if (isset($data['business_units'])) {
                $stmt = $this->pdo->prepare('INSERT INTO business_units (id, name, description, created_at) VALUES (:id, :name, :description, :created_at)');
                foreach ($data['business_units'] as $row) {
                    $stmt->execute([
                        ':id' => $row['id'],
                        ':name' => $row['name'],
                        ':description' => $row['description'] ?? null,
                        ':created_at' => $row['created_at'] ?? Utils::now()
                    ]);
                }
            }

            // People
            if (isset($data['people'])) {
                $stmt = $this->pdo->prepare('INSERT INTO people (id, name, created_at, job_title, team_id) VALUES (:id, :name, :created_at, :job_title, :team_id)');
                foreach ($data['people'] as $row) {
                    $stmt->execute([
                        ':id' => $row['id'] ?? null, // Auto inc if null
                        ':name' => $row['name'],
                        ':created_at' => $row['created_at'] ?? Utils::now(),
                        ':job_title' => $row['job_title'] ?? null,
                        ':team_id' => $row['team_id'] ?? null
                    ]);
                }
            }

            // Inbox Items
            if (isset($data['inbox_items'])) {
                $stmt = $this->pdo->prepare('INSERT INTO inbox_items (id, content, status, created_at, business_unit, importance, urgency, created_by, energy_level) VALUES (:id, :content, :status, :created_at, :business_unit, :importance, :urgency, :created_by, :energy_level)');
                foreach ($data['inbox_items'] as $row) {
                    $stmt->execute([
                        ':id' => $row['id'],
                        ':content' => $row['content'],
                        ':status' => $row['status'] ?? 'raw',
                        ':created_at' => $row['created_at'] ?? Utils::now(),
                        ':business_unit' => $row['business_unit'] ?? null,
                        ':importance' => $row['importance'] ?? 0,
                        ':urgency' => $row['urgency'] ?? 0,
                        ':created_by' => $row['created_by'] ?? null,
                        ':energy_level' => $row['energy_level'] ?? 'medium'
                    ]);
                }
            }

            // Projects
            if (isset($data['projects'])) {
                $stmt = $this->pdo->prepare('INSERT INTO projects (id, title, status, created_at, business_unit, next_action, updated_at, created_by, visibility) VALUES (:id, :title, :status, :created_at, :business_unit, :next_action, :updated_at, :created_by, :visibility)');
                foreach ($data['projects'] as $row) {
                    $stmt->execute([
                        ':id' => $row['id'],
                        ':title' => $row['title'],
                        ':status' => $row['status'] ?? 'active',
                        ':created_at' => $row['created_at'] ?? Utils::now(),
                        ':business_unit' => $row['business_unit'] ?? null,
                        ':next_action' => $row['next_action'] ?? null,
                        ':updated_at' => $row['updated_at'] ?? null,
                        ':created_by' => $row['created_by'] ?? null,
                        ':visibility' => $row['visibility'] ?? 'private'
                    ]);
                }
            }

            // Tasks
            if (isset($data['tasks'])) {
                $stmt = $this->pdo->prepare('INSERT INTO tasks (id, date, slot, title, status, assigned_to, created_at, business_unit, energy_level, context_tags, importance, urgency, linked_references, created_by, recurrence_pattern, next_due_date, completed_at, updated_at, project_id) VALUES (:id, :date, :slot, :title, :status, :assigned_to, :created_at, :business_unit, :energy_level, :context_tags, :importance, :urgency, :linked_references, :created_by, :recurrence_pattern, :next_due_date, :completed_at, :updated_at, :project_id)');
                foreach ($data['tasks'] as $row) {
                    $stmt->execute([
                        ':id' => $row['id'],
                        ':date' => $row['date'],
                        ':slot' => $row['slot'],
                        ':title' => $row['title'],
                        ':status' => $row['status'] ?? 'pending',
                        ':assigned_to' => $row['assigned_to'] ?? null,
                        ':created_at' => $row['created_at'] ?? Utils::now(),
                        ':business_unit' => $row['business_unit'] ?? null,
                        ':energy_level' => $row['energy_level'] ?? 'medium',
                        ':context_tags' => is_array($row['context_tags'] ?? null) ? json_encode($row['context_tags']) : ($row['context_tags'] ?? null),
                        ':importance' => $row['importance'] ?? 0,
                        ':urgency' => $row['urgency'] ?? 0,
                        ':linked_references' => is_array($row['linked_references'] ?? null) ? json_encode($row['linked_references']) : ($row['linked_references'] ?? null),
                        ':created_by' => $row['created_by'] ?? null,
                        ':recurrence_pattern' => $row['recurrence_pattern'] ?? null,
                        ':next_due_date' => $row['next_due_date'] ?? null,
                        ':completed_at' => $row['completed_at'] ?? null,
                        ':updated_at' => $row['updated_at'] ?? null,
                        ':project_id' => $row['project_id'] ?? null
                    ]);
                }
            }

            // Comments
            if (isset($data['task_comments'])) {
                $stmt = $this->pdo->prepare('INSERT INTO task_comments (id, task_id, author, content, created_at) VALUES (:id, :task_id, :author, :content, :created_at)');
                foreach ($data['task_comments'] as $row) {
                    $stmt->execute([
                        ':id' => $row['id'],
                        ':task_id' => $row['task_id'],
                        ':author' => $row['author'] ?? 'System',
                        ':content' => $row['content'],
                        ':created_at' => $row['created_at'] ?? Utils::now()
                    ]);
                }
            }

            // Focus Sessions
            if (isset($data['focus_sessions'])) {
                $stmt = $this->pdo->prepare('INSERT INTO focus_sessions (id, user_id, task_id, start_time, end_time, duration_minutes, status, created_at) VALUES (:id, :user_id, :task_id, :start_time, :end_time, :duration_minutes, :status, :created_at)');
                foreach ($data['focus_sessions'] as $row) {
                    $stmt->execute([
                        ':id' => $row['id'],
                        ':user_id' => $row['user_id'],
                        ':task_id' => $row['task_id'] ?? null,
                        ':start_time' => $row['start_time'],
                        ':end_time' => $row['end_time'] ?? null,
                        ':duration_minutes' => $row['duration_minutes'] ?? 0,
                        ':status' => $row['status'] ?? 'completed',
                        ':created_at' => $row['created_at'] ?? Utils::now()
                    ]);
                }
            }
            
            // Audit Logs
            if (isset($data['audit_logs'])) {
                $stmt = $this->pdo->prepare('INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, created_at) VALUES (:id, :user_id, :action, :entity_type, :entity_id, :details, :created_at)');
                foreach ($data['audit_logs'] as $row) {
                    $stmt->execute([
                        ':id' => $row['id'],
                        ':user_id' => $row['user_id'],
                        ':action' => $row['action'],
                        ':entity_type' => $row['entity_type'] ?? null,
                        ':entity_id' => $row['entity_id'] ?? null,
                        ':details' => is_array($row['details'] ?? null) ? json_encode($row['details']) : ($row['details'] ?? null),
                        ':created_at' => $row['created_at'] ?? Utils::now()
                    ]);
                }
            }

            // Settings
            if (isset($data['settings'])) {
                $stmt = $this->pdo->prepare('INSERT INTO settings (setting_key, setting_value, updated_at) VALUES (:key, :val, :updated)');
                foreach ($data['settings'] as $row) {
                    $stmt->execute([
                        ':key' => $row['setting_key'],
                        ':val' => $row['setting_value'],
                        ':updated' => $row['updated_at'] ?? Utils::now()
                    ]);
                }
            }

            $this->pdo->commit();
        } catch (Exception $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }

    public function getBackups(): array
    {
        $files = glob($this->backupDir . '/*.json');
        $backups = [];
        foreach ($files as $file) {
            $backups[] = [
                'filename' => basename($file),
                'size' => filesize($file),
                'created_at' => date('Y-m-d H:i:s', filemtime($file))
            ];
        }
        // Sort by date desc
        usort($backups, fn($a, $b) => strcmp($b['created_at'], $a['created_at']));
        return $backups;
    }

    public function cleanupOldBackups(int $days = 7): int
    {
        $files = glob($this->backupDir . '/*.json');
        $count = 0;
        $now = time();
        foreach ($files as $file) {
            if ($now - filemtime($file) > $days * 24 * 3600) {
                unlink($file);
                $count++;
            }
        }
        return $count;
    }
}
