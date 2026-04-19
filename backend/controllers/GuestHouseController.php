<?php
class GuestHouseController
{
    private bool $schemaEnsured = false;

    private function ensureAdvancedSchema(): void
    {
        if ($this->schemaEnsured) return;
        $this->schemaEnsured = true;

        try {
            $this->addColumnIfMissing('guest_house_guests', 'payment_mode', "ALTER TABLE guest_house_guests ADD COLUMN payment_mode VARCHAR(20) NOT NULL DEFAULT 'cash' AFTER id_proof");
            $this->addColumnIfMissing('guest_house_guests', 'total_amount', "ALTER TABLE guest_house_guests ADD COLUMN total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER payment_mode");
            $this->addColumnIfMissing('guest_house_guests', 'advance_amount', "ALTER TABLE guest_house_guests ADD COLUMN advance_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER total_amount");
            $this->addColumnIfMissing('guest_house_guests', 'paid_amount', "ALTER TABLE guest_house_guests ADD COLUMN paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER advance_amount");
            $this->addColumnIfMissing('guest_house_guests', 'balance_amount', "ALTER TABLE guest_house_guests ADD COLUMN balance_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER paid_amount");
            $this->addColumnIfMissing('guest_house_guests', 'expected_checkout_at', "ALTER TABLE guest_house_guests ADD COLUMN expected_checkout_at DATETIME DEFAULT NULL AFTER check_out_at");
            $this->addColumnIfMissing('guest_house_guests', 'booking_from', "ALTER TABLE guest_house_guests ADD COLUMN booking_from DATETIME DEFAULT NULL AFTER expected_checkout_at");
            $this->addColumnIfMissing('guest_house_guests', 'booking_to', "ALTER TABLE guest_house_guests ADD COLUMN booking_to DATETIME DEFAULT NULL AFTER booking_from");
            $this->addColumnIfMissing('guest_house_guests', 'adults_count', "ALTER TABLE guest_house_guests ADD COLUMN adults_count INT NOT NULL DEFAULT 1 AFTER phone");
            $this->addColumnIfMissing('guest_house_guests', 'children_count', "ALTER TABLE guest_house_guests ADD COLUMN children_count INT NOT NULL DEFAULT 0 AFTER adults_count");
            $this->addColumnIfMissing('guest_house_guests', 'companions', "ALTER TABLE guest_house_guests ADD COLUMN companions TEXT NULL AFTER children_count");
            $this->addColumnIfMissing('guest_house_guests', 'companions_id_details', "ALTER TABLE guest_house_guests ADD COLUMN companions_id_details TEXT NULL AFTER companions");
            Database::run("ALTER TABLE guest_house_guests
                MODIFY COLUMN status ENUM('reserved','checked_in','checked_out','cancelled') NOT NULL DEFAULT 'checked_in'");
        } catch (Throwable $e) {
            // keep backward compatibility when ALTER ... IF NOT EXISTS is unavailable
        }
    }

    private function addColumnIfMissing(string $table, string $column, string $sql): void
    {
        if ($this->columnExists($table, $column)) return;
        Database::run($sql);
    }

    private function overlaps(string $from, string $to): string
    {
        return "(? < booking_to AND ? > booking_from)";
    }

    private function parseDateTime(string $field, string $value): string
    {
        if ($value === '') Response::unprocessable('Validation failed.', [$field => ["$field is required."]]);
        $ts = strtotime($value);
        if ($ts === false) Response::unprocessable('Validation failed.', [$field => ["$field must be a valid date/time."]]);
        return date('Y-m-d H:i:s', $ts);
    }

    private function paymentMode(string $mode): string
    {
        $modes = ['cash', 'upi', 'card', 'credit', 'bank'];
        $mode = strtolower(trim($mode));
        return in_array($mode, $modes, true) ? $mode : 'cash';
    }

    private function roomConflictMessage(array $booking): string
    {
        return "Room {$booking['room_no']} already booked from {$booking['booking_from']} to {$booking['booking_to']}.";
    }
    private function tableExists(string $table): bool
    {
        try {
            $exists = Database::value("SHOW TABLES LIKE ?", [$table]);
            return !empty($exists);
        } catch (Throwable $e) {
            return false;
        }
    }

    private function columnExists(string $table, string $column): bool
    {
        try {
            $col = Database::row("SHOW COLUMNS FROM `$table` LIKE ?", [$column]);
            return !empty($col);
        } catch (Throwable $e) {
            return false;
        }
    }

    public function roomCategories(Request $req): never
    {
        Auth::guard();
        try {
            $rows = Database::all(
                "SELECT id, name, is_active
                 FROM guest_house_room_categories
                 WHERE is_active = 1
                 ORDER BY name ASC"
            );
            Response::success($rows);
        } catch (Throwable $e) {
            Response::success([]);
        }
    }

    public function createRoomCategory(Request $req): never
    {
        $payload = Auth::guard();
        $v = Validator::make($req->body())
            ->required('name', 'Category Name')->string('name', 2, 80);
        if ($v->fails()) Response::unprocessable('Validation failed.', $v->errors());

        $name = $req->bodyStr('name');
        try {
            $exists = Database::row(
                "SELECT id, name, is_active
                 FROM guest_house_room_categories
                 WHERE LOWER(name) = LOWER(?)
                 LIMIT 1",
                [$name]
            );
            if ($exists) Response::success($exists, 'Category already exists.');

            Database::run(
                "INSERT INTO guest_house_room_categories (name, created_by) VALUES (?, ?)",
                [$name, (int)$payload['admin_id']]
            );
            $id = Database::lastId();
            $row = Database::row("SELECT id, name, is_active FROM guest_house_room_categories WHERE id = ?", [$id]);
            Response::created($row, 'Room category created.');
        } catch (Throwable $e) {
            Response::serverError('Failed to create room category.');
        }
    }

    public function createRoom(Request $req): never
    {
        $payload = Auth::guard();
        $v = Validator::make($req->body())
            ->required('room_no', 'Room Number')->string('room_no', 1, 20)
            ->required('floor_no', 'Floor')->string('floor_no', 1, 20);
        if ($v->fails()) Response::unprocessable('Validation failed.', $v->errors());

        $roomNo = $req->bodyStr('room_no');
        $floorNo = $req->bodyStr('floor_no');
        $categoryId = (int)$req->bodyInt('category_id', 0);
        $roomType = $req->bodyStr('room_type');

        try {
            $exists = Database::value(
                "SELECT COUNT(*) FROM guest_house_rooms WHERE room_no = ?",
                [$roomNo]
            );
            if ((int)$exists > 0) Response::error("Room {$roomNo} already exists.", 409);

            if ($categoryId > 0) {
                $catExists = Database::value(
                    "SELECT COUNT(*) FROM guest_house_room_categories WHERE id = ? AND is_active = 1",
                    [$categoryId]
                );
                if ((int)$catExists === 0) Response::notFound('Room category not found.');
            }

            Database::run(
                "INSERT INTO guest_house_rooms (room_no, room_type, floor_no, category_id, status, is_active, created_at, updated_at)
                 VALUES (?, ?, ?, ?, 'available', 1, NOW(), NOW())",
                [$roomNo, $roomType ?: null, $floorNo, $categoryId > 0 ? $categoryId : null]
            );
            $id = Database::lastId();
            Helper::log((int)$payload['admin_id'], 'create_room', 'guest_house', $id, "Room {$roomNo} created.");
            Response::created(['id' => $id], 'Room created successfully.');
        } catch (Throwable $e) {
            Response::serverError('Failed to create room.');
        }
    }

    public function profiles(Request $req): never
    {
        Auth::guard();
        try {
            $q = $req->queryStr('q');
            $params = [];
            $where = 'WHERE is_active = 1';
            if ($q !== '') {
                $where .= ' AND (name LIKE ? OR address LIKE ?)';
                $like = '%' . $q . '%';
                $params[] = $like;
                $params[] = $like;
            }

            $rows = Database::all(
                "SELECT id, name, address
                 FROM guest_house_profiles
                 $where
                 ORDER BY name ASC
                 LIMIT 200",
                $params
            );
            Response::success($rows);
        } catch (Throwable $e) {
            // Table may not exist in older DB before migration.
            Response::success([]);
        }
    }

    public function createProfile(Request $req): never
    {
        $payload = Auth::guard();
        $v = Validator::make($req->body())
            ->required('name', 'Guest House Name')->string('name', 2, 120)
            ->required('address', 'Address')->string('address', 5, 255);
        if ($v->fails()) Response::unprocessable('Validation failed.', $v->errors());

        $name = $req->bodyStr('name');
        $address = $req->bodyStr('address');
        try {
            $exists = Database::row(
                "SELECT id, name, address
                 FROM guest_house_profiles
                 WHERE name = ? AND address = ? AND is_active = 1
                 LIMIT 1",
                [$name, $address]
            );
            if ($exists) {
                Response::success($exists, 'Profile already exists.');
            }

            Database::run(
                "INSERT INTO guest_house_profiles (name, address, created_by)
                 VALUES (?, ?, ?)",
                [$name, $address, (int)$payload['admin_id']]
            );
            $id = Database::lastId();
            $row = Database::row(
                "SELECT id, name, address FROM guest_house_profiles WHERE id = ?",
                [$id]
            );
            Response::created($row, 'Guest house profile saved.');
        } catch (Throwable $e) {
            Response::serverError('Failed to save guest house profile.');
        }
    }

    public function dashboard(Request $req): never
    {
        Auth::guard();
        $this->ensureAdvancedSchema();

        $summary = Database::row(
            "SELECT
                COUNT(*) AS total_rooms,
                SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) AS available_rooms,
                SUM(CASE WHEN status = 'booked' THEN 1 ELSE 0 END) AS booked_rooms
             FROM guest_house_rooms
             WHERE is_active = 1"
        ) ?: ['total_rooms' => 0, 'available_rooms' => 0, 'booked_rooms' => 0];

        $activeGuests = (int) Database::value(
            "SELECT COUNT(*) FROM guest_house_guests WHERE status = 'checked_in'"
        );

        $hasCategoryTable = $this->tableExists('guest_house_room_categories');
        $hasCategoryCol = $this->columnExists('guest_house_rooms', 'category_id');
        $joinCategory = $hasCategoryTable && $hasCategoryCol;

        $rooms = Database::all(
            "SELECT r.id, r.room_no, r.room_type, r.floor_no, r.status,
                    " . ($hasCategoryCol ? "r.category_id," : "NULL AS category_id,") . "
                    " . ($joinCategory ? "COALESCE(c.name, r.room_type, 'Standard')" : "COALESCE(r.room_type, 'Standard')") . " AS category_name,
                    g.id AS guest_id, g.guest_name, g.phone, g.id_proof, g.check_in_at, g.expected_checkout_at, g.balance_amount
             FROM guest_house_rooms r
             " . ($joinCategory ? "LEFT JOIN guest_house_room_categories c ON c.id = r.category_id" : "") . "
             LEFT JOIN guest_house_guests g
               ON g.room_id = r.id AND g.status = 'checked_in'
             WHERE r.is_active = 1
             ORDER BY CAST(r.room_no AS UNSIGNED), r.room_no"
        );

        $recentGuests = Database::all(
            "SELECT g.id, g.guest_name, g.phone, g.address, g.id_proof, g.room_id, r.category_id,
                    g.status, g.room_no, g.check_in_at, g.check_out_at, g.expected_checkout_at,
                    g.total_amount, g.advance_amount, g.paid_amount, g.balance_amount, g.payment_mode,
                    g.booking_from, g.booking_to, g.adults_count, g.children_count, g.companions, g.companions_id_details
             FROM guest_house_guests g
             LEFT JOIN guest_house_rooms r ON r.id = g.room_id
             WHERE g.status IN ('checked_in','checked_out')
             ORDER BY g.created_at DESC
             LIMIT 12"
        );

        $dueCheckouts = Database::all(
            "SELECT id, guest_name, room_no, expected_checkout_at
             FROM guest_house_guests
             WHERE status = 'checked_in'
               AND expected_checkout_at IS NOT NULL
               AND expected_checkout_at <= NOW()
             ORDER BY expected_checkout_at ASC
             LIMIT 20"
        );

        Response::success([
            'summary' => [
                'total_rooms'     => (int) $summary['total_rooms'],
                'available_rooms' => (int) $summary['available_rooms'],
                'booked_rooms'    => (int) $summary['booked_rooms'],
                'active_guests'   => $activeGuests,
            ],
            'rooms' => $rooms,
            'recent_guests' => $recentGuests,
            'due_checkouts' => $dueCheckouts,
        ]);
    }

