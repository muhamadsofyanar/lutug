<?php

declare(strict_types=1);

class Utils
{
    public static function sendJson(array $data, int $status = 200): void
    {
        // Clean output buffer before sending JSON to ensure no garbage output
        if (ob_get_length()) {
            ob_clean();
        }
        
        http_response_code($status);
        if (php_sapi_name() !== 'cli') {
            header('Content-Type: application/json; charset=utf-8');
        }
        echo json_encode($data);
    }

    public static function sendSuccess(mixed $data = null, string $message = '', int $status = 200): void
    {
        $response = [
            'success' => true,
        ];
        if ($data !== null) {
            $response['data'] = $data;
        }
        if ($message !== '') {
            $response['message'] = $message;
        }
        self::sendJson($response, $status);
    }

    public static function sendError(string $message, string $code = '', int $status = 400, mixed $details = null): void
    {
        $response = [
            'success' => false,
            'error' => [
                'message' => $message,
            ]
        ];
        if ($code !== '') {
            $response['error']['code'] = $code;
        }
        if ($details !== null) {
            $response['error']['details'] = $details;
        }
        self::sendJson($response, $status);
    }

    private static ?array $mockBody = null;

    public static function setMockBody(array $body): void
    {
        self::$mockBody = $body;
    }

    public static function readJsonBody(): array
    {
        if (self::$mockBody !== null) {
            return self::$mockBody;
        }
        $raw = file_get_contents('php://input');
        if ($raw === false || $raw === '') {
            return [];
        }
        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            return [];
        }
        return $decoded;
    }

    public static function todayDate(): string
    {
        return (new DateTimeImmutable('now'))->format('Y-m-d');
    }

    public static function now(): string
    {
        return (new DateTimeImmutable('now'))->format(DATE_ATOM);
    }

    public static function validateString(array $data, string $key, int $maxLength = 0, string $default = ''): string
    {
        if (!isset($data[$key]) || !is_string($data[$key])) {
            return $default;
        }
        $val = strip_tags(trim($data[$key]));
        if ($maxLength > 0 && mb_strlen($val) > $maxLength) {
            $val = mb_substr($val, 0, $maxLength);
        }
        return $val;
    }

    public static function validateInt(array $data, string $key, ?int $default = null): ?int
    {
        if (!isset($data[$key])) {
            return $default;
        }
        if (is_int($data[$key])) {
            return $data[$key];
        }
        if (is_string($data[$key]) && ctype_digit($data[$key])) {
            return (int)$data[$key];
        }
        return $default;
    }

    public static function translateDay(string $dayName): string
    {
        $days = [
            'Monday' => 'Senin',
            'Tuesday' => 'Selasa',
            'Wednesday' => 'Rabu',
            'Thursday' => 'Kamis',
            'Friday' => 'Jumat',
            'Saturday' => 'Sabtu',
            'Sunday' => 'Minggu'
        ];
        return $days[$dayName] ?? $dayName;
    }
}

