<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/core/Utils.php';
require_once dirname(__DIR__) . '/core/AppHelper.php';

class PeopleController
{
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    public function list(): void
    {
        try {
            // Fetch people with team info
            $stmt = $this->pdo->prepare('
                SELECT p.id, p.name, p.job_title, p.team_id, t.name as team_name 
                FROM people p 
                LEFT JOIN teams t ON p.team_id = t.id
            ');
            $stmt->execute();
            $people = $stmt->fetchAll(PDO::FETCH_ASSOC);
            $peopleMap = [];
            foreach ($people as $p) {
                $peopleMap[$p['name']] = [
                    'id' => $p['id'],
                    'job_title' => $p['job_title'],
                    'team_id' => $p['team_id'],
                    'team_name' => $p['team_name'],
                    'is_person' => true
                ];
            }

            // Fetch users
            $stmt = $this->pdo->prepare('SELECT id, username, job_title, role, assigned_units FROM users');
            $stmt->execute();
            $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
            $userMap = [];
            foreach ($users as $u) {
                $userMap[$u['username']] = [
                    'id' => $u['id'],
                    'job_title' => $u['job_title'],
                    'role' => $u['role'],
                    'assigned_units' => $u['assigned_units'] ? json_decode($u['assigned_units'], true) : [],
                    'is_user' => true
                ];
            }

            // Merge
            $allNames = array_unique(array_merge(array_keys($peopleMap), array_keys($userMap)));
            sort($allNames);

            $result = [];
            foreach ($allNames as $name) {
                $pData = $peopleMap[$name] ?? [];
                $uData = $userMap[$name] ?? [];

                $jobTitle = $uData['job_title'] ?? $pData['job_title'] ?? null;
                $role = $uData['role'] ?? null;
                
                $result[] = [
                    'id' => $pData['id'] ?? $uData['id'] ?? null, // Prefer people ID if exists for editing person details
                    'name' => $name,
                    'is_user' => isset($uData['is_user']),
                    'is_person' => isset($pData['is_person']),
                    'job_title' => $jobTitle,
                    'role' => $role,
                    'team_id' => $pData['team_id'] ?? null,
                    'team_name' => $pData['team_name'] ?? null,
                    'assigned_units' => $uData['assigned_units'] ?? []
                ];
            }

            Utils::sendSuccess(['people' => $result]);
        } catch (Throwable $e) {
            Utils::sendSuccess(['people' => []]);
        }
    }

    public function add(): void
    {
        $body = Utils::readJsonBody();
        if (!isset($body['name'])) {
            Utils::sendError('Nama wajib diisi', '', 400);
            return;
        }
        $name = trim($body['name']);
        if ($name === '') {
            Utils::sendError('Nama tidak boleh kosong', '', 400);
            return;
        }
        
        $jobTitle = $body['job_title'] ?? null;
        $teamId = $body['team_id'] ?? null;

        try {
            $stmt = $this->pdo->prepare('INSERT INTO people (name, job_title, team_id, created_at) VALUES (:name, :job_title, :team_id, :created_at)');
            $stmt->execute([
                ':name' => $name,
                ':job_title' => $jobTitle,
                ':team_id' => $teamId,
                ':created_at' => Utils::now()
            ]);
            AppHelper::logActivity($this->pdo, 'people_add', 'people', (int)$this->pdo->lastInsertId(), 'Menambah orang: ' . $name);
            Utils::sendSuccess(['result' => 'created']);
        } catch (PDOException $e) {
            if (strpos($e->getMessage(), 'UNIQUE constraint failed') !== false || strpos($e->getMessage(), 'constraint failed') !== false) {
                 Utils::sendError('Orang sudah ada', '', 400);
            } else {
                 throw $e;
            }
        }
    }

    public function update(): void
    {
        $body = Utils::readJsonBody();
        if (!isset($body['name'])) {
            Utils::sendError('Nama wajib diisi', '', 400);
            return;
        }
        
        $name = $body['name'];
        $jobTitle = $body['job_title'] ?? null;
        $teamId = $body['team_id'] ?? null;

        // Note: This only updates the 'people' table entry. 
        // If the person is also a user, job_title in users table is handled by AdminController.
        // But for simplicity, we can try to update both if they match by name/username.
        
        try {
            $this->pdo->beginTransaction();

            // Update people table
            $stmt = $this->pdo->prepare('UPDATE people SET job_title = :job_title, team_id = :team_id WHERE name = :name');
            $stmt->execute([
                ':job_title' => $jobTitle,
                ':team_id' => $teamId,
                ':name' => $name
            ]);

            // Update users table (job_title only)
            $stmt = $this->pdo->prepare('UPDATE users SET job_title = :job_title WHERE username = :name');
            $stmt->execute([
                ':job_title' => $jobTitle,
                ':name' => $name
            ]);
            
            $this->pdo->commit();
            Utils::sendSuccess(['result' => 'updated']);
        } catch (Throwable $e) {
            $this->pdo->rollBack();
            Utils::sendError('Gagal update data: ' . $e->getMessage());
        }
    }

    public function delete(): void
    {
        $body = Utils::readJsonBody();
        if (!isset($body['name'])) {
            Utils::sendError('Nama wajib diisi', '', 400);
            return;
        }
        $name = trim($body['name']);
        $stmt = $this->pdo->prepare('DELETE FROM people WHERE name = :name');
        $stmt->execute([':name' => $name]);
        AppHelper::logActivity($this->pdo, 'people_delete', 'people', 0, 'Menghapus orang: ' . $name);
        Utils::sendSuccess(['result' => 'deleted']);
    }
}
