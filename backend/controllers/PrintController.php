<?php
require_once __DIR__ . '/../utils/EscposPrinter.php';

class PrintController
{
    public function printBill(Request $req): never
    {
        Auth::guard();

        $billNumber = $req->bodyStr('bill_number');
        if (!$billNumber) {
            Response::error('bill_number is required.', 422);
        }

        $bill = Database::row(
            "SELECT b.*, o.order_number, o.order_type, o.guest_name, o.guest_room,
                    t.label AS table_label, t.table_number
             FROM bills b
             JOIN orders o ON b.order_id = o.id
             LEFT JOIN restaurant_tables t ON o.table_id = t.id
             WHERE b.bill_number = ?",
            [$billNumber]
        );
        if (!$bill) {
            Response::notFound('Bill not found.');
        }

        $items = Database::all(
            'SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC',
            [$bill['order_id']]
        );

        $settings = Helper::allSettings();
        $this->sendToPrinter(function (EscposPrinter $p) use ($bill, $items, $settings) {
            $this->formatBill($p, $bill, $items, $settings);
        });
    }

    public function printKOT(Request $req): never
    {
        Auth::guard();

        $orderId = $req->bodyInt('order_id');
        if (!$orderId) {
            Response::error('order_id is required.', 422);
        }

        $order = Database::row(
            "SELECT o.*, t.label AS table_label, t.table_number
             FROM orders o
             LEFT JOIN restaurant_tables t ON o.table_id = t.id
             WHERE o.id = ?",
            [$orderId]
        );
        if (!$order) {
            Response::notFound('Order not found.');
        }

        $items = Database::all(
            'SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC',
            [$orderId]
        );

        $this->sendToPrinter(function (EscposPrinter $p) use ($order, $items) {
            $this->formatKOT($p, $order, $items);
        });
    }

    public function testPrint(Request $req): never
    {
        Auth::guard();

        $type = $req->bodyStr('type') ?: 'bill';

        $this->sendToPrinter(function (EscposPrinter $p) use ($type) {
            if ($type === 'kot') {
                $this->formatKOT($p, [
                    'order_number' => 'TEST-001',
                    'order_type'   => 'dine_in',
                    'table_label'  => 'Table 1',
                    'table_number' => '1',
                ], [
                    ['item_name' => 'PRINT TEST OK', 'quantity' => 1],
                    ['item_name' => 'Masala Dosa', 'quantity' => 2],
                ]);
            } else {
                $settings = Helper::allSettings();
                $this->formatBill($p, [
                    'bill_number'      => 'TEST',
                    'order_number'     => 'TEST-001',
                    'order_type'       => 'dine_in',
                    'table_label'      => 'Table 1',
                    'payment_mode'     => 'cash',
                    'created_at'       => date('Y-m-d H:i:s'),
                    'paid_at'          => date('Y-m-d H:i:s'),
                    'subtotal'         => 350,
                    'tax_amount'       => 0,
                    'discount_amount'  => 0,
                    'commission_amount'=> 0,
                    'grand_total'      => 350,
                ], [
                    ['item_name' => 'Print Test Item', 'quantity' => 1, 'line_total' => 350],
                ], $settings);
            }
        });
    }

    private function sendToPrinter(callable $formatter): never
    {
        $settings = Helper::allSettings();
        $enabled  = ($settings['printer_enabled'] ?? '1') === '1';
        $ip       = trim($settings['printer_ip'] ?? '192.168.0.101');
        $port     = (int)($settings['printer_port'] ?? 9100);

        if (!$enabled) {
            Response::error('Printer is disabled in settings.', 422);
        }
        if (!$ip) {
            Response::error('Printer IP not configured in settings.', 422);
        }

        $printer = new EscposPrinter();
        if (!$printer->connect($ip, $port)) {
            Response::error("Cannot connect to printer at {$ip}:{$port}. Check IP and same WiFi network.", 503);
        }

        try {
            $printer->init();
            $formatter($printer);
            $printer->cut();
        } finally {
            $printer->close();
        }

        Response::success(['printed' => true, 'printer' => "{$ip}:{$port}"], 'Printed successfully.');
    }

