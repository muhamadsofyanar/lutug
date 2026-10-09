<?php

declare(strict_types=1);

// Set Default Timezone to WIB (Asia/Jakarta)
date_default_timezone_set('Asia/Jakarta');

// Load Env for CORS
require_once dirname(__DIR__) . '/core/AppHelper.php'; // Ensures dotenv is loaded if AppHelper does it, or load it manually here if needed.
// Actually config.php loads dotenv. Let's require config.
require_once dirname(__DIR__, 2) . '/config/config.php';

// Start output buffering
ob_start();

// Disable error display
ini_set('display_errors', '0');
ini_set('log_errors', '1');
ini_set('error_log', dirname(__DIR__) . '/php_errors.log');

// Register shutdown function
register_shutdown_function(function() {
    $error = error_get_last();
    if ($error && ($error['type'] === E_ERROR || $error['type'] === E_PARSE || $error['type'] === E_CORE_ERROR || $error['type'] === E_COMPILE_ERROR)) {
        if (ob_get_length()) ob_clean();
        if (!headers_sent()) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
            header("Access-Control-Allow-Origin: *");
        }
        echo json_encode([
            'success' => false,
            'error' => ['message' => INSYARAH_DEBUG ? 'Fatal Error: ' . $error['message'] : 'Internal server error']
        ]);
    } else {
        if (ob_get_level() > 0) ob_end_flush();
    }
});

// Configure Session
$cookieDomain = null; // Default to current domain
// Support for cross-subdomain sessions if needed (e.g. .domain.com)
if (env('SESSION_DOMAIN')) {
    $cookieDomain = env('SESSION_DOMAIN');
}

