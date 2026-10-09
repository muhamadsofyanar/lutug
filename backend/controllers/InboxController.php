<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/core/Utils.php';
require_once dirname(__DIR__) . '/core/AppHelper.php';
require_once dirname(__DIR__) . '/services/TaskService.php';
require_once dirname(__DIR__) . '/core/GamificationEngine.php';

class InboxController
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
        if (empty($assignedUnits) && !empty($_SESSION['business_unit'])) {
            $assignedUnits[] = $_SESSION['business_unit'];
        }

        if ($userId) {
            if ($role === 'admin') {
                $sql = "SELECT id, content, status, created_at, business_unit FROM inbox_items WHERE status = 'raw' ORDER BY created_at DESC";
                $stmt = $this->pdo->prepare($sql);
                $stmt->execute();
            } else {
                $sql = "SELECT id, content, status, created_at, business_unit FROM inbox_items WHERE status = 'raw' AND (created_by = :user_id OR created_by IS NULL";
                $params = [':user_id' => $userId];
                
                if (!empty($assignedUnits)) {
                    $placeholders = [];
                    foreach ($assignedUnits as $i => $u) {
                        $key = ":bu_$i";
                        $placeholders[] = $key;
                        $params[$key] = $u;
                    }
                    $inClause = implode(',', $placeholders);
                    $sql .= " OR business_unit IN ($inClause)";
                }
                $sql .= ") ORDER BY created_at DESC";
                
                $stmt = $this->pdo->prepare($sql);
                $stmt->execute($params);
            }
        } else {
             $stmt = $this->pdo->query("SELECT id, content, status, created_at, business_unit FROM inbox_items WHERE status = 'raw' AND created_by IS NULL ORDER BY created_at DESC");
        }
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
        Utils::sendSuccess(['items' => $items]);
    }

    public function listNextActions(): void
    {
        $userId = $_SESSION['user_id'] ?? null;
        $role = $_SESSION['role'] ?? 'member';
        $assignedUnits = $_SESSION['assigned_units'] ?? [];
        if (empty($assignedUnits) && !empty($_SESSION['business_unit'])) {
            $assignedUnits[] = $_SESSION['business_unit'];
        }

        if ($userId) {
            if ($role === 'admin') {
                $sql = "SELECT id, content, status, created_at, business_unit, energy_level, importance, urgency FROM inbox_items WHERE status = 'next_action_later' ORDER BY created_at DESC";
                $stmt = $this->pdo->prepare($sql);
                $stmt->execute();
            } else {
                $sql = "SELECT id, content, status, created_at, business_unit, energy_level, importance, urgency FROM inbox_items WHERE status = 'next_action_later' AND (created_by = :user_id OR created_by IS NULL";
                $params = [':user_id' => $userId];
                
                if (!empty($assignedUnits)) {
                    $placeholders = [];
                    foreach ($assignedUnits as $i => $u) {
                        $key = ":bu_$i";
                        $placeholders[] = $key;
                        $params[$key] = $u;
                    }
                    $inClause = implode(',', $placeholders);
                    $sql .= " OR business_unit IN ($inClause)";
                }
                $sql .= ") ORDER BY created_at DESC";
                
                $stmt = $this->pdo->prepare($sql);
                $stmt->execute($params);
            }
        } else {
             $stmt = $this->pdo->query("SELECT id, content, status, created_at, business_unit, energy_level, importance, urgency FROM inbox_items WHERE status = 'next_action_later' AND created_by IS NULL ORDER BY created_at DESC");
        }
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Energy Advice Logic (Phase 5)
        $advice = null;
        $adviceText = null;
        if ($userId) {
             $stmtEnergy = $this->pdo->prepare("SELECT energy_level FROM daily_updates WHERE user_id = :user_id ORDER BY date DESC LIMIT 3");
             $stmtEnergy->execute([':user_id' => $userId]);
             $recentEnergy = $stmtEnergy->fetchAll(PDO::FETCH_COLUMN);
             
             if (count($recentEnergy) > 0) {
                 $avg = array_sum($recentEnergy) / count($recentEnergy);
                 if ($avg < 40) {
                     $advice = "low"; 
                     $adviceText = "⚠️ Baterai Lemah (Rata-rata " . round($avg) . "%). Fokus pada 1-2 tugas kritis saja.";
                 } elseif ($avg > 80) {
                     $advice = "high";
                     $adviceText = "⚡ Energi Tinggi (Rata-rata " . round($avg) . "%). Hajar tugas tersulit!";
                 } else {
                     $advice = "medium";
                     $adviceText = "🔋 Energi Stabil (Rata-rata " . round($avg) . "%). Pertahankan ritme kerja.";
                 }
             }
        }

        Utils::sendSuccess([
            'items' => $items,
            'energy_state' => $advice,
            'energy_advice' => $adviceText
        ]);
    }

    public function update(): void
    {
        $body = Utils::readJsonBody();
        $id = Utils::validateInt($body, 'id');
        if ($id === null) {
            Utils::sendError('ID wajib diisi');
            return;
        }

        $userId = $_SESSION['user_id'] ?? null;
        $role = $_SESSION['role'] ?? 'member';
        $assignedUnits = $_SESSION['assigned_units'] ?? [];
        if (empty($assignedUnits) && !empty($_SESSION['business_unit'])) {
            $assignedUnits[] = $_SESSION['business_unit'];
        }
        
        // Check access
        if ($userId) {
            if ($role === 'admin') {
                $check = $this->pdo->prepare("SELECT id FROM inbox_items WHERE id = :id");
                $check->execute([':id' => $id]);
            } else {
                $sql = "SELECT id FROM inbox_items WHERE id = :id AND (created_by = :user_id OR created_by IS NULL";
                $params = [':id' => $id, ':user_id' => $userId];
                
                if (!empty($assignedUnits)) {
                    $placeholders = [];
                    foreach ($assignedUnits as $i => $u) {
                        $key = ":bu_$i";
                        $placeholders[] = $key;
                        $params[$key] = $u;
                    }
                    $inClause = implode(',', $placeholders);
                    $sql .= " OR business_unit IN ($inClause)";
                }
                $sql .= ")";
                
                $check = $this->pdo->prepare($sql);
                $check->execute($params);
            }
        } else {
            $check = $this->pdo->prepare("SELECT id FROM inbox_items WHERE id = :id AND created_by IS NULL");
            $check->execute([':id' => $id]);
        }
        
        if (!$check->fetch()) {
            Utils::sendError('Item tidak ditemukan atau akses ditolak', '', 404);
            return;
        }

        // Update fields if present
        $fields = [];
        $params = [':id' => $id];

        if (isset($body['energy_level'])) {
            $fields[] = "energy_level = :energy_level";
            $params[':energy_level'] = $body['energy_level'];
        }
        
        if (isset($body['importance'])) {
            $fields[] = "importance = :importance";
            $params[':importance'] = (int)$body['importance'];
        }

        if (isset($body['urgency'])) {
            $fields[] = "urgency = :urgency";
            $params[':urgency'] = (int)$body['urgency'];
        }

        if (isset($body['content'])) {
            $fields[] = "content = :content";
            $params[':content'] = $body['content'];
        }

        if (empty($fields)) {
            Utils::sendSuccess(['message' => 'Tidak ada perubahan']);
            return;
        }

        $sql = "UPDATE inbox_items SET " . implode(', ', $fields) . " WHERE id = :id";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);

        Utils::sendSuccess(['message' => 'Item inbox berhasil diperbarui']);
    }

    public function create(): void
    {
        $body = Utils::readJsonBody();
        $content = Utils::validateString($body, 'content', 1000);
        $businessUnit = Utils::validateString($body, 'businessUnit', 80, '');
        
        if ($content === '') {
            Utils::sendError('Konten tidak boleh kosong');
            return;
        }
        $now = Utils::now();
        $userId = $_SESSION['user_id'] ?? null;
        $stmt = $this->pdo->prepare('INSERT INTO inbox_items (content, status, created_at, created_by, business_unit) VALUES (:content, :status, :created_at, :created_by, :business_unit)');
        $stmt->execute([
            ':content' => $content,
            ':status' => 'raw',
            ':created_at' => $now,
            ':created_by' => $userId,
            ':business_unit' => $businessUnit === '' ? null : $businessUnit,
        ]);
        $id = (int)$this->pdo->lastInsertId();
        AppHelper::logActivity($this->pdo, 'inbox_create', 'inbox', $id, 'Membuat item inbox', null, $businessUnit === '' ? null : $businessUnit);
        Utils::sendSuccess([
            'item' => [
                'id' => $id,
                'content' => $content,
                'status' => 'raw',
                'created_at' => $now,
                'business_unit' => $businessUnit === '' ? null : $businessUnit,
            ]
        ], '', 201);
    }

    public function delete(): void
    {
        $body = Utils::readJsonBody();
        $id = Utils::validateInt($body, 'id');
        if ($id === null) {
            Utils::sendError('ID wajib diisi dan harus berupa angka');
            return;
        }
        
        $item = AppHelper::inboxItemById($this->pdo, $id);
        if (!$item) {
            Utils::sendError('Item tidak ditemukan', '', 404);
            return;
        }

        if ($this->checkAccess($item, 'delete')) {
            $stmt = $this->pdo->prepare('DELETE FROM inbox_items WHERE id = :id');
            $stmt->execute([':id' => $id]);
            Utils::sendSuccess(['success' => true, 'message' => 'Item dihapus']);
        } else {
            Utils::sendError('Akses ditolak: Hanya Manager yang bisa menghapus item orang lain.', '', 403);
        }
    }

    public function decisionCommit(): void
    {
        $body = Utils::readJsonBody();
        $inboxId = Utils::validateInt($body, 'inboxId');
        if ($inboxId === null) {
            Utils::sendError('inboxId wajib diisi dan harus berupa angka', '', 400);
            return;
        }
        
        $item = AppHelper::inboxItemById($this->pdo, $inboxId);
        if ($item === null) {
            Utils::sendError('Item tidak ditemukan', '', 404);
            return;
        }
        
        if (!$this->checkAccess($item, 'decision')) {
             Utils::sendError('Akses ditolak', '', 403);
             return;
        }

        $decision = isset($body['decision']) ? $body['decision'] : 'today'; 
        
        // Backwards compatibility
        if (isset($body['needAction']) && !isset($body['decision'])) {
             if (!$body['needAction']) $decision = 'trash';
             else if ($body['isProject']) $decision = 'project';
             else if ($body['when'] === 'later') $decision = 'later';
             else $decision = 'today';
        }

        $newTitle = isset($body['title']) && trim($body['title']) !== '' ? trim($body['title']) : trim($item['content']);
        $businessUnit = isset($body['businessUnit']) ? trim($body['businessUnit']) : '';
        if ($businessUnit === '') $businessUnit = null;

        try {
            $this->pdo->beginTransaction();

            if ($decision === 'trash') {
                if (!$this->checkAccess($item, 'delete')) {
                    $this->pdo->rollBack();
                    Utils::sendError('Akses ditolak: Hanya Manager yang bisa menghapus item orang lain.', '', 403);
                    return;
                }
                $this->handleTrash($inboxId, $item, $body);
                return;
            }

            if ($decision === 'reference') {
                $this->handleReference($inboxId, $newTitle, $businessUnit, $body);
                return;
            }

            if ($decision === 'project') {
                $this->handleProject($inboxId, $newTitle, $businessUnit, $body);
                return;
            }

            // Update title/content/business_unit if changed
            if ($newTitle !== $item['content'] || $businessUnit !== $item['business_unit']) {
                $stmt = $this->pdo->prepare("UPDATE inbox_items SET content = :content, business_unit = :business_unit WHERE id = :id");
                $stmt->execute([':content' => $newTitle, ':business_unit' => $businessUnit, ':id' => $inboxId]);
            }

            if ($decision === 'later') {
                $this->handleLater($inboxId, $item, $body);
                return;
            }

            if ($decision === 'schedule') {
                $this->handleSchedule($inboxId, $newTitle, $businessUnit, $body);
                return;
            }

            // Decision: Today
            $this->handleToday($inboxId, $newTitle, $businessUnit, $body);

        } catch (\Throwable $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            Utils::sendError('Terjadi Kesalahan Server: ' . $e->getMessage(), '', 500);
        }
    }

    private function checkAccess(array $item, string $action): bool
    {
        $userId = $_SESSION['user_id'] ?? null;
        $role = $_SESSION['role'] ?? 'member';
        $assignedUnits = $_SESSION['assigned_units'] ?? [];
        if (empty($assignedUnits) && !empty($_SESSION['business_unit'])) {
            $assignedUnits[] = $_SESSION['business_unit'];
        }

        $ownerId = $item['created_by'];
        $itemUnit = $item['business_unit'];

        if ($role === 'admin') return true;

        $isOwner = ($userId && $userId == $ownerId) || $ownerId === null;
        $inUnit = ($userId && $itemUnit && in_array($itemUnit, $assignedUnits));

        if ($action === 'delete') {
            if ($role === 'manager') {
                return $isOwner || $inUnit;
            }
            return $isOwner;
        }

        // Default 'read' or 'decision' access
        if ($isOwner) return true;
        if ($inUnit) return true;

        return false;
    }

    private function handleTrash(int $inboxId, array $item, array $body): void
    {
        $assignedTo = AppHelper::normalizeAssignedTo($body);
        $stmt = $this->pdo->prepare("DELETE FROM inbox_items WHERE id = :id");
        $stmt->execute([':id' => $inboxId]);
        AppHelper::logActivity($this->pdo, 'decision_trash', 'inbox', $inboxId, 'Menghapus item inbox', $assignedTo, $item['business_unit']);
        
        $this->logDecision((int)($_SESSION['user_id'] ?? 0), 'inbox', $inboxId, 'killed', null, ['original_content' => $item['content']]);
        
        $this->pdo->commit();
        Utils::sendSuccess(['result' => 'trash', 'message' => 'Item dihapus']);
    }

    private function handleReference(int $inboxId, string $newTitle, ?string $businessUnit, array $body): void
    {
        $userId = $_SESSION['user_id'] ?? null;
        $tags = isset($body['tags']) ? trim($body['tags']) : '';
        $assignedTo = AppHelper::normalizeAssignedTo($body);
        $now = Utils::now();

        $stmt = $this->pdo->prepare("INSERT INTO reference_items (title, content, tags, created_by, created_at, updated_at, business_unit) VALUES (:title, :content, :tags, :created_by, :created_at, :updated_at, :business_unit)");
        $stmt->execute([
            ':title' => $newTitle,
            ':content' => 'Dari Inbox',
            ':tags' => $tags,
            ':created_by' => $userId,
            ':created_at' => $now,
            ':updated_at' => $now,
            ':business_unit' => $businessUnit
        ]);
        $refId = $this->pdo->lastInsertId();

        $stmtDel = $this->pdo->prepare("DELETE FROM inbox_items WHERE id = :id");
        $stmtDel->execute([':id' => $inboxId]);
        
        AppHelper::logActivity($this->pdo, 'decision_reference', 'reference', (int)$refId, 'Menjadikan inbox sebagai referensi: ' . $newTitle, $assignedTo, $businessUnit);
        
        $this->logDecision((int)($_SESSION['user_id'] ?? 0), 'inbox', $inboxId, 'reference', null, ['reference_id' => $refId, 'title' => $newTitle]);
        
        $this->pdo->commit();
        Utils::sendSuccess(['result' => 'reference_created', 'id' => $refId, 'message' => 'Referensi berhasil dibuat']);
    }

    private function handleProject(int $inboxId, string $newTitle, ?string $businessUnit, array $body): void
    {
        if ($newTitle === '') {
            $this->pdo->rollBack();
            Utils::sendError('Judul project tidak boleh kosong', '', 400);
            return;
        }
        
        $userId = $_SESSION['user_id'] ?? null;
        $firstActionTitle = isset($body['firstActionTitle']) ? trim($body['firstActionTitle']) : '';
        $assignedTo = AppHelper::normalizeAssignedTo($body);
        $now = Utils::now();
        $projectStatus = $firstActionTitle === '' ? 'waiting' : 'active';
        
        $insertProject = $this->pdo->prepare('INSERT INTO projects (title, status, next_action, business_unit, visibility, created_at, updated_at, created_by) VALUES (:title, :status, :next_action, :business_unit, :visibility, :created_at, :updated_at, :created_by)');
        $insertProject->execute([
            ':title' => $newTitle,
            ':status' => $projectStatus,
            ':next_action' => $firstActionTitle === '' ? null : $firstActionTitle,
            ':business_unit' => $businessUnit,
            ':visibility' => 'private',
            ':created_at' => $now,
            ':updated_at' => $now,
            ':created_by' => $userId,
        ]);
        $projectId = (int)$this->pdo->lastInsertId();

        if ($firstActionTitle !== '') {
            $stmtStep = $this->pdo->prepare('INSERT INTO project_steps (project_id, step_order, title, created_at) VALUES (:pid, 1, :title, :created_at)');
            $stmtStep->execute([
                ':pid' => $projectId,
                ':title' => $firstActionTitle,
                ':created_at' => $now
            ]);
        }

        $stmt = $this->pdo->prepare('DELETE FROM inbox_items WHERE id = :id');
        $stmt->execute([':id' => $inboxId]);

        AppHelper::logActivity($this->pdo, 'project_create', 'project', $projectId, 'Membuat project dari inbox: ' . $newTitle, $assignedTo, $businessUnit);
        
        $this->logDecision((int)($_SESSION['user_id'] ?? 0), 'inbox', $inboxId, 'project', null, ['project_id' => $projectId, 'title' => $newTitle]);
        
        $this->pdo->commit();
        Utils::sendSuccess(['result' => 'project_created', 'id' => $projectId], '', 201);
    }

    private function handleLater(int $inboxId, array $item, array $body): void
    {
        $assignedTo = AppHelper::normalizeAssignedTo($body);
        $businessUnit = isset($body['businessUnit']) ? trim($body['businessUnit']) : $item['business_unit'];
        
        $stmt = $this->pdo->prepare("UPDATE inbox_items SET status = 'next_action_later' WHERE id = :id");
        $stmt->execute([':id' => $inboxId]);
        AppHelper::logActivity($this->pdo, 'decision_later', 'inbox', $inboxId, 'Menunda item inbox untuk nanti', $assignedTo, $businessUnit);
        
        $this->logDecision((int)($_SESSION['user_id'] ?? 0), 'inbox', $inboxId, 'deferred', null, ['title' => $item['content']]);
        
        $this->pdo->commit();
        Utils::sendSuccess(['result' => 'saved_for_later', 'message' => 'Disimpan untuk nanti']);
    }

    private function handleToday(int $inboxId, string $newTitle, ?string $businessUnit, array $body): void
    {
        $userId = $_SESSION['user_id'] ?? null;
        if ($userId !== null) {
            $userId = (int)$userId;
        }
        $assignedTo = AppHelper::normalizeAssignedTo($body);
        $dailyLimit = isset($body['dailyLimit']) ? (int)$body['dailyLimit'] : null;

        $task = null;
        if (!TaskService::tryScheduleToday($this->pdo, $newTitle, $task, $assignedTo, $dailyLimit, $userId, $businessUnit)) {
            // Fallback to 'later'
            $stmt = $this->pdo->prepare("UPDATE inbox_items SET status = 'next_action_later' WHERE id = :id");
            $stmt->execute([':id' => $inboxId]);
            AppHelper::logActivity($this->pdo, 'decision_later_fallback', 'inbox', $inboxId, 'Auto-defer inbox ke nanti (Today Full)', $assignedTo, $businessUnit);
            
            $this->logDecision((int)($_SESSION['user_id'] ?? 0), 'inbox', $inboxId, 'deferred_fallback', 'Daily limit reached', ['title' => $newTitle]);
            
            $this->pdo->commit();
            
            Utils::sendSuccess([
                'code' => 'TODAY_FULL',
                'message' => 'Hari ini penuh. Item dipindahkan ke Next Actions.',
                'result' => 'saved_for_later'
            ]);
            return;
        }
        
        $stmt = $this->pdo->prepare("UPDATE inbox_items SET status = 'scheduled_today' WHERE id = :id");
        $stmt->execute([':id' => $inboxId]);
        
        if (is_array($task) && isset($task['id'])) {
            $insertComment = $this->pdo->prepare('INSERT INTO task_comments (task_id, content, author, created_at) VALUES (:task_id, :content, :author, :created_at)');
            $insertComment->execute([
                ':task_id' => (int)$task['id'],
                ':content' => 'Tugas dibuat dari Inbox.',
                ':author' => $assignedTo,
                ':created_at' => Utils::now(),
            ]);
        }
        
        AppHelper::logActivity($this->pdo, 'task_create', 'task', (int)$task['id'], 'Membuat tugas dari inbox: ' . $newTitle, $assignedTo, $businessUnit);
        
        $this->logDecision((int)($_SESSION['user_id'] ?? 0), 'inbox', $inboxId, 'processed_to_today', null, ['task_id' => $task['id'], 'title' => $newTitle]);
        
        $this->pdo->commit();
        Utils::sendSuccess(['result' => 'task_created', 'task' => $task, 'message' => 'Tugas berhasil dibuat'], '', 201);
    }

    private function handleSchedule(int $inboxId, string $newTitle, ?string $businessUnit, array $body): void
    {
        $userId = $_SESSION['user_id'] ?? null;
        if ($userId !== null) {
            $userId = (int)$userId;
        }
        $assignedTo = AppHelper::normalizeAssignedTo($body);
        $scheduleDate = isset($body['scheduleDate']) ? trim((string)$body['scheduleDate']) : '';
        if ($scheduleDate === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $scheduleDate) || strtotime($scheduleDate) === false) {
            $this->pdo->rollBack();
            Utils::sendError('Tanggal jadwal tidak valid. Format: YYYY-MM-DD', '', 400);
            return;
        }

        $task = null;
        if (!TaskService::tryScheduleOnDate($this->pdo, $newTitle, $scheduleDate, $task, $assignedTo, null, $userId, $businessUnit)) {
            $stmt = $this->pdo->prepare("UPDATE inbox_items SET status = 'next_action_later' WHERE id = :id");
            $stmt->execute([':id' => $inboxId]);
            AppHelper::logActivity($this->pdo, 'decision_later', 'inbox', $inboxId, 'Menunda item inbox karena gagal penjadwalan', $assignedTo, $businessUnit);
            
            $this->logDecision((int)($_SESSION['user_id'] ?? 0), 'inbox', $inboxId, 'deferred', 'Schedule failed', ['title' => $newTitle]);
            
            $this->pdo->commit();
            Utils::sendSuccess(['result' => 'saved_for_later', 'message' => 'Gagal menjadwalkan. Disimpan untuk nanti']);
            return;
        }

        $stmt = $this->pdo->prepare("UPDATE inbox_items SET status = 'scheduled_on_date' WHERE id = :id");
        $stmt->execute([':id' => $inboxId]);

        if (is_array($task) && isset($task['id'])) {
            $insertComment = $this->pdo->prepare('INSERT INTO task_comments (task_id, content, author, created_at) VALUES (:task_id, :content, :author, :created_at)');
            $insertComment->execute([
                ':task_id' => (int)$task['id'],
                ':content' => 'Tugas dijadwalkan dari Inbox.',
                ':author' => $assignedTo,
                ':created_at' => Utils::now(),
            ]);
        }

        AppHelper::logActivity($this->pdo, 'task_create', 'task', (int)$task['id'], 'Menjadwalkan tugas dari inbox: ' . $newTitle . ' pada ' . $scheduleDate, $assignedTo, $businessUnit);
        $this->logDecision((int)($_SESSION['user_id'] ?? 0), 'inbox', $inboxId, 'processed_to_schedule', null, ['task_id' => $task['id'], 'title' => $newTitle, 'date' => $scheduleDate]);
        $this->pdo->commit();
        Utils::sendSuccess(['result' => 'task_created', 'task' => $task, 'message' => 'Tugas berhasil dijadwalkan'], '', 201);
    }

    private function logDecision(int $userId, string $entityType, int $entityId, string $decisionType, ?string $reason = null, array $metaData = []): void
    {
        try {
            $stmt = $this->pdo->prepare("INSERT INTO decision_logs (user_id, entity_type, entity_id, decision_type, reason, meta_data) VALUES (:uid, :etype, :eid, :dtype, :reason, :meta)");
            $stmt->execute([
                ':uid' => $userId,
                ':etype' => $entityType,
                ':eid' => $entityId,
                ':dtype' => $decisionType,
                ':reason' => $reason,
                ':meta' => json_encode($metaData)
            ]);

            // Check for Decision Maker badge
            $gamification = new GamificationEngine($this->pdo);
            $gamification->checkBadges($userId, 'decision_count', []);
        } catch (\Throwable $e) {
            // Silently fail logging
        }
    }
}
