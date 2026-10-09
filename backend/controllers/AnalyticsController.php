<?php

require_once dirname(__DIR__) . '/core/Utils.php';
require_once dirname(__DIR__) . '/core/AppHelper.php';

class AnalyticsController
{
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    // GET: /api/analytics/team_performance
    public function getTeamPerformance(): void
    {
        $this->checkAdmin();

        try {
            // 1. Task Completion Stats per User
            // Count completed tasks vs total tasks (last 30 days)
            $stmt = $this->pdo->prepare("
                SELECT 
                    u.id, 
                    u.username,
                    u.job_title,
                    COUNT(CASE WHEN t.status = 'done' THEN 1 END) as completed,
                    COUNT(t.id) as total,
                    AVG(CASE WHEN du.energy_level IS NOT NULL THEN du.energy_level END) as avg_energy
                FROM users u
                LEFT JOIN tasks t ON u.id = t.created_by AND t.created_at >= date('now', '-30 days')
                LEFT JOIN daily_updates du ON u.id = du.user_id AND du.date >= date('now', '-30 days')
                GROUP BY u.id
                ORDER BY completed DESC
            ");
            $stmt->execute();
            $performance = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Calculate Completion Rate
            foreach ($performance as &$p) {
                $p['completion_rate'] = $p['total'] > 0 ? round(($p['completed'] / $p['total']) * 100, 1) : 0;
                $p['avg_energy'] = $p['avg_energy'] ? round($p['avg_energy'], 1) : 0;
            }

            Utils::sendSuccess(['performance' => $performance]);

        } catch (Exception $e) {
            Utils::sendError('Gagal mengambil data performa tim: ' . $e->getMessage());
        }
    }

    // GET: /api/analytics/burnout_heatmap
    public function getBurnoutHeatmap(): void
    {
        $this->checkAdmin();

        try {
            // Get Energy Levels for all users in last 30 days
            $stmt = $this->pdo->prepare("
                SELECT 
                    u.username,
                    du.date,
                    du.energy_level
                FROM daily_updates du
                JOIN users u ON du.user_id = u.id
                WHERE du.date >= date('now', '-30 days')
                ORDER BY du.date ASC
            ");
            $stmt->execute();
            $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Format for Heatmap: [ { date: '2023-01-01', user1: 80, user2: 70 }, ... ]
            // OR grouped by user: [ { username: 'user1', data: [ { date: '...', value: 80 } ] } ]
            // Recharts prefers array of objects where keys are series names for LineChart, 
            // but for Heatmap (Matrix), we might need custom processing on frontend.
            // Let's send raw data grouped by user for flexibility.
            
            $heatmap = [];
            foreach ($data as $row) {
                $heatmap[$row['username']][] = [
                    'date' => $row['date'],
                    'value' => (int)$row['energy_level']
                ];
            }

            Utils::sendSuccess(['heatmap' => $heatmap]);

        } catch (Exception $e) {
            Utils::sendError('Gagal mengambil data burnout: ' . $e->getMessage());
        }
    }

    private function checkAdmin(): void
    {
        if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
            Utils::sendError('Akses ditolak. Hanya Admin yang dapat melihat analitik.', 'FORBIDDEN', 403);
            exit;
        }
    }
}
