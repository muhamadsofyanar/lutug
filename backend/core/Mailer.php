<?php

namespace Core;

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require_once __DIR__ . '/../../config/config.php';

class Mailer {
    private $mail;

    public function __construct() {
        $this->mail = new PHPMailer(true);

        try {
            // Server settings
            $this->mail->isSMTP();
            $this->mail->Host       = env('MAIL_HOST', 'smtp.mailketing.id');
            $this->mail->SMTPAuth   = true;
            $this->mail->Username   = env('MAIL_USERNAME', '');
            $this->mail->Password   = env('MAIL_PASSWORD', ''); 
            $this->mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            $this->mail->Port       = env('MAIL_PORT', 587);

            // Default Sender
            $this->mail->setFrom(
                env('MAIL_FROM_ADDRESS', 'noreply@example.com'), 
                env('MAIL_FROM_NAME', 'InsyaRah')
            );
        } catch (Exception $e) {
            // Log error silently, don't throw yet
            error_log("Mailer Config Error: {$this->mail->ErrorInfo}");
        }
    }

    public function send($to, $subject, $body, $isHtml = true) {
        try {
            $this->mail->addAddress($to);
            $this->mail->isHTML($isHtml);
            $this->mail->Subject = $subject;
            $this->mail->Body    = $body;
            $this->mail->AltBody = strip_tags($body);

            $this->mail->send();
            return true;
        } catch (Exception $e) {
            error_log("Message could not be sent. Mailer Error: {$this->mail->ErrorInfo}");
            return false;
        }
    }
}
