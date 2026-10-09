<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/core/Utils.php';

class SearchController
{
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    public function globalSearch(): void
    {
        $query = isset($_GET['q']) ? trim($_GET['q']) : '';
        if ($query === '') {
            Utils::sendSuccess(['results' => []]);
            return;
        }
        $param = '%' . $query . '%';
        $userId = $_SESSION['user_id'] ?? null;
        
        $userClause = $userId ? "(created_by = :user_id OR created_by IS NULL)" : "created_by IS NULL";
        $params = [':q' => $param];
        if ($userId) {
            $params[':user_id'] = $userId;
        }
        
        // Search Inbox
        $inboxStmt = $this->pdo->prepare("SELECT id, content AS title, status, 'inbox' AS type, created_at FROM inbox_items WHERE content LIKE :q AND $userClause LIMIT 20");
        $inboxStmt->execute($params);
        $inboxResults = $inboxStmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Search Tasks
        $tasksStmt = $this->pdo->prepare("SELECT id, title, status, 'task' AS type, created_at FROM tasks WHERE title LIKE :q AND $userClause LIMIT 20");
        $tasksStmt->execute($params);
        $taskResults = $tasksStmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Search Projects
        $projectsStmt = $this->pdo->prepare("SELECT id, title, status, 'project' AS type, created_at FROM projects WHERE title LIKE :q AND $userClause LIMIT 20");
        $projectsStmt->execute($params);
        $projectResults = $projectsStmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Search References
        $refStmt = $this->pdo->prepare("SELECT id, title, 'reference' AS type, created_at FROM reference_items WHERE (title LIKE :q OR content LIKE :q OR tags LIKE :q) AND $userClause LIMIT 20");
        $refStmt->execute($params);
        $refResults = $refStmt->fetchAll(PDO::FETCH_ASSOC);

        $merged = array_merge($inboxResults, $taskResults, $projectResults, $refResults);
        
        // Sort by created_at desc (optional)
        usort($merged, function ($a, $b) {
            return strcmp($b['created_at'], $a['created_at']);
        });
        
        // Limit total
        $final = array_slice($merged, 0, 50);
        
        Utils::sendSuccess(['results' => $final]);
    }
}
