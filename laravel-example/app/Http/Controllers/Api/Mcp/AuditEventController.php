<?php

namespace App\Http\Controllers\Api\Mcp;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

final class AuditEventController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $event = $request->validate([
            'request_id' => ['required', 'uuid'],
            'occurred_at' => ['required', 'date'],
            'phase' => ['required', 'in:read-only'],
            'actor_user_id' => ['required', 'string', 'max:100'],
            'actor_role' => ['required', 'in:sales,team_admin,admin'],
            'team_ids' => ['array'],
            'team_ids.*' => ['string', 'max:100'],
            'tool' => ['required', 'string', 'max:100'],
            'allowed' => ['required', 'boolean'],
            'outcome' => ['required', 'string', 'max:100'],
            'argument_keys' => ['array'],
            'argument_keys.*' => ['string', 'max:100'],
            'duration_ms' => ['required', 'integer', 'min:0'],
        ]);

        Log::channel(config('services.prime_mcp.audit_channel', 'daily'))
            ->info('prime_mcp_tool_call', $event);

        return response()->json(['data' => ['accepted' => true]], 202);
    }
}

