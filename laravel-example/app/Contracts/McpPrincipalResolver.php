<?php

namespace App\Contracts;

use App\Data\McpPrincipal;
use Illuminate\Contracts\Auth\Authenticatable;

interface McpPrincipalResolver
{
    /** Map the existing Prime Forecast V3 user/team model to the canonical MCP principal. */
    public function resolve(Authenticatable $user): McpPrincipal;
}

