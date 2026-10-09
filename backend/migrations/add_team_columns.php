<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/config/config.php';
require_once dirname(__DIR__) . '/core/Utils.php';

try {
    $pdo = new PDO('sqlite:' . INSYARAH_DB_PATH);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    echo "Migrating database for Team features...\n";

    // 1. Add visibility to projects
    echo "Checking projects table...\n";
    $cols = $pdo->query("PRAGMA table_info(projects)")->fetchAll(PDO::FETCH_ASSOC);
    $hasVisibility = false;
    foreach ($cols as $col) {
        if ($col['name'] === 'visibility') {
            $hasVisibility = true;
            break;
        }
    }

    if (!$hasVisibility) {
        echo "Adding visibility column to projects...\n";
        $pdo->exec("ALTER TABLE projects ADD COLUMN visibility TEXT DEFAULT 'private'");
    } else {
        echo "projects.visibility already exists.\n";
    }

    // 2. Add business_unit to users
    echo "Checking users table...\n";
    $cols = $pdo->query("PRAGMA table_info(users)")->fetchAll(PDO::FETCH_ASSOC);
    $hasUnit = false;
    foreach ($cols as $col) {
        if ($col['name'] === 'business_unit') {
            $hasUnit = true;
            break;
        }
    }

    if (!$hasUnit) {
        echo "Adding business_unit column to users...\n";
        $pdo->exec("ALTER TABLE users ADD COLUMN business_unit TEXT DEFAULT NULL");
    } else {
        echo "users.business_unit already exists.\n";
    }

    echo "Migration completed successfully.\n";

} catch (PDOException $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}