    public function availableRooms(Request $req): never
    {
        Auth::guard();
        $this->ensureAdvancedSchema();

        $categoryId = $req->queryInt('category_id', 0);
        $excludeGuestId = $req->queryInt('exclude_guest_id', 0);
        $from = $req->queryStr('from_date');
        $to = $req->queryStr('to_date');

        if ($categoryId <= 0) Response::success([]);
        if ($from === '' || $to === '') Response::success([]);

        $fromSql = $this->parseDateTime('from_date', $from);
        $toSql = $this->parseDateTime('to_date', $to);
        if (strtotime($toSql) <= strtotime($fromSql)) {
            Response::unprocessable('Validation failed.', ['to_date' => ['To date must be after from date.']]);
        }

        $rooms = Database::all(
            "SELECT r.id, r.room_no
             FROM guest_house_rooms r
             WHERE r.is_active = 1
               AND r.category_id = ?
               AND NOT EXISTS (
                    SELECT 1 FROM guest_house_guests g
                    WHERE g.room_id = r.id
                      AND g.id <> ?
                      AND g.status IN ('reserved', 'checked_in')
                      AND (? < COALESCE(g.booking_to, g.expected_checkout_at, g.check_out_at, '9999-12-31 23:59:59'))
                      AND (? > COALESCE(g.booking_from, g.check_in_at, g.created_at))
               )
             ORDER BY CAST(r.room_no AS UNSIGNED), r.room_no",
            [$categoryId, $excludeGuestId, $fromSql, $toSql]
        );

        Response::success($rooms);
    }

