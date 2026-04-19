<?php
class SettingsController
{
    public function index(Request $req): never
    {
        Auth::guard();

        $rows = Database::all(
            'SELECT * FROM settings ORDER BY setting_group ASC, sort_order ASC, id ASC'
        );

        Response::success($rows);
    }

    public function update(Request $req): never
    {
        Auth::guard();

        $data = $req->body();
        if (empty($data) || !is_array($data)) {
            Response::error('No settings data provided.', 422);
        }

        // Validate specific fields
        if (isset($data['guest_house_commission'])) {
            if (!is_numeric($data['guest_house_commission'])) {
                Response::error('Guest house commission percentage must be a valid number.', 422);
            }
            $commissionPct = (float)$data['guest_house_commission'];
            if ($commissionPct < 0 || $commissionPct > 100) {
                Response::error('Guest house commission percentage must be between 0 and 100.', 422);
            }
        }
        if (isset($data['tax_percentage'])) {
            $tax = (float)$data['tax_percentage'];
            if ($tax < 0 || $tax > 100) {
                Response::error('Tax percentage must be between 0 and 100.', 422);
            }
        }

        $allowedKeys = Database::all('SELECT setting_key FROM settings');
        $allowed     = array_column($allowedKeys, 'setting_key');

        Database::begin();
        try {
            $stmt = Database::get()->prepare(
                'UPDATE settings SET setting_value = ? WHERE setting_key = ?'
            );
            foreach ($data as $key => $value) {
                if (!in_array($key, $allowed, true)) continue; // skip unknown keys
                $stmt->execute([(string)$value, $key]);
            }
            Database::commit();
        } catch (Throwable $e) {
            Database::rollback();
            Response::serverError('Failed to update settings.');
        }

        Response::success(null, 'Settings updated successfully.');
    }
}
