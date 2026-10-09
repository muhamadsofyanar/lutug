<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/core/Utils.php';
require_once dirname(__DIR__) . '/core/AppHelper.php';
require_once dirname(__DIR__) . '/services/TaskService.php';
require_once dirname(__DIR__) . '/core/AuditLogger.php';

class ProjectController
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
        $assignedUnits = $_SESSION['assigned_units'] ?? [];
        // Fallback to single unit if assigned_units is empty but business_unit is set
        if (empty($assignedUnits) && !empty($_SESSION['business_unit'])) {
            $assignedUnits[] = $_SESSION['business_unit'];
        }

        if ($userId) {
            if ($role === 'admin') {
                $sql = "SELECT * FROM projects ORDER BY created_at DESC";
                $stmt = $this->pdo->prepare($sql);
                $stmt->execute();
            } else {
                $sql = "SELECT * FROM projects WHERE 
                        (created_by = :user_id) 
                        OR (visibility = 'public') 
                        OR (created_by IS NULL)
                       ";
                $params = [':user_id' => $userId];

                if (!empty($assignedUnits)) {
                    $placeholders = [];
                    foreach ($assignedUnits as $i => $u) {
                        $key = ":bu_$i";
                        $placeholders[] = $key;
                        $params[$key] = $u;
                    }
                    $inClause = implode(',', $placeholders);
                    $sql .= " OR (visibility = 'team' AND business_unit IN ($inClause)) ";
                }
                
                $sql .= " ORDER BY created_at DESC";
                $stmt = $this->pdo->prepare($sql);
                $stmt->execute($params);
            }
        } else {
            $stmt = $this->pdo->query("SELECT * FROM projects WHERE created_by IS NULL OR visibility = 'public' ORDER BY created_at DESC");
        }
        $projects = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Oracle Analysis (Phase 11)
        if (!empty($projects)) {
            $projectIds = array_column($projects, 'id');
            $inQuery = implode(',', array_fill(0, count($projectIds), '?'));
            
            // Get Task Stats
            $fourteenDaysAgo = date('Y-m-d H:i:s', strtotime('-14 days'));
            $sqlStats = "SELECT 
                            project_id,
                            SUM(CASE WHEN status = 'completed' AND completed_at >= ? THEN 1 ELSE 0 END) as recent_completed,
                            SUM(CASE WHEN status != 'completed' THEN 1 ELSE 0 END) as remaining
                         FROM tasks 
                         WHERE project_id IN ($inQuery)
                         GROUP BY project_id";
            
            $stmtStats = $this->pdo->prepare($sqlStats);
            // Prepend date parameter to project IDs array
            $executionParams = array_merge([$fourteenDaysAgo], $projectIds);
            $stmtStats->execute($executionParams);
            $statsMap = [];
            while ($row = $stmtStats->fetch(PDO::FETCH_ASSOC)) {
                $statsMap[$row['project_id']] = $row;
            }

            $now = new DateTime();
            foreach ($projects as &$project) {
                $pid = $project['id'];
                $stats = $statsMap[$pid] ?? ['recent_completed' => 0, 'remaining' => 0];
                
                $velocityPerDay = $stats['recent_completed'] / 14; // Simple moving average
                $remaining = $stats['remaining'];
                
                // Stagnation Logic
                $updatedAt = new DateTime($project['updated_at'] ?? $project['created_at']);
                $diff = $now->diff($updatedAt);
                $daysInactive = $diff->days;
                $project['is_stagnant'] = ($daysInactive > 7 && in_array($project['status'], ['active', 'waiting']));
                $project['days_inactive'] = $daysInactive;

                // Oracle Prediction
                $oracle = [
                    'status' => 'unknown', 
                    'message' => 'Data tidak cukup',
                    'color' => 'slate',
                    'velocity' => round($velocityPerDay * 7, 1), // Tasks per week
                    'estimated_days' => null
                ];

                if ($project['status'] === 'completed') {
                    $oracle = ['status' => 'success', 'message' => 'Proyek Selesai', 'color' => 'emerald', 'velocity' => 0, 'estimated_days' => 0];
                } elseif ($remaining == 0) {
                     $oracle = ['status' => 'success', 'message' => 'Tidak ada tugas tersisa', 'color' => 'emerald', 'velocity' => 0, 'estimated_days' => 0];
                } elseif ($velocityPerDay > 0) {
                    $daysToComplete = ceil($remaining / $velocityPerDay);
                    $oracle['estimated_days'] = $daysToComplete;
                    
                    if ($daysToComplete < 7) {
                        $oracle['status'] = 'optimal';
                        $oracle['message'] = "Selesai dalam ±$daysToComplete hari";
                        $oracle['color'] = 'cyan';
                    } elseif ($daysToComplete < 30) {
                        $oracle['status'] = 'good';
                        $oracle['message'] = "Selesai dalam ±$daysToComplete hari";
                        $oracle['color'] = 'emerald';
                    } else {
                        $oracle['status'] = 'slow';
                        $oracle['message'] = "Lambat (±$daysToComplete hari)";
                        $oracle['color'] = 'yellow';
                    }
                } else {
                    // Velocity 0 but tasks remain
                    $oracle['status'] = 'stalled';
                    $oracle['message'] = 'Macet (Velocity 0)';
                    $oracle['color'] = 'red';
                }

                if ($project['is_stagnant']) {
                    $oracle['status'] = 'stagnant';
                    $oracle['message'] = 'STAGNAN (>7 hari tanpa update)';
                    $oracle['color'] = 'red';
                }

                $project['oracle'] = $oracle;
                $project['stats'] = $stats;
            }
            unset($project);
        } else {
             // Handle empty projects case if needed, but loop won't run so it's fine
        }

        Utils::sendSuccess(['projects' => $projects]);
    }

    public function create(): void
    {
        $body = Utils::readJsonBody();
        $title = Utils::validateString($body, 'title', 160);
        $businessUnit = Utils::validateString($body, 'businessUnit', 80, '');
        $nextAction = Utils::validateString($body, 'nextAction', 160);
        $visibility = Utils::validateString($body, 'visibility', 20, 'private');
        
        if (!in_array($visibility, ['private', 'team', 'public'])) {
            $visibility = 'private';
        }
        
        if ($title === '') {
            Utils::sendError('Judul project tidak boleh kosong', '', 400);
            return;
        }
        $now = Utils::now();
        $status = $nextAction === '' ? 'waiting' : 'active';
        $userId = $_SESSION['user_id'] ?? null;
        $stmt = $this->pdo->prepare('INSERT INTO projects (title, status, next_action, business_unit, visibility, created_at, updated_at, created_by) VALUES (:title, :status, :next_action, :business_unit, :visibility, :created_at, :updated_at, :created_by)');
        $stmt->execute([
            ':title' => $title,
            ':status' => $status,
            ':next_action' => $nextAction === '' ? null : $nextAction,
            ':business_unit' => $businessUnit === '' ? null : $businessUnit,
            ':visibility' => $visibility,
            ':created_at' => $now,
            ':updated_at' => $now,
            ':created_by' => $userId,
        ]);
        $id = (int)$this->pdo->lastInsertId();
        AppHelper::logActivity($this->pdo, 'project_create', 'project', $id, 'Membuat project manual: ' . $title, null, $businessUnit === '' ? null : $businessUnit);
        
        AuditLogger::log('PROJECT_CREATE', 'project', $id, ['title' => $title, 'business_unit' => $businessUnit, 'visibility' => $visibility]);

        Utils::sendSuccess([
            'project' => [
                'id' => $id,
                'title' => $title,
                'status' => $status,
                'next_action' => $nextAction === '' ? null : $nextAction,
                'business_unit' => $businessUnit === '' ? null : $businessUnit,
                'visibility' => $visibility,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            'message' => 'Project berhasil dibuat'
        ], '', 201);
    }

    public function update(): void
    {
        $body = Utils::readJsonBody();
        $projectId = Utils::validateInt($body, 'id');
        
        if ($projectId === null) {
            Utils::sendError('ID project wajib diisi', '', 400);
            return;
        }

        $this->ensureProjectAccess($projectId, $_SESSION['user_id'] ?? null);

        // Fetch current business_unit
        $stmtProj = $this->pdo->prepare("SELECT business_unit FROM projects WHERE id = :id");
        $stmtProj->execute([':id' => $projectId]);
        $currentProj = $stmtProj->fetch(PDO::FETCH_ASSOC);
        $currentBusinessUnit = $currentProj['business_unit'] ?? null;

        $title = isset($body['title']) ? Utils::validateString($body, 'title', 160) : null;
        $status = isset($body['status']) ? Utils::validateString($body, 'status', 20) : null;
        $businessUnit = isset($body['businessUnit']) ? Utils::validateString($body, 'businessUnit', 80) : null;
        $visibility = isset($body['visibility']) ? Utils::validateString($body, 'visibility', 20) : null;
        
        $fields = [];
        $params = [':id' => $projectId];
        $now = Utils::now();

        if ($title !== null && $title !== '') {
            $fields[] = "title = :title";
            $params[':title'] = $title;
        }
        if ($status !== null && in_array($status, ['active', 'waiting', 'completed', 'archived', 'someday', 'terminated'])) {
            $fields[] = "status = :status";
            $params[':status'] = $status;
        }
        if ($businessUnit !== null) {
            $fields[] = "business_unit = :business_unit";
            $params[':business_unit'] = $businessUnit;
        }
        if ($visibility !== null && in_array($visibility, ['private', 'team', 'public'])) {
            $fields[] = "visibility = :visibility";
            $params[':visibility'] = $visibility;
        }

        if (empty($fields)) {
            Utils::sendSuccess(['message' => 'Tidak ada perubahan']);
            return;
        }

        $fields[] = "updated_at = :updated_at";
        $params[':updated_at'] = $now;

        $sql = "UPDATE projects SET " . implode(', ', $fields) . " WHERE id = :id";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);

        AppHelper::logActivity($this->pdo, 'project_update', 'project', $projectId, 'Memperbarui detail proyek', null, $businessUnit ?? $currentBusinessUnit);
        Utils::sendSuccess(['result' => 'updated', 'message' => 'Project diperbarui']);
    }

    public function setNextAction(): void
    {
        $body = Utils::readJsonBody();
        $projectId = Utils::validateInt($body, 'projectId');
        $nextAction = strip_tags(Utils::validateString($body, 'nextAction', 160));

        if ($projectId === null || $nextAction === '') {
            Utils::sendError('Data tidak lengkap atau next action kosong', '', 400);
            return;
        }
        
        // Verify project exists
        $userId = $_SESSION['user_id'] ?? null;
        $this->ensureProjectAccess($projectId, $userId);

        // Fetch business unit
        $stmtProj = $this->pdo->prepare("SELECT business_unit FROM projects WHERE id = :id");
        $stmtProj->execute([':id' => $projectId]);
        $proj = $stmtProj->fetch(PDO::FETCH_ASSOC);
        $businessUnit = $proj['business_unit'] ?? null;
        
        $now = Utils::now();
        $stmt = $this->pdo->prepare("UPDATE projects SET next_action = :next_action, status = 'active', updated_at = :updated_at WHERE id = :id");
        $stmt->execute([
            ':next_action' => $nextAction,
            ':updated_at' => $now,
            ':id' => $projectId,
        ]);
        AppHelper::logActivity($this->pdo, 'project_next_action', 'project', $projectId, 'Memperbarui aksi selanjutnya: ' . $nextAction, null, $businessUnit);
        Utils::sendSuccess(['result' => 'updated', 'message' => 'Next action diperbarui']);
    }

    public function scheduleNextAction(): void
    {
        $body = Utils::readJsonBody();
        $projectId = Utils::validateInt($body, 'projectId');
        $nextAction = Utils::validateString($body, 'nextAction', 160);

        if ($projectId === null || $nextAction === '') {
            Utils::sendError('Data tidak lengkap atau next action kosong', '', 400);
            return;
        }
        
        // Verify project exists
        $userId = $_SESSION['user_id'] ?? null;
        $this->ensureProjectAccess($projectId, $userId);

        // Fetch business unit
        $stmtProj = $this->pdo->prepare("SELECT business_unit FROM projects WHERE id = :id");
        $stmtProj->execute([':id' => $projectId]);
        $proj = $stmtProj->fetch(PDO::FETCH_ASSOC);
        $businessUnit = $proj['business_unit'] ?? null;

        $assignedTo = AppHelper::normalizeAssignedTo($body);
        $maxTasksPerDay = null;
        if (isset($body['maxTasksPerDay'])) {
            $raw = $body['maxTasksPerDay'];
            if (is_string($raw) && $raw === 'unlimited') {
                $maxTasksPerDay = 0;
            } elseif (is_int($raw) || is_float($raw) || (is_string($raw) && is_numeric($raw))) {
                $maxTasksPerDay = (int)$raw;
            }
        }

        try {
            $this->pdo->beginTransaction();

            $task = null;
            $userId = $_SESSION['user_id'] ?? null;
            if (!TaskService::tryScheduleToday($this->pdo, $nextAction, $task, $assignedTo, $maxTasksPerDay, $userId, null, $projectId)) {
                $this->pdo->rollBack();
                Utils::sendSuccess([
                    'error' => 'Hari ini sudah cukup penuh.',
                    'code' => 'TODAY_FULL',
                ]);
                return;
            }

            $now = Utils::now();
            $stmt = $this->pdo->prepare("UPDATE projects SET next_action = NULL, status = 'waiting', updated_at = :updated_at WHERE id = :id");
            $stmt->execute([
                ':updated_at' => $now,
                ':id' => $projectId,
            ]);

            if (is_array($task) && isset($task['id'])) {
                $insertComment = $this->pdo->prepare('INSERT INTO task_comments (task_id, content, author, created_at) VALUES (:task_id, :content, :author, :created_at)');
                $insertComment->execute([
                    ':task_id' => (int)$task['id'],
                    ':content' => 'Tugas berasal dari project #' . $projectId,
                    ':author' => $assignedTo,
                    ':created_at' => $now,
                ]);
                AppHelper::logActivity($this->pdo, 'project_schedule', 'project', $projectId, 'Menjadwalkan next action: ' . $nextAction, $assignedTo, $businessUnit);
            }

            $this->pdo->commit();
            Utils::sendSuccess(['result' => 'scheduled', 'task' => $task, 'message' => 'Next action dijadwalkan']);
        } catch (Throwable $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            Utils::sendError('Terjadi Kesalahan Server: ' . $e->getMessage(), '', 500);
        }
    }

    public function terminate(): void
    {
        $body = Utils::readJsonBody();
        $projectId = Utils::validateInt($body, 'projectId');
        $reason = Utils::validateString($body, 'reason', 1000);
        
        if ($projectId === null) {
            Utils::sendError('ID project wajib diisi', '', 400);
            return;
        }

        // Strict Permission Check for Terminate
        $userId = $_SESSION['user_id'] ?? null;
        $role = $_SESSION['role'] ?? 'member';
        $assignedUnits = $_SESSION['assigned_units'] ?? [];
        if (empty($assignedUnits) && !empty($_SESSION['business_unit'])) {
            $assignedUnits[] = $_SESSION['business_unit'];
        }

        // Fetch project details
        $stmtProj = $this->pdo->prepare("SELECT business_unit, title, created_by FROM projects WHERE id = :id");
        $stmtProj->execute([':id' => $projectId]);
        $proj = $stmtProj->fetch(PDO::FETCH_ASSOC);
        
        if (!$proj) {
            Utils::sendError('Project tidak ditemukan', '', 404);
            return;
        }

        $businessUnit = $proj['business_unit'] ?? null;
        $title = $proj['title'] ?? 'Unknown Project';

        $canTerminate = false;
        if ($role === 'admin') {
            $canTerminate = true;
        } elseif (!empty($assignedUnits) && in_array($businessUnit, $assignedUnits)) {
            $canTerminate = true;
        }

        if (!$canTerminate) {
            Utils::sendError('Akses ditolak untuk terminasi project ini', '', 403);
            return;
        }

        $now = Utils::now();
        $stmt = $this->pdo->prepare("UPDATE projects SET status = 'terminated', updated_at = :updated_at WHERE id = :id");
        $stmt->execute([':updated_at' => $now, ':id' => $projectId]);

        AppHelper::logActivity($this->pdo, 'project_terminate', 'project', $projectId, 'Terminasi project: ' . $reason, null, $businessUnit);
        AuditLogger::log('PROJECT_TERMINATE', 'project', $projectId, ['reason' => $reason]);

        Utils::sendSuccess(['result' => 'terminated', 'message' => 'Project dihentikan']);
    }

    public function getTasks(): void
    {
        $projectId = isset($_GET['projectId']) ? (int)$_GET['projectId'] : null;
        if (!$projectId) {
            Utils::sendError('Project ID wajib diisi', '', 400);
            return;
        }

        $this->ensureProjectAccess($projectId, $_SESSION['user_id'] ?? null);

        // Fetch all tasks for this project
        $stmt = $this->pdo->prepare("
            SELECT t.*, 
                   (SELECT author FROM task_comments WHERE task_id = t.id ORDER BY created_at DESC LIMIT 1) as last_actor
            FROM tasks t 
            WHERE t.project_id = :project_id 
            ORDER BY t.date ASC, t.created_at DESC
        ");
        $stmt->execute([':project_id' => $projectId]);
        $tasks = $stmt->fetchAll(PDO::FETCH_ASSOC);

        Utils::sendSuccess(['tasks' => $tasks]);
    }

    public function delete(): void
    {
        $body = Utils::readJsonBody();
        if (!isset($body['projectId'])) {
            Utils::sendError('ID project wajib diisi', '', 400);
            return;
        }
        $projectId = (int)$body['projectId'];
        
        // Strict Permission Check for Delete
        $userId = $_SESSION['user_id'] ?? null;
        $role = $_SESSION['role'] ?? 'member';
        $assignedUnits = $_SESSION['assigned_units'] ?? [];
        if (empty($assignedUnits) && !empty($_SESSION['business_unit'])) {
            $assignedUnits[] = $_SESSION['business_unit'];
        }

        // Fetch project details
        $stmtProj = $this->pdo->prepare("SELECT business_unit, created_by FROM projects WHERE id = :id");
        $stmtProj->execute([':id' => $projectId]);
        $proj = $stmtProj->fetch(PDO::FETCH_ASSOC);
        
        if (!$proj) {
            Utils::sendError('Project tidak ditemukan', '', 404);
            return;
        }

        $businessUnit = $proj['business_unit'] ?? null;

        $canDelete = false;
        if ($role === 'admin') {
            $canDelete = true;
        } else {
            $isOwner = ($proj['created_by'] == $userId) || $proj['created_by'] === null;
            $inUnit = ($businessUnit && in_array($businessUnit, $assignedUnits));

            if ($role === 'manager') {
                // Manager: Can delete if Owner OR in Unit
                if ($isOwner || $inUnit) $canDelete = true;
            } else {
                // Member: Can delete ONLY if Owner
                if ($isOwner) $canDelete = true;
            }
        }

        if (!$canDelete) {
            Utils::sendError('Akses ditolak: Hanya Manager yang bisa menghapus project orang lain.', '', 403);
            return;
        }

        try {
            $this->pdo->beginTransaction();

            // Delete steps first
            $stmtSteps = $this->pdo->prepare('DELETE FROM project_steps WHERE project_id = :id');
            $stmtSteps->execute([':id' => $projectId]);

            // Delete project
            $stmt = $this->pdo->prepare('DELETE FROM projects WHERE id = :id');
            $stmt->execute([':id' => $projectId]);

            AppHelper::logActivity($this->pdo, 'project_delete', 'project', $projectId, 'Menghapus project', null, $businessUnit);
            AuditLogger::log('PROJECT_DELETE', 'project', $projectId, ['title' => $proj['title'] ?? 'Unknown']);
            
            $this->pdo->commit();
            Utils::sendSuccess(['result' => 'deleted', 'message' => 'Project dihapus']);
        } catch (Throwable $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            Utils::sendError('Terjadi Kesalahan Server: ' . $e->getMessage(), '', 500);
        }
    }

    public function listSteps(): void
    {
        $projectId = isset($_GET['projectId']) ? (int)$_GET['projectId'] : 0;
        if ($projectId > 0) {
            $stmt = $this->pdo->prepare('SELECT id, title FROM project_steps WHERE project_id = :pid ORDER BY step_order ASC, created_at ASC');
            $stmt->execute([':pid' => $projectId]);
            $steps = $stmt->fetchAll(PDO::FETCH_ASSOC);
            Utils::sendSuccess(['steps' => $steps]);
        } else {
            $stmt = $this->pdo->prepare('SELECT id, project_id, title FROM project_steps ORDER BY project_id ASC, step_order ASC, created_at ASC');
            $stmt->execute();
            $steps = $stmt->fetchAll(PDO::FETCH_ASSOC);
            Utils::sendSuccess(['steps' => $steps]);
        }
    }

    public function addStep(): void
    {
        $body = Utils::readJsonBody();
        if (!isset($body['projectId']) || !isset($body['title'])) {
            Utils::sendError('Data tidak lengkap', '', 400);
            return;
        }
        $projectId = (int)$body['projectId'];
        $this->ensureProjectAccess($projectId, $_SESSION['user_id'] ?? null);
        
        // Fetch business unit
        $stmtProj = $this->pdo->prepare("SELECT business_unit FROM projects WHERE id = :id");
        $stmtProj->execute([':id' => $projectId]);
        $proj = $stmtProj->fetch(PDO::FETCH_ASSOC);
        $businessUnit = $proj['business_unit'] ?? null;

        $title = trim($body['title']);
        if ($title === '') {
            Utils::sendError('Judul langkah tidak boleh kosong', '', 400);
            return;
        }
        $stmt = $this->pdo->prepare('SELECT MAX(step_order) as max_order FROM project_steps WHERE project_id = :pid');
        $stmt->execute([':pid' => $projectId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $nextOrder = ($row && isset($row['max_order'])) ? (int)$row['max_order'] + 1 : 1;
        
        $insert = $this->pdo->prepare('INSERT INTO project_steps (project_id, step_order, title, created_at) VALUES (:pid, :ord, :title, :created_at)');
        $insert->execute([
            ':pid' => $projectId,
            ':ord' => $nextOrder,
            ':title' => $title,
            ':created_at' => Utils::now()
        ]);
        
        AppHelper::logActivity($this->pdo, 'project_step_add', 'project', $projectId, 'Menambah langkah project: ' . $title, null, $businessUnit);
        Utils::sendSuccess(['result' => 'created', 'id' => $this->pdo->lastInsertId(), 'message' => 'Langkah ditambahkan']);
    }

    public function promoteStep(): void
    {
        $body = Utils::readJsonBody();
        if (!isset($body['stepId'])) {
            Utils::sendError('ID langkah wajib diisi', '', 400);
            return;
        }
        $stepId = (int)$body['stepId'];
        $stmt = $this->pdo->prepare('SELECT project_id, title FROM project_steps WHERE id = :id');
        $stmt->execute([':id' => $stepId]);
        $step = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$step) {
            Utils::sendError('Langkah tidak ditemukan', '', 404);
            return;
        }

        $projectId = (int)$step['project_id'];
        $title = $step['title'];
        
        $this->ensureProjectAccess($projectId, $_SESSION['user_id'] ?? null);

        // Fetch business unit
        $stmtProj = $this->pdo->prepare("SELECT business_unit FROM projects WHERE id = :id");
        $stmtProj->execute([':id' => $projectId]);
        $proj = $stmtProj->fetch(PDO::FETCH_ASSOC);
        $businessUnit = $proj['business_unit'] ?? null;
        
        $assignedTo = AppHelper::getCurrentUsername(); // Default to current user for promotion
        
        try {
            $this->pdo->beginTransaction();
            
            $task = null;
            $userId = $_SESSION['user_id'] ?? null;
            
            // Try schedule today
            if (!TaskService::tryScheduleToday($this->pdo, $title, $task, $assignedTo, null, $userId, $businessUnit, $projectId)) {
                $this->pdo->rollBack();
                Utils::sendSuccess([
                    'error' => 'Hari ini sudah penuh (Max 20 tugas).',
                    'code' => 'TODAY_FULL'
                ]);
                return;
            }
            
            // Delete the step since it's promoted
            $del = $this->pdo->prepare('DELETE FROM project_steps WHERE id = :id');
            $del->execute([':id' => $stepId]);
            
            // Log activity
            AppHelper::logActivity($this->pdo, 'project_step_promote', 'project', $projectId, 'Mempromosikan langkah ke Hari Ini: ' . $title, $assignedTo, $businessUnit);
            
            $this->pdo->commit();
            Utils::sendSuccess(['result' => 'promoted', 'task' => $task, 'message' => 'Langkah dipromosikan']);
        } catch (Throwable $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            Utils::sendError('Terjadi Kesalahan Server: ' . $e->getMessage(), '', 500);
        }
    }

    public function deleteStep(): void
    {
        $body = Utils::readJsonBody();
        if (!isset($body['stepId'])) {
            Utils::sendError('ID langkah wajib diisi', '', 400);
            return;
        }
        $stepId = (int)$body['stepId'];
        $stmt = $this->pdo->prepare('SELECT project_id, title FROM project_steps WHERE id = :id');
        $stmt->execute([':id' => $stepId]);
        $step = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($step) {
            $this->ensureProjectAccess((int)$step['project_id'], $_SESSION['user_id'] ?? null);

            // Fetch business unit
            $stmtProj = $this->pdo->prepare("SELECT business_unit FROM projects WHERE id = :id");
            $stmtProj->execute([':id' => $step['project_id']]);
            $proj = $stmtProj->fetch(PDO::FETCH_ASSOC);
            $businessUnit = $proj['business_unit'] ?? null;

            $del = $this->pdo->prepare('DELETE FROM project_steps WHERE id = :id');
            $del->execute([':id' => $stepId]);
            AppHelper::logActivity($this->pdo, 'project_step_delete', 'project', (int)$step['project_id'], 'Menghapus langkah project: ' . $step['title'], null, $businessUnit);
            AuditLogger::log('PROJECT_STEP_DELETE', 'project', (int)$step['project_id'], ['step_title' => $step['title']]);
        }
        
        Utils::sendSuccess(['result' => 'deleted', 'message' => 'Langkah dihapus']);
    }

    private function ensureProjectAccess(int $projectId, ?int $userId): void
    {
        $stmt = $this->pdo->prepare("SELECT business_unit, visibility, created_by FROM projects WHERE id = :id");
        $stmt->execute([':id' => $projectId]);
        $project = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$project) {
            Utils::sendError('Project tidak ditemukan', '', 404);
            exit;
        }

        $role = $_SESSION['role'] ?? 'member';
        $assignedUnits = $_SESSION['assigned_units'] ?? [];
        if (empty($assignedUnits) && !empty($_SESSION['business_unit'])) {
            $assignedUnits[] = $_SESSION['business_unit'];
        }

        if (AppHelper::canAccessProject($project, $userId, $role, $assignedUnits)) {
            return;
        }

        // If not accessible:
        if (!$userId && $project['visibility'] !== 'public') {
             Utils::sendError('Autentikasi diperlukan', '', 401);
             exit;
        }
        
        Utils::sendError('Akses ditolak', '', 403);
        exit;
    }
}
