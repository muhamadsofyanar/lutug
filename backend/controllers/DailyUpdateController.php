<?php

require_once dirname(__DIR__) . '/core/Utils.php';
require_once dirname(__DIR__) . '/core/AppHelper.php';
require_once dirname(__DIR__) . '/core/GamificationEngine.php';

class DailyUpdateController
{
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    public function list(): void
    {
        $this->ensureTableExists();
        $userId = $_SESSION['user_id'] ?? null;
        if (!$userId) {
            Utils::sendError('Tidak terautentikasi', '', 401);
            return;
        }

        // Get updates for a specific date range or limit?
        // For now, let's get updates for the current month or last 30 days
        $stmt = $this->pdo->prepare("
            SELECT du.*, u.username 
            FROM daily_updates du
            JOIN users u ON du.user_id = u.id
            ORDER BY du.date DESC, du.created_at DESC
            LIMIT 50
        ");
        $stmt->execute();
        $updates = $stmt->fetchAll(PDO::FETCH_ASSOC);

        Utils::sendSuccess(['updates' => $updates]);
    }

    public function getToday(): void
    {
        $this->ensureTableExists();
        $userId = $_SESSION['user_id'] ?? null;
        if (!$userId) {
            Utils::sendError('Tidak terautentikasi', '', 401);
            return;
        }

        $date = date('Y-m-d');
        $businessUnit = $_GET['business_unit'] ?? null;

        $query = "SELECT * FROM daily_updates WHERE user_id = ? AND date = ?";
        $params = [$userId, $date];

        if (!empty($businessUnit)) {
            $query .= " AND business_unit = ?";
            $params[] = $businessUnit;
        } else {
            $query .= " AND (business_unit IS NULL OR business_unit = '')";
        }

        $stmt = $this->pdo->prepare($query);
        $stmt->execute($params);
        $update = $stmt->fetch(PDO::FETCH_ASSOC);

        Utils::sendSuccess(['update' => $update]);
    }

    public function save(): void
    {
        $userId = $_SESSION['user_id'] ?? null;
        if (!$userId) {
            Utils::sendError('Tidak terautentikasi', '', 401);
            return;
        }

        try {
            $input = Utils::readJsonBody(); 

            $todayPlan = $input['today_plan'] ?? '';
            $done = $input['done'] ?? '';
            $blocker = $input['blocker'] ?? '';
            $energyLevel = isset($input['energy_level']) ? (int)$input['energy_level'] : 70;
            $businessUnit = $input['business_unit'] ?? null;
            $date = date('Y-m-d');

            // Self-healing: Ensure table exists
            $this->ensureTableExists();

            // Check if exists
            $query = "SELECT id FROM daily_updates WHERE user_id = ? AND date = ?";
            $params = [$userId, $date];

            if (!empty($businessUnit)) {
                $query .= " AND business_unit = ?";
                $params[] = $businessUnit;
            } else {
                $query .= " AND (business_unit IS NULL OR business_unit = '')";
            }

            $stmt = $this->pdo->prepare($query);
            $stmt->execute($params);
            $existing = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($existing) {
                $stmt = $this->pdo->prepare("
                    UPDATE daily_updates 
                    SET today_plan = ?, done = ?, blocker = ?, energy_level = ? 
                    WHERE id = ?
                ");
                $stmt->execute([$todayPlan, $done, $blocker, $energyLevel, $existing['id']]);
                AppHelper::logActivity($this->pdo, 'daily_update_update', 'daily_update', $existing['id'], 'Memperbarui update harian', null, $businessUnit);
            } else {
                
                // Gamification: Streak & XP
                $xpInfo = null;
                try {
                    $gamification = new GamificationEngine($this->pdo);
                    $gamification->updateStreak($userId);
                    $xpInfo = $gamification->addXp($userId, 20);
                } catch (Throwable $e) {
                    // Ignore gamification errors
                }

                $now = date('Y-m-d H:i:s');
                $stmt = $this->pdo->prepare("
                    INSERT INTO daily_updates (user_id, date, today_plan, done, blocker, energy_level, business_unit, created_at) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ");
                $stmt->execute([$userId, $date, $todayPlan, $done, $blocker, $energyLevel, $businessUnit, $now]);
                AppHelper::logActivity($this->pdo, 'daily_update_create', 'daily_update', $this->pdo->lastInsertId(), 'Membuat update harian', null, $businessUnit);
            }

            Utils::sendSuccess(['message' => 'Update harian disimpan', 'xp' => $xpInfo ?? null]);
        } catch (PDOException $e) {
            error_log("DailyUpdate Save Error: " . $e->getMessage());
            Utils::sendError('Kesalahan Database: ' . $e->getMessage(), 'DB_ERROR', 500);
        } catch (Throwable $e) {
            error_log("DailyUpdate Save Error: " . $e->getMessage());
            Utils::sendError('Kesalahan Server: ' . $e->getMessage(), 'SERVER_ERROR', 500);
        }
    }

    private function ensureTableExists(): void
    {
        // Try to create the table if it doesn't exist (Self-healing)
        // Detect if MySQL or SQLite
        $driver = $this->pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
        
        if ($driver === 'mysql') {
            $sql = "
                CREATE TABLE IF NOT EXISTS daily_updates (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    date DATE NOT NULL,
                    today_plan TEXT,
                    done TEXT,
                    blocker TEXT,
                    energy_level INT DEFAULT 70,
                    business_unit VARCHAR(80) DEFAULT NULL,
                    created_at DATETIME NOT NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            ";
        } else {
            // SQLite
            $sql = "
                CREATE TABLE IF NOT EXISTS daily_updates (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    date TEXT NOT NULL,
                    today_plan TEXT,
                    done TEXT,
                    blocker TEXT,
                    energy_level INTEGER DEFAULT 70,
                    business_unit TEXT DEFAULT NULL,
                    created_at TEXT NOT NULL
                );
            ";
        }
        
        $this->pdo->exec($sql);
    }
}
