<?php

class OracleEngine {
    private $pdo;
    private $userId;

    public function __construct(PDO $pdo, int $userId) {
        $this->pdo = $pdo;
        $this->userId = $userId;
    }

    public function analyze(): array {
        // 1. Fetch Data (Last 14 Days)
        $data = $this->fetchData();
        
        if (count($data) < 3) {
            return [
                'level' => 'unknown',
                'message' => 'The Oracle butuh lebih banyak data energi (min 3 hari).',
                'trend' => 'flat',
                'risk_score' => 0,
                'advice' => 'Isi Jurnal Harian secara rutin.'
            ];
        }

        // 2. Analyze Trends
        $energyTrend = $this->calculateTrend(array_column($data, 'energy_level'));
        $workloadTrend = $this->calculateTrend(array_column($data, 'tasks_completed'));
        
        // 3. Calculate Risk Score
        $riskAnalysis = $this->calculateRisk($data, $energyTrend, $workloadTrend);

        return [
            'level' => $riskAnalysis['level'],
            'message' => $riskAnalysis['message'],
            'trend' => $energyTrend['direction'], // Visual indicator for energy
            'risk_score' => $riskAnalysis['score'],
            'details' => [
                'energy_avg' => $energyTrend['average'],
                'workload_avg' => $workloadTrend['average']
            ]
        ];
    }

    private function fetchData(): array {
        // Get Energy (from daily_updates) and Task Counts (from tasks) per day
        // This is a simplified fetch. In reality, we might need a JOIN or separate queries.
        // For now, let's assume we get energy from daily_updates. 
        // We'll mock task counts or fetch them if possible.
        
        $sql = "SELECT date, energy_level FROM daily_updates 
                WHERE user_id = :uid 
                ORDER BY date DESC LIMIT 14";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':uid' => $this->userId]);
        $updates = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Sort by date ASC for trend analysis
        usort($updates, function($a, $b) {
            return strtotime($a['date']) - strtotime($b['date']);
        });

        // Enrich with task counts (Optimized: Single Query)
        $dates = array_column($updates, 'date');
        $taskCounts = [];

        if (!empty($dates)) {
            $placeholders = implode(',', array_fill(0, count($dates), '?'));
            $sqlTasks = "SELECT date(completed_at) as d, COUNT(*) as c 
                         FROM tasks 
                         WHERE created_by = ? 
                         AND date(completed_at) IN ($placeholders) 
                         GROUP BY date(completed_at)";
            
            $stmtTasks = $this->pdo->prepare($sqlTasks);
            $params = array_merge([$this->userId], $dates);
            $stmtTasks->execute($params);
            $taskCounts = $stmtTasks->fetchAll(PDO::FETCH_KEY_PAIR);
        }

        foreach ($updates as &$day) {
            $day['tasks_completed'] = isset($taskCounts[$day['date']]) ? (int)$taskCounts[$day['date']] : 0;
        }

        return $updates;
    }

    private function calculateTrend(array $values): array {
        if (empty($values)) return ['average' => 0, 'direction' => 'flat', 'slope' => 0];

        $count = count($values);
        $sum = array_sum($values);
        $average = $sum / $count;

        // Simple Linear Regression for Slope
        // x = day index (0 to n), y = value
        $n = $count;
        $sumX = 0;
        $sumY = 0;
        $sumXY = 0;
        $sumXX = 0;

        for ($i = 0; $i < $n; $i++) {
            $sumX += $i;
            $sumY += $values[$i];
            $sumXY += ($i * $values[$i]);
            $sumXX += ($i * $i);
        }

        $slope = 0;
        $denominator = ($n * $sumXX) - ($sumX * $sumX);
        if ($denominator != 0) {
            $slope = (($n * $sumXY) - ($sumX * $sumY)) / $denominator;
        }

        $direction = 'flat';
        if ($slope > 0.5) $direction = 'up';
        if ($slope < -0.5) $direction = 'down';

        return [
            'average' => $average,
            'direction' => $direction,
            'slope' => $slope
        ];
    }

    private function calculateRisk(array $data, array $energy, array $workload): array {
        $score = 0;
        $message = "Sistem Stabil";
        $level = "stable";

        // Factor 1: Low Energy Baseline
        if ($energy['average'] < 40) {
            $score += 40;
            $message = "Energi Rata-rata Rendah";
        }

        // Factor 2: Declining Energy
        if ($energy['slope'] < -1.5) {
            $score += 30;
            $message = "Energi Menurun Drastis";
        }

        // Factor 3: High Workload + Low Energy (The Danger Zone)
        // If Workload is increasing but Energy is decreasing
        if ($workload['slope'] > 0 && $energy['slope'] < 0) {
            $score += 50; // Major risk factor
            $message = "PERINGATAN: Beban Kerja Naik saat Energi Turun!";
        }

        // Factor 4: Chronic Low Energy (Last 3 days all < 30)
        $recent = array_slice($data, -3);
        $chronicLow = true;
        foreach ($recent as $day) {
            if ($day['energy_level'] > 35) $chronicLow = false;
        }
        if ($chronicLow && count($recent) == 3) {
            $score += 40;
            $message = "KELELAHAN KRONIS TERDETEKSI";
        }

        // Determine Level
        if ($score >= 80) {
            $level = 'critical';
            $message = "BAHAYA BURNOUT: " . $message;
        } elseif ($score >= 50) {
            $level = 'warning';
            $message = "Waspada: " . $message;
        } elseif ($energy['average'] > 80 && $energy['slope'] >= 0) {
            $level = 'optimal';
            $message = "Kondisi Prima! Manfaatkan momentum ini.";
        }

        return [
            'score' => min(100, $score),
            'level' => $level,
            'message' => $message
        ];
    }
}
