<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class RequireMcpServiceKey
{
    public function handle(Request $request, Closure $next): Response
    {
        $expected = (string) config('services.prime_mcp.service_key');
        $provided = (string) $request->header('X-Prime-MCP-Key', '');

        if ($expected === '' || $provided === '' || ! hash_equals($expected, $provided)) {
            return response()->json([
                'code' => 'invalid_service_key',
                'message' => 'Unauthorized MCP service.',
            ], 401);
        }

        return $next($request);
    }
}

