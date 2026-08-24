<?php

namespace App\Contracts;

use App\Data\McpPrincipal;

interface ForecastReadRepository
{
    /** @return array<string, mixed> */
    public function forUser(McpPrincipal $actor, int|string $userId, array $filters): array;

    /** @return array<string, mixed> */
    public function forTeam(McpPrincipal $actor, int|string $teamId, array $filters): array;

    /** @return array<string, mixed> */
    public function forCompany(McpPrincipal $actor, array $filters): array;
}

