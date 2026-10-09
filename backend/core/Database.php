<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'config' . DIRECTORY_SEPARATOR . 'config.php';

final class Database
{
    private static ?PDO $pdo = null;

    public static function connection(): PDO
    {
        if (self::$pdo instanceof PDO) {
            return self::$pdo;
        }

        $connection = env('DB_CONNECTION', 'sqlite');

        if ($connection === 'mysql') {
            $host = env('DB_HOST', '127.0.0.1');
            $port = env('DB_PORT', '3306');
            $database = env('DB_DATABASE', 'insyarah');
            $username = env('DB_USERNAME', 'root');
            $password = env('DB_PASSWORD', '');
            
            $dsn = "mysql:host={$host};port={$port};dbname={$database};charset=utf8mb4";
            
            try {
                $pdo = new PDO($dsn, $username, $password);
                $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
                self::$pdo = $pdo;
                // MySQL usually manages schema via migrations, but for now we can try to auto-init if empty
                // But typically for MySQL we expect the DB to exist.
                // We can run a simple check if tables exist, or just rely on manual migration.
                // For simplicity in this pair-prog session, let's call initSchemaMySQL if needed.
                self::initSchemaMySQL($pdo);
                return self::$pdo;
            } catch (PDOException $e) {
                // Throw exception instead of die() so it can be caught by the global handler
                throw new Exception("DB Connection failed: " . $e->getMessage());
            }
        }

        try {
            $dbPath = INSYARAH_DB_PATH;
            $dir = dirname($dbPath);
            if (!is_dir($dir)) {
                if (!@mkdir($dir, 0777, true)) {
                     throw new Exception("Cannot create database directory: $dir. Please check permissions.");
                }
            }
            if (!is_writable($dir)) {
                 throw new Exception("Database directory is not writable: $dir. Please check permissions.");
            }
            
            $needInit = !file_exists($dbPath);
            $pdo = new PDO('sqlite:' . $dbPath);
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            
            // Performance Optimization for Local SQLite
            $pdo->exec('PRAGMA journal_mode = WAL;');
            $pdo->exec('PRAGMA synchronous = NORMAL;');
            $pdo->exec('PRAGMA busy_timeout = 5000;');

            if ($needInit || !$pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")->fetchColumn()) {
                self::initSchema($pdo);
            }
            self::migrateSchema($pdo);
            self::$pdo = $pdo;
            return self::$pdo;
        } catch (PDOException $e) {
             throw new Exception("SQLite Connection failed: " . $e->getMessage() . " (Path: " . INSYARAH_DB_PATH . ")");
        }
    }