session_set_cookie_params([
    'lifetime' => 86400 * 30,
    'path' => '/',
    'domain' => $cookieDomain,
    'secure' => filter_var(env('SESSION_SECURE_COOKIE', false), FILTER_VALIDATE_BOOLEAN) || (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on'),
    'httponly' => true,
    'samesite' => 'Lax'
]);
session_start();

// Enhanced CORS Handling
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowedOrigins = env('CORS_ALLOWED_ORIGINS', '*'); // Default to * if not set

if ($allowedOrigins === '*') {
    header("Access-Control-Allow-Origin: *");
} else {
    $origins = array_map('trim', explode(',', $allowedOrigins));
    if (in_array($origin, $origins)) {
        header("Access-Control-Allow-Origin: $origin");
        header("Access-Control-Allow-Credentials: true");
    }
}

header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Routes
require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . 'core' . DIRECTORY_SEPARATOR . 'Database.php';
require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . 'controllers' . DIRECTORY_SEPARATOR . 'AuthController.php';
require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . 'controllers' . DIRECTORY_SEPARATOR . 'InboxController.php';
require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . 'controllers' . DIRECTORY_SEPARATOR . 'TaskController.php';
require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . 'controllers' . DIRECTORY_SEPARATOR . 'ProjectController.php';
require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . 'controllers' . DIRECTORY_SEPARATOR . 'ArchiveController.php';
require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . 'controllers' . DIRECTORY_SEPARATOR . 'HistoryController.php';
require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . 'controllers' . DIRECTORY_SEPARATOR . 'ReviewController.php';
require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . 'controllers' . DIRECTORY_SEPARATOR . 'SearchController.php';
require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . 'controllers' . DIRECTORY_SEPARATOR . 'BusinessUnitController.php';
require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . 'controllers' . DIRECTORY_SEPARATOR . 'TeamController.php';
require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . 'controllers' . DIRECTORY_SEPARATOR . 'PeopleController.php';
require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . 'controllers' . DIRECTORY_SEPARATOR . 'AdminController.php';
require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . 'controllers' . DIRECTORY_SEPARATOR . 'ReferenceController.php';
require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . 'controllers' . DIRECTORY_SEPARATOR . 'DashboardController.php';
require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . 'controllers' . DIRECTORY_SEPARATOR . 'DailyUpdateController.php';
require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . 'controllers' . DIRECTORY_SEPARATOR . 'WeeklyDirectionController.php';
require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . 'controllers' . DIRECTORY_SEPARATOR . 'AttachmentController.php';
require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . 'controllers' . DIRECTORY_SEPARATOR . 'GamificationController.php';
require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . 'controllers' . DIRECTORY_SEPARATOR . 'FocusController.php';
require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . 'controllers' . DIRECTORY_SEPARATOR . 'ReportController.php';
require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . 'controllers' . DIRECTORY_SEPARATOR . 'DecisionController.php';
require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . 'controllers' . DIRECTORY_SEPARATOR . 'AnalyticsController.php';
require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . 'core' . DIRECTORY_SEPARATOR . 'RateLimiter.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? '';

// Public actions
$publicActions = [
    'auth_login',
    'auth_register',
    'auth_verify_otp',
    'auth_me',
    'auth_request_reset',
    'auth_reset_password',
    'admin_broadcast',
    // Read-only endpoints safe for unauthenticated preloads
    'reference_list',
    'business_unit_list',
    'weekly_list'
];

try {
    $pdo = Database::connection();
    
    // Auth Check
    $userId = null;
    $user = null;
    
    // Check Authorization Header first (Bearer Token)
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? '';
    
    // If no header, check session (Legacy/Same Domain)
    if (empty($authHeader) && isset($_SESSION['user_id'])) {
        $userId = $_SESSION['user_id'];
    } 
    // If header exists, validate token (Not implemented fully yet, using Session for now as primary)
    // Future: Implement JWT validation here if needed for stateless API.
    
    if (in_array($action, $publicActions)) {
        // Allow public access
    } else {
        if (!$userId) {
            // Check if user is trying to access protected route
             // Allow 'auth_me' to return null without error if not logged in (handled in controller)
             // Actually auth_me is in publicActions list above.
             
             http_response_code(401);
             echo json_encode(['success' => false, 'error' => ['message' => 'Unauthorized']]);
             exit;
        }
    }

    // Routing
    switch ($action) {
        // Auth
        case 'auth_login': (new AuthController($pdo))->login(); break;
        case 'auth_register': (new AuthController($pdo))->register(); break;
        case 'auth_verify_otp': (new AuthController($pdo))->verifyOtp(); break;
        case 'auth_me': (new AuthController($pdo))->me(); break;
        case 'auth_logout': (new AuthController($pdo))->logout(); break;
        case 'auth_update_profile': (new AuthController($pdo))->updateProfile(); break;
        case 'auth_request_reset': (new AuthController($pdo))->requestPasswordReset(); break;
        case 'auth_reset_password': (new AuthController($pdo))->resetPasswordWithOtp(); break;

        // Inbox
        case 'inbox_list': (new InboxController($pdo))->list(); break;
        case 'inbox_create': (new InboxController($pdo))->create(); break;
        case 'inbox_update': (new InboxController($pdo))->update(); break;
        case 'inbox_delete': (new InboxController($pdo))->delete(); break;
        case 'inbox_process': (new InboxController($pdo))->decisionCommit(); break;
        case 'inbox_next_actions': (new InboxController($pdo))->listNextActions(); break;

        // Tasks
        case 'task_list': (new TaskController($pdo))->listToday(); break;
        // Backward-compat alias
        case 'today_list': (new TaskController($pdo))->listToday(); break;
        case 'task_create': (new TaskController($pdo))->create(); break;
        case 'task_update': (new TaskController($pdo))->updateAttributes(); break;
        case 'task_delete': (new TaskController($pdo))->terminate(); break;
        case 'task_toggle': (new TaskController($pdo))->complete(); break;
        case 'task_comments_list': (new TaskController($pdo))->listComments(); break;
        case 'task_comments_add': (new TaskController($pdo))->addComment(); break;
        case 'task_energy_audit': (new TaskController($pdo))->energyAudit(); break;

        // Projects
        case 'project_list': (new ProjectController($pdo))->list(); break;
        case 'project_create': (new ProjectController($pdo))->create(); break;
        case 'project_update': (new ProjectController($pdo))->update(); break;
        case 'project_delete': (new ProjectController($pdo))->delete(); break;
        case 'project_set_next_action': (new ProjectController($pdo))->setNextAction(); break;
        case 'project_schedule_next_action': (new ProjectController($pdo))->scheduleNextAction(); break;
        case 'project_terminate': (new ProjectController($pdo))->terminate(); break;
        case 'project_tasks': (new ProjectController($pdo))->getTasks(); break;

        // Archive & History & Review
        case 'archive_list': (new ArchiveController($pdo))->list(); break;
        case 'history_list': (new HistoryController($pdo))->list(); break;
        case 'history_activity': (new HistoryController($pdo))->listActivity(); break;
        case 'review_decide': (new ReviewController($pdo))->decide(); break;

        // References
        case 'reference_list': (new ReferenceController($pdo))->list(); break;
        case 'reference_create': (new ReferenceController($pdo))->create(); break;
        case 'reference_update': (new ReferenceController($pdo))->update(); break;
        case 'reference_delete': (new ReferenceController($pdo))->delete(); break;

        // Daily Updates
        case 'daily_list': (new DailyUpdateController($pdo))->list(); break;
        case 'daily_create': (new DailyUpdateController($pdo))->save(); break;
        case 'daily_get_today': (new DailyUpdateController($pdo))->getToday(); break;

        // Weekly Direction
        case 'weekly_list': (new WeeklyDirectionController($pdo))->list(); break;
        case 'weekly_create': (new WeeklyDirectionController($pdo))->save(); break;
        case 'weekly_insights': (new WeeklyDirectionController($pdo))->insights(); break;
        // Backward-compat alias
        case 'weekly_direction_list': (new WeeklyDirectionController($pdo))->list(); break;
        case 'weekly_direction_insights': (new WeeklyDirectionController($pdo))->insights(); break;

        // People/Delegation
        case 'people_list': (new PeopleController($pdo))->list(); break;
        case 'people_create': (new PeopleController($pdo))->add(); break;
        case 'people_update': (new PeopleController($pdo))->update(); break;
        case 'people_delete': (new PeopleController($pdo))->delete(); break;

        // Business Units
        case 'business_unit_list': (new BusinessUnitController($pdo))->list(); break;
        // Backward-compat alias
        case 'business_units': (new BusinessUnitController($pdo))->list(); break;
        case 'business_unit_create': (new BusinessUnitController($pdo))->create(); break;
        case 'business_unit_delete': (new BusinessUnitController($pdo))->delete(); break;

        // Teams
        case 'team_list': (new TeamController($pdo))->list(); break;
        case 'team_create': (new TeamController($pdo))->create(); break;
        case 'team_delete': (new TeamController($pdo))->delete(); break;

        // Dashboard
        case 'dashboard_stats': (new DashboardController($pdo))->stats(); break;

        // Attachments
        case 'attachment_upload': (new AttachmentController($pdo))->upload(); break;
        case 'attachment_list': (new AttachmentController($pdo))->list(); break;
        case 'attachment_delete': (new AttachmentController($pdo))->delete(); break;

        // Search
        case 'search': (new SearchController($pdo))->globalSearch(); break;

        // Admin
        case 'admin_users': (new AdminController($pdo))->listUsers(); break;
        case 'admin_users_list': (new AdminController($pdo))->listUsers(); break;
        case 'admin_users_update': (new AdminController($pdo))->updateUser(); break;
        case 'admin_users_delete': (new AdminController($pdo))->deleteUser(); break;
        case 'admin_reset_password': (new AdminController($pdo))->resetPassword(); break;
        case 'admin_broadcast': (new AdminController($pdo))->broadcastMessage(); break;
        case 'admin_audit_logs': (new AdminController($pdo))->getAuditLogs(); break;
        case 'admin_health_check': (new AdminController($pdo))->checkHealth(); break;
        case 'admin_settings_get': (new AdminController($pdo))->getSettings(); break;
        case 'admin_settings_update': (new AdminController($pdo))->updateSettings(); break;
        case 'admin_backups_list': (new AdminController($pdo))->getBackups(); break;
        case 'admin_backups_create': (new AdminController($pdo))->createBackup(); break;
        case 'admin_backups_restore': (new AdminController($pdo))->restoreBackup(); break;
        case 'admin_backups_delete': (new AdminController($pdo))->deleteBackup(); break;
        case 'admin_backup_download': (new AdminController($pdo))->downloadBackup(); break;
        case 'reset_all': (new AdminController($pdo))->resetAll(); break;
        case 'export_all': (new AdminController($pdo))->exportAll(); break;
        case 'import_all': (new AdminController($pdo))->importAll(); break;

        // Gamification
        case 'gamification_stats': (new GamificationController($pdo))->getStats(); break;

        // Focus
        case 'focus_start': (new FocusController($pdo))->start(); break;
        case 'focus_stop': (new FocusController($pdo))->stop(); break;
        case 'focus_cancel': (new FocusController($pdo))->cancel(); break;

        // Report
        case 'report_export': (new ReportController($pdo))->export(); break;

        // Decisions
        case 'decision_list': (new DecisionController($pdo))->list(); break;
        case 'decision_stats': (new DecisionController($pdo))->stats(); break;

        // Analytics
        case 'analytics_team_performance': (new AnalyticsController($pdo))->getTeamPerformance(); break;
        case 'analytics_burnout_risk': (new AnalyticsController($pdo))->getBurnoutHeatmap(); break;

        // Default
        default:
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => ['message' => 'Action not found']]);
            break;
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => ['message' => $e->getMessage()]]);
}