    public function createGuest(Request $req): never
    {
        $payload = Auth::guard();
        $this->ensureAdvancedSchema();

        $v = Validator::make($req->body())
            ->required('guest_name', 'Guest Name')->string('guest_name', 2, 100)
            ->required('phone', 'Phone Number')->string('phone', 7, 20)->phone('phone', 'Phone Number')
            ->required('category_id', 'Room Category')->integer('category_id', 1)
            ->required('room_no', 'Room Number')->string('room_no', 1, 20)
            ->required('address', 'Address')->string('address', 5, 255)
            ->string('id_proof', 0, 120);

        if ($v->fails()) Response::unprocessable('Validation failed.', $v->errors());

        $roomNo = $req->bodyStr('room_no');
        $fromSql = $this->parseDateTime('from_date', $req->bodyStr('from_date'));
        $toSql = $this->parseDateTime('to_date', $req->bodyStr('to_date'));
        $expectedCheckout = $req->bodyStr('expected_checkout_at') ?: $toSql;
        $expectedCheckoutSql = $this->parseDateTime('expected_checkout_at', $expectedCheckout);
        if (strtotime($toSql) <= strtotime($fromSql)) {
            Response::unprocessable('Validation failed.', ['to_date' => ['To date must be after from date.']]);
        }

        $totalAmount = max(0, $req->bodyFloat('total_amount', 0));
        $advanceAmount = max(0, $req->bodyFloat('advance_amount', 0));
        $paidAmount = max(0, $req->bodyFloat('paid_amount', $advanceAmount));
        if ($paidAmount < $advanceAmount) $paidAmount = $advanceAmount;
        if ($paidAmount > $totalAmount) $paidAmount = $totalAmount;
        $balanceAmount = max(0, $totalAmount - $paidAmount);
        $paymentMode = $this->paymentMode($req->bodyStr('payment_mode', 'cash'));
        $bookingId = $req->bodyInt('booking_id', 0);
        $adultsCount = max(1, $req->bodyInt('adults_count', 1));
        $childrenCount = max(0, $req->bodyInt('children_count', 0));
        $companions = $req->bodyStr('companions');
        $companionsIdDetails = $req->bodyStr('companions_id_details');

        Database::begin();
        try {
            $room = Database::row(
                "SELECT * FROM guest_house_rooms WHERE room_no = ? AND is_active = 1 FOR UPDATE",
                [$roomNo]
            );
            if (!$room) {
                Database::rollback();
                Response::notFound('Room not found.');
            }
            if ((int)$room['category_id'] !== (int)$req->bodyInt('category_id')) {
                Database::rollback();
                Response::error("Selected room does not belong to chosen category.", 422);
            }

            $conflict = Database::row(
                "SELECT id, room_no,
                        COALESCE(booking_from, check_in_at, created_at) AS booking_from,
                        COALESCE(booking_to, expected_checkout_at, check_out_at, '9999-12-31 23:59:59') AS booking_to
                 FROM guest_house_guests
                 WHERE room_id = ?
                   AND status IN ('reserved', 'checked_in')
                   AND (? < COALESCE(booking_to, expected_checkout_at, check_out_at, '9999-12-31 23:59:59'))
                   AND (? > COALESCE(booking_from, check_in_at, created_at))
                 LIMIT 1",
                [(int)$room['id'], $fromSql, $toSql]
            );
            if ($conflict && ((int)$conflict['id'] !== $bookingId)) {
                Database::rollback();
                Response::error($this->roomConflictMessage($conflict), 409);
            }

            if ($bookingId > 0) {
                $bookingRow = Database::row(
                    "SELECT id FROM guest_house_guests WHERE id = ? AND status = 'reserved' FOR UPDATE",
                    [$bookingId]
                );
                if (!$bookingRow) {
                    Database::rollback();
                    Response::error('Selected advance booking not found.', 404);
                }
                Database::run(
                    "UPDATE guest_house_guests
                     SET guest_name = ?, phone = ?, adults_count = ?, children_count = ?, companions = ?, companions_id_details = ?,
                         room_id = ?, room_no = ?, address = ?, id_proof = ?,
                         payment_mode = ?, total_amount = ?, advance_amount = ?, paid_amount = ?, balance_amount = ?,
                         booking_from = ?, booking_to = ?, expected_checkout_at = ?, check_in_at = NOW(), check_out_at = NULL,
                         status = 'checked_in', updated_at = NOW()
                     WHERE id = ?",
                    [
                        $req->bodyStr('guest_name'),
                        $req->bodyStr('phone'),
                        $adultsCount,
                        $childrenCount,
                        $companions ?: null,
                        $companionsIdDetails ?: null,
                        (int) $room['id'],
                        $roomNo,
                        $req->bodyStr('address'),
                        $req->bodyStr('id_proof') ?: '',
                        $paymentMode,
                        $totalAmount,
                        $advanceAmount,
                        $paidAmount,
                        $balanceAmount,
                        $fromSql,
                        $toSql,
                        $expectedCheckoutSql,
                        $bookingId,
                    ]
                );
                $guestId = $bookingId;
            } else {
                Database::run(
                    "INSERT INTO guest_house_guests
                     (guest_name, phone, adults_count, children_count, companions, companions_id_details, room_id, room_no, address, id_proof, payment_mode, total_amount, advance_amount, paid_amount, balance_amount, booking_from, booking_to, expected_checkout_at, check_in_at, status, created_by)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'checked_in', ?)",
                    [
                        $req->bodyStr('guest_name'),
                        $req->bodyStr('phone'),
                        $adultsCount,
                        $childrenCount,
                        $companions ?: null,
                        $companionsIdDetails ?: null,
                        (int) $room['id'],
                        $roomNo,
                        $req->bodyStr('address'),
                        $req->bodyStr('id_proof') ?: '',
                        $paymentMode,
                        $totalAmount,
                        $advanceAmount,
                        $paidAmount,
                        $balanceAmount,
                        $fromSql,
                        $toSql,
                        $expectedCheckoutSql,
                        (int) $payload['admin_id'],
                    ]
                );
                $guestId = Database::lastId();
            }

            Database::run("UPDATE guest_house_rooms SET status = 'booked' WHERE id = ?", [(int) $room['id']]);
            Database::commit();
        } catch (Throwable $e) {
            Database::rollback();
            Response::serverError('Failed to save guest record.');
        }

