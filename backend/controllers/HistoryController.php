<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/core/Utils.php';

class HistoryController
{
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    public function list(): void
    {
        $userId = $_SESSION['user_id'] ?? null;
        $role = $_SESSION['role'] ?? 'member';

        if ($userId && $role === 'admin') {
             // Admin sees all done tasks
             $stmt = $this->pdo->prepare("SELECT id, date, slot, title, status, assigned_to, business_unit, (SELECT author FROM task_comments WHERE task_id = tasks.id ORDER BY created_at DESC LIMIT 1) AS last_actor, created_at FROM tasks WHERE status = :status ORDER BY date DESC, slot ASC");
             $stmt->execute([
                ':status' => 'done'
             ]);
        } elseif ($userId) {
            $stmt = $this->pdo->prepare("SELECT id, date, slot, title, status, assigned_to, business_unit, (SELECT author FROM task_comments WHERE task_id = tasks.id ORDER BY created_at DESC LIMIT 1) AS last_actor, created_at FROM tasks WHERE status = :status AND (created_by = :user_id OR created_by IS NULL) ORDER BY date DESC, slot ASC");
            $stmt->execute([
                ':status' => 'done',
                ':user_id' => $userId,
            ]);
        } else {
            $stmt = $this->pdo->prepare("SELECT id, date, slot, title, status, assigned_to, business_unit, (SELECT author FROM task_comments WHERE task_id = tasks.id ORDER BY created_at DESC LIMIT 1) AS last_actor, created_at FROM tasks WHERE status = :status AND created_by IS NULL ORDER BY date DESC, slot ASC");
            $stmt->execute([
                ':status' => 'done',
            ]);
        }
        $tasks = $stmt->fetchAll(PDO::FETCH_ASSOC);
        Utils::sendSuccess(['tasks' => $tasks]);
    }

    public function listActivity(): void
    {
        try {
            $businessUnit = $_GET['business_unit'] ?? null;
            $sql = 'SELECT * FROM activity_logs';
            $params = [];
            
            if (!empty($businessUnit)) {
                $sql .= ' WHERE business_unit = :business_unit';
                $params[':business_unit'] = $businessUnit;
            }
            
            $sql .= ' ORDER BY created_at DESC LIMIT 50';
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute($params);
            $events = $stmt->fetchAll(PDO::FETCH_ASSOC);
            Utils::sendSuccess(['events' => $events]);
        } catch (Throwable $e) {
            Utils::sendSuccess(['events' => []]);
        }
    }
}
