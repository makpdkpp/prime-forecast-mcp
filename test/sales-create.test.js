import test from 'node:test';
import assert from 'node:assert/strict';
import { startTestApp, mcpRequest, createMockGatewayFetch } from './helpers.js';
import { loadConfig } from '../src/config.js';

const id = '62886a5e-842d-483e-8ffd-2c4a1eab473c';
const project = { Product_detail: 'Demo project', company_id: 1, Product_id: 1, Source_budget_id: 1,
  priority_id: 1, team_id: 10, product_value: 1200, fiscalyear: 2026, contact_start_date: '2026-10-01' };

async function fixture(enabled = true) {
  const calls = [];
  const base = createMockGatewayFetch({ calls });
  const fetchImpl = async (url, options) => {
    const path = new URL(url).pathname;
    const token = options.headers.authorization?.replace('Bearer ', '');
    if (path.endsWith('/auth/context') && ['writer', 'admin-writer'].includes(token)) {
      return Response.json({ data: { user_id: 101, role: token === 'writer' ? 'sales' : 'admin', team_ids: [10],
        permissions: ['forecast.self.read', 'sales.self.create'], token_expires_at: new Date(Date.now() + 3600000).toISOString() } });
    }
    if (path === '/api/mcp/v1/sales-drafts') {
      calls.push({ path, options });
      return Response.json({ data: { draft_id: id, status: 'pending_confirmation', project_id: null,
        confirmation_url: 'https://demo.primes.co.th/mcp/sales-drafts/' + id } });
    }
    if (path === '/api/mcp/v1/sales-drafts/' + id) {
      calls.push({ path, options });
      return Response.json({ data: { draft_id: id, status: 'created', project_id: 123 } });
    }
    if (path === '/api/mcp/v1/sales-create/options') return Response.json({ data: { teams: [{ team_id: 10 }] } });
    return base(url, options);
  };
  return startTestApp({ calls, salesCreateEnabled: enabled, fetchImpl });
}

const rpc = (method, params = {}) => ({ jsonrpc: '2.0', id: 1, method, params });

test('write tools require explicit permission, role and feature flag', async () => {
  for (const enabled of [false, true]) {
    const app = await fixture(enabled);
    try {
      for (const token of ['sales', 'admin-writer', 'writer']) {
        const { body } = await mcpRequest(app.baseUrl, token, rpc('tools/list'));
        const draftTool = body.result.tools.find(t => t.name === 'prepare_sales_project');
        assert.equal(Boolean(draftTool), enabled && token === 'writer');
        if (draftTool) assert.equal(draftTool.annotations.readOnlyHint, false);
      }
      const denied = await mcpRequest(app.baseUrl, 'sales', rpc('tools/call', { name: 'prepare_sales_project', arguments: { idempotency_key: id, project } }));
      assert.ok(denied.body.error);
      assert.equal(app.calls.filter(c => c.path === '/api/mcp/v1/sales-drafts').length, 0);
    } finally { await app.stop(); }
  }
});

test('draft calls preserve idempotency and audit without contact values; status is explicit', async () => {
  const app = await fixture();
  try {
    const options = await mcpRequest(app.baseUrl, 'writer', rpc('tools/call', { name: 'get_sales_create_options', arguments: {} }));
    assert.equal(options.body.result.structuredContent.data.teams[0].team_id, 10);
    const args = { idempotency_key: id, project: { ...project, contact_email: 'private@example.test' } };
    const result = await mcpRequest(app.baseUrl, 'writer', rpc('tools/call', { name: 'prepare_sales_project', arguments: args }));
    assert.equal(result.body.result.structuredContent.data.status, 'pending_confirmation');
    const sent = app.calls.find(c => c.path === '/api/mcp/v1/sales-drafts');
    assert.deepEqual(JSON.parse(sent.options.body), args);
    assert.equal(sent.options.method, 'POST');
    const audits = app.calls.filter(c => c.path === '/api/mcp/v1/audit-events');
    assert.ok(audits.some(c => c.body.phase === 'sales-create'));
    assert.ok(!JSON.stringify(audits).includes('private@example.test'));
    const status = await mcpRequest(app.baseUrl, 'writer', rpc('tools/call', { name: 'get_sales_project_draft', arguments: { draft_id: id } }));
    assert.equal(status.body.result.structuredContent.data.project_id, 123);
    assert.ok(!app.calls.some(c => c.path.includes('/mcp/sales-drafts/')));
  } finally { await app.stop(); }
});

test('cross-team and owner injection never reach draft gateway', async () => {
  const app = await fixture();
  try {
    for (const invalid of [{ ...project, team_id: 20 }, { ...project, user_id: 999 }]) {
      const result = await mcpRequest(app.baseUrl, 'writer', rpc('tools/call', { name: 'prepare_sales_project', arguments: { idempotency_key: id, project: invalid } }));
      assert.ok(result.body.error || result.body.result.isError);
    }
    assert.equal(app.calls.filter(c => c.path === '/api/mcp/v1/sales-drafts').length, 0);
  } finally { await app.stop(); }
});

test('write configuration defaults off and rejects production hosts or stdout audit', () => {
  assert.equal(loadConfig({}).salesCreateEnabled, false);
  assert.throws(() => loadConfig({ MCP_SALES_CREATE_ENABLED: 'true' }), /Demo hosts/);
  const demo = { MCP_SALES_CREATE_ENABLED: 'true', PUBLIC_BASE_URL: 'https://mcp-demo.primes.co.th', LARAVEL_BASE_URL: 'https://demo.primes.co.th' };
  assert.equal(loadConfig(demo).salesCreateEnabled, true);
  assert.throws(() => loadConfig({ ...demo, LARAVEL_BASE_URL: 'http://demo.primes.co.th' }), /Demo hosts/);
  assert.throws(() => loadConfig({ ...demo, AUDIT_SINK: 'stdout' }), /Demo hosts/);
});
