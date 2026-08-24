<?php

namespace App\Contracts;

interface SalesTeamResolver
{
    /** Return the salesperson's current team ID, or throw when no authorized mapping exists. */
    public function teamIdForSales(int|string $salesId): int|string;
}