    private static function initSchemaMySQL(PDO $pdo): void
    {
        // Simple check if tables exist to avoid error
        try {
            $pdo->query("SELECT 1 FROM users LIMIT 1");
        } catch (PDOException $e) {
            // Table doesn't exist, continue to creation
        }

        $sql = "
CREATE TABLE IF NOT EXISTS inbox_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    content TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'raw',
    created_by INT NULL,
    business_unit VARCHAR(80) DEFAULT NULL,
    energy_level VARCHAR(50) DEFAULT NULL,
    importance INT DEFAULT 0,
    urgency INT DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    date DATE NOT NULL,
    slot INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    assigned_to VARCHAR(100),
    created_by INT NULL,
    business_unit VARCHAR(80) DEFAULT NULL,
    project_id INT NULL,
    energy_level VARCHAR(50) DEFAULT 'medium',
    context_tags TEXT,
    importance INT DEFAULT 0,
    urgency INT DEFAULT 0,
    linked_references TEXT,
    recurrence_pattern VARCHAR(100),
    next_due_date DATE,
    completed_at DATETIME,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    description TEXT,
    created_by INT NULL,
    business_unit VARCHAR(80) DEFAULT NULL,
    next_action TEXT,
    visibility VARCHAR(50) DEFAULT 'private',
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS project_steps (
            id INT AUTO_INCREMENT PRIMARY KEY,
            project_id INT NOT NULL,
            step_order INT NOT NULL DEFAULT 0,
            title VARCHAR(255) NOT NULL,
            status VARCHAR(50) DEFAULT 'pending',
            created_at DATETIME,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'member',
    job_title VARCHAR(100) DEFAULT NULL,
    business_unit VARCHAR(80) DEFAULT NULL,
    assigned_units TEXT DEFAULT NULL,
    xp INT DEFAULT 0,
    level INT DEFAULT 1,
    streak_current INT DEFAULT 0,
    streak_best INT DEFAULT 0,
    earned_badges TEXT,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS business_units (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS teams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    business_unit_id INT,
    description TEXT,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (business_unit_id) REFERENCES business_units(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INT,
    details TEXT,
    created_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_updates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    date DATE NOT NULL,
    today_plan TEXT,
    done TEXT,
    blocker TEXT,
    business_unit VARCHAR(80) DEFAULT NULL,
    energy_level INT DEFAULT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS weekly_directions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    week_start DATE NOT NULL,
    content TEXT NOT NULL,
    business_unit VARCHAR(80) DEFAULT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
    setting_key VARCHAR(50) PRIMARY KEY,
    setting_value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task_comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT NOT NULL,
    user_id INT NOT NULL,
    comment TEXT NOT NULL,
    created_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS people (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    job_title VARCHAR(100),
    team_id INT,
    created_at DATETIME NOT NULL
);
";
        $pdo->exec($sql);
        
        // Insert default settings if not exists
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM settings WHERE setting_key = 'registration_enabled'");
        $stmt->execute();
        if ($stmt->fetchColumn() == 0) {
            $stmt = $pdo->prepare("INSERT INTO settings (setting_key, setting_value) VALUES ('registration_enabled', '1')");
            $stmt->execute();
        }
    }

    private static function initSchema(PDO $pdo): void
    {
        // SQLite Schema - Updated to match actual DB
        $sql = "
        CREATE TABLE IF NOT EXISTS inbox_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'raw',
            created_by INTEGER,
            business_unit TEXT DEFAULT NULL,
            energy_level TEXT DEFAULT NULL,
            importance INTEGER DEFAULT 0,
            urgency INTEGER DEFAULT 0,
            created_at DATETIME,
            updated_at DATETIME
        );
        
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date DATE NOT NULL,
            slot INTEGER NOT NULL,
            title TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            assigned_to TEXT,
            created_by INTEGER,
            business_unit TEXT DEFAULT NULL,
            project_id INTEGER,
            energy_level TEXT DEFAULT 'medium',
            context_tags TEXT,
            importance INTEGER DEFAULT 0,
            urgency INTEGER DEFAULT 0,
            linked_references TEXT,
            recurrence_pattern TEXT,
            next_due_date DATE,
            completed_at DATETIME,
            created_at DATETIME,
            updated_at DATETIME
        );
        
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            description TEXT,
            created_by INTEGER,
            business_unit TEXT DEFAULT NULL,
            next_action TEXT,
            visibility TEXT DEFAULT 'private',
            created_at DATETIME,
            updated_at DATETIME
        );

        CREATE TABLE IF NOT EXISTS project_steps (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            step_order INTEGER NOT NULL DEFAULT 0,
            title TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at DATETIME,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'member',
            job_title TEXT DEFAULT NULL,
            business_unit TEXT DEFAULT NULL,
            assigned_units TEXT DEFAULT NULL,
            xp INTEGER DEFAULT 0,
            level INTEGER DEFAULT 1,
            streak_current INTEGER DEFAULT 0,
            streak_best INTEGER DEFAULT 0,
            earned_badges TEXT,
            created_at DATETIME,
            updated_at DATETIME
        );

        CREATE TABLE IF NOT EXISTS business_units (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            created_at DATETIME,
            updated_at DATETIME
        );

        CREATE TABLE IF NOT EXISTS teams (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            business_unit_id INTEGER,
            description TEXT,
            created_at DATETIME,
            updated_at DATETIME,
            FOREIGN KEY (business_unit_id) REFERENCES business_units(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            action TEXT NOT NULL,
            entity_type TEXT,
            entity_id INTEGER,
            details TEXT,
            created_at DATETIME
        );

        CREATE TABLE IF NOT EXISTS daily_updates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            date DATE NOT NULL,
            today_plan TEXT,
            done TEXT,
            blocker TEXT,
            business_unit TEXT DEFAULT NULL,
            energy_level INTEGER DEFAULT NULL,
            created_at DATETIME,
            updated_at DATETIME
        );
        
        CREATE TABLE IF NOT EXISTS weekly_directions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            week_start DATE NOT NULL,
            content TEXT NOT NULL,
            business_unit TEXT DEFAULT NULL,
            created_at DATETIME,
            updated_at DATETIME
        );
        
