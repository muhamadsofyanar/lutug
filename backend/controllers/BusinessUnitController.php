<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/core/Utils.php';
require_once dirname(__DIR__) . '/core/AppHelper.php';

class BusinessUnitController
{
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    public function list(): void
    {
        try {
            $stmt = $this->pdo->prepare('SELECT id, name FROM business_units ORDER BY name ASC');
            $stmt->execute();
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            Utils::sendSuccess(['units' => $rows]);
        } catch (Throwable $e) {
            Utils::sendSuccess(['units' => []]);
        }
    }

    public function create(): void
    {
        $role = $_SESSION['role'] ?? 'member';
        if ($role !== 'admin') {
            Utils::sendError('Akses ditolak. Hanya admin.', '', 403);
            return;
        }

        $body = Utils::readJsonBody();
        if (!isset($body['name'])) {
            Utils::sendError('Nama unit wajib diisi', '', 400);
            return;
        }
        $name = trim($body['name']);
        if ($name === '') {
            Utils::sendError('Nama unit tidak boleh kosong', '', 400);
            return;
        }
        try {
            $stmt = $this->pdo->prepare('INSERT INTO business_units (name, created_at) VALUES (:name, :created_at)');
            $stmt->execute([
                ':name' => $name,
                ':created_at' => Utils::now()
            ]);
            AppHelper::logActivity($this->pdo, 'business_unit_create', 'business_unit', (int)$this->pdo->lastInsertId(), 'Menambah unit bisnis: ' . $name);
            Utils::sendSuccess(['result' => 'created', 'message' => 'Unit bisnis berhasil dibuat']);
        } catch (PDOException $e) {
            if (strpos($e->getMessage(), 'UNIQUE constraint failed') !== false || strpos($e->getMessage(), 'constraint failed') !== false) {
                 Utils::sendError('Unit bisnis sudah ada', '', 400);
            } else {
                 throw $e;
            }
        }
    }

    public function update(): void
    {
        $role = $_SESSION['role'] ?? 'member';
        if ($role !== 'admin') {
            Utils::sendError('Akses ditolak. Hanya admin.', '', 403);
            return;
        }

        $body = Utils::readJsonBody();
        $id = Utils::validateInt($body, 'id');
        $name = trim($body['name'] ?? '');

        if (!$id || $name === '') {
            Utils::sendError('ID dan Nama unit wajib diisi', '', 400);
            return;
        }

        try {
            $stmt = $this->pdo->prepare('UPDATE business_units SET name = :name WHERE id = :id');
            $stmt->execute([':name' => $name, ':id' => $id]);
            AppHelper::logActivity($this->pdo, 'business_unit_update', 'business_unit', $id, 'Mengubah nama unit bisnis menjadi: ' . $name);
            Utils::sendSuccess(['result' => 'updated', 'message' => 'Unit bisnis berhasil diperbarui']);
        } catch (PDOException $e) {
            Utils::sendError('Gagal update unit. Nama mungkin duplikat.', '', 400);
        }
    }

    public function delete(): void
    {
        $role = $_SESSION['role'] ?? 'member';
        if ($role !== 'admin') {
            Utils::sendError('Akses ditolak. Hanya admin.', '', 403);
            return;
        }

        $body = Utils::readJsonBody();
        $id = Utils::validateInt($body, 'id');

        if (!$id) {
            Utils::sendError('ID unit wajib diisi', '', 400);
            return;
        }

        $stmt = $this->pdo->prepare('DELETE FROM business_units WHERE id = :id');
        $stmt->execute([':id' => $id]);
        AppHelper::logActivity($this->pdo, 'business_unit_delete', 'business_unit', $id, 'Menghapus unit bisnis');
        
        Utils::sendSuccess(['result' => 'deleted', 'message' => 'Unit bisnis berhasil dihapus']);
    }
}
