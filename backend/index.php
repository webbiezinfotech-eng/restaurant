<?php
/**
 * Restaurant Manager — Backend Entry Point & Router
 * Plain PHP, no framework.
 */

declare(strict_types=1);

// ---- Error handling ----
set_error_handler(function (int $errno, string $errstr, string $errfile, int $errline): bool {
    if (!(error_reporting() & $errno)) return false;
    throw new ErrorException($errstr, 0, $errno, $errfile, $errline);
});

// ---- Bootstrap ----
require_once __DIR__ . '/config/app.php';
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/core/Database.php';
require_once __DIR__ . '/core/Response.php';
require_once __DIR__ . '/core/Request.php';
require_once __DIR__ . '/core/Auth.php';
require_once __DIR__ . '/utils/Validator.php';
require_once __DIR__ . '/utils/Helper.php';
require_once __DIR__ . '/controllers/AuthController.php';
require_once __DIR__ . '/controllers/DashboardController.php';
require_once __DIR__ . '/controllers/TableController.php';
require_once __DIR__ . '/controllers/MenuController.php';
require_once __DIR__ . '/controllers/OrderController.php';
require_once __DIR__ . '/controllers/BillingController.php';
require_once __DIR__ . '/controllers/ReportController.php';
require_once __DIR__ . '/controllers/SettingsController.php';
require_once __DIR__ . '/controllers/GuestHouseController.php';

// ---- CORS ----
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, ALLOWED_ORIGINS, true)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Max-Age: 86400');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ---- Parse URI ----
$rawUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
// Strip API prefix for both flows:
// - local:  /api/...
// - server: /backend/...
// - php dev server direct index: /backend/index.php/...
// - safe fallback: /backend/api/...
$uri    = preg_replace('#^/(backend/index\.php|index\.php|backend/api|backend|api)#', '', $rawUri);
$uri    = '/' . trim($uri, '/');
$method = strtoupper($_SERVER['REQUEST_METHOD']);
$req    = new Request();

// ---- Instantiate controllers ----
$auth    = new AuthController();
$dash    = new DashboardController();
$tables  = new TableController();
$menu    = new MenuController();
$orders  = new OrderController();
$billing = new BillingController();
$reports = new ReportController();
$sett    = new SettingsController();
$gh      = new GuestHouseController();

// ---- Router ----
// Returns true if matched, false if not

