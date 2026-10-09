<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/core/Utils.php';

class DecisionController
{
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    public function list(): void
    {
        $userId = $_SESSION['user_id'] ?? null;
        if (!$userId) {
            Utils::sendError('Tidak terautentikasi', '', 401);
            return;
        }

        // Auto-fix schema if missing columns (SQLite specific)
        try {
            $stmt = $this->pdo->query("PRAGMA table_info(decision_logs)");
            $columns = $stmt->fetchAll(PDO::FETCH_COLUMN, 1);
            
            if (!in_array('entity_type', $columns)) {
                $this->pdo->exec("ALTER TABLE decision_logs ADD COLUMN entity_type VARCHAR(50) DEFAULT 'inbox'");
            }
            if (!in_array('entity_id', $columns)) {
                $this->pdo->exec("ALTER TABLE decision_logs ADD COLUMN entity_id INTEGER DEFAULT 0");
            }
            // Fix: Add other potentially missing columns that caused issues before
             if (!in_array('reason', $columns)) {
                $this->pdo->exec("ALTER TABLE decision_logs ADD COLUMN reason TEXT DEFAULT NULL");
            }
             if (!in_array('meta_data', $columns)) {
                $this->pdo->exec("ALTER TABLE decision_logs ADD COLUMN meta_data TEXT DEFAULT NULL");
            }
        } catch (Throwable $e) {
            // Ignore schema errors, proceed to list
        }

        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
        
        $sql = "SELECT dl.*, u.username 
                FROM decision_logs dl 
                LEFT JOIN users u ON dl.user_id = u.id 
                WHERE dl.user_id = :user_id 
                ORDER BY dl.created_at DESC 
                LIMIT :limit";
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->bindValue(':user_id', $userId, PDO::PARAM_INT);
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();
        
        $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Decode meta_data
        foreach ($logs as &$log) {
            if ($log['meta_data']) {
                $log['meta_data'] = json_decode($log['meta_data'], true);
            }
        }

        Utils::sendSuccess(['logs' => $logs]);
    }
    
    public function stats(): void
    {
        $userId = $_SESSION['user_id'] ?? null;
        if (!$userId) {
            Utils::sendError('Tidak terautentikasi', '', 401);
            return;
        }

        $sql = "SELECT decision_type, COUNT(*) as count 
                FROM decision_logs 
                WHERE user_id = :user_id 
                GROUP BY decision_type";
                
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':user_id' => $userId]);
        $stats = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
        
        Utils::sendSuccess(['stats' => $stats]);
    }
}
