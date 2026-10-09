<?php

class RateLimiter {
    private $pdo;
    
    public function __construct($pdo) {
        $this->pdo = $pdo;
    }
    
    /**
     * Check if request is allowed
     * @param string $key Unique identifier (e.g. IP)
     * @param int $limit Max requests
     * @param int $window Window in seconds
     * @return bool
     */
    public function check($key, $limit, $window) {
        $now = time();
        
        // Garbage collection (1% chance)
        if (rand(1, 100) <= 1) {
            $this->cleanup($now);
        }
        
        $stmt = $this->pdo->prepare("SELECT * FROM rate_limits WHERE `key` = :key");
        $stmt->execute(['key' => $key]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($row) {
            if ($now > $row['reset_at']) {
                // Window expired, reset
                $stmt = $this->pdo->prepare("UPDATE rate_limits SET requests = 1, reset_at = :reset_at WHERE `key` = :key");
                $stmt->execute(['key' => $key, 'reset_at' => $now + $window]);
                return true;
            } else {
                // Window active
                if ($row['requests'] < $limit) {
                    $stmt = $this->pdo->prepare("UPDATE rate_limits SET requests = requests + 1 WHERE `key` = :key");
                    $stmt->execute(['key' => $key]);
                    return true;
                } else {
                    return false;
                }
            }
        } else {
            // New entry
            $stmt = $this->pdo->prepare("INSERT INTO rate_limits (`key`, requests, reset_at) VALUES (:key, 1, :reset_at)");
            $stmt->execute(['key' => $key, 'reset_at' => $now + $window]);
            return true;
        }
    }
    
    private function cleanup($now) {
        try {
            $this->pdo->exec("DELETE FROM rate_limits WHERE reset_at < $now");
        } catch (Throwable $e) {
            // Ignore cleanup errors
        }
    }
}
