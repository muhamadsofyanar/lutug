<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/core/Utils.php';
require_once dirname(__DIR__) . '/core/AppHelper.php';
require_once dirname(__DIR__) . '/core/GamificationEngine.php';
require_once dirname(__DIR__) . '/core/AuditLogger.php';
require_once dirname(__DIR__) . '/services/TaskService.php';

class TaskController
{
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    public function listToday(): void
    {
        $date = isset($_GET['date']) && is_string($_GET['date']) && $_GET['date'] !== '' ? $_GET['date'] : Utils::todayDate();
        $userId = $_SESSION['user_id'] ?? null;
        $username = $_SESSION['username'] ?? null;
        $businessUnit = $_GET['business_unit'] ?? null;
        
        // Use IN clause for status to include both pending and in_progress
        $sql = "SELECT id, date, slot, title, status, assigned_to, created_by, energy_level, context_tags, business_unit, importance, urgency, linked_references, recurrence_pattern, next_due_date, (SELECT author FROM task_comments WHERE task_id = tasks.id ORDER BY created_at DESC LIMIT 1) AS last_actor, created_at FROM tasks WHERE date = :date AND status IN ('pending', 'in_progress')";
        $params = [':date' => $date];
        
        $role = $_SESSION['role'] ?? 'member';
        
        if ($userId && $role !== 'admin') {
            $sql .= " AND (assigned_to = :username OR (assigned_to = 'Saya' AND created_by = :user_id) OR created_by IS NULL)";
            $params[':user_id'] = $userId;
            $params[':username'] = $username;
        } elseif (!$userId) {
            $sql .= " AND created_by IS NULL";
        }

        if (!empty($businessUnit)) {
            $sql .= " AND business_unit = :business_unit";
            $params[':business_unit'] = $businessUnit;
        }

        $sql .= " ORDER BY slot ASC";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        
        $tasks = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $totalDecisions = count($tasks);

        // Energy Advice Logic (Phase 5)
        $advice = null;
        if ($userId) {
             $stmtEnergy = $this->pdo->prepare("SELECT energy_level FROM daily_updates WHERE user_id = :user_id ORDER BY date DESC LIMIT 3");
             $stmtEnergy->execute([':user_id' => $userId]);
             $recentEnergy = $stmtEnergy->fetchAll(PDO::FETCH_COLUMN);
             
             if (count($recentEnergy) > 0) {
                 $avg = array_sum($recentEnergy) / count($recentEnergy);
                 if ($avg < 40) {
                    $advice = "⚠️ Baterai Lemah (Rata-rata " . round($avg) . "%). Fokus pada 1-2 tugas kritis saja.";
                } elseif ($avg > 80) {
                    $advice = "⚡ Energi Tinggi (Rata-rata " . round($avg) . "%). Hajar tugas tersulit!";
                } else {
                    $advice = "🔋 Energi Stabil (Rata-rata " . round($avg) . "%). Pertahankan ritme kerja.";
                }
             }
        }

        Utils::sendSuccess([
            'date' => $date,
            'tasks' => $tasks,
            'total_decisions' => $totalDecisions,
            'energy_advice' => $advice
        ]);
    }

    public function create(): void
    {
        $body = Utils::readJsonBody();
        $title = Utils::validateString($body, 'title', 255);
        if ($title === '') {
            Utils::sendError('Judul tugas wajib diisi', '', 400);
            return;
        }

        $userId = $_SESSION['user_id'] ?? null;
        $username = AppHelper::getCurrentUsername();
        $assignedTo = AppHelper::normalizeAssignedTo($body);
        
        $date = Utils::validateDate($body, 'date') ?? Utils::todayDate();
        $slot = Utils::validateString($body, 'slot', 20, 'unplanned');
        $businessUnit = Utils::validateString($body, 'businessUnit', 80, '');
        $energy = Utils::validateString($body, 'energyLevel', 20, 'medium');
        $tags = Utils::validateString($body, 'contextTags', 255, '');
        
        $now = Utils::now();
        
        $stmt = $this->pdo->prepare("INSERT INTO tasks (title, date, slot, status, assigned_to, created_by, created_at, updated_at, business_unit, energy_level, context_tags) VALUES (:title, :date, :slot, 'pending', :assigned_to, :created_by, :created_at, :updated_at, :business_unit, :energy, :tags)");
        
        $stmt->execute([
            ':title' => $title,
            ':date' => $date,
            ':slot' => $slot,
            ':assigned_to' => $assignedTo,
            ':created_by' => $userId,
            ':created_at' => $now,
            ':updated_at' => $now,
            ':business_unit' => $businessUnit,
            ':energy' => $energy,
            ':tags' => $tags
        ]);
        
        $id = (int)$this->pdo->lastInsertId();
        
        AppHelper::logActivity($this->pdo, 'task_create', 'task', $id, 'Membuat tugas manual: ' . $title, $assignedTo, $businessUnit);
        
        Utils::sendSuccess(['message' => 'Tugas berhasil dibuat', 'id' => $id]);
    }

