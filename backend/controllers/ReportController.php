<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/core/Utils.php';
require_once dirname(__DIR__) . '/core/AppHelper.php';

class ReportController
{
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    public function export()
    {
        $type = $_GET['type'] ?? 'daily';
        $startDate = $_GET['start_date'] ?? date('Y-m-d');
        $endDate = $_GET['end_date'] ?? date('Y-m-d');
        
        $data = [];

        switch ($type) {
            case 'daily':
                $data = $this->getDailyReport($startDate);
                break;
            case 'weekly':
                $data = $this->getWeeklyReport($startDate, $endDate);
                break;
            case 'project':
                $data = $this->getProjectReport();
                break;
            default:
                Utils::sendError('Tipe laporan tidak valid');
                return;
        }

        Utils::sendSuccess(['data' => $data]);
    }

    private function getDailyReport(string $date): array
    {
        // 1. Get Completed Tasks
        $stmt = $this->pdo->prepare("
            SELECT t.*, u.username as completed_by_name
            FROM tasks t
            LEFT JOIN users u ON t.created_by = u.id
            WHERE t.completed_at LIKE :date_pattern
            AND t.status = 'done'
            ORDER BY t.completed_at ASC
        ");
        $stmt->execute([':date_pattern' => "$date%"]);
        $completedTasks = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // 2. Get Daily Update (Plan/Blocker)
        $stmt = $this->pdo->prepare("
            SELECT * FROM daily_updates 
            WHERE date = :date
        ");
        $stmt->execute([':date' => $date]);
        $dailyUpdates = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // 3. Get Stats
        $stats = [
            'total_completed' => count($completedTasks),
            'energy_average' => 0 // Placeholder logic
        ];

        return [
            'title' => "Laporan Harian - $date",
            'date' => $date,
            'completed_tasks' => $completedTasks,
            'daily_updates' => $dailyUpdates,
            'stats' => $stats
        ];
    }

    private function getWeeklyReport(string $startDate, string $endDate): array
    {
        // 1. Completed Tasks in range
        $stmt = $this->pdo->prepare("
            SELECT t.* 
            FROM tasks t
            WHERE t.completed_at >= :start_date 
            AND t.completed_at <= :end_date
            AND t.status = 'done'
            ORDER BY t.completed_at ASC
        ");
        $stmt->execute([
            ':start_date' => "$startDate 00:00:00",
            ':end_date' => "$endDate 23:59:59"
        ]);
        $tasks = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // 2. Weekly Directions
        $stmt = $this->pdo->prepare("
            SELECT * FROM daily_updates
            WHERE date BETWEEN :start AND :end
        ");
        $stmt->execute([':start' => $startDate, ':end' => $endDate]);
        $updates = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return [
            'title' => "Laporan Mingguan ($startDate s/d $endDate)",
            'range' => [$startDate, $endDate],
            'tasks' => $tasks,
            'updates' => $updates
        ];
    }

    private function getProjectReport(): array
    {
        $stmt = $this->pdo->query("
            SELECT p.*, 
            (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') as done_tasks,
            (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'pending') as pending_tasks
            FROM projects p
            WHERE p.status != 'archived'
            ORDER BY p.updated_at DESC
        ");
        $projects = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return [
            'title' => 'Laporan Status Proyek',
            'generated_at' => date('Y-m-d H:i:s'),
            'projects' => $projects
        ];
    }
}
