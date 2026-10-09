<?php

require_once __DIR__ . '/Database.php';

class AuditLogger {
    public static function log($action, $entityType = null, $entityId = null, $details = null, $userId = null) {
        try {
            $pdo = Database::connection();
            
            // If user_id is not provided, try to get it from session
            if ($userId === null) {
                if (session_status() === PHP_SESSION_NONE) {
                    session_start();
                }
                $userId = $_SESSION['user_id'] ?? null;
            }
            
            // Get IP and User Agent
            $ipAddress = $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN';
            $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'UNKNOWN';
            
            // Encode details if it's an array/object
            if (is_array($details) || is_object($details)) {
                $details = json_encode($details);
            }
            
            $stmt = $pdo->prepare("INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([$userId, $action, $entityType, $entityId, $details, $ipAddress, $userAgent]);
            
            return true;
        } catch (Exception $e) {
            // Silently fail logging to not disrupt the main flow
            error_log("Audit Log Failed: " . $e->getMessage());
            return false;
        }
    }
}
