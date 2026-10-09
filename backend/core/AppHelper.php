<?php

declare(strict_types=1);

require_once __DIR__ . '/Utils.php';

class AppHelper
{
    public static function getCurrentUsername(): string
    {
        return $_SESSION['username'] ?? 'Saya';
    }

    public static function normalizeAssignedTo(array $body): string
    {
        $assignedTo = self::getCurrentUsername();
        if (isset($body['assignedTo']) && is_string($body['assignedTo'])) {
            $value = trim($body['assignedTo']);
            if ($value !== '') {
                $assignedTo = $value;
            }
        }
        return $assignedTo;
    }

    public static function logActivity(PDO $pdo, string $eventType, string $entityType, ?int $entityId, string $description, ?string $actor = null, ?string $businessUnit = null): void
    {
        $actor = $actor ?? self::getCurrentUsername();
        try {
            $now = Utils::now();
            $stmt = $pdo->prepare('INSERT INTO activity_logs (event_type, entity_type, entity_id, description, actor, business_unit, created_at) VALUES (:event_type, :entity_type, :entity_id, :description, :actor, :business_unit, :created_at)');
            $stmt->execute([
                ':event_type' => $eventType,
                ':entity_type' => $entityType,
                ':entity_id' => $entityId,
                ':description' => $description,
                ':actor' => $actor,
                ':business_unit' => $businessUnit,
                ':created_at' => $now,
            ]);
        } catch (Throwable $e) {
            // Silent failure for logs, but let's log to file for debugging
            file_put_contents(dirname(__DIR__) . '/debug_activity_log_error.txt', date('Y-m-d H:i:s') . " Error: " . $e->getMessage() . "\n", FILE_APPEND);
        }
    }

    public static function inboxItemById(PDO $pdo, int $id): ?array
    {
        $stmt = $pdo->prepare('SELECT id, content, status, created_at, created_by, business_unit FROM inbox_items WHERE id = :id');
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row === false) {
            return null;
        }
        return $row;
    }

    public static function canAccessProject(array $project, ?int $userId, string $role, array $assignedUnits): bool
    {
        // Public projects accessible to everyone
        if (($project['visibility'] ?? 'private') === 'public') return true;

        // For non-public projects, user must be logged in
        if (!$userId) return false;

        // Admin always has access
        if ($role === 'admin') return true;

        // Project Creator
        if (($project['created_by'] ?? null) == $userId) return true;

        // Team Project
        if (($project['visibility'] ?? 'private') === 'team') {
             if (in_array($project['business_unit'] ?? '', $assignedUnits)) {
                 return true;
             }
        }

        return false;
    }

    // --- System Settings ---
    // Now using Database 'settings' table

    public static function getSystemSettings(PDO $pdo): array
    {
        try {
            $stmt = $pdo->query("SELECT setting_key, setting_value FROM settings");
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            $settings = [
                'registration_enabled' => true,
                'maintenance_mode' => false,
                'gamification_enabled' => false,
                'oracle_enabled' => false,
                'weekly_insights_enabled' => false,
                'knowledge_graph_enabled' => false,
                'whatsapp_enabled' => false,
                'telegram_enabled' => false
            ];

            foreach ($rows as $row) {
                // Convert string '1'/'0' or 'true'/'false' to boolean if needed, or just keep as is
                // For 'registration_enabled', we expect boolean behavior
                $val = $row['setting_value'];
                $boolKeys = [
                    'registration_enabled',
                    'gamification_enabled',
                    'oracle_enabled',
                    'weekly_insights_enabled',
                    'knowledge_graph_enabled',
                    'whatsapp_enabled',
                    'telegram_enabled',
                ];
                if (in_array($row['setting_key'], $boolKeys, true)) {
                    $val = ($val === '1' || $val === 'true');
                }
                $settings[$row['setting_key']] = $val;
            }
            return $settings;
        } catch (Exception $e) {
            // Fallback if table missing
            return [
                'registration_enabled' => true,
                'maintenance_mode' => false,
                'gamification_enabled' => false,
                'oracle_enabled' => false,
                'weekly_insights_enabled' => false,
                'knowledge_graph_enabled' => false,
                'whatsapp_enabled' => false,
                'telegram_enabled' => false
            ];
        }
    }

    public static function updateSystemSetting(PDO $pdo, string $key, $value): void
    {
        // Store as string
        $strValue = $value;
        if (is_bool($value)) {
            $strValue = $value ? '1' : '0';
        }

        // Upsert
        // SQLite: INSERT OR REPLACE
        // MySQL: INSERT ... ON DUPLICATE KEY UPDATE
        // Portable: Check then Insert/Update
        
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM settings WHERE setting_key = :key");
        $stmt->execute([':key' => $key]);
        $exists = $stmt->fetchColumn() > 0;

        if ($exists) {
            $stmt = $pdo->prepare("UPDATE settings SET setting_value = :val, updated_at = CURRENT_TIMESTAMP WHERE setting_key = :key");
            $stmt->execute([':val' => $strValue, ':key' => $key]);
        } else {
            $stmt = $pdo->prepare("INSERT INTO settings (setting_key, setting_value) VALUES (:key, :val)");
            $stmt->execute([':key' => $key, ':val' => $strValue]);
        }
    }
}
