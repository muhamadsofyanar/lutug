<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/core/Utils.php';
require_once dirname(__DIR__) . '/core/AppHelper.php';

class DashboardController
{
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    public function stats(): void
    {
        $userId = $_SESSION['user_id'] ?? null;
        $params = [];
        $userClauseInbox = "created_by IS NULL";
        $userClauseTasks = "created_by IS NULL";
        $userClauseProjects = "created_by IS NULL";
        $userClauseRefs = "created_by IS NULL";

        if ($userId) {
            // Jika Admin, lihat semua data (Global View) untuk monitoring
            if (isset($_SESSION['role']) && $_SESSION['role'] === 'admin') {
                $userClauseInbox = "1=1";
                $userClauseTasks = "1=1";
                $userClauseProjects = "1=1";
                $userClauseRefs = "1=1";
                $params = [];
            } else {
                $userClauseInbox = "(created_by = :user_id OR created_by IS NULL)";
                $userClauseTasks = "(created_by = :user_id OR created_by IS NULL)";
                $userClauseProjects = "(created_by = :user_id OR created_by IS NULL)";
                $userClauseRefs = "(created_by = :user_id OR created_by IS NULL)";
                $params = [':user_id' => $userId];
            }
        }

        // Inbox Count
        $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM inbox_items WHERE status = 'raw' AND $userClauseInbox");
        $stmt->execute($params);
        $inboxCount = $stmt->fetchColumn();

        // Today Count (Pending & In Progress)
        $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM tasks WHERE status IN ('pending', 'in_progress') AND date = :today AND $userClauseTasks");
        $todayParams = array_merge($params, [':today' => date('Y-m-d')]);
        $stmt->execute($todayParams);
        $todayCount = $stmt->fetchColumn();

        // Next Actions Count (Inbox items marked as later)
        $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM inbox_items WHERE status = 'next_action_later' AND $userClauseInbox");
        $stmt->execute($params);
        $nextActionsCount = $stmt->fetchColumn();

        // Projects Count (Active)
        $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM projects WHERE status = 'active' AND $userClauseProjects");
        $stmt->execute($params);
        $projectsCount = $stmt->fetchColumn();

        // References Count
        $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM reference_items WHERE $userClauseRefs");
        $stmt->execute($params);
        $referencesCount = $stmt->fetchColumn();

        // Zombie Count (Active Projects stagnant > 7 days)
        $stmt = $this->pdo->prepare("SELECT updated_at, created_at FROM projects WHERE status = 'active' AND $userClauseProjects");
        $stmt->execute($params);
        $activeProjs = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $zombieCount = 0;
        $now = new DateTime();
        foreach ($activeProjs as $p) {
             $u = new DateTime($p['updated_at'] ?? $p['created_at']);
             if ($now->diff($u)->days > 7) {
                 $zombieCount++;
             }
        }

        // Velocity (Last 7 Days)
        $velocity = [];
        $sevenDaysAgo = date('Y-m-d', strtotime('-6 days'));
        
        $stmt = $this->pdo->prepare("
            SELECT date, COUNT(*) as count 
            FROM tasks 
            WHERE status = 'done' 
            AND date >= :start_date 
            AND $userClauseTasks 
            GROUP BY date
        ");
        
        $vParams = array_merge($params, [':start_date' => $sevenDaysAgo]);
        $stmt->execute($vParams);
        $velocityRaw = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

        for ($i = 6; $i >= 0; $i--) {
            $d = date('Y-m-d', strtotime("-$i days"));
            $velocity[] = [
                'date' => $d,
                'day' => date('D', strtotime($d)),
                'count' => isset($velocityRaw[$d]) ? (int)$velocityRaw[$d] : 0
            ];
        }

        // Unit Distribution (Active Projects)
        $stmt = $this->pdo->prepare("SELECT business_unit, COUNT(*) as count FROM projects WHERE status = 'active' AND business_unit IS NOT NULL AND business_unit != '' AND $userClauseProjects GROUP BY business_unit");
        $stmt->execute($params);
        $projectDistribution = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Unit Distribution (Pending Tasks & In Progress)
        $stmt = $this->pdo->prepare("SELECT business_unit, COUNT(*) as count FROM tasks WHERE status IN ('pending', 'in_progress') AND business_unit IS NOT NULL AND business_unit != '' AND $userClauseTasks GROUP BY business_unit");
        $stmt->execute($params);
        $taskDistribution = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Unit Distribution (Inbox)
        $stmt = $this->pdo->prepare("SELECT business_unit, COUNT(*) as count FROM inbox_items WHERE status = 'raw' AND business_unit IS NOT NULL AND business_unit != '' AND $userClauseInbox GROUP BY business_unit");
        $stmt->execute($params);
        $inboxDistribution = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Business Health Metrics (Phase 11)
        // 1. Stagnant Projects
        $sevenDaysAgo = date('Y-m-d H:i:s', strtotime('-7 days'));
        $stmt = $this->pdo->prepare("
            SELECT business_unit, COUNT(*) as count 
            FROM projects 
            WHERE status = 'active' 
            AND (updated_at < :seven_days_ago OR (updated_at IS NULL AND created_at < :seven_days_ago))
            AND business_unit IS NOT NULL AND business_unit != '' 
            AND $userClauseProjects
            GROUP BY business_unit
        ");
        $stagnantParams = array_merge($params, [':seven_days_ago' => $sevenDaysAgo]);
        $stmt->execute($stagnantParams);
        $stagnantDist = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

        // 2. Velocity (Completed last 14 days)
        $fourteenDaysAgo = date('Y-m-d H:i:s', strtotime('-14 days'));
        $stmt = $this->pdo->prepare("
            SELECT business_unit, COUNT(*) as count 
            FROM tasks 
            WHERE status = 'completed' 
            AND completed_at >= :fourteen_days_ago
            AND business_unit IS NOT NULL AND business_unit != '' 
            AND $userClauseTasks
            GROUP BY business_unit
        ");
        $velocityParams = array_merge($params, [':fourteen_days_ago' => $fourteenDaysAgo]);
        $stmt->execute($velocityParams);
        $velocityDist = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

        // 3. Overdue Tasks
        $nowDate = date('Y-m-d');
        $stmt = $this->pdo->prepare("
            SELECT business_unit, COUNT(*) as count 
            FROM tasks 
            WHERE status != 'completed' 
            AND date < :now_date
            AND business_unit IS NOT NULL AND business_unit != '' 
            AND $userClauseTasks
            GROUP BY business_unit
        ");
        $overdueParams = array_merge($params, [':now_date' => $nowDate]);
        $stmt->execute($overdueParams);
        $overdueDist = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

        // Aggregate Unit Summary
        $unitSummary = [];
        $processDist = function($dist, $type) use (&$unitSummary) {
            foreach ($dist as $item) {
                $unit = $item['business_unit'];
                if (!isset($unitSummary[$unit])) {
                    $unitSummary[$unit] = ['projects' => 0, 'tasks' => 0, 'inbox' => 0, 'health_score' => 100];
                }
                $unitSummary[$unit][$type] = (int)$item['count'];
            }
        };

        $processDist($projectDistribution, 'projects');
        $processDist($taskDistribution, 'tasks');
        $processDist($inboxDistribution, 'inbox');
        
        // Calculate Health Score
        foreach ($unitSummary as $unit => &$data) {
            $stagnant = $stagnantDist[$unit] ?? 0;
            $overdue = $overdueDist[$unit] ?? 0;
            $velocity = $velocityDist[$unit] ?? 0;

            $score = 100;
            $score -= ($stagnant * 15); // Heavy penalty for stagnant projects
            $score -= ($overdue * 5);   // Medium penalty for overdue
            $score += ($velocity * 2);  // Bonus for momentum
            
            // Cap at 100, Min at 0
            $data['health_score'] = max(0, min(100, $score));
            $data['metrics'] = [
                'stagnant' => $stagnant,
                'overdue' => $overdue,
                'velocity_14d' => $velocity
            ];
        }
        unset($data);
        
        // Sort by total activity
        uasort($unitSummary, function($a, $b) {
            $totalA = $a['projects'] + $a['tasks'] + $a['inbox'];
            $totalB = $b['projects'] + $b['tasks'] + $b['inbox'];
            return $totalB <=> $totalA;
        });

        // Energy Trend (Last 7 Days)
        $energyTrend = [];
        try {
            $energyRaw = [];
            if ($userId) {
                $sevenDaysAgo = date('Y-m-d', strtotime('-6 days'));
                $stmt = $this->pdo->prepare("
                    SELECT date, energy_level 
                    FROM daily_updates 
                    WHERE date >= :start_date 
                    AND user_id = :user_id
                ");
                $stmt->execute([':start_date' => $sevenDaysAgo, ':user_id' => $userId]);
                $energyRaw = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
            }

            for ($i = 6; $i >= 0; $i--) {
                $d = date('Y-m-d', strtotime("-$i days"));
                $energyTrend[] = [
                    'day' => mb_substr(Utils::translateDay(date('l', strtotime($d))), 0, 3),
                    'level' => isset($energyRaw[$d]) ? (int)$energyRaw[$d] : 0
                ];
            }
        } catch (Exception $e) {
            $energyTrend = [];
        }

        // Weekly Direction Status (Count for current week)
        $monday = date('Y-m-d', strtotime('monday this week'));
        $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM weekly_directions WHERE week_start = :week_start AND user_id = :user_id");
        $stmt->execute([':week_start' => $monday, ':user_id' => $userId]);
        $weeklyCount = $stmt->fetchColumn();

        // Radar Points (Active Tasks & Next Actions for Eisenhower Matrix)
        $radarPoints = [];
        try {
            $sql = "
                (SELECT id, title, importance, urgency, business_unit, 'task' as type 
                 FROM tasks 
                 WHERE status IN ('pending', 'in_progress') AND (created_by = :uid1 OR created_by IS NULL))
                UNION ALL
                (SELECT id, content as title, importance, urgency, business_unit, 'inbox' as type 
                 FROM inbox_items 
                 WHERE status = 'next_action_later' AND (created_by = :uid2 OR created_by IS NULL))
                ORDER BY importance DESC, urgency DESC 
                LIMIT 100
            ";
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([':uid1' => $userId, ':uid2' => $userId]);
            $radarPoints = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $e) {
             $stmt = $this->pdo->prepare("SELECT id, title, importance, urgency, business_unit FROM tasks WHERE status IN ('pending', 'in_progress') AND $userClauseTasks ORDER BY importance DESC, urgency DESC LIMIT 100");
             $stmt->execute($params);
             $radarPoints = $stmt->fetchAll(PDO::FETCH_ASSOC);
        }

        // Energy Advice (3-Day Trend)
        $energyAdvice = [
            'phase' => 'CALIBRATION',
            'message' => 'Log data energi harian untuk mengaktifkan saran.',
            'avg_level' => 0,
            'color' => 'slate'
        ];

        // Oracle / Burnout Prediction (Phase 11)
        $oracleStatus = ['level' => 'stable', 'message' => 'SISTEM NORMAL', 'trend' => 'flat', 'risk_score' => 0];
        $settings = AppHelper::getSystemSettings($this->pdo);

        if ($userId) {
             // Advice Logic
             $stmtEnergy = $this->pdo->prepare("SELECT energy_level FROM daily_updates WHERE user_id = :user_id ORDER BY date DESC LIMIT 3");
             $stmtEnergy->execute([':user_id' => $userId]);
             $recentEnergy = $stmtEnergy->fetchAll(PDO::FETCH_COLUMN);
             
             if (count($recentEnergy) > 0) {
                 $avg = array_sum($recentEnergy) / count($recentEnergy);
                 $energyAdvice['avg_level'] = round($avg);
                 if ($avg < 40) {
                     $energyAdvice['phase'] = 'BATERAI LEMAH';
                     $energyAdvice['message'] = 'Energi kritis. Fokus bertahan hidup. Jangan ambil proyek baru.';
                     $energyAdvice['color'] = 'red';
                 } elseif ($avg > 80) {
                     $energyAdvice['phase'] = 'ENERGI TINGGI';
                     $energyAdvice['message'] = 'Momentum tinggi. Waktunya eksekusi tugas tersulit.';
                     $energyAdvice['color'] = 'emerald';
                 } else {
                     $energyAdvice['phase'] = 'ALIRAN STABIL';
                     $energyAdvice['message'] = 'Energi stabil. Pertahankan ritme kerja konsisten.';
                     $energyAdvice['color'] = 'cyan';
                 }
             }

            $oracleStatus = $oracleStatus;
        }

        // Focus Stats (Bio-Feedback)
        $focusStats = [
            'total_minutes' => 0,
            'today_minutes' => 0,
            'today_sessions' => 0
        ];

        if ($userId) {
            try {
                // Total Focus Time
                $stmt = $this->pdo->prepare("SELECT SUM(duration_minutes) FROM focus_sessions WHERE user_id = :user_id AND status = 'completed'");
                $stmt->execute([':user_id' => $userId]);
                $focusStats['total_minutes'] = (int)$stmt->fetchColumn();

                // Today's Stats
                $todayDate = date('Y-m-d');
                $stmt = $this->pdo->prepare("SELECT SUM(duration_minutes) as minutes, COUNT(*) as sessions FROM focus_sessions WHERE user_id = :user_id AND status = 'completed' AND DATE(start_time) = :today");
                $stmt->execute([':user_id' => $userId, ':today' => $todayDate]);
                $todayFocus = $stmt->fetch(PDO::FETCH_ASSOC);
                
                if ($todayFocus) {
                    $focusStats['today_minutes'] = (int)$todayFocus['minutes'];
                    $focusStats['today_sessions'] = (int)$todayFocus['sessions'];
                }
            } catch (Exception $e) {
                // Ignore errors if table doesn't exist yet
            }
        }

        $gamificationData = null;

        Utils::sendSuccess([
            'stats' => [
                'inbox' => (int)$inboxCount,
                'today' => (int)$todayCount,
                'next_actions' => (int)$nextActionsCount,
                'projects' => (int)$projectsCount,
                'references' => (int)$referencesCount,
                'zombies' => (int)$zombieCount,
                'weekly_set' => (int)$weeklyCount,
                'energy_advice' => $energyAdvice,
                'oracle' => $oracleStatus,
                'gamification' => $gamificationData,
                'focus_stats' => $focusStats,
                'unit_summary' => $unitSummary,
                'energy_trend' => $energyTrend,
                'radar_points' => $radarPoints,
                'velocity' => $velocity,
                'distribution' => [
                    'projects' => $projectDistribution,
                    'tasks' => $taskDistribution,
                    'inbox' => $inboxDistribution
                ],
                'feature_flags' => [
                    'oracle_enabled' => !empty($settings['oracle_enabled']),
                    'gamification_enabled' => !empty($settings['gamification_enabled']),
                    'knowledge_graph_enabled' => !empty($settings['knowledge_graph_enabled']),
                    'weekly_insights_enabled' => !empty($settings['weekly_insights_enabled']),
                    'whatsapp_enabled' => !empty($settings['whatsapp_enabled']),
                    'telegram_enabled' => !empty($settings['telegram_enabled']),
                ]
            ]
        ]);
    }
}
