<?php

class WhatsAppNotifier {
    private $apiKey;
    private $apiUrl = "https://starsender.online/api/sendText";

    public function __construct() {
        $this->apiKey = $_ENV['WA_API_KEY'] ?? null;
    }

    /**
     * Send a text message via WhatsApp (StarSender)
     * 
     * @param string $message The message text
     * @param string $number The target phone number (e.g., 08123xxx or 628123xxx)
     * @return array Result with success status and response
     */
    public function sendMessage($message, $number) {
        if (!$this->apiKey) {
            return ['success' => false, 'error' => 'WhatsApp API Key not configured'];
        }

        if (!$number) {
            return ['success' => false, 'error' => 'Target phone number not provided'];
        }

        // Format number if needed (StarSender usually accepts 08... or 628...)
        // But keeping it as is is usually safest unless specified otherwise.

        $data = [
            'message' => $message,
            'tujuan' => $number
        ];

        $options = [
            'http' => [
                'timeout' => 30, // Increase timeout to 30s
                'header'  => [
                    "Content-type: application/json",
                    "apikey: " . $this->apiKey
                ],
                'method'  => 'POST',
                'content' => json_encode($data),
                'ignore_errors' => true
            ]
        ];

        $context  = stream_context_create($options);
        
        try {
            $result = @file_get_contents($this->apiUrl, false, $context);
            if ($result === FALSE) {
                $error = error_get_last();
                return ['success' => false, 'error' => 'Connection Failed: ' . ($error['message'] ?? 'Unknown error')];
            }
            
            $response = json_decode($result, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                 return ['success' => false, 'error' => 'Invalid JSON response from StarSender'];
            }
            
            // StarSender success check (handles various response formats)
            $success = ($response['status'] ?? false) == true || 
                       ($response['code'] ?? 0) == 200 ||
                       ($response['success'] ?? false) == true;

            return [
                'success' => $success,
                'response' => $response
            ];
        } catch (Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }
}
