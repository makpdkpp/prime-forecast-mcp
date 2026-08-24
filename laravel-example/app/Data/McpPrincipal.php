<?php

namespace App\Data;

final readonly class McpPrincipal
{
    /** @param list<int|string> $teamIds @param list<string> $permissions */
    public function __construct(
        public int|string $userId,
        public string $role,
        public array $teamIds,
        public array $permissions,
        public int $tokenExpiresAt,
    ) {}
}

