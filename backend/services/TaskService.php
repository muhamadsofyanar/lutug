<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/core/Utils.php';
require_once dirname(__DIR__) . '/core/AppHelper.php';

class TaskService
{
    public static function tryScheduleOnDate(PDO $pdo, string $title, string $date, ?array &$taskOut = null, ?string $assignedTo = null, ?int $maxTasksPerDay = null, ?int $createdBy = null, ?string $businessUnit = null, ?int $projectId = null): bool
    {
        $assignedTo = $assignedTo ?? AppHelper::getCurrentUsername();
        $countStmt = $pdo->prepare('SELECT COUNT(*) FROM tasks WHERE date = :date');
        $countStmt->execute([':date' => $date]);
        $existingCount = (int)$countStmt->fetchColumn();
        $limit = $maxTasksPerDay;
        if ($limit === null) {
            $limit = 0; // 0 means no cap for scheduled date
        }
        if ($limit > 0 && $existingCount >= $limit) {
            return false;
        }
        $slotsStmt = $pdo->prepare('SELECT slot FROM tasks WHERE date = :date');
        $slotsStmt->execute([':date' => $date]);
        $usedSlots = [];
        while ($row = $slotsStmt->fetch(PDO::FETCH_ASSOC)) {
            $usedSlots[] = (int)$row['slot'];
        }
        $slot = 1;
        while (in_array($slot, $usedSlots, true)) {
            $slot++;
        }
        $now = Utils::now();
        $insert = $pdo->prepare('INSERT INTO tasks (date, slot, title, status, assigned_to, created_at, updated_at, created_by, business_unit, project_id) VALUES (:date, :slot, :title, :status, :assigned_to, :created_at, :updated_at, :created_by, :business_unit, :project_id)');
        $insert->execute([
            ':date' => $date,
            ':slot' => $slot,
            ':title' => $title,
            ':status' => 'pending',
            ':assigned_to' => $assignedTo,
            ':created_at' => $now,
            ':updated_at' => $now,
            ':created_by' => $createdBy,
            ':business_unit' => $businessUnit,
            ':project_id' => $projectId,
        ]);
        $taskId = (int)$pdo->lastInsertId();
        $taskOut = [
            'id' => $taskId,
            'date' => $date,
            'slot' => $slot,
            'title' => $title,
            'status' => 'pending',
            'assigned_to' => $assignedTo,
            'created_at' => $now,
            'updated_at' => $now,
            'created_by' => $createdBy,
            'business_unit' => $businessUnit,
            'project_id' => $projectId,
        ];
        return true;
    }

    public static function tryScheduleToday(PDO $pdo, string $title, ?array &$taskOut = null, ?string $assignedTo = null, ?int $maxTasksPerDay = null, ?int $createdBy = null, ?string $businessUnit = null, ?int $projectId = null): bool
    {
        $assignedTo = $assignedTo ?? AppHelper::getCurrentUsername();
        $date = Utils::todayDate();
        $countStmt = $pdo->prepare('SELECT COUNT(*) FROM tasks WHERE date = :date');
        $countStmt->execute([':date' => $date]);
        $existingCount = (int)$countStmt->fetchColumn();
        $limit = $maxTasksPerDay;
        if ($limit === null) {
            $limit = 20; // Increased from 5 to 20 to avoid TODAY_FULL blocking
        }
        if ($limit > 0 && $existingCount >= $limit) {
            return false;
        }
        $slotsStmt = $pdo->prepare('SELECT slot FROM tasks WHERE date = :date');
        $slotsStmt->execute([':date' => $date]);
        $usedSlots = [];
        while ($row = $slotsStmt->fetch(PDO::FETCH_ASSOC)) {
            $usedSlots[] = (int)$row['slot'];
        }
        $slot = 1;
        while (in_array($slot, $usedSlots, true)) {
            $slot++;
        }
        $now = Utils::now();
        $insert = $pdo->prepare('INSERT INTO tasks (date, slot, title, status, assigned_to, created_at, updated_at, created_by, business_unit, project_id) VALUES (:date, :slot, :title, :status, :assigned_to, :created_at, :updated_at, :created_by, :business_unit, :project_id)');
        $insert->execute([
            ':date' => $date,
            ':slot' => $slot,
            ':title' => $title,
            ':status' => 'pending',
            ':assigned_to' => $assignedTo,
            ':created_at' => $now,
            ':updated_at' => $now,
            ':created_by' => $createdBy,
            ':business_unit' => $businessUnit,
            ':project_id' => $projectId,
        ]);
        $taskId = (int)$pdo->lastInsertId();
        $taskOut = [
            'id' => $taskId,
            'date' => $date,
            'slot' => $slot,
            'title' => $title,
            'status' => 'pending',
            'assigned_to' => $assignedTo,
            'created_at' => $now,
            'updated_at' => $now,
            'created_by' => $createdBy,
            'business_unit' => $businessUnit,
            'project_id' => $projectId,
        ];
        return true;
    }

    public static function handleCompletionRecurrence(PDO $pdo, int $taskId): ?int
    {
        $stmt = $pdo->prepare("SELECT title, assigned_to, created_by, business_unit, project_id, recurrence_pattern, date FROM tasks WHERE id = :id");
        $stmt->execute([':id' => $taskId]);
        $task = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$task || empty($task['recurrence_pattern'])) {
            return null;
        }

        $pattern = $task['recurrence_pattern'];
        
        // Recur from TODAY to avoid backlog spam
        $nextDate = date('Y-m-d', strtotime('+1 day')); // Default

        if ($pattern === 'daily') {
            $nextDate = date('Y-m-d', strtotime('+1 day'));
        } elseif ($pattern === 'weekly') {
            $nextDate = date('Y-m-d', strtotime('+1 week'));
        } elseif ($pattern === 'monthly') {
            $nextDate = date('Y-m-d', strtotime('+1 month'));
        } elseif ($pattern === 'yearly') {
            $nextDate = date('Y-m-d', strtotime('+1 year'));
        } elseif (preg_match('/^custom_(\d+)_days$/', $pattern, $matches)) {
            $days = (int)$matches[1];
            $nextDate = date('Y-m-d', strtotime("+$days days"));
        }

        // Create new task
        $newTaskTitle = $task['title'];
        
        // Find slot
        $countStmt = $pdo->prepare('SELECT COUNT(*) FROM tasks WHERE date = :date');
        $countStmt->execute([':date' => $nextDate]);
        $existingCount = (int)$countStmt->fetchColumn();
        
        // Simple slot logic
        $slot = $existingCount + 1;

        $now = Utils::now();
        $insert = $pdo->prepare('INSERT INTO tasks (date, slot, title, status, assigned_to, created_at, updated_at, created_by, business_unit, project_id, recurrence_pattern) VALUES (:date, :slot, :title, :status, :assigned_to, :created_at, :updated_at, :created_by, :business_unit, :project_id, :recurrence_pattern)');
        $insert->execute([
            ':date' => $nextDate,
            ':slot' => $slot,
            ':title' => $newTaskTitle,
            ':status' => 'pending',
            ':assigned_to' => $task['assigned_to'],
            ':created_at' => $now,
            ':updated_at' => $now,
            ':created_by' => $task['created_by'],
            ':business_unit' => $task['business_unit'],
            ':project_id' => $task['project_id'],
            ':recurrence_pattern' => $pattern
        ]);

        $newTaskId = (int)$pdo->lastInsertId();
        
        return $newTaskId;
    }
}
