import test from 'node:test';
import assert from 'node:assert/strict';
import { mcpRequest, startTestApp } from './helpers.js';

const listTools = { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} };

test('MCP endpoint rejects requests without a bearer token', async (t) => {
  const app = await startTestApp();
  t.after(() => app.stop());
  const { response } = await mcpRequest(app.baseUrl, null, listTools);
  assert.equal(response.status, 401);
  assert.match(response.headers.get('www-authenticate'), /resource_metadata=/);
});

test('MCP endpoint maps a rejected bearer token to 401, never 500', async (t) => {
  const app = await startTestApp();
  t.after(() => app.stop());
  const { response } = await mcpRequest(app.baseUrl, 'not-a-valid-token', listTools);
  assert.equal(response.status, 401);
  assert.match(response.headers.get('www-authenticate'), /invalid_token/);
});

for (const [token, expected] of [
  ['sales', ['get_my_forecast']],
  ['team', ['get_my_forecast', 'list_team_forecasts', 'get_sales_forecast']],
  ['admin', ['get_my_forecast', 'list_team_forecasts', 'get_sales_forecast', 'get_company_forecast']]
]) {
  test(`${token} receives only its allowed tools`, async (t) => {
    const app = await startTestApp();
    t.after(() => app.stop());
    const { response, body } = await mcpRequest(app.baseUrl, token, listTools);
    assert.equal(response.status, 200);
    assert.deepEqual(body.result.tools.map((tool) => tool.name), expected);
    for (const tool of body.result.tools) {
      assert.equal(tool.annotations.readOnlyHint, true);
      assert.equal(tool.annotations.destructiveHint, false);
    }
  });
}

test('sales can call own forecast and every call emits a Laravel audit event', async (t) => {
  const calls = [];
  const app = await startTestApp({ calls });
  t.after(() => app.stop());
  const { response, body } = await mcpRequest(app.baseUrl, 'sales', {
    jsonrpc: '2.0', id: 2, method: 'tools/call',
    params: { name: 'get_my_forecast', arguments: {} }
  });
  assert.equal(response.status, 200);
  assert.equal(body.result.isError, undefined);
  assert.match(body.result.content[0].text, /125000/);
  const result = JSON.parse(body.result.content[0].text);
  assert.equal(result.items[0].owner_id, 101);
  assert.equal(result.summary.forecast_value, 125000);
  assert.equal(result.meta.total, 1);
  const forecastCall = calls.find((call) => call.path === '/api/mcp/v1/forecast/me' && call.method === 'GET');
  const auditCall = calls.find((call) => call.path === '/api/mcp/v1/audit-events' && call.method === 'POST');
  assert.ok(forecastCall);
  assert.ok(auditCall);
  assert.equal(forecastCall.headers['x-mcp-tool-name'], 'get_my_forecast');
  assert.equal(forecastCall.headers['x-request-id'], auditCall.body.request_id);
  assert.equal(auditCall.body.http_status, 200);
});

test('team admin cannot escape assigned team scope', async (t) => {
  const calls = [];
  const app = await startTestApp({ calls });
  t.after(() => app.stop());
  const { body } = await mcpRequest(app.baseUrl, 'team', {
    jsonrpc: '2.0', id: 3, method: 'tools/call',
    params: { name: 'list_team_forecasts', arguments: { team_id: '99' } }
  });
  assert.equal(body.result.isError, true);
  assert.match(body.result.content[0].text, /permission_denied/);
  assert.equal(calls.some((call) => call.path.includes('/teams/99/')), false);
});

test('sales cannot invoke an unregistered company tool directly', async (t) => {
  const calls = [];
  const app = await startTestApp({ calls });
  t.after(() => app.stop());
  const { body } = await mcpRequest(app.baseUrl, 'sales', {
    jsonrpc: '2.0', id: 4, method: 'tools/call',
    params: { name: 'get_company_forecast', arguments: {} }
  });
  assert.ok(body.error || body.result?.isError);
  assert.equal(calls.some((call) => call.path === '/api/mcp/v1/forecast/company'), false);
  const auditCall = calls.find((call) => call.path === '/api/mcp/v1/audit-events');
  assert.ok(auditCall);
  assert.equal(auditCall.body.tool, 'get_company_forecast');
  assert.equal(auditCall.body.allowed, false);
  assert.equal(auditCall.body.http_status, 403);
});

test('gateway rejection keeps its HTTP status in the Laravel audit event', async (t) => {
  const calls = [];
  const app = await startTestApp({ calls });
  t.after(() => app.stop());
  const { body } = await mcpRequest(app.baseUrl, 'team', {
    jsonrpc: '2.0', id: 5, method: 'tools/call',
    params: { name: 'get_sales_forecast', arguments: { sales_id: '404' } }
  });
  assert.equal(body.result.isError, true);
  assert.match(body.result.content[0].text, /not_found/);
  const auditCall = calls.find((call) => call.path === '/api/mcp/v1/audit-events');
  assert.ok(auditCall);
  assert.equal(auditCall.body.allowed, true);
  assert.equal(auditCall.body.outcome, 'not_found');
  assert.equal(auditCall.body.http_status, 404);
});

test('health and readiness endpoints report independently', async (t) => {
  const app = await startTestApp();
  t.after(() => app.stop());
  const health = await fetch(`${app.baseUrl}/healthz`);
  const ready = await fetch(`${app.baseUrl}/readyz`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).mode, 'read-only');
  assert.equal(ready.status, 200);
});
