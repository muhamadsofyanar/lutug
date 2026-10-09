<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/core/Utils.php';
require_once dirname(__DIR__) . '/core/AppHelper.php';

class TeamController
{
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    public function list(): void
    {
        try {
            $stmt = $this->pdo->prepare('
                SELECT t.*, b.name as business_unit_name 
                FROM teams t
                LEFT JOIN business_units b ON t.business_unit_id = b.id
                ORDER BY t.name ASC
            ');
            $stmt->execute();
            $teams = $stmt->fetchAll(PDO::FETCH_ASSOC);
            Utils::sendSuccess(['teams' => $teams]);
        } catch (Throwable $e) {
            Utils::sendError('Gagal mengambil data tim: ' . $e->getMessage());
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
            Utils::sendError('Nama tim wajib diisi', '', 400);
            return;
        }

        try {
            $stmt = $this->pdo->prepare('INSERT INTO teams (name, description, business_unit_id) VALUES (:name, :description, :business_unit_id)');
            $stmt->execute([
                ':name' => $body['name'],
                ':description' => $body['description'] ?? null,
                ':business_unit_id' => $body['business_unit_id'] ?? null
            ]);
            
            $id = (int)$this->pdo->lastInsertId();
            AppHelper::logActivity($this->pdo, 'team_create', 'team', $id, 'Menambah tim: ' . $body['name']);
            Utils::sendSuccess(['result' => 'created', 'id' => $id]);
        } catch (Throwable $e) {
            Utils::sendError('Gagal membuat tim: ' . $e->getMessage());
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
        if (!isset($body['id'])) {
            Utils::sendError('ID tim wajib diisi', '', 400);
            return;
        }

        try {
            $stmt = $this->pdo->prepare('UPDATE teams SET name = :name, description = :description, business_unit_id = :business_unit_id, updated_at = CURRENT_TIMESTAMP WHERE id = :id');
            $stmt->execute([
                ':id' => $body['id'],
                ':name' => $body['name'],
                ':description' => $body['description'] ?? null,
                ':business_unit_id' => $body['business_unit_id'] ?? null
            ]);
            
            AppHelper::logActivity($this->pdo, 'team_update', 'team', (int)$body['id'], 'Mengubah data tim: ' . $body['name']);
            Utils::sendSuccess(['result' => 'updated']);
        } catch (Throwable $e) {
            Utils::sendError('Gagal mengupdate tim: ' . $e->getMessage());
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
        if (!isset($body['id'])) {
            Utils::sendError('ID tim wajib diisi', '', 400);
            return;
        }

        try {
            // Check if used by people
            $stmt = $this->pdo->prepare('SELECT COUNT(*) FROM people WHERE team_id = :id');
            $stmt->execute([':id' => $body['id']]);
            if ($stmt->fetchColumn() > 0) {
                Utils::sendError('Tidak dapat menghapus tim yang memiliki anggota', '', 400);
                return;
            }

            $stmt = $this->pdo->prepare('DELETE FROM teams WHERE id = :id');
            $stmt->execute([':id' => $body['id']]);
            
            AppHelper::logActivity($this->pdo, 'team_delete', 'team', (int)$body['id'], 'Menghapus tim');
            Utils::sendSuccess(['result' => 'deleted']);
        } catch (Throwable $e) {
            Utils::sendError('Gagal menghapus tim: ' . $e->getMessage());
        }
    }
}