        CREATE TABLE IF NOT EXISTS settings (
            setting_key VARCHAR(50) PRIMARY KEY,
            setting_value TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS task_comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            author TEXT NOT NULL,
            created_at DATETIME
        );

        CREATE TABLE IF NOT EXISTS people (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            job_title TEXT,
            team_id INTEGER,
            created_at DATETIME
        );

        CREATE TABLE IF NOT EXISTS attachments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entity_type TEXT NOT NULL,
            entity_id INTEGER NOT NULL,
            file_name TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_type TEXT DEFAULT NULL,
            file_size INTEGER DEFAULT NULL,
            uploaded_by INTEGER DEFAULT NULL,
            created_at DATETIME
        );

        CREATE TABLE IF NOT EXISTS rate_limits (
            key TEXT PRIMARY KEY,
            requests INTEGER DEFAULT 1,
            reset_at INTEGER DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS focus_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            task_id INTEGER DEFAULT NULL,
            start_time DATETIME NOT NULL,
            end_time DATETIME DEFAULT NULL,
            duration_minutes INTEGER DEFAULT 0,
            status TEXT DEFAULT 'running',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS reference_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT,
            tags TEXT DEFAULT NULL,
            business_unit TEXT DEFAULT NULL,
            created_by INTEGER DEFAULT NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL
        );

        CREATE TABLE IF NOT EXISTS decision_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id INTEGER NOT NULL,
            decision_type TEXT NOT NULL,
            reason TEXT,
            meta_data TEXT DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS weekly_directions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            week_start DATE NOT NULL,
            content TEXT NOT NULL,
            business_unit TEXT DEFAULT NULL,
            created_at DATETIME,
            updated_at DATETIME
        );
        ";

        $pdo->exec($sql);
    }
    
    private static function migrateSchema(PDO $pdo): void
    {
        if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) !== 'sqlite') {
            return;
        }

        $commentCols = array_column($pdo->query("PRAGMA table_info(task_comments)")->fetchAll(PDO::FETCH_ASSOC), 'name');
        if (in_array('comment', $commentCols, true) && !in_array('content', $commentCols, true)) {
            $pdo->beginTransaction();
            try {
                $pdo->exec("ALTER TABLE task_comments RENAME TO task_comments_legacy");
                $pdo->exec("CREATE TABLE task_comments (id INTEGER PRIMARY KEY AUTOINCREMENT, task_id INTEGER NOT NULL, content TEXT NOT NULL, author TEXT NOT NULL, created_at DATETIME)");
                $pdo->exec("INSERT INTO task_comments SELECT c.id, c.task_id, c.comment, COALESCE(u.username, 'Unknown'), c.created_at FROM task_comments_legacy c LEFT JOIN users u ON u.id=c.user_id");
                $pdo->exec("DROP TABLE task_comments_legacy");
                $pdo->commit();
            } catch (Throwable $e) {
                $pdo->rollBack();
                throw $e;
            }
        }
        $pdo->exec("CREATE TABLE IF NOT EXISTS activity_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id INTEGER, description TEXT, actor TEXT, business_unit TEXT, created_at DATETIME)");

        // Add energy_level to inbox_items if missing
        $cols = $pdo->query("PRAGMA table_info(inbox_items)")->fetchAll(PDO::FETCH_ASSOC);
        $hasEnergy = false;
        foreach ($cols as $col) {
            if ($col['name'] === 'energy_level') {
                $hasEnergy = true; 
                break;
            }
        }
        if (!$hasEnergy) {
            $pdo->exec("ALTER TABLE inbox_items ADD COLUMN energy_level TEXT DEFAULT NULL");
        }
        
        // Add missing columns to users
        $userCols = $pdo->query("PRAGMA table_info(users)")->fetchAll(PDO::FETCH_ASSOC);
        $userColNames = array_column($userCols, 'name');
        
        $missingCols = [
            'job_title' => 'TEXT DEFAULT NULL',
            'assigned_units' => 'TEXT DEFAULT NULL',
            'full_name' => 'TEXT DEFAULT NULL',
            'phone' => 'TEXT DEFAULT NULL',
            'email' => 'TEXT DEFAULT NULL',
            'telegram_chat_id' => 'TEXT DEFAULT NULL',
            'otp_code' => 'TEXT DEFAULT NULL',
            'otp_expiry' => 'DATETIME DEFAULT NULL',
            'otp_secret' => 'TEXT DEFAULT NULL',
            'otp_expires_at' => 'DATETIME DEFAULT NULL',
            'is_verified' => 'INTEGER DEFAULT 0'
        ];

        foreach ($missingCols as $colName => $colDef) {
            if (!in_array($colName, $userColNames)) {
                $pdo->exec("ALTER TABLE users ADD COLUMN $colName $colDef");
            }
        }
        
        // Ensure all tables exist (Safe to run IF NOT EXISTS)
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS project_steps (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                step_order INTEGER NOT NULL DEFAULT 0,
                title TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                created_at DATETIME,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS task_comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id INTEGER NOT NULL,
                content TEXT NOT NULL,
                author TEXT NOT NULL,
                created_at DATETIME
            );

            CREATE TABLE IF NOT EXISTS people (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                job_title TEXT,
                team_id INTEGER,
                created_at DATETIME
            );

            CREATE TABLE IF NOT EXISTS attachments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entity_type TEXT NOT NULL,
                entity_id INTEGER NOT NULL,
                file_name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_type TEXT DEFAULT NULL,
                file_size INTEGER DEFAULT NULL,
                uploaded_by INTEGER DEFAULT NULL,
                created_at DATETIME
            );

            CREATE TABLE IF NOT EXISTS rate_limits (
                key TEXT PRIMARY KEY,
                requests INTEGER DEFAULT 1,
                reset_at INTEGER DEFAULT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS focus_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                task_id INTEGER DEFAULT NULL,
                start_time DATETIME NOT NULL,
                end_time DATETIME DEFAULT NULL,
                duration_minutes INTEGER DEFAULT 0,
                status TEXT DEFAULT 'running',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS reference_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                content TEXT,
                tags TEXT DEFAULT NULL,
                business_unit TEXT DEFAULT NULL,
                created_by INTEGER DEFAULT NULL,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL
            );

            CREATE TABLE IF NOT EXISTS decision_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                entity_type TEXT NOT NULL,
                entity_id INTEGER NOT NULL,
                decision_type TEXT NOT NULL,
                reason TEXT,
                meta_data TEXT DEFAULT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS weekly_directions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                week_start DATE NOT NULL,
                content TEXT NOT NULL,
                business_unit TEXT DEFAULT NULL,
                created_at DATETIME,
                updated_at DATETIME
            );
        ");
    }
}
