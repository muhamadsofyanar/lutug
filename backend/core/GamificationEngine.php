<?php

require_once __DIR__ . '/Database.php';

class GamificationEngine
{
    private $pdo;

    const BADGES = [
        'first_blood' => ['name' => 'Langkah Awal', 'desc' => 'Menyelesaikan tugas pertama', 'icon' => '🩸'],
        'streak_7' => ['name' => 'Pejuang Mingguan', 'desc' => 'Streak 7 hari berturut-turut', 'icon' => '🔥'],
        'streak_30' => ['name' => 'Tekad Baja', 'desc' => 'Streak 30 hari berturut-turut', 'icon' => '🗿'],
        'level_5' => ['name' => 'Veteran', 'desc' => 'Mencapai Level 5', 'icon' => '⭐'],
        'level_10' => ['name' => 'Elit', 'desc' => 'Mencapai Level 10', 'icon' => '👑'],
        'focus_novice' => ['name' => 'Fokus Pemula', 'desc' => 'Menyelesaikan sesi fokus pertama', 'icon' => '🧘'],
        'focus_marathon' => ['name' => 'Fokus Mendalam', 'desc' => 'Sesi fokus > 45 menit', 'icon' => '🌊'],
        'focus_master' => ['name' => 'Master Zen', 'desc' => 'Total fokus > 100 menit', 'icon' => '🧠'],
        'decision_maker' => ['name' => 'Penentu Arah', 'desc' => 'Mencatat 50 keputusan', 'icon' => '⚖️'],
    ];

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
    }

    public function addXp($userId, $amount)
    {
        $stmt = $this->pdo->prepare("SELECT xp, level, earned_badges FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user) return;

        $currentXp = (int)$user['xp'];
        $currentLevel = (int)$user['level'];
        
        $newXp = $currentXp + $amount;
        $newLevel = $this->calculateLevel($newXp);

        // Update DB
        $stmt = $this->pdo->prepare("UPDATE users SET xp = ?, level = ? WHERE id = ?");
        $stmt->execute([$newXp, $newLevel, $userId]);

        // Check for Level Badges
        $newBadges = [];
        if ($newLevel > $currentLevel) {
            $newBadges = $this->checkBadges($userId, 'level', ['level' => $newLevel, 'earned_badges' => $user['earned_badges']]);
        }

        return [
            'xp_gained' => $amount,
            'new_xp' => $newXp,
            'new_level' => $newLevel,
            'level_up' => $newLevel > $currentLevel,
            'new_badges' => $newBadges
        ];
    }

    private function calculateLevel($xp)
    {
        // Simple formula: Level = 1 + floor(sqrt(XP / 100))
        // Or fixed tiers:
        // Lvl 1: 0-499
        // Lvl 2: 500-1999
        // Lvl 3: 2000-4999
        // Lvl 4: 5000-9999
        // Lvl 5: 10000+
        
        if ($xp >= 50000) return 10;
        if ($xp >= 25000) return 9;
        if ($xp >= 15000) return 8;
        if ($xp >= 12000) return 7;
        if ($xp >= 11000) return 6;
        if ($xp >= 10000) return 5;
        if ($xp >= 5000) return 4;
        if ($xp >= 2000) return 3;
        if ($xp >= 500) return 2;
        return 1;
    }

    public function updateStreak($userId)
    {
        // Should be called on Daily Update
        $today = date('Y-m-d');
        
        // Get last update from daily_updates table to verify consistency?
        // Or just trust the caller. 
        // Let's rely on the users table 'last_streak_date' (need to add this? or use last_activity_date?)
        // I didn't add last_streak_date. I'll use a new column or just manage it here.
        // Wait, I didn't add last_streak_date in migration. I added streak_current.
        // I need to know WHEN the last streak increment happened to prevent double counting or reset.
        // Let's check `daily_updates` table for the last entry.
        
        $stmt = $this->pdo->prepare("SELECT date FROM daily_updates WHERE user_id = ? ORDER BY date DESC LIMIT 1");
        $stmt->execute([$userId]);
        $lastUpdate = $stmt->fetchColumn();

        if (!$lastUpdate) {
            // First ever update
            $this->setStreak($userId, 1);
            return;
        }

        $lastDate = new DateTime($lastUpdate);
        $currentDate = new DateTime($today);
        $diff = $currentDate->diff($lastDate)->days;

        if ($diff == 0) {
            // Already updated today, do nothing
            return;
        } elseif ($diff == 1) {
            // Consecutive day
            $this->incrementStreak($userId);
        } else {
            // Streak broken
            $this->setStreak($userId, 1);
        }
    }

    private function incrementStreak($userId)
    {
        $stmt = $this->pdo->prepare("SELECT streak_current, streak_best, earned_badges FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        $newStreak = $user['streak_current'] + 1;
        $bestStreak = max($user['streak_best'], $newStreak);

        $stmt = $this->pdo->prepare("UPDATE users SET streak_current = ?, streak_best = ? WHERE id = ?");
        $stmt->execute([$newStreak, $bestStreak, $userId]);

        // Check Streak Badges
        $this->checkBadges($userId, 'streak', ['streak' => $newStreak, 'earned_badges' => $user['earned_badges']]);
    }

    private function setStreak($userId, $value)
    {
        $stmt = $this->pdo->prepare("UPDATE users SET streak_current = ? WHERE id = ?");
        $stmt->execute([$value, $userId]);
    }

    public function checkBadges($userId, $type, $data)
    {
        if (isset($data['earned_badges'])) {
            $earnedBadges = is_array($data['earned_badges']) ? $data['earned_badges'] : json_decode($data['earned_badges'], true);
        } else {
            $stmt = $this->pdo->prepare("SELECT earned_badges FROM users WHERE id = ?");
            $stmt->execute([$userId]);
            $earnedBadges = json_decode($stmt->fetchColumn() ?? '[]', true);
        }

        $newBadges = [];

        if ($type === 'streak') {
            $streak = $data['streak'];
            if ($streak >= 7 && !in_array('streak_7', $earnedBadges)) {
                $newBadges[] = 'streak_7';
            }
            if ($streak >= 30 && !in_array('streak_30', $earnedBadges)) {
                $newBadges[] = 'streak_30';
            }
        } elseif ($type === 'level') {
            $level = $data['level'];
            if ($level >= 5 && !in_array('level_5', $earnedBadges)) {
                $newBadges[] = 'level_5';
            }
            if ($level >= 10 && !in_array('level_10', $earnedBadges)) {
                $newBadges[] = 'level_10';
            }
        } elseif ($type === 'task_completion') {
            if (!in_array('first_blood', $earnedBadges)) {
                $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM tasks WHERE created_by = ? AND status = 'done'");
                $stmt->execute([$userId]);
                $count = $stmt->fetchColumn();
                if ($count >= 1) {
                    $newBadges[] = 'first_blood';
                }
            }
        } elseif ($type === 'focus_session') {
            $duration = $data['duration']; // Current session duration
            
            // Check Focus Novice (First Session)
            if (!in_array('focus_novice', $earnedBadges)) {
                // If this is called, one session is just completed.
                // We can check count or just assume if not earned yet and we finished one, we get it.
                // But let's check count to be sure.
                $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM focus_sessions WHERE user_id = ? AND status = 'completed'");
                $stmt->execute([$userId]);
                if ($stmt->fetchColumn() >= 1) {
                    $newBadges[] = 'focus_novice';
                }
            }

            // Check Focus Marathon (Single session > 45 mins)
            if ($duration >= 45 && !in_array('focus_marathon', $earnedBadges)) {
                $newBadges[] = 'focus_marathon';
            }

            // Check Focus Master (Total > 100 mins)
            if (!in_array('focus_master', $earnedBadges)) {
                $stmt = $this->pdo->prepare("SELECT SUM(duration_minutes) FROM focus_sessions WHERE user_id = ? AND status = 'completed'");
                $stmt->execute([$userId]);
                $totalMinutes = (int)$stmt->fetchColumn();
                if ($totalMinutes >= 100) {
                    $newBadges[] = 'focus_master';
                }
            }
        } elseif ($type === 'decision_count') {
            if (!in_array('decision_maker', $earnedBadges)) {
                $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM decision_logs WHERE user_id = ?");
                $stmt->execute([$userId]);
                $count = (int)$stmt->fetchColumn();
                if ($count >= 50) {
                    $newBadges[] = 'decision_maker';
                }
            }
        }

        if (!empty($newBadges)) {
            $earnedBadges = array_merge($earnedBadges, $newBadges);
            $stmt = $this->pdo->prepare("UPDATE users SET earned_badges = ? WHERE id = ?");
            $stmt->execute([json_encode($earnedBadges), $userId]);
        }

        return $newBadges;
    }

    public static function getBadgeDetails($badgeId) {
        return self::BADGES[$badgeId] ?? null;
    }
}
