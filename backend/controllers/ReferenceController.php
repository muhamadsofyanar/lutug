<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/core/Utils.php';
require_once dirname(__DIR__) . '/core/AppHelper.php';

class ReferenceController
{
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    public function list(): void
    {
        $userId = $_SESSION['user_id'] ?? null;
        $search = $_GET['q'] ?? '';
        
        $sql = "SELECT * FROM reference_items WHERE (created_by = :user_id OR created_by IS NULL)";
        $params = [':user_id' => $userId];
        
        if ($search !== '') {
            $sql .= " AND (title LIKE :search OR content LIKE :search OR tags LIKE :search)";
            $params[':search'] = '%' . $search . '%';
        }
        
        $sql .= " ORDER BY created_at DESC";
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
        Utils::sendSuccess(['items' => $items]);
    }

    public function create(): void
    {
        $body = Utils::readJsonBody();
        $title = Utils::validateString($body, 'title', 255);
        $content = Utils::validateString($body, 'content', 10000, '');
        $tags = Utils::validateString($body, 'tags', 255, '');
        $businessUnit = Utils::validateString($body, 'businessUnit', 100, '');
        
        if ($title === '') {
            Utils::sendError('Judul referensi tidak boleh kosong', '', 400);
            return;
        }

        $now = Utils::now();
        $userId = $_SESSION['user_id'] ?? null;
        
        $stmt = $this->pdo->prepare('INSERT INTO reference_items (title, content, tags, business_unit, created_by, created_at, updated_at) VALUES (:title, :content, :tags, :business_unit, :created_by, :created_at, :updated_at)');
        $stmt->execute([
            ':title' => $title,
            ':content' => $content,
            ':tags' => $tags,
            ':business_unit' => $businessUnit === '' ? null : $businessUnit,
            ':created_by' => $userId,
            ':created_at' => $now,
            ':updated_at' => $now,
        ]);
        
        $id = (int)$this->pdo->lastInsertId();
        AppHelper::logActivity($this->pdo, 'reference_create', 'reference', $id, 'Membuat referensi: ' . $title, null, $businessUnit === '' ? null : $businessUnit);
        
        Utils::sendSuccess([
            'item' => [
                'id' => $id,
                'title' => $title,
                'content' => $content,
                'tags' => $tags,
                'business_unit' => $businessUnit,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ], '', 201);
    }

    public function update(): void
    {
        $body = Utils::readJsonBody();
        $id = Utils::validateInt($body, 'id');
        $title = Utils::validateString($body, 'title', 255);
        $content = Utils::validateString($body, 'content', 10000);
        $tags = Utils::validateString($body, 'tags', 255);
        $businessUnit = Utils::validateString($body, 'businessUnit', 100, '');

        if ($id === null || $title === '') {
            Utils::sendError('ID dan Judul wajib diisi', '', 400);
            return;
        }

        $userId = $_SESSION['user_id'] ?? null;
        // Verify access
        $stmt = $this->pdo->prepare('SELECT id FROM reference_items WHERE id = :id AND (created_by = :user_id OR created_by IS NULL)');
        $stmt->execute([':id' => $id, ':user_id' => $userId]);
        if (!$stmt->fetch()) {
            Utils::sendError('Referensi tidak ditemukan atau akses ditolak', '', 404);
            return;
        }

        $now = Utils::now();
        $stmt = $this->pdo->prepare('UPDATE reference_items SET title = :title, content = :content, tags = :tags, business_unit = :business_unit, updated_at = :updated_at WHERE id = :id');
        $stmt->execute([
            ':title' => $title,
            ':content' => $content,
            ':tags' => $tags,
            ':business_unit' => $businessUnit === '' ? null : $businessUnit,
            ':updated_at' => $now,
            ':id' => $id,
        ]);
        
        AppHelper::logActivity($this->pdo, 'reference_update', 'reference', $id, 'Mengupdate referensi: ' . $title, null, $businessUnit === '' ? null : $businessUnit);
        
        Utils::sendSuccess([
            'item' => [
                'id' => $id,
                'title' => $title,
                'content' => $content,
                'tags' => $tags,
                'business_unit' => $businessUnit,
                'updated_at' => $now,
            ],
        ]);
    }

    public function delete(): void
    {
        $body = Utils::readJsonBody();
        $id = Utils::validateInt($body, 'id');

        if ($id === null) {
            Utils::sendError('ID wajib diisi', '', 400);
            return;
        }

        $userId = $_SESSION['user_id'] ?? null;
        // Verify access
        $stmt = $this->pdo->prepare('SELECT id, business_unit FROM reference_items WHERE id = :id AND (created_by = :user_id OR created_by IS NULL)');
        $stmt->execute([':id' => $id, ':user_id' => $userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            Utils::sendError('Referensi tidak ditemukan atau akses ditolak', '', 404);
            return;
        }
        $businessUnit = $row['business_unit'] ?? null;

        $stmt = $this->pdo->prepare('DELETE FROM reference_items WHERE id = :id');
        $stmt->execute([':id' => $id]);
        
        AppHelper::logActivity($this->pdo, 'reference_delete', 'reference', $id, 'Menghapus referensi', null, $businessUnit);
        Utils::sendSuccess(['result' => 'deleted']);
    }
}
