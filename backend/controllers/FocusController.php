<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/core/GamificationEngine.php';
require_once dirname(__DIR__) . '/core/Utils.php';

class FocusController
{
    private PDO $pdo;
    private GamificationEngine $gamification;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
        $this->gamification = new GamificationEngine($pdo);
    }

    public function start(): void
    {
        try {
            $input = Utils::readJsonBody();
            $taskId = $input['task_id'] ?? null;
            $userId = $_SESSION['user_id'];

            $stmt = $this->pdo->prepare("INSERT INTO focus_sessions (user_id, task_id, start_time, status) VALUES (:user_id, :task_id, :start_time, 'running')");
            $stmt->execute([
                ':user_id' => $userId,
                ':task_id' => $taskId,
                ':start_time' => date('Y-m-d H:i:s')
            ]);

            $sessionId = $this->pdo->lastInsertId();

            // Auto-set task status to 'in_progress' if it exists and is currently pending
            if ($taskId) {
                $stmtTask = $this->pdo->prepare("UPDATE tasks SET status = 'in_progress' WHERE id = :id AND status = 'pending'");
                $stmtTask->execute([':id' => $taskId]);
            }

            Utils::sendSuccess(['session_id' => $sessionId]);
        } catch (Throwable $e) {
            Utils::sendError($e->getMessage());
        }
    }

    public function stop(): void
    {
        try {
            $input = Utils::readJsonBody();
            $sessionId = $input['session_id'] ?? null;
            $userId = $_SESSION['user_id'];

            if (!$sessionId) {
                Utils::sendError('ID Sesi diperlukan', '', 400);
                return;
            }

            // Verify session belongs to user
            $stmt = $this->pdo->prepare("SELECT * FROM focus_sessions WHERE id = :id AND user_id = :user_id");
            $stmt->execute([':id' => $sessionId, ':user_id' => $userId]);
            $session = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$session) {
                Utils::sendError('Sesi tidak ditemukan', '', 404);
                return;
            }

            $endTime = date('Y-m-d H:i:s');
            $startTime = new DateTime($session['start_time']);
            $endDateTime = new DateTime($endTime);
            $duration = $startTime->diff($endDateTime);
            $minutes = ($duration->days * 24 * 60) + ($duration->h * 60) + $duration->i;

            // Update Session
            $stmt = $this->pdo->prepare("UPDATE focus_sessions SET end_time = :end_time, duration_minutes = :minutes, status = 'completed' WHERE id = :id");
            $stmt->execute([
                ':end_time' => $endTime,
                ':minutes' => $minutes,
                ':id' => $sessionId
            ]);

            // Award XP (2 XP per minute)
            $xpEarned = $minutes * 2;
            
            $gamificationResult = null;
            if ($xpEarned > 0) {
                $gamificationResult = $this->gamification->addXp($userId, $xpEarned);
                
                // Check Focus Badges
                $focusBadges = $this->gamification->checkBadges($userId, 'focus_session', ['duration' => $minutes]);
                if (!empty($focusBadges)) {
                    if (!isset($gamificationResult['new_badges'])) $gamificationResult['new_badges'] = [];
                    $gamificationResult['new_badges'] = array_merge($gamificationResult['new_badges'], $focusBadges);
                }
            }

            Utils::sendSuccess([
                'duration_minutes' => $minutes,
                'xp_earned' => $xpEarned,
                'gamification' => $gamificationResult
            ]);
        } catch (Throwable $e) {
            Utils::sendError($e->getMessage());
        }
    }

    public function cancel(): void
    {
        try {
            $input = Utils::readJsonBody();
            $sessionId = $input['session_id'] ?? null;
            $userId = $_SESSION['user_id'];

            if (!$sessionId) {
                Utils::sendError('ID Sesi diperlukan', '', 400);
                return;
            }

            $stmt = $this->pdo->prepare("UPDATE focus_sessions SET end_time = :end_time, status = 'interrupted' WHERE id = :id AND user_id = :user_id");
            $stmt->execute([':end_time' => date('Y-m-d H:i:s'), ':id' => $sessionId, ':user_id' => $userId]);

            Utils::sendSuccess([]);
        } catch (Throwable $e) {
            Utils::sendError($e->getMessage());
        }
    }
}
