<?php

namespace App\Http\Controllers\Api\Mcp;

use App\Contracts\ForecastReadRepository;
use App\Contracts\McpPrincipalResolver;
use App\Contracts\SalesTeamResolver;
use App\Http\Controllers\Controller;
use App\Http\Requests\McpForecastQueryRequest;
use App\Services\McpAuthorizationService;
use Illuminate\Http\JsonResponse;

final class ForecastReadController extends Controller
{
    public function __construct(
        private readonly ForecastReadRepository $forecasts,
        private readonly McpPrincipalResolver $principals,
        private readonly SalesTeamResolver $salesTeams,
        private readonly McpAuthorizationService $authorization,
    ) {}

    public function me(McpForecastQueryRequest $request): JsonResponse
    {
        $actor = $this->principals->resolve($request->user());
        $this->authorization->authorizeSelf($actor);

        return response()->json(['data' => $this->forecasts->forUser(
            $actor,
            $actor->userId,
            $request->validated(),
        )]);
    }

    public function team(McpForecastQueryRequest $request, string $teamId): JsonResponse
    {
        $actor = $this->principals->resolve($request->user());
        $this->authorization->authorizeTeam($actor, $teamId);

        return response()->json(['data' => $this->forecasts->forTeam(
            $actor,
            $teamId,
            $request->validated(),
        )]);
    }

    public function sales(McpForecastQueryRequest $request, string $salesId): JsonResponse
    {
        $actor = $this->principals->resolve($request->user());
        $this->authorization->authorizeTeam($actor, $this->salesTeams->teamIdForSales($salesId));

        return response()->json(['data' => $this->forecasts->forUser(
            $actor,
            $salesId,
            $request->validated(),
        )]);
    }

    public function company(McpForecastQueryRequest $request): JsonResponse
    {
        $actor = $this->principals->resolve($request->user());
        $this->authorization->authorizeCompany($actor);

        return response()->json(['data' => $this->forecasts->forCompany(
            $actor,
            $request->validated(),
        )]);
    }

}
