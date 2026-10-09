<?php

declare(strict_types=1);

// Adjust paths based on script location
require_once __DIR__ . '/../core/Utils.php';
require_once __DIR__ . '/../core/Database.php';
require_once __DIR__ . '/../core/BackupManager.php';

// Check if running from CLI
if (php_sapi_name() !== 'cli') {
    die('This script must be run from the command line.');
}

try {
    $pdo = Database::connection();
    $manager = new BackupManager($pdo);
} catch (Exception $e) {
    die("Initialization Error: " . $e->getMessage() . "\n");
}

$command = $argv[1] ?? 'help';

switch ($command) {
    case 'backup':
        echo "Creating backup...\n";
        try {
            $result = $manager->createBackup(true);
            echo "Backup created successfully!\n";
            echo "Filename: " . $result['filename'] . "\n";
            echo "Path: " . $result['path'] . "\n";
        } catch (Exception $e) {
            echo "Error creating backup: " . $e->getMessage() . "\n";
            exit(1);
        }
        break;

    case 'list':
        echo "Available backups:\n";
        $backups = $manager->getBackups();
        if (empty($backups)) {
            echo "No backups found.\n";
        } else {
            foreach ($backups as $backup) {
                echo "- " . $backup['filename'] . " (" . number_format($backup['size'] / 1024, 2) . " KB) - " . $backup['created_at'] . "\n";
            }
        }
        break;

    case 'restore':
        $filename = $argv[2] ?? null;
        if (!$filename) {
            echo "Error: Please specify the backup filename to restore.\n";
            echo "Usage: php backup_cli.php restore <filename>\n";
            exit(1);
        }
        
        // Construct path relative to backend root
        // script is in backend/scripts
        // backups are in backend/backups
        $targetPath = dirname(__DIR__) . '/backups/' . $filename;

        if (!file_exists($targetPath)) {
             echo "Error: Backup file not found: $filename\n";
             echo "Searched at: $targetPath\n";
             exit(1);
        }

        echo "Restoring from $filename...\n";
        echo "WARNING: This will overwrite existing data! (y/n): ";
        $handle = fopen("php://stdin", "r");
        $line = fgets($handle);
        if (trim(strtolower($line)) !== 'y') {
            echo "Aborted.\n";
            exit;
        }

        try {
            $json = file_get_contents($targetPath);
            $data = json_decode($json, true);
            if (!$data) {
                throw new Exception("Invalid JSON in backup file.");
            }
            $manager->restoreBackup($data);
            echo "Restore completed successfully!\n";
        } catch (Exception $e) {
             echo "Error restoring backup: " . $e->getMessage() . "\n";
             exit(1);
        }
        break;

    case 'cleanup':
        $days = isset($argv[2]) ? (int)$argv[2] : 7;
        echo "Cleaning up backups older than $days days...\n";
        $count = $manager->cleanupOldBackups($days);
        echo "Deleted $count old backup(s).\n";
        break;

    case 'help':
    default:
        echo "Usage: php backup_cli.php [command] [options]\n";
        echo "Commands:\n";
        echo "  backup              Create a new backup\n";
        echo "  list                List available backups\n";
        echo "  restore <filename>  Restore a backup (WARNING: Overwrites data)\n";
        echo "  cleanup [days]      Delete backups older than [days] days (default: 7)\n";
        break;
}
