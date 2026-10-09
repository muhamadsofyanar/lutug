<?php

require_once dirname(__DIR__) . '/core/Utils.php';
require_once dirname(__DIR__) . '/core/GamificationEngine.php';

class GamificationController
{
    private $pdo;
    private $engine;

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
        $this->engine = new GamificationEngine($pdo);
    }

    public function getStats()
    {
        $settings = AppHelper::getSystemSettings($this->pdo);
        if (empty($settings['gamification_enabled'])) {
            Utils::sendSuccess(['enabled' => false]);
            return;
        }
        $userId = $_SESSION['user_id'] ?? null;
        if (!$userId) {
            Utils::sendError('Tidak Diizinkan', '', 401);
            return;
        }

        $stmt = $this->pdo->prepare("SELECT xp, level, streak_current, streak_best, earned_badges FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $stats = $stmt->fetch(PDO::FETCH_ASSOC);

        // Parse badges JSON
        $earnedBadgesIds = json_decode($stats['earned_badges'] ?? '[]', true);
        $detailedBadges = [];
        foreach ($earnedBadgesIds as $badgeId) {
            $details = GamificationEngine::getBadgeDetails($badgeId);
            if ($details) {
                $details['id'] = $badgeId;
                $detailedBadges[] = $details;
            }
        }
        $stats['earned_badges'] = $detailedBadges;

        // Add next level info
        $stats['next_level_xp'] = $this->getNextLevelXp($stats['level']);
        $stats['level_title'] = $this->getLevelTitle($stats['level']);

        Utils::sendSuccess($stats);
    }

    private function getNextLevelXp($currentLevel)
    {
        // Must match GamificationEngine::calculateLevel thresholds
        if ($currentLevel < 1) return 500;
        if ($currentLevel == 1) return 500;
        if ($currentLevel == 2) return 2000;
        if ($currentLevel == 3) return 5000;
        if ($currentLevel == 4) return 10000;
        if ($currentLevel == 5) return 11000;
        if ($currentLevel == 6) return 12000;
        if ($currentLevel == 7) return 15000;
        if ($currentLevel == 8) return 25000;
        if ($currentLevel == 9) return 50000;
        
        return 999999;
    }

    private function getLevelTitle($level)
    {
        switch ($level) {
            case 1: return 'Operator Pemula';
            case 2: return 'Agen Lapangan';
            case 3: return 'Veteran';
            case 4: return 'Komandan Elit';
            case 5: return 'Legenda Cyberpunk';
            case 6: return 'Panglima Neon';
            case 7: return 'Penguasa Sistem';
            case 8: return 'Dewa Netrunner';
            case 9: return 'Singularitas';
            case 10: return 'Sang Arsitek';
            default: return 'Entitas Tidak Dikenal';
        }
    }
}
