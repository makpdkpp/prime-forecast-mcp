<?php

namespace App\Http\Controllers\Api\Mcp;

use App\Contracts\McpPrincipalResolver;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class AuthContextController extends Controller
{
    public function __invoke(Request $request, McpPrincipalResolver $resolver): JsonResponse
    {
        $principal = $resolver->resolve($request->user());

        return response()->json(['data' => [
            'user' => ['id' => $principal->userId],
            'role' => $principal->role,
            'team_ids' => array_values($principal->teamIds),
            'permissions' => array_values($principal->permissions),
            'token_expires_at' => $principal->tokenExpiresAt,
        ]]);
    }
}