    public function updateAttributes(): void
    {
        $body = Utils::readJsonBody();
        $taskId = Utils::validateInt($body, 'taskId');
        $energy = strip_tags(Utils::validateString($body, 'energy_level', 20, 'medium'));
        $context = strip_tags(Utils::validateString($body, 'context_tags', 255));
        $businessUnit = isset($body['business_unit']) ? strip_tags(Utils::validateString($body, 'business_unit', 80)) : null;
        $importance = isset($body['importance']) ? (int)$body['importance'] : null;
        $urgency = isset($body['urgency']) ? (int)$body['urgency'] : null;
        $linkedReferences = isset($body['linked_references']) ? json_encode($body['linked_references']) : null;
        $recurrencePattern = isset($body['recurrence_pattern']) ? strip_tags(Utils::validateString($body, 'recurrence_pattern', 50)) : null;
        $assignedTo = isset($body['assigned_to']) ? strip_tags(Utils::validateString($body, 'assigned_to', 80)) : null;
        
        if ($taskId === null) {
            Utils::sendError('taskId wajib diisi', '', 400);
            return;
        }

        $task = $this->getTaskIfAccessible($taskId);
        if (!$task) {
            Utils::sendError('Tugas tidak ditemukan atau akses ditolak', '', 404);
            return;
        }

        // Only update fields that are present in the request (partial update support)
        
        $fields = [];
        $params = [':id' => $taskId];

        if (isset($body['energy_level'])) {
            $fields[] = "energy_level = :energy";
            $params[':energy'] = $energy;
        }
        if (isset($body['context_tags'])) {
            $fields[] = "context_tags = :context";
            $params[':context'] = $context;
        }
        if (array_key_exists('business_unit', $body)) {
             $fields[] = "business_unit = :bu";
             $params[':bu'] = $businessUnit;
        }
        if (isset($body['importance'])) {
            $fields[] = "importance = :imp";
            $params[':imp'] = $importance;
        }
        if (isset($body['urgency'])) {
            $fields[] = "urgency = :urg";
            $params[':urg'] = $urgency;
        }
        if (isset($body['linked_references'])) {
            $fields[] = "linked_references = :refs";
            $params[':refs'] = $linkedReferences;
        }
        if (array_key_exists('recurrence_pattern', $body)) {
            $fields[] = "recurrence_pattern = :recurrence";
            $params[':recurrence'] = $recurrencePattern;
        }
        if (array_key_exists('assigned_to', $body)) {
            $fields[] = "assigned_to = :assigned";
            $params[':assigned'] = $assignedTo;
        }
        if (isset($body['status'])) {
             $validStatuses = ['pending', 'in_progress', 'done', 'terminated']; 
             if (in_array($body['status'], $validStatuses)) {
                 $fields[] = "status = :status";
                 $params[':status'] = $body['status'];
                 if ($body['status'] === 'pending' || $body['status'] === 'in_progress') {
                      $fields[] = "completed_at = NULL";
                 }
             }
        }

        if (empty($fields)) {
             Utils::sendSuccess(['message' => 'Tidak ada perubahan yang diberikan']);
             return;
        }

        $sql = "UPDATE tasks SET " . implode(', ', $fields) . " WHERE id = :id";
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);

        AuditLogger::log('TASK_UPDATE', 'task', $taskId, $fields);

