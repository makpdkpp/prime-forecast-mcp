<?php

namespace App\Services;

use App\Data\McpPrincipal;
use Illuminate\Auth\Access\AuthorizationException;

final class McpAuthorizationService
{
    private const PERMISSIONS = [
        'self' => 'forecast.self.read',
        'team' => 'forecast.team.read',
        'company' => 'forecast.company.read',
    ];

    public function authorizeSelf(McpPrincipal $actor): void
    {
        $this->requirePermission($actor, self::PERMISSIONS['self']);
    }

    public function authorizeTeam(McpPrincipal $actor, int|string $teamId): void
    {
        $this->requirePermission($actor, self::PERMISSIONS['team']);
        if ($actor->role !== 'admin' && ! in_array((string) $teamId, array_map('strval', $actor->teamIds), true)) {
            throw new AuthorizationException('Team is outside the authorized scope.');
        }
    }

    public function authorizeCompany(McpPrincipal $actor): void
    {
        if ($actor->role !== 'admin') {
            throw new AuthorizationException('Admin role is required.');
        }
        $this->requirePermission($actor, self::PERMISSIONS['company']);
    }

    private function requirePermission(McpPrincipal $actor, string $permission): void
    {
        if (! in_array($permission, $actor->permissions, true)) {
            throw new AuthorizationException("Missing permission: {$permission}");
        }
    }
}

