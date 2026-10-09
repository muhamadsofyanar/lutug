<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/core/Utils.php';

class ArchiveController
{
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    public function list(): void
    {
        $userId = $_SESSION['user_id'] ?? null;
        if ($userId) {
            $stmt = $this->pdo->prepare("SELECT id, content, status, created_at FROM inbox_items WHERE status = 'no_action' AND (created_by = :user_id OR created_by IS NULL) ORDER BY created_at DESC");
            $stmt->execute([':user_id' => $userId]);
        } else {
            $stmt = $this->pdo->prepare("SELECT id, content, status, created_at FROM inbox_items WHERE status = 'no_action' AND created_by IS NULL ORDER BY created_at DESC");
            $stmt->execute();
        }
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
        Utils::sendSuccess(['items' => $items]);
    }
}
