import { randomUUID } from 'node:crypto';
import * as z from 'zod/v4';

const permission = 'sales.self.create';
export function canPrepareSales(principal) {
  return ['sales', 'team_admin'].includes(principal.role) && principal.permissions.includes(permission);
}

const projectSchema = z.strictObject({
  Product_detail: z.string().min(1).max(100).describe('Project name'),
  company_id: z.number().int().positive(),
  Product_id: z.number().int().positive(),
  Source_budget_id: z.number().int().positive(),
  priority_id: z.number().int().positive(),
  team_id: z.number().int().positive(),
  product_value: z.number().min(0).max(999999999999.99).describe('THB, at most two decimal places'),
  fiscalyear: z.number().int().min(2000).max(2100).describe('Gregorian fiscal year, not Buddhist year'),
  contact_start_date: z.iso.date(),
  date_of_closing_of_sale: z.iso.date().optional(),
  sales_can_be_close: z.iso.date().optional(),
  remark: z.string().max(255).optional(),
  contact_person: z.string().max(255).optional(),
  contact_phone: z.string().max(50).optional(),
  contact_email: z.email().max(255).optional(),
  contact_note: z.string().max(2000).optional(),
  steps: z.array(z.strictObject({ level_id: z.number().int().positive(), date: z.iso.date() })).max(6).optional()
});

export function registerSalesCreateTools(server, { principal, token, gateway, audit, enabled }) {
  if (!enabled || !canPrepareSales(principal)) return;
  const run = async (tool, args, operation) => {
    const requestId = randomUUID();
    const started = Date.now();
    let outcome = 'success';
    let status = 200;
    try {
      const data = await operation({ requestId, tool });
      return { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: { data } };
    } catch (error) {
      outcome = error.code ?? 'tool_error';
      status = error.status ?? 500;
      return { isError: true, content: [{ type: 'text', text: JSON.stringify({ error: outcome, message: error.message }) }] };
    } finally {
      await audit.record({ request_id: requestId, phase: 'sales-create', actor_user_id: principal.userId,
        actor_role: principal.role, team_ids: principal.teamIds, tool, allowed: status !== 403,
        outcome, http_status: status, argument_keys: Object.keys(args), duration_ms: Date.now() - started });
    }
  };
  const read = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
  server.registerTool('get_sales_create_options', {
    title: 'Look up sales project choices',
    description: 'Get valid customer, product, budget source, priority, step and assigned-team IDs before preparing a new project. Search/paginate customers; never guess IDs.',
    inputSchema: z.strictObject({ company_search: z.string().max(100).optional(), page: z.number().int().positive().default(1) }),
    annotations: read
  }, args => run('get_sales_create_options', args, context => gateway.salesCreateOptions(token, args, context)));
  server.registerTool('prepare_sales_project', {
    title: 'Prepare a new sales project for human confirmation',
    description: 'Save an expiring draft only, NOT a sales project. Obtain required fields from the user. Use a UUID idempotency_key, reuse it for retries with the SAME payload; use a new key for changes. Return the confirmation_url to the user. The user must open it, log in and confirm. NEVER open or submit confirmation on the user behalf. Never claim a project exists until get_sales_project_draft returns status created.',
    inputSchema: z.strictObject({ idempotency_key: z.uuid(), project: projectSchema }),
    annotations: { ...read, readOnlyHint: false }
  }, args => run('prepare_sales_project', args, context => {
    if (!principal.teamIds.includes(String(args.project.team_id))) {
      throw Object.assign(new Error('Team is outside your scope.'), { code: 'permission_denied', status: 403 });
    }
    return gateway.prepareSalesProject(token, args, context);
  }));
  server.registerTool('get_sales_project_draft', {
    title: 'Check sales project creation status',
    description: 'Check whether the user has confirmed a draft. pending_confirmation means no project has been created. created includes the project_id. No polling loop: check when the user reports confirmation.',
    inputSchema: z.strictObject({ draft_id: z.uuid() }), annotations: read
  }, args => run('get_sales_project_draft', args, context => gateway.salesProjectDraft(token, args.draft_id, context)));
}
