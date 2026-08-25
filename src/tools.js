import { randomUUID } from 'node:crypto';
import * as z from 'zod/v4';
import { assertTeamScope, assertToolAllowed, visibleTools } from './permission-guard.js';

const periodSchema = {
  date_from: z.iso.date().optional().describe('Start date in YYYY-MM-DD'),
  date_to: z.iso.date().optional().describe('End date in YYYY-MM-DD')
};

const paginationSchema = {
  page: z.number().int().min(1).default(1),
  per_page: z.number().int().min(1).max(100).default(25)
};

const READ_ONLY_ANNOTATIONS = Object.freeze({
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false
});

function toolResult(data) {
  return {
    content: [{ type: 'text', text: JSON.stringify(data) }],
    structuredContent: { data }
  };
}

function errorResult(error) {
  return {
    isError: true,
    content: [{
      type: 'text',
      text: JSON.stringify({
        error: error.code ?? 'tool_error',
        message: error.message,
        retryable: error.retryable ?? false
      })
    }]
  };
}

async function executeReadTool({ tool, args, principal, token, gateway, audit, operation }) {
  const requestId = randomUUID();
  const startedAt = Date.now();
  let outcome = 'success';
  let httpStatus = 200;
  try {
    assertToolAllowed(principal, tool);
    return toolResult(await operation({ requestId, tool }));
  } catch (error) {
    outcome = error.code ?? 'error';
    httpStatus = Number.isInteger(error.status) ? error.status : 500;
    return errorResult(error);
  } finally {
    await audit.record({
      request_id: requestId,
      actor_user_id: principal.userId,
      actor_role: principal.role,
      team_ids: principal.teamIds,
      tool,
      allowed: outcome !== 'permission_denied',
      outcome,
      http_status: httpStatus,
      argument_keys: Object.keys(args).sort(),
      duration_ms: Date.now() - startedAt
    });
  }
}

export function registerReadOnlyTools(server, { principal, token, gateway, audit }) {
  const allowed = new Set(visibleTools(principal));

  if (allowed.has('get_my_forecast')) {
    server.registerTool('get_my_forecast', {
      title: 'Get my forecast',
      description: 'Read the authenticated user’s forecast for an optional date range.',
      inputSchema: z.object(periodSchema),
      annotations: READ_ONLY_ANNOTATIONS
    }, async (args) => executeReadTool({
      tool: 'get_my_forecast', args, principal, token, gateway, audit,
      operation: (context) => gateway.getMyForecast(token, args, context)
    }));
  }

  if (allowed.has('list_team_forecasts')) {
    server.registerTool('list_team_forecasts', {
      title: 'List team forecasts',
      description: 'Read paginated forecasts for a team the caller is permitted to manage.',
      inputSchema: z.object({
        team_id: z.string().min(1),
        ...periodSchema,
        ...paginationSchema
      }),
      annotations: READ_ONLY_ANNOTATIONS
    }, async (args) => executeReadTool({
      tool: 'list_team_forecasts', args, principal, token, gateway, audit,
      operation: (context) => {
        assertTeamScope(principal, args.team_id);
        return gateway.listTeamForecasts(token, args.team_id, args, context);
      }
    }));
  }

  if (allowed.has('get_sales_forecast')) {
    server.registerTool('get_sales_forecast', {
      title: 'Get a sales forecast',
      description: 'Read one salesperson’s forecast within the caller’s authorized team scope.',
      inputSchema: z.object({
        sales_id: z.string().min(1),
        ...periodSchema
      }),
      annotations: READ_ONLY_ANNOTATIONS
    }, async (args) => executeReadTool({
      tool: 'get_sales_forecast', args, principal, token, gateway, audit,
      operation: (context) => gateway.getSalesForecast(token, args.sales_id, args, context)
    }));
  }

  if (allowed.has('get_company_forecast')) {
    server.registerTool('get_company_forecast', {
      title: 'Get company forecast',
      description: 'Read company-wide forecast aggregates. Admin only.',
      inputSchema: z.object(periodSchema),
      annotations: READ_ONLY_ANNOTATIONS
    }, async (args) => executeReadTool({
      tool: 'get_company_forecast', args, principal, token, gateway, audit,
      operation: (context) => gateway.getCompanyForecast(token, args, context)
    }));
  }
}

export { READ_ONLY_ANNOTATIONS };
