<?php
/**
 * JWT-based stateless authentication.
 * HS256 with base64url encoding.
 */
class Auth
{
    private static function b64url(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function b64decode(string $data): string
    {
        $pad = strlen($data) % 4;
        if ($pad) $data .= str_repeat('=', 4 - $pad);
        return base64_decode(strtr($data, '-_', '+/'));
    }

    public static function generateToken(array $payload): string
    {
        $header  = self::b64url(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
        $payload['iat'] = time();
        $payload['exp'] = time() + JWT_EXPIRY;
        $body = self::b64url(json_encode($payload));
        $sig  = self::b64url(hash_hmac('sha256', "$header.$body", JWT_SECRET, true));
        return "$header.$body.$sig";
    }

    public static function verifyToken(string $token): ?array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) return null;

        [$header, $body, $sig] = $parts;
        $expected = self::b64url(hash_hmac('sha256', "$header.$body", JWT_SECRET, true));

        if (!hash_equals($expected, $sig)) return null;

        $payload = json_decode(self::b64decode($body), true);
        if (!$payload || !isset($payload['exp']) || $payload['exp'] < time()) {
            return null;
        }
        return $payload;
    }

    /**
     * Bearer token from Authorization header (works with Apache, nginx, PHP built-in server, proxies).
     */
    private static function bearerFromRequest(): ?string
    {
        $auth = '';
        if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
            $auth = (string) $_SERVER['HTTP_AUTHORIZATION'];
        } elseif (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            $auth = (string) $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
        } elseif (function_exists('apache_request_headers')) {
            $headers = apache_request_headers();
            if (is_array($headers)) {
                $headers = array_change_key_case($headers, CASE_LOWER);
                $auth = $headers['authorization'] ?? '';
            }
        }
        if ($auth === '' && function_exists('getallheaders')) {
            $headers = @getallheaders();
            if (is_array($headers)) {
                $headers = array_change_key_case($headers, CASE_LOWER);
                $auth = $headers['authorization'] ?? '';
            }
        }
        if (!str_starts_with($auth, 'Bearer ')) {
            return null;
        }
        return substr($auth, 7);
    }

    /**
     * Require a valid Bearer token. Returns decoded payload or terminates with 401.
     */
    public static function guard(): array
    {
        $token = self::bearerFromRequest();

        if ($token === null || $token === '') {
            Response::unauthorized('Authorization token is required.');
        }
        $payload = self::verifyToken($token);

        if (!$payload) {
            Response::unauthorized('Invalid or expired token. Please log in again.');
        }
        return $payload;
    }
}
