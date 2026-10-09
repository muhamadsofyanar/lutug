<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/core/Utils.php';
require_once dirname(__DIR__) . '/core/AppHelper.php';

class WeeklyDirectionController
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
            Utils::sendSuccess(['weekly_directions' => []]);
            return;
        }

        $businessUnit = $_GET['business_unit'] ?? null;
        $params = [':user_id' => $userId];
        $sql = "SELECT * FROM weekly_directions WHERE user_id = :user_id";

        if (!empty($businessUnit)) {
            $sql .= " AND business_unit = :business_unit";
            $params[':business_unit'] = $businessUnit;
        } else {
            $sql .= " AND (business_unit IS NULL OR business_unit = '')";
        }

        $sql .= " ORDER BY week_start DESC";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        $directions = $stmt->fetchAll(PDO::FETCH_ASSOC);

        Utils::sendSuccess(['weekly_directions' => $directions]);
    }

    public function save(): void
    {
        $userId = $_SESSION['user_id'] ?? null;
        if (!$userId) {
            Utils::sendError('Tidak Diizinkan', '', 401);
            return;
        }

        $body = Utils::readJsonBody();
        if (!isset($body['week_start']) || !isset($body['content'])) {
            Utils::sendError('Data yang diperlukan tidak lengkap');
            return;
        }

        $weekStart = $body['week_start'];
        $content = $body['content'];
        $businessUnit = $body['business_unit'] ?? null;
        $now = Utils::now();

        // Check if exists
        $sql = "SELECT id FROM weekly_directions WHERE user_id = :user_id AND week_start = :week_start";
        $params = [':user_id' => $userId, ':week_start' => $weekStart];

        if (!empty($businessUnit)) {
            $sql .= " AND business_unit = :business_unit";
            $params[':business_unit'] = $businessUnit;
        } else {
            $sql .= " AND (business_unit IS NULL OR business_unit = '')";
        }

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($existing) {
            $stmt = $this->pdo->prepare("
                UPDATE weekly_directions 
                SET content = :content, updated_at = :updated_at 
                WHERE id = :id
            ");
            $stmt->execute([
                ':content' => $content,
                ':updated_at' => $now,
                ':id' => $existing['id']
            ]);
            AppHelper::logActivity($this->pdo, 'weekly_direction_update', 'weekly_direction', $existing['id'], 'Mengupdate arahan mingguan', null, $businessUnit);
        } else {
            $stmt = $this->pdo->prepare("
                INSERT INTO weekly_directions (user_id, week_start, content, business_unit, created_at, updated_at) 
                VALUES (:user_id, :week_start, :content, :business_unit, :created_at, :updated_at)
            ");
            $stmt->execute([
                ':user_id' => $userId,
                ':week_start' => $weekStart,
                ':content' => $content,
                ':business_unit' => $businessUnit,
                ':created_at' => $now,
                ':updated_at' => $now
            ]);
            $lastId = $this->pdo->lastInsertId();
            AppHelper::logActivity($this->pdo, 'weekly_direction_create', 'weekly_direction', $lastId ? (int)$lastId : null, 'Membuat arahan mingguan', null, $businessUnit);
        }

        Utils::sendSuccess(['message' => 'Arahan mingguan disimpan']);
    }

    public function insights(): void
    {
        $userId = $_SESSION['user_id'] ?? null;
        if (!$userId) {
            Utils::sendSuccess(['message' => 'Tidak Diizinkan', 'insights' => null]);
            return;
        }

        $weekStartStr = $_GET['week_start'] ?? null;
        if (!$weekStartStr) {
            Utils::sendError('Tanggal awal minggu diperlukan');
            return;
        }

        $businessUnit = $_GET['business_unit'] ?? null;
        $settings = AppHelper::getSystemSettings($this->pdo);
        if (empty($settings['weekly_insights_enabled'])) {
            Utils::sendSuccess(['message' => 'Weekly insights dinonaktifkan', 'insights' => null]);
            return;
        }

        // Calculate range (Monday 00:00:00 to Next Monday 00:00:00 exclusive)
        $startDate = $weekStartStr . ' 00:00:00';
        $endDate = date('Y-m-d', strtotime($weekStartStr . ' +7 days')) . ' 00:00:00';

        // 1. Task Metrics
        $params = [':start' => $startDate, ':end' => $endDate];
        $buSql = "";
        if (!empty($businessUnit)) {
            $buSql = " AND business_unit = :business_unit";
            $params[':business_unit'] = $businessUnit;
        }

        // Completed Tasks
        $sqlCompleted = "SELECT COUNT(*) as count FROM tasks WHERE status = 'done' AND completed_at >= :start AND completed_at < :end" . $buSql;
        $stmtCompleted = $this->pdo->prepare($sqlCompleted);
        $stmtCompleted->execute($params);
        $completedCount = $stmtCompleted->fetch(PDO::FETCH_ASSOC)['count'];

        // Terminated Tasks (status='cancelled')
        $sqlTerminated = "SELECT COUNT(*) as count FROM tasks WHERE status = 'cancelled' AND updated_at >= :start AND updated_at < :end" . $buSql;
        $stmtTerminated = $this->pdo->prepare($sqlTerminated);
        $stmtTerminated->execute($params);
        $terminatedCount = $stmtTerminated->fetch(PDO::FETCH_ASSOC)['count'];

        // Created Tasks
        $sqlCreated = "SELECT COUNT(*) as count FROM tasks WHERE created_at >= :start AND created_at < :end" . $buSql;
        $stmtCreated = $this->pdo->prepare($sqlCreated);
        $stmtCreated->execute($params);
        $createdCount = $stmtCreated->fetch(PDO::FETCH_ASSOC)['count'];

        // 2. Project Metrics (Terminated)
        $projParams = [':start' => $startDate, ':end' => $endDate];
        $projBuSql = "";
        if (!empty($businessUnit)) {
            $projBuSql = " AND business_unit = :business_unit";
            $projParams[':business_unit'] = $businessUnit;
        }
        
        $sqlProjTerminated = "SELECT COUNT(*) as count FROM projects WHERE status = 'terminated' AND updated_at >= :start AND updated_at < :end" . $projBuSql;
        $stmtProjTerminated = $this->pdo->prepare($sqlProjTerminated);
        $stmtProjTerminated->execute($projParams);
        $projTerminatedCount = $stmtProjTerminated->fetch(PDO::FETCH_ASSOC)['count'];

        // 3. Termination Reasons (The "Learning" part)
        // Task Reasons
        $taskReasonSql = "
            SELECT tc.content, t.title as source_title, 'task' as source_type, tc.created_at
            FROM task_comments tc
            JOIN tasks t ON tc.task_id = t.id
            WHERE tc.content LIKE 'Terminated. Reason:%'
            AND tc.created_at >= :start AND tc.created_at < :end
        ";
        if (!empty($businessUnit)) {
            $taskReasonSql .= " AND t.business_unit = :business_unit";
        }
        $taskReasonSql .= " ORDER BY tc.created_at DESC";
        
        $stmtTaskReasons = $this->pdo->prepare($taskReasonSql);
        $stmtTaskReasons->execute($params);
        $taskReasons = $stmtTaskReasons->fetchAll(PDO::FETCH_ASSOC);

        // Project Reasons (from Activity Logs)
        $projReasonSql = "
            SELECT description as content, entity_id, 'project' as source_type, created_at
            FROM activity_logs
            WHERE event_type = 'project_terminate'
            AND created_at >= :start AND created_at < :end
        ";
        if (!empty($businessUnit)) {
            $projReasonSql .= " AND business_unit = :business_unit";
        }
        $projReasonSql .= " ORDER BY created_at DESC";

        $stmtProjReasons = $this->pdo->prepare($projReasonSql);
        $stmtProjReasons->execute($params); // reusing params as they have start, end, business_unit
        $projReasonsRaw = $stmtProjReasons->fetchAll(PDO::FETCH_ASSOC);

        // Fetch project titles for reasons
        $projReasons = [];
        foreach ($projReasonsRaw as $r) {
            // Get title
            $stmtP = $this->pdo->prepare("SELECT title FROM projects WHERE id = :id");
            $stmtP->execute([':id' => $r['entity_id']]);
            $p = $stmtP->fetch(PDO::FETCH_ASSOC);
            $r['source_title'] = $p ? $p['title'] : 'Unknown Project';
            $projReasons[] = $r;
        }

        // Merge reasons
        $allReasons = array_merge($taskReasons, $projReasons);
        
        // Clean up content strings
        foreach ($allReasons as &$reason) {
            $reason['content'] = str_replace('Terminated. Reason: ', '', $reason['content']);
            $reason['content'] = str_replace('Dibatalkan: ', '', $reason['content']); // Indonesian Task
            $reason['content'] = str_replace('Project terminated. Reason: ', '', $reason['content']);
            $reason['content'] = str_replace('Terminasi project: ', '', $reason['content']); // Indonesian Project
        }

        // 4. Energy Distribution (Pattern Analysis)
        $energySql = "SELECT energy_level, COUNT(*) as count FROM tasks WHERE status = 'done' AND completed_at >= :start AND completed_at < :end" . $buSql . " GROUP BY energy_level";
        $stmtEnergy = $this->pdo->prepare($energySql);
        $stmtEnergy->execute($params);
        $energyData = $stmtEnergy->fetchAll(PDO::FETCH_KEY_PAIR); // [ 'high' => 5, 'medium' => 2 ]

        // 5. Daily Velocity (Pattern Analysis)
        // Using SQLite strftime or MySQL DATE() depending on DB. Assuming MySQL/MariaDB based on Laragon.
        $velocitySql = "SELECT DATE(completed_at) as date, COUNT(*) as count FROM tasks WHERE status = 'done' AND completed_at >= :start AND completed_at < :end" . $buSql . " GROUP BY DATE(completed_at) ORDER BY date ASC";
        $stmtVelocity = $this->pdo->prepare($velocitySql);
        $stmtVelocity->execute($params);
        $velocityData = $stmtVelocity->fetchAll(PDO::FETCH_ASSOC);

        // 6. Bio-Rhythm (User Energy from Daily Updates)
        $bioSql = "SELECT date, energy_level FROM daily_updates WHERE user_id = :user_id AND date >= :start_date AND date < :end_date ORDER BY date ASC";
        $bioParams = [
            ':user_id' => $userId,
            ':start_date' => date('Y-m-d', strtotime($startDate)),
            ':end_date' => date('Y-m-d', strtotime($endDate))
        ];
        $stmtBio = $this->pdo->prepare($bioSql);
        $stmtBio->execute($bioParams);
        $bioData = $stmtBio->fetchAll(PDO::FETCH_ASSOC);

        // 7. Automated Pattern Analysis
        $analysis = [];
        
        // Bio-Rhythm Analysis
        if (!empty($bioData)) {
            $avgEnergy = array_sum(array_column($bioData, 'energy_level')) / count($bioData);
            if ($avgEnergy < 40) {
                $analysis[] = "Peringatan Baterai Lemah: Rata-rata energi minggu ini hanya " . round($avgEnergy) . "%. Prioritaskan pemulihan.";
            } elseif ($avgEnergy > 80) {
                $analysis[] = "Zona Performa Tinggi: Anda sedang berapi-api! Rata-rata energi: " . round($avgEnergy) . "%.";
            } else {
                $analysis[] = "Kondisi Stabil: Rata-rata energi Anda terjaga baik (" . round($avgEnergy) . "%).";
            }
        }

        // Correlation Engine: Energy vs Velocity
        if (!empty($bioData) && !empty($velocityData)) {
            // Index velocity by date
            $velocityMap = [];
            foreach ($velocityData as $v) {
                $velocityMap[$v['date']] = $v['count'];
            }

            $buckets = [
                'high' => ['tasks' => 0, 'days' => 0], // >= 70
                'med' => ['tasks' => 0, 'days' => 0],  // 30-69
                'low' => ['tasks' => 0, 'days' => 0]   // < 30
            ];

            foreach ($bioData as $day) {
                $date = $day['date'];
                $energy = $day['energy_level'];
                $tasks = $velocityMap[$date] ?? 0;

                if ($energy >= 70) {
                    $buckets['high']['tasks'] += $tasks;
                    $buckets['high']['days']++;
                } elseif ($energy < 30) {
                    $buckets['low']['tasks'] += $tasks;
                    $buckets['low']['days']++;
                } else {
                    $buckets['med']['tasks'] += $tasks;
                    $buckets['med']['days']++;
                }
            }

            // Calculate Averages
            $avgs = [];
            foreach ($buckets as $key => $data) {
                if ($data['days'] > 0) {
                    $avgs[$key] = $data['tasks'] / $data['days'];
                }
            }

            // Generate Insights
            if (isset($avgs['high']) && isset($avgs['low'])) {
                if ($avgs['high'] > $avgs['low'] * 1.5) {
                    $diff = round((($avgs['high'] - $avgs['low']) / $avgs['low']) * 100);
                    $analysis[] = "Keselarasan Energi: Anda {$diff}% lebih produktif saat energi tinggi.";
                } elseif ($avgs['low'] > $avgs['high']) {
                    $analysis[] = "Pecandu Adrenalin? Anda menyelesaikan lebih banyak tugas saat energi rendah. Risiko burnout.";
                }
            } elseif (isset($avgs['med']) && !isset($avgs['high']) && !isset($avgs['low'])) {
                $analysis[] = "Konsistensi: Anda menjaga output stabil dengan energi menengah.";
            }

            if (isset($avgs['high']) && $avgs['high'] > 5) {
                 $analysis[] = "Hari Bertenaga: Anda rata-rata menyelesaikan " . round($avgs['high'], 1) . " tugas saat energi tinggi.";
            }
        }

        // Energy Analysis (Tasks)
        $totalEnergyTasks = array_sum($energyData);
        if ($totalEnergyTasks > 0) {
            $highPct = ($energyData['high'] ?? 0) / $totalEnergyTasks;
            $lowPct = ($energyData['low'] ?? 0) / $totalEnergyTasks;
            
            if ($highPct > 0.4) {
                $analysis[] = "Interval Intensitas Tinggi: >40% tugas membutuhkan energi tinggi. Waspada kelelahan.";
            } elseif ($lowPct > 0.4) {
                $analysis[] = "Mode Pemulihan: >40% tugas benergi rendah. Bagus untuk maintenance.";
            } else {
                $analysis[] = "Aliran Seimbang: Output energi terdistribusi dengan baik.";
            }
        }

        // Velocity Analysis
        if (!empty($velocityData)) {
            $maxV = 0;
            $maxDate = '';
            foreach ($velocityData as $d) {
                if ($d['count'] > $maxV) {
                    $maxV = $d['count'];
                    $maxDate = $d['date'];
                }
            }
            if ($maxDate) {
                // Localize day name
                $dayName = Utils::translateDay(date('l', strtotime($maxDate)));
                $analysis[] = "Kecepatan Puncak: {$dayName} adalah hari paling produktif ({$maxV} tugas).";
            }
        }

        // Throughput Analysis
        if ($createdCount > 0) {
            $ratio = $completedCount / $createdCount;
            if ($ratio > 1.2) {
                $analysis[] = "Pembersihan Backlog: Anda menyelesaikan jauh lebih banyak daripada yang dibuat.";
            } elseif ($ratio < 0.7) {
                $analysis[] = "Peringatan Akumulasi: Pembuatan tugas lebih cepat daripada penyelesaian.";
            }
        }

        // 8. Golden Hours (Productivity by Hour)
        $goldenSql = "SELECT completed_at FROM tasks WHERE status = 'done' AND completed_at >= :start AND completed_at < :end" . $buSql;
        $stmtGolden = $this->pdo->prepare($goldenSql);
        $stmtGolden->execute($params);
        $completedDates = $stmtGolden->fetchAll(PDO::FETCH_COLUMN);

        $goldenData = [];
        foreach ($completedDates as $dateStr) {
             $ts = strtotime($dateStr);
             if ($ts) {
                 $hour = (int)date('G', $ts);
                 if (!isset($goldenData[$hour])) {
                     $goldenData[$hour] = 0;
                 }
                 $goldenData[$hour]++;
             }
        }

        // Golden Hour Insight
        $maxHourCount = 0;
        $bestHour = -1;
        foreach ($goldenData as $h => $c) {
            if ($c > $maxHourCount) {
                $maxHourCount = $c;
                $bestHour = $h;
            }
        }
        if ($bestHour !== -1 && $maxHourCount > 1) {
            $period = $bestHour < 12 ? "Pagi" : ($bestHour < 18 ? "Siang/Sore" : "Malam");
            $analysis[] = "Jam Emas: Produktivitas puncak Anda sekitar jam " . sprintf("%02d:00", $bestHour) . " ($period).";
        }

        // 9. Decision Metrics (Phase 4)
        $decisionSql = "SELECT decision_type, COUNT(*) as count FROM decision_logs WHERE user_id = :user_id AND created_at >= :start AND created_at < :end GROUP BY decision_type";
        $stmtDecision = $this->pdo->prepare($decisionSql);
        $stmtDecision->execute([':user_id' => $userId, ':start' => $startDate, ':end' => $endDate]);
        $decisionData = $stmtDecision->fetchAll(PDO::FETCH_KEY_PAIR);

        // Decision Analysis
        $totalDecisions = array_sum($decisionData);
        if ($totalDecisions > 50) {
             $analysis[] = "Beban Kognitif Tinggi: Anda membuat $totalDecisions keputusan terdokumentasi minggu ini.";
        }

        Utils::sendSuccess([
            'metrics' => [
                'tasks_completed' => $completedCount,
                'tasks_terminated' => $terminatedCount,
                'tasks_created' => $createdCount,
                'projects_terminated' => $projTerminatedCount
            ],
            'reasons' => $allReasons,
            'energy_distribution' => $energyData,
            'daily_velocity' => $velocityData,
            'bio_rhythm' => $bioData,
            'golden_hours' => $goldenData,
            'decision_stats' => $decisionData,
            'analysis' => $analysis
        ]);
    }
}