    private function formatKOT(EscposPrinter $p, array $order, array $items): void
    {
        $when = date('d/m/Y, h:i:s A');
        $place = ($order['order_type'] ?? '') === 'dine_in'
            ? 'RESTAURANT (DINE IN)'
            : 'GUEST HOUSE';
        $location = ($order['order_type'] ?? '') === 'dine_in'
            ? 'TABLE: ' . ($order['table_number'] ?? $order['table_label'] ?? '-')
            : 'ROOM: ' . ($order['guest_room'] ?? '-');

        $p->align('center');
        $p->bold(true);
        $p->text('KITCHEN ORDER');
        $p->bold(false);
        $p->separator();
        $p->text('ORDER: ' . Helper::shortDocNumber($order['order_number'] ?? $order['id'] ?? '-'));
        $p->align('left');
        $p->text('DATE: ' . $when);
        $p->text('PLACE: ' . $place);
        $p->text($location);
        $p->separator();

        foreach ($items as $item) {
            $name = strtoupper($item['item_name'] ?? '');
            $qty  = (string)($item['quantity'] ?? 0);
            $p->twoColumn($name, $qty);
        }

        $p->separator();
        $p->align('center');
        $p->text('TOTAL ITEMS: ' . count($items));
        $p->feed(1);
    }

    private function formatBill(EscposPrinter $p, array $bill, array $items, array $settings): void
    {
        $sym    = $settings['currency_symbol'] ?? 'Rs.';
        $sym    = $sym === '₹' ? 'Rs.' : $sym;
        $when   = date('d-M-Y, h:i A', strtotime($bill['paid_at'] ?? $bill['created_at'] ?? 'now'));
        $billNo = Helper::shortDocNumber($bill['bill_number'] ?? '-');
        $ordNo  = Helper::shortDocNumber($bill['order_number'] ?? '-');
        $table  = $bill['table_label'] ?? $bill['guest_room'] ?? '-';
        $pay    = strtoupper($bill['payment_mode'] ?? 'CASH');
        $footer = $settings['bill_footer_text'] ?? 'Thank you!';

        $p->align('center');
        $p->bold(true);
        $p->text($settings['business_name'] ?? 'Restaurant');
        $p->bold(false);
        if (!empty($settings['business_address'])) {
            $p->text($settings['business_address']);
        }
        if (!empty($settings['business_phone'])) {
            $p->text($settings['business_phone']);
        }
        $p->separator();
        $p->bold(true);
        $p->text('TAX INVOICE');
        $p->bold(false);
        $p->separator();
        $p->bold(true);
        $p->text($billNo);
        $p->bold(false);
        $p->text($when);
        $p->text("Order {$ordNo} | Table {$table} | {$pay}");
        $p->separator();

        foreach ($items as $item) {
            $name = ($item['item_name'] ?? '') . ' x' . ($item['quantity'] ?? 0);
            $amt  = $sym . number_format((float)($item['line_total'] ?? 0), 2);
            $p->twoColumn($name, $amt);
        }

        $p->separator();
        $p->twoColumn('Subtotal', $sym . number_format((float)($bill['subtotal'] ?? 0), 2));

        if ((float)($bill['tax_amount'] ?? 0) > 0) {
            $p->twoColumn('Tax', $sym . number_format((float)$bill['tax_amount'], 2));
        }
        if ((float)($bill['discount_amount'] ?? 0) > 0) {
            $p->twoColumn('Discount', '-' . $sym . number_format((float)$bill['discount_amount'], 2));
        }

        $p->separator();
        $p->align('center');
        $p->bold(true);
        $p->text('TOTAL');
        $p->text($sym . number_format((float)($bill['grand_total'] ?? 0), 2));
        $p->bold(false);
        $p->separator();
        $p->text('**** ' . strtoupper($footer) . ' ****');
        $p->text('Date & Time : ' . $when);
        $p->feed(1);
    }
}