        Utils::sendSuccess(['result' => 'updated']);
    }

    public function energyAudit(): void
    {
        $userId = $_SESSION['user_id'] ?? null;
        $days = isset($_GET['days']) ? (int)$_GET['days'] : 7;
        
        // Ensure date range is reasonable
        if ($days < 1) $days = 7;
        if ($days > 30) $days = 30;

        $driver = $this->pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
        $dateCondition = "";
        
        if ($driver === 'sqlite') {
            // SQLite: datetime('now', '-7 days')
            $dateCondition = "completed_at >= datetime('now', '-' || :days || ' days')";
        } else {
            // MySQL: DATE_SUB(NOW(), INTERVAL 7 DAY)
            $dateCondition = "completed_at >= DATE_SUB(NOW(), INTERVAL :days DAY)";
        }

        // Base query
        $sql = "SELECT 
                    DATE(completed_at) as audit_date, 
                    energy_level, 
                    COUNT(*) as task_count 
                FROM tasks 
                WHERE 
                    status = 'done' 
                    AND $dateCondition
                ";
        
        $params = [':days' => $days];

        // Filter by user if logged in
        if ($userId) {
            $sql .= " AND (assigned_to = :username OR created_by = :user_id OR created_by IS NULL)";
            $params[':username'] = $_SESSION['username'] ?? '';
            $params[':user_id'] = $userId;
        }

        $sql .= " GROUP BY audit_date, energy_level ORDER BY audit_date ASC";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

        Utils::sendSuccess(['audit_data' => $data]);
    }

    public function complete(): void
    {
        $body = Utils::readJsonBody();
        $taskId = Utils::validateInt($body, 'taskId');
        $reason = Utils::validateString($body, 'reason', 1000);
        
        if ($taskId === null) {
            Utils::sendError('taskId wajib diisi dan harus berupa angka', '', 400);
            return;
        }

        $currentUser = AppHelper::getCurrentUsername();
        $actor = Utils::validateString($body, 'actor', 80, $currentUser);
        if ($actor === '') {
             $actor = $currentUser;
        }

        $userId = $_SESSION['user_id'] ?? null;
        
        $taskInfo = $this->getTaskIfAccessible($taskId);
        if (!$taskInfo) {
            Utils::sendError('Tugas tidak ditemukan atau akses ditolak', '', 403);
            return;
        }
        $businessUnit = $taskInfo['business_unit'] ?? null;

        $now = Utils::now();

        $stmt = $this->pdo->prepare('UPDATE tasks SET status = :status, completed_at = :completed_at WHERE id = :id');
        $stmt->execute([
            ':status' => 'done',
            ':completed_at' => $now,
            ':id' => $taskId
        ]);
        // $now is already defined above
        $commentContent = $reason !== '' ? "Selesai. Alasan: " . $reason : 'Tugas ditandai selesai.';
        
        $insertComment = $this->pdo->prepare('INSERT INTO task_comments (task_id, content, author, created_at) VALUES (:task_id, :content, :author, :created_at)');
        $insertComment->execute([
            ':task_id' => $taskId,
            ':content' => $commentContent,
            ':author' => $actor,
            ':created_at' => $now,
        ]);
        AppHelper::logActivity($this->pdo, 'task_complete', 'task', $taskId, $commentContent, $actor, $businessUnit);
        
        // Gamification: Add XP
        $xpInfo = null;
        if ($userId) {
             $gamification = new GamificationEngine($this->pdo);
             $xpInfo = $gamification->addXp($userId, 10);
             
             // Check task completion badges (e.g. First Blood)
             $taskBadges = $gamification->checkBadges($userId, 'task_completion', []);
             if (!empty($taskBadges)) {
                 if (!isset($xpInfo['new_badges'])) $xpInfo['new_badges'] = [];
                 $xpInfo['new_badges'] = array_merge($xpInfo['new_badges'], $taskBadges);
             }
        }

        // Handle Recurrence
        TaskService::handleCompletionRecurrence($this->pdo, $taskId);

        Utils::sendSuccess(['result' => 'completed', 'xp' => $xpInfo]);
    }

    public function terminate(): void
    {
        $body = Utils::readJsonBody();
        $taskId = Utils::validateInt($body, 'taskId');
        $reason = Utils::validateString($body, 'reason', 1000);
        
        if ($taskId === null) {
            Utils::sendError('taskId wajib diisi', '', 400);
            return;
        }

        $currentUser = AppHelper::getCurrentUsername();
        $actor = Utils::validateString($body, 'actor', 80, $currentUser);
        if ($actor === '') $actor = $currentUser;

        $taskInfo = $this->getTaskIfAccessible($taskId);
        if (!$taskInfo) {
            Utils::sendError('Akses ditolak atau tugas tidak ditemukan', '', 403);
            return;
        }
        $businessUnit = $taskInfo['business_unit'] ?? null;

        $stmt = $this->pdo->prepare('UPDATE tasks SET status = :status WHERE id = :id');
        $stmt->execute([
            ':status' => 'cancelled',
            ':id' => $taskId
        ]);

        $now = Utils::now();
        $commentContent = $reason !== '' ? "Dibatalkan: " . $reason : 'Tugas dibatalkan.';
        
        $insertComment = $this->pdo->prepare('INSERT INTO task_comments (task_id, content, author, created_at) VALUES (:task_id, :content, :author, :created_at)');
        $insertComment->execute([
            ':task_id' => $taskId,
            ':content' => $commentContent,
            ':author' => $actor,
            ':created_at' => $now,
        ]);

        AppHelper::logActivity($this->pdo, 'task_terminate', 'task', $taskId, $commentContent, $actor, $businessUnit);
        AuditLogger::log('TASK_TERMINATE', 'task', $taskId, ['reason' => $reason]);
        Utils::sendSuccess(['result' => 'terminated']);
    }

    public function listComments(): void
    {
        $taskId = isset($_GET['taskId']) ? (int)$_GET['taskId'] : 0;
        if ($taskId <= 0) {
            Utils::sendSuccess(['comments' => []]);
            return;
        }

        if (!$this->getTaskIfAccessible($taskId)) {
            Utils::sendError('Tugas tidak ditemukan atau akses ditolak', '', 404);
            return;
        }

        $stmt = $this->pdo->prepare('SELECT * FROM task_comments WHERE task_id = :task_id ORDER BY created_at ASC');
        $stmt->execute([':task_id' => $taskId]);
        $comments = $stmt->fetchAll(PDO::FETCH_ASSOC);
        Utils::sendSuccess(['comments' => $comments]);
    }

    public function addComment(): void
    {
        $body = Utils::readJsonBody();
        $taskId = Utils::validateInt($body, 'taskId');
        $content = strip_tags(Utils::validateString($body, 'content', 1000));
        $author = strip_tags(Utils::validateString($body, 'author', 80, AppHelper::getCurrentUsername()));

        if ($taskId === null || $content === '') {
            Utils::sendError('Data tidak lengkap', '', 400);
            return;
        }

        if (!$this->getTaskIfAccessible($taskId)) {
            Utils::sendError('Tugas tidak ditemukan atau akses ditolak', '', 404);
            return;
        }

        if ($author === '') $author = AppHelper::getCurrentUsername();
        if ($content === '') {
            Utils::sendError('Komentar tidak boleh kosong', '', 400);
            return;
        }
        $now = Utils::now();
        $stmt = $this->pdo->prepare('INSERT INTO task_comments (task_id, content, author, created_at) VALUES (:task_id, :content, :author, :created_at)');
        $stmt->execute([
            ':task_id' => $taskId,
            ':content' => $content,
            ':author' => $author,
            ':created_at' => $now,
        ]);
        $id = (int)$this->pdo->lastInsertId();
        Utils::sendSuccess([
            'comment' => [
                'id' => $id,
                'task_id' => $taskId,
                'content' => $content,
                'author' => $author,
                'created_at' => $now,
            ],
        ], '', 201);
    }

    private function getTaskIfAccessible(int $taskId): ?array
    {
        $userId = $_SESSION['user_id'] ?? null;
        $username = AppHelper::getCurrentUsername();
        $role = $_SESSION['role'] ?? 'member';
        
        // 1. Get Task Metadata
        $stmt = $this->pdo->prepare('SELECT * FROM tasks WHERE id = :id');
        $stmt->execute([':id' => $taskId]);
        $task = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$task) return null;

        // Admin Override: Access Everything
        if ($role === 'admin') {
            return $task;
        }

        // 2. Check Project Level Access (if attached to project)
        if (!empty($task['project_id'])) {
             $stmtProj = $this->pdo->prepare("SELECT business_unit, visibility, created_by FROM projects WHERE id = :id");
             $stmtProj->execute([':id' => $task['project_id']]);
             $project = $stmtProj->fetch(PDO::FETCH_ASSOC);

             if ($project) {
                 $role = $_SESSION['role'] ?? 'member';
                 $assignedUnits = $_SESSION['assigned_units'] ?? [];
                 if (empty($assignedUnits) && !empty($_SESSION['business_unit'])) {
                     $assignedUnits[] = $_SESSION['business_unit'];
                 }
                 
                 if (AppHelper::canAccessProject($project, $userId, $role, $assignedUnits)) {
                     return $task;
                 }
             }
        }

        // 3. Fallback to Task Level Access
        if ($userId) {
            // Manager Override for Unit tasks
            if (($_SESSION['role'] ?? '') === 'manager') {
                 $assignedUnits = $_SESSION['assigned_units'] ?? [];
                 if (empty($assignedUnits) && !empty($_SESSION['business_unit'])) {
                     $assignedUnits[] = $_SESSION['business_unit'];
                 }
                 if (!empty($task['business_unit']) && in_array($task['business_unit'], $assignedUnits)) {
                     return $task;
                 }
            }

            // Check ownership, assignment, or legacy/public status
            if ($task['created_by'] == $userId) return $task;
            if ($task['assigned_to'] === $username) return $task;
            if ($task['created_by'] === null) return $task;
        } else {
            // Guest only sees public/legacy tasks
            if ($task['created_by'] === null) return $task;
        }
        
        return null;
    }
}
