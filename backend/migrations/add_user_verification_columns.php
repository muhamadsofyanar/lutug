<?php
require_once __DIR__ . '/../core/Database.php';

try {
    $pdo = Database::connection();
    
    // Add columns if they don't exist
    $cols = $pdo->query("PRAGMA table_info(users)")->fetchAll(PDO::FETCH_ASSOC);
    $existingCols = array_column($cols, 'name');

    if (!in_array('email', $existingCols)) {
        $pdo->exec("ALTER TABLE users ADD COLUMN email TEXT DEFAULT NULL");
        // SQLite doesn't support adding UNIQUE constraint in ALTER TABLE easily, 
        // but we can enforce it in application logic or recreate table (too risky).
        // Application logic check is fine for now.
    }
    
    if (!in_array('phone', $existingCols)) {
        $pdo->exec("ALTER TABLE users ADD COLUMN phone TEXT DEFAULT NULL");
    }

    if (!in_array('otp_code', $existingCols)) {
        $pdo->exec("ALTER TABLE users ADD COLUMN otp_code TEXT DEFAULT NULL");
    }

    if (!in_array('otp_expiry', $existingCols)) {
        $pdo->exec("ALTER TABLE users ADD COLUMN otp_expiry DATETIME DEFAULT NULL");
    }

    if (!in_array('is_verified', $existingCols)) {
        $pdo->exec("ALTER TABLE users ADD COLUMN is_verified INTEGER DEFAULT 0");
    }

    echo "Migration successful: Added email, phone, and otp columns to users table.\n";
    
} catch (PDOException $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
}