try {

    // Auth
    if ($uri === '/auth/login'           && $method === 'POST')  { $auth->login($req); }
    if ($uri === '/auth/logout'          && $method === 'POST')  { $auth->logout($req); }
    if ($uri === '/auth/me'              && $method === 'GET')   { $auth->me($req); }
    if ($uri === '/auth/change-password' && $method === 'POST')  { $auth->changePassword($req); }

    // Dashboard
    if ($uri === '/dashboard' && $method === 'GET') { $dash->index($req); }

    // Tables
    if ($uri === '/tables'  && $method === 'GET') { $tables->index($req); }

    if (preg_match('#^/tables/(\d+)$#', $uri, $m)) {
        match ($method) {
            'GET'  => $tables->show($req, (int)$m[1]),
            'PUT'  => $tables->update($req, (int)$m[1]),
            default => null,
        };
    }
    if (preg_match('#^/tables/(\d+)/reset$#', $uri, $m) && $method === 'POST') {
        $tables->reset($req, (int)$m[1]);
    }

    // Categories
    if ($uri === '/categories' && $method === 'GET')  { $menu->getCategories($req); }
    if ($uri === '/categories' && $method === 'POST') { $menu->createCategory($req); }

    if (preg_match('#^/categories/(\d+)$#', $uri, $m)) {
        match ($method) {
            'PUT'    => $menu->updateCategory($req, (int)$m[1]),
            'DELETE' => $menu->deleteCategory($req, (int)$m[1]),
            default  => null,
        };
    }

    // Menu items
    if ($uri === '/menu-items' && $method === 'GET')  { $menu->getItems($req); }
    if ($uri === '/menu-items' && $method === 'POST') { $menu->createItem($req); }

    if (preg_match('#^/menu-items/(\d+)$#', $uri, $m)) {
        match ($method) {
            'PUT'    => $menu->updateItem($req, (int)$m[1]),
            'DELETE' => $menu->toggleItem($req, (int)$m[1]),
            default  => null,
        };
    }

    // Orders — list & create
    if ($uri === '/orders'               && $method === 'GET')  { $orders->index($req); }
    if ($uri === '/orders/dine-in'       && $method === 'POST') { $orders->createDineIn($req); }
    if ($uri === '/orders/guest-house'   && $method === 'POST') { $orders->createGuestHouse($req); }

    // Orders — single
    if (preg_match('#^/orders/(\d+)$#', $uri, $m) && $method === 'GET') {
        $orders->show($req, (int)$m[1]);
    }

    // Order items
    if (preg_match('#^/orders/(\d+)/items$#', $uri, $m) && $method === 'POST') {
        $orders->addItem($req, (int)$m[1]);
    }
    if (preg_match('#^/orders/(\d+)/items/(\d+)$#', $uri, $m)) {
        match ($method) {
            'PUT'    => $orders->updateItem($req, (int)$m[1], (int)$m[2]),
            'DELETE' => $orders->removeItem($req, (int)$m[1], (int)$m[2]),
            default  => null,
        };
    }
    if (preg_match('#^/orders/(\d+)/cancel$#', $uri, $m) && $method === 'POST') {
        $orders->cancel($req, (int)$m[1]);
    }
    if (preg_match('#^/orders/(\d+)/commission$#', $uri, $m) && $method === 'PUT') {
        $orders->updateCommission($req, (int)$m[1]);
    }

    // Billing
    if (preg_match('#^/orders/(\d+)/bill$#', $uri, $m) && $method === 'POST') {
        $billing->generateBill($req, (int)$m[1]);
    }
    if ($uri === '/bills' && $method === 'GET') { $billing->index($req); }
    if (preg_match('#^/bills/([A-Z0-9]+)/mark-paid$#', $uri, $m) && $method === 'POST') {
        $billing->markAsPaid($req, $m[1]);
    }
    if (preg_match('#^/bills/([A-Z0-9]+)/payment-status$#', $uri, $m) && $method === 'POST') {
        $billing->updatePaymentStatus($req, $m[1]);
    }
    if (preg_match('#^/bills/([A-Z0-9]+)$#', $uri, $m) && $method === 'GET') {
        $billing->show($req, $m[1]);
    }

    // Reports
    if ($uri === '/reports/sales'         && $method === 'GET') { $reports->sales($req); }
    if ($uri === '/reports/item-wise'     && $method === 'GET') { $reports->itemWise($req); }
    if ($uri === '/reports/table-wise'    && $method === 'GET') { $reports->tableWise($req); }
    if ($uri === '/reports/commission'    && $method === 'GET') { $reports->commission($req); }
    if ($uri === '/reports/payment-mode'  && $method === 'GET') { $reports->paymentMode($req); }
    if ($uri === '/reports/category-wise' && $method === 'GET') { $reports->categoryWise($req); }

    // Settings
    if ($uri === '/settings' && $method === 'GET') { $sett->index($req); }
    if ($uri === '/settings' && $method === 'PUT') { $sett->update($req); }

    // Guest house
    if ($uri === '/guest-house/dashboard' && $method === 'GET') { $gh->dashboard($req); }
    if ($uri === '/guest-house/rooms'     && $method === 'GET') { $gh->rooms($req); }
    if ($uri === '/guest-house/rooms'     && $method === 'POST') { $gh->createRoom($req); }
    if ($uri === '/guest-house/available-rooms' && $method === 'GET') { $gh->availableRooms($req); }
    if ($uri === '/guest-house/room-categories' && $method === 'GET') { $gh->roomCategories($req); }
    if ($uri === '/guest-house/room-categories' && $method === 'POST') { $gh->createRoomCategory($req); }
    if ($uri === '/guest-house/profiles'  && $method === 'GET') { $gh->profiles($req); }
    if ($uri === '/guest-house/profiles'  && $method === 'POST') { $gh->createProfile($req); }
    if ($uri === '/guest-house/guests'    && $method === 'POST') { $gh->createGuest($req); }
    if (preg_match('#^/guest-house/guests/(\d+)$#', $uri, $m) && $method === 'PUT') {
        $gh->updateGuest($req, (int)$m[1]);
    }
    if ($uri === '/guest-house/bookings'  && $method === 'GET') { $gh->bookings($req); }
    if ($uri === '/guest-house/bookings'  && $method === 'POST') { $gh->createBooking($req); }
    if (preg_match('#^/guest-house/guests/(\d+)/payment$#', $uri, $m) && $method === 'POST') {
        $gh->addPayment($req, (int)$m[1]);
    }
    if (preg_match('#^/guest-house/guests/(\d+)/checkout$#', $uri, $m) && $method === 'POST') {
        $gh->checkout($req, (int)$m[1]);
    }

    // ---- 404 fallback ----
    Response::error("Endpoint not found: $method $uri", 404);

} catch (Throwable $e) {
    if (APP_DEBUG) {
        Response::serverError($e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    } else {
        error_log($e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
        Response::serverError('An unexpected error occurred.');
    }
}