        Helper::log((int)$payload['admin_id'], 'guest_checkin', 'guest_house', $guestId, "Guest checked in to room {$roomNo}");

        $guest = Database::row("SELECT * FROM guest_house_guests WHERE id = ?", [$guestId]);
        Response::created($guest, 'Guest check-in recorded.');
    }

    public function createBooking(Request $req): never
    {
        $payload = Auth::guard();
        $this->ensureAdvancedSchema();

        $v = Validator::make($req->body())
            ->required('guest_name', 'Guest Name')->string('guest_name', 2, 100)
            ->required('phone', 'Phone Number')->string('phone', 7, 20)->phone('phone', 'Phone Number')
            ->required('category_id', 'Room Category')->integer('category_id', 1)
            ->required('room_no', 'Room Number')->string('room_no', 1, 20)
            ->required('address', 'Address')->string('address', 5, 255)
            ->string('id_proof', 0, 120);
        if ($v->fails()) Response::unprocessable('Validation failed.', $v->errors());

        $fromSql = $this->parseDateTime('from_date', $req->bodyStr('from_date'));
        $toSql = $this->parseDateTime('to_date', $req->bodyStr('to_date'));
        if (strtotime($toSql) <= strtotime($fromSql)) {
            Response::unprocessable('Validation failed.', ['to_date' => ['To date must be after from date.']]);
        }

        $roomNo = $req->bodyStr('room_no');
        $room = Database::row("SELECT id, room_no, category_id, status FROM guest_house_rooms WHERE room_no = ? AND is_active = 1", [$roomNo]);
        if (!$room) Response::notFound('Room not found.');
        if ((int)$room['category_id'] !== (int)$req->bodyInt('category_id')) {
            Response::error("Selected room does not belong to chosen category.", 422);
        }

        $bookingConflict = Database::row(
            "SELECT room_no,
                    COALESCE(booking_from, check_in_at, created_at) AS booking_from,
                    COALESCE(booking_to, expected_checkout_at, check_out_at, '9999-12-31 23:59:59') AS booking_to
             FROM guest_house_guests
             WHERE room_id = ?
               AND status IN ('reserved', 'checked_in')
               AND (? < COALESCE(booking_to, expected_checkout_at, check_out_at, '9999-12-31 23:59:59'))
               AND (? > COALESCE(booking_from, check_in_at, created_at))
             LIMIT 1",
            [(int)$room['id'], $fromSql, $toSql]
        );
        if ($bookingConflict) {
            Response::error($this->roomConflictMessage($bookingConflict), 409);
        }

        $totalAmount = max(0, $req->bodyFloat('total_amount', 0));
        $advanceAmount = max(0, $req->bodyFloat('advance_amount', 0));
        if ($advanceAmount > $totalAmount) $advanceAmount = $totalAmount;
        $balanceAmount = max(0, $totalAmount - $advanceAmount);
        $paymentMode = $this->paymentMode($req->bodyStr('payment_mode', 'cash'));
        $adultsCount = max(1, $req->bodyInt('adults_count', 1));
        $childrenCount = max(0, $req->bodyInt('children_count', 0));
        $companions = $req->bodyStr('companions');
        $companionsIdDetails = $req->bodyStr('companions_id_details');

        Database::run(
            "INSERT INTO guest_house_guests
             (guest_name, phone, adults_count, children_count, companions, companions_id_details, room_id, room_no, address, id_proof, payment_mode, total_amount, advance_amount, paid_amount, balance_amount, booking_from, booking_to, expected_checkout_at, status, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'reserved', ?)",
            [
                $req->bodyStr('guest_name'),
                $req->bodyStr('phone'),
                $adultsCount,
                $childrenCount,
                $companions ?: null,
                $companionsIdDetails ?: null,
                (int)$room['id'],
                $roomNo,
                $req->bodyStr('address'),
                $req->bodyStr('id_proof') ?: '',
                $paymentMode,
                $totalAmount,
                $advanceAmount,
                $advanceAmount,
                $balanceAmount,
                $fromSql,
                $toSql,
                $toSql,
                (int)$payload['admin_id'],
            ]
        );
        $bookingId = Database::lastId();

        Helper::log((int)$payload['admin_id'], 'guest_booking', 'guest_house', $bookingId, "Advance booking created for room {$roomNo}");
        Response::created(['id' => $bookingId], 'Advance booking created.');
    }

    public function bookings(Request $req): never
    {
        Auth::guard();
        $this->ensureAdvancedSchema();
        $rows = Database::all(
            "SELECT g.id, g.room_no, g.guest_name, g.phone, g.booking_from, g.booking_to, g.total_amount, g.advance_amount, g.balance_amount, g.payment_mode, g.status,
                    g.adults_count, g.children_count, g.companions, g.companions_id_details, g.room_id, r.category_id, g.expected_checkout_at
             FROM guest_house_guests g
             LEFT JOIN guest_house_rooms r ON r.id = g.room_id
             WHERE g.status = 'reserved'
             ORDER BY g.booking_from ASC
             LIMIT 100"
        );
        Response::success($rows);
    }

    public function updateGuest(Request $req, int $guestId): never
    {
        $payload = Auth::guard();
        $this->ensureAdvancedSchema();

        Database::begin();
        try {
            $guest = Database::row("SELECT * FROM guest_house_guests WHERE id = ? FOR UPDATE", [$guestId]);
            if (!$guest) {
                Database::rollback();
                Response::notFound('Guest record not found.');
            }

            $newStatus = $req->bodyStr('status', $guest['status']);
            if (!in_array($newStatus, ['reserved', 'checked_in', 'checked_out', 'cancelled'], true)) {
                $newStatus = $guest['status'];
            }

            $roomNo = $req->bodyStr('room_no', $guest['room_no']);
            $room = Database::row("SELECT id, room_no, category_id FROM guest_house_rooms WHERE room_no = ? AND is_active = 1 FOR UPDATE", [$roomNo]);
            if (!$room) {
                Database::rollback();
                Response::notFound('Room not found.');
            }

            $fromSql = $this->parseDateTime('from_date', $req->bodyStr('from_date', $guest['booking_from'] ?: $guest['check_in_at']));
            $toSql = $this->parseDateTime('to_date', $req->bodyStr('to_date', $guest['booking_to'] ?: $guest['expected_checkout_at'] ?: $guest['check_in_at']));
            if (strtotime($toSql) <= strtotime($fromSql)) {
                Database::rollback();
                Response::unprocessable('Validation failed.', ['to_date' => ['To date must be after from date.']]);
            }
            $expectedCheckoutSql = $this->parseDateTime('expected_checkout_at', $req->bodyStr('expected_checkout_at', $toSql));

            $conflict = Database::row(
                "SELECT room_no,
                        COALESCE(booking_from, check_in_at, created_at) AS booking_from,
                        COALESCE(booking_to, expected_checkout_at, check_out_at, '9999-12-31 23:59:59') AS booking_to
                 FROM guest_house_guests
                 WHERE room_id = ?
                   AND id <> ?
                   AND status IN ('reserved', 'checked_in')
                   AND (? < COALESCE(booking_to, expected_checkout_at, check_out_at, '9999-12-31 23:59:59'))
                   AND (? > COALESCE(booking_from, check_in_at, created_at))
                 LIMIT 1",
                [(int)$room['id'], $guestId, $fromSql, $toSql]
            );
            if ($conflict) {
                Database::rollback();
                Response::error($this->roomConflictMessage($conflict), 409);
            }

            $totalAmount = max(0, $req->bodyFloat('total_amount', (float)$guest['total_amount']));
            $advanceAmount = max(0, $req->bodyFloat('advance_amount', (float)$guest['advance_amount']));
            $paidAmount = max(0, $req->bodyFloat('paid_amount', (float)$guest['paid_amount']));
            if ($advanceAmount > $totalAmount) $advanceAmount = $totalAmount;
            if ($paidAmount < $advanceAmount) $paidAmount = $advanceAmount;
            if ($paidAmount > $totalAmount) $paidAmount = $totalAmount;
            $balanceAmount = max(0, $totalAmount - $paidAmount);

            $checkInAtExpr = $newStatus === 'checked_in' ? "COALESCE(check_in_at, NOW())" : "check_in_at";
            $checkOutAtExpr = $newStatus === 'checked_out' ? "COALESCE(check_out_at, NOW())" : "check_out_at";

            Database::run(
                "UPDATE guest_house_guests
                 SET guest_name = ?, phone = ?, adults_count = ?, children_count = ?, companions = ?, companions_id_details = ?,
                     room_id = ?, room_no = ?, address = ?, id_proof = ?, payment_mode = ?,
                     total_amount = ?, advance_amount = ?, paid_amount = ?, balance_amount = ?,
                     booking_from = ?, booking_to = ?, expected_checkout_at = ?,
                     status = ?, check_in_at = {$checkInAtExpr}, check_out_at = {$checkOutAtExpr}, updated_at = NOW()
                 WHERE id = ?",
                [
                    $req->bodyStr('guest_name', $guest['guest_name']),
                    $req->bodyStr('phone', $guest['phone']),
                    max(1, $req->bodyInt('adults_count', (int)($guest['adults_count'] ?? 1))),
                    max(0, $req->bodyInt('children_count', (int)($guest['children_count'] ?? 0))),
                    $req->bodyStr('companions', (string)($guest['companions'] ?? '')) ?: null,
                    $req->bodyStr('companions_id_details', (string)($guest['companions_id_details'] ?? '')) ?: null,
                    (int)$room['id'],
                    $roomNo,
                    $req->bodyStr('address', $guest['address']),
                    $req->bodyStr('id_proof', $guest['id_proof']),
                    $this->paymentMode($req->bodyStr('payment_mode', $guest['payment_mode'] ?? 'cash')),
                    $totalAmount,
                    $advanceAmount,
                    $paidAmount,
                    $balanceAmount,
                    $fromSql,
                    $toSql,
                    $expectedCheckoutSql,
                    $newStatus,
                    $guestId,
                ]
            );

            $oldRoomId = (int)$guest['room_id'];
            $newRoomId = (int)$room['id'];
            foreach (array_unique([$oldRoomId, $newRoomId]) as $rid) {
                $cnt = (int)Database::value("SELECT COUNT(*) FROM guest_house_guests WHERE room_id = ? AND status = 'checked_in'", [$rid]);
                Database::run("UPDATE guest_house_rooms SET status = ? WHERE id = ?", [$cnt > 0 ? 'booked' : 'available', $rid]);
            }

            Database::commit();
        } catch (Throwable $e) {
            Database::rollback();
            Response::serverError('Failed to update guest record.');
        }

        Helper::log((int)$payload['admin_id'], 'guest_update', 'guest_house', $guestId, "Guest record updated.");
        $row = Database::row("SELECT * FROM guest_house_guests WHERE id = ?", [$guestId]);
        Response::success($row, 'Guest updated successfully.');
    }

    public function addPayment(Request $req, int $guestId): never
    {
        $payload = Auth::guard();
        $this->ensureAdvancedSchema();
        $amount = max(0, $req->bodyFloat('amount', 0));
        if ($amount <= 0) Response::unprocessable('Validation failed.', ['amount' => ['Amount must be greater than 0.']]);
        $paymentMode = $this->paymentMode($req->bodyStr('payment_mode', 'cash'));

        Database::begin();
        try {
            $guest = Database::row(
                "SELECT id, paid_amount, total_amount, balance_amount, status
                 FROM guest_house_guests
                 WHERE id = ? FOR UPDATE",
                [$guestId]
            );
            if (!$guest) {
                Database::rollback();
                Response::notFound('Guest record not found.');
            }
            if ($guest['status'] !== 'checked_in') {
                Database::rollback();
                Response::error('Payment can only be added for checked-in guests.', 409);
            }

            $newPaid = (float)$guest['paid_amount'] + $amount;
            $total = (float)$guest['total_amount'];
            if ($newPaid > $total) $newPaid = $total;
            $newBalance = max(0, $total - $newPaid);

            Database::run(
                "UPDATE guest_house_guests
                 SET paid_amount = ?, balance_amount = ?, payment_mode = ?, updated_at = NOW()
                 WHERE id = ?",
                [$newPaid, $newBalance, $paymentMode, $guestId]
            );
            Database::commit();
        } catch (Throwable $e) {
            Database::rollback();
            Response::serverError('Failed to add payment.');
        }

        Helper::log((int)$payload['admin_id'], 'guest_add_payment', 'guest_house', $guestId, "Payment added: {$amount}");
        $row = Database::row("SELECT id, paid_amount, balance_amount, payment_mode FROM guest_house_guests WHERE id = ?", [$guestId]);
        Response::success($row, 'Payment updated.');
    }

    public function checkout(Request $req, int $guestId): never
    {
        $payload = Auth::guard();

        Database::begin();
        try {
            $guest = Database::row(
                "SELECT * FROM guest_house_guests WHERE id = ? FOR UPDATE",
                [$guestId]
            );
            if (!$guest) {
                Database::rollback();
                Response::notFound('Guest record not found.');
            }
            if ($guest['status'] !== 'checked_in') {
                Database::rollback();
                Response::error('Guest is already checked out.', 409);
            }

            Database::run(
                "UPDATE guest_house_guests SET status = 'checked_out', check_out_at = NOW() WHERE id = ?",
                [$guestId]
            );
            Database::run("UPDATE guest_house_rooms SET status = 'available' WHERE id = ?", [(int)$guest['room_id']]);
            Database::commit();
        } catch (Throwable $e) {
            Database::rollback();
            Response::serverError('Failed to checkout guest.');
        }

        Helper::log((int)$payload['admin_id'], 'guest_checkout', 'guest_house', $guestId, "Guest checked out from room {$guest['room_no']}");
        Response::success(null, 'Guest checked out successfully.');
    }

    public function rooms(Request $req): never
    {
        Auth::guard();
        $hasCategoryTable = $this->tableExists('guest_house_room_categories');
        $hasCategoryCol = $this->columnExists('guest_house_rooms', 'category_id');
        $joinCategory = $hasCategoryTable && $hasCategoryCol;
        $rooms = Database::all(
            "SELECT r.id, r.room_no, r.room_type, r.floor_no, r.status,
                    " . ($hasCategoryCol ? "r.category_id," : "NULL AS category_id,") . "
                    " . ($joinCategory ? "COALESCE(c.name, r.room_type, 'Standard')" : "COALESCE(r.room_type, 'Standard')") . " AS category_name
             FROM guest_house_rooms r
             " . ($joinCategory ? "LEFT JOIN guest_house_room_categories c ON c.id = r.category_id" : "") . "
             WHERE r.is_active = 1
             ORDER BY CAST(r.room_no AS UNSIGNED), r.room_no"
        );
        Response::success($rooms);
    }
}
