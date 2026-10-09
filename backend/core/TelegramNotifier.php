<?php

class TelegramNotifier {
    private $botToken;
    private $defaultChatId;
    private $apiUrl = "https://api.telegram.org/bot";

    public function __construct() {
        $this->botToken = $_ENV['TELEGRAM_BOT_TOKEN'] ?? null;
        $this->defaultChatId = $_ENV['TELEGRAM_CHAT_ID'] ?? null;
    }

    /**
     * Send a text message to a Telegram chat
     * 
     * @param string $message The message text
     * @param string|null $chatId Optional chat ID (uses default from env if null)
     * @return array Result with success status and response
     */
    public function sendMessage($message, $chatId = null) {
        if (!$this->botToken) {
            return ['success' => false, 'error' => 'Telegram Bot Token not configured'];
        }

        $targetChatId = $chatId ?? $this->defaultChatId;
        
        if (!$targetChatId) {
            return ['success' => false, 'error' => 'Target Chat ID not provided'];
        }

        $url = $this->apiUrl . $this->botToken . "/sendMessage";
        
        $data = [
            'chat_id' => $targetChatId,
            'text' => $message,
            'parse_mode' => 'HTML'
        ];

        $options = [
            'http' => [
                'header'  => "Content-type: application/x-www-form-urlencoded\r\n",
                'method'  => 'POST',
                'content' => http_build_query($data),
                'ignore_errors' => true // Capture non-200 responses
            ]
        ];

        $context  = stream_context_create($options);
        
        try {
            $result = file_get_contents($url, false, $context);
            if ($result === FALSE) {
                return ['success' => false, 'error' => 'Failed to connect to Telegram API'];
            }
            
            $response = json_decode($result, true);
            return [
                'success' => $response['ok'] ?? false,
                'response' => $response
            ];
        } catch (Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }
}
