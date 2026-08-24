<?php

use App\Http\Controllers\Api\Mcp\AuditEventController;
use App\Http\Controllers\Api\Mcp\AuthContextController;
use App\Http\Controllers\Api\Mcp\ForecastReadController;
use Illuminate\Support\Facades\Route;

Route::prefix('mcp/v1')->middleware(['mcp.service', 'throttle:120,1'])->group(function (): void {
    Route::get('/health', fn () => response()->json(['data' => ['status' => 'ok']]));
    Route::post('/audit-events', AuditEventController::class);

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::post('/auth/context', AuthContextController::class);
        Route::get('/forecast/me', [ForecastReadController::class, 'me']);
        Route::get('/teams/{teamId}/forecasts', [ForecastReadController::class, 'team']);
        Route::get('/sales/{salesId}/forecast', [ForecastReadController::class, 'sales']);
        Route::get('/forecast/company', [ForecastReadController::class, 'company']);
    });
});

