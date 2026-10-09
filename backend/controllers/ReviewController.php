<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/core/Utils.php';
require_once dirname(__DIR__) . '/core/AppHelper.php';

class ReviewController
{
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    public function decide(): void
    {
        $body = Utils::readJsonBody();
        if (!isset($body['taskId']) || !isset($body['decision'])) {
            Utils::sendError('Data tidak lengkap', '', 400);
            return;
        }
        $taskId = (int)$body['taskId'];
        $decision = $body['decision'];
        $actor = AppHelper::getCurrentUsername();
        if (isset($body['actor']) && is_string($body['actor'])) {
            $val = trim($body['actor']);
            if ($val !== '') {
                $actor = $val;
            }
        }

        try {
            $this->pdo->beginTransaction();

            $stmt = $this->pdo->prepare('SELECT * FROM tasks WHERE id = :id');
            $stmt->execute([':id' => $taskId]);
            $task = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$task) {
                $this->pdo->rollBack();
                Utils::sendError('Tugas tidak ditemukan', '', 404);
                return;
            }
            $now = Utils::now();

            if ($decision === 'tomorrow') {
                $tomorrow = (new DateTimeImmutable('tomorrow'))->format('Y-m-d');
                $maxTasksPerDay = null;
                if (isset($body['maxTasksPerDay'])) {
                    $raw = $body['maxTasksPerDay'];
                    if (is_string($raw) && $raw === 'unlimited') {
                        $maxTasksPerDay = 0;
                    } elseif (is_int($raw) || is_float($raw) || (is_string($raw) && is_numeric($raw))) {
                        $maxTasksPerDay = (int)$raw;
                    }
                }
                $countStmt = $this->pdo->prepare('SELECT COUNT(*) FROM tasks WHERE date = :date');
                $countStmt->execute([':date' => $tomorrow]);
                $existingCount = (int)$countStmt->fetchColumn();
                $limit = $maxTasksPerDay === null ? 5 : $maxTasksPerDay;
                if ($limit > 0 && $existingCount >= $limit) {
                    $this->pdo->rollBack();
                    Utils::sendSuccess(['error' => 'Jadwal besok sudah penuh.', 'code' => 'TOMORROW_FULL']);
                    return;
                }
                $update = $this->pdo->prepare('UPDATE tasks SET date = :date, slot = 999 WHERE id = :id');
                $update->execute([':date' => $tomorrow, ':id' => $taskId]);
                AppHelper::logActivity($this->pdo, 'review_tomorrow', 'task', $taskId, 'Memindahkan tugas ke besok', $actor);
                
                $this->pdo->commit();
                Utils::sendSuccess(['result' => 'moved_tomorrow', 'message' => 'Tugas dipindahkan ke besok']);
                return;
            }

            if ($decision === 'shrink') {
                $smallerTitle = isset($body['smallerTitle']) ? trim($body['smallerTitle']) : '';
                if ($smallerTitle === '') {
                    $this->pdo->rollBack();
                    Utils::sendError('Judul langkah kecil wajib diisi', '', 400);
                    return;
                }
                $update = $this->pdo->prepare('UPDATE tasks SET title = :title WHERE id = :id');
                $update->execute([':title' => $smallerTitle, ':id' => $taskId]);
                $comment = $this->pdo->prepare('INSERT INTO task_comments (task_id, content, author, created_at) VALUES (:task_id, :content, :author, :created_at)');
                $comment->execute([
                    ':task_id' => $taskId,
                    ':content' => 'Tugas dikecilkan dari: ' . $task['title'],
                    ':author' => $actor,
                    ':created_at' => $now,
                ]);
                AppHelper::logActivity($this->pdo, 'review_shrink', 'task', $taskId, 'Mengecilkan tugas: ' . $smallerTitle, $actor);
                
                $this->pdo->commit();
                Utils::sendSuccess(['result' => 'shrunk', 'message' => 'Tugas dikecilkan']);
                return;
            }

            if ($decision === 'archive') {
                $delete = $this->pdo->prepare('DELETE FROM tasks WHERE id = :id');
                $delete->execute([':id' => $taskId]);
                $userId = $_SESSION['user_id'] ?? null;
                $insert = $this->pdo->prepare("INSERT INTO inbox_items (content, status, created_at, created_by) VALUES (:content, 'no_action', :created_at, :created_by)");
                $insert->execute([
                    ':content' => $task['title'],
                    ':created_at' => $now,
                    ':created_by' => $userId,
                ]);
                AppHelper::logActivity($this->pdo, 'review_archive', 'task', $taskId, 'Mengarsipkan tugas', $actor);
                
                $this->pdo->commit();
                Utils::sendSuccess(['result' => 'archived', 'message' => 'Tugas diarsipkan']);
                return;
            }

            if ($decision === 'project') {
                $firstActionTitle = isset($body['firstActionTitle']) ? trim($body['firstActionTitle']) : '';
                
                $delete = $this->pdo->prepare('DELETE FROM tasks WHERE id = :id');
                $delete->execute([':id' => $taskId]);
                
                $projectStatus = $firstActionTitle === '' ? 'waiting' : 'active';
                $userId = $_SESSION['user_id'] ?? null;
                $insertProject = $this->pdo->prepare('INSERT INTO projects (title, status, next_action, created_at, updated_at, created_by) VALUES (:title, :status, :next_action, :created_at, :updated_at, :created_by)');
                $insertProject->execute([
                    ':title' => $task['title'],
                    ':status' => $projectStatus,
                    ':next_action' => $firstActionTitle === '' ? null : $firstActionTitle,
                    ':created_at' => $now,
                    ':updated_at' => $now,
                    ':created_by' => $userId,
                ]);
                $projectId = (int)$this->pdo->lastInsertId();

                // If first action is provided, also add it as a project step
                if ($firstActionTitle !== '') {
                    $stmtStep = $this->pdo->prepare('INSERT INTO project_steps (project_id, step_order, title, created_at) VALUES (:pid, 1, :title, :created_at)');
                    $stmtStep->execute([
                        ':pid' => $projectId,
                        ':title' => $firstActionTitle,
                        ':created_at' => $now
                    ]);
                }

                AppHelper::logActivity($this->pdo, 'review_project', 'project', $projectId, 'Menaikkan tugas menjadi project', $actor);
                
                $this->pdo->commit();
                Utils::sendSuccess(['result' => 'project_created', 'message' => 'Project berhasil dibuat']);
                return;
            }

            $this->pdo->rollBack();
            Utils::sendError('Pilihan tidak valid', '', 400);

        } catch (Throwable $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            Utils::sendError('Terjadi Kesalahan Server: ' . $e->getMessage(), '', 500);
        }
    }
}
