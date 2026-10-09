<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable(dirname(__DIR__));
$dotenv->safeLoad();

// Helper to get env with default
if (!function_exists('env')) {
    function env($key, $default = null) {
        return $_ENV[$key] ?? $_SERVER[$key] ?? (getenv($key) !== false ? getenv($key) : $default);
    }
}

$dbPath = env('DB_DATABASE', 'database/insyarah.sqlite');
// Handle relative path if needed, or assume it's relative to root
if ($dbPath !== ':memory:' && !str_starts_with($dbPath, '/') && !str_starts_with($dbPath, '\\') && !preg_match('/^[a-zA-Z]:/', $dbPath)) {
    $dbPath = dirname(__DIR__) . DIRECTORY_SEPARATOR . $dbPath;
}

define('INSYARAH_DB_PATH', $dbPath);
define('INSYARAH_DEBUG', filter_var(env('APP_DEBUG', false), FILTER_VALIDATE_BOOLEAN));

