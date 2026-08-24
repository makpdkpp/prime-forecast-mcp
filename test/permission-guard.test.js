import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertTeamScope,
  isToolAllowed,
  TOOL_POLICIES,
  visibleTools
} from '../src/permission-guard.js';

const sales = { userId: '101', role: 'sales', teamIds: ['10'], permissions: ['forecast.self.read'] };
const teamAdmin = { userId: '201', role: 'team_admin', teamIds: ['10'], permissions: ['forecast.self.read', 'forecast.team.read'] };
const admin = { userId: '1', role: 'admin', teamIds: [], permissions: ['forecast.self.read', 'forecast.team.read', 'forecast.company.read'] };

test('sales can see only their own forecast tool', () => {
  assert.deepEqual(visibleTools(sales), ['get_my_forecast']);
});

test('team admin can see self and team tools but not company tool', () => {
  assert.deepEqual(visibleTools(teamAdmin), ['get_my_forecast', 'list_team_forecasts', 'get_sales_forecast']);
});

test('admin can see every phase 1 tool', () => {
  assert.deepEqual(visibleTools(admin), Object.keys(TOOL_POLICIES));
});

test('role alone is insufficient when explicit permission is missing', () => {
  assert.equal(isToolAllowed({ ...admin, permissions: [] }, 'get_company_forecast'), false);
});

test('team admin is restricted to assigned teams while admin is global', () => {
  assert.doesNotThrow(() => assertTeamScope(teamAdmin, '10'));
  assert.throws(() => assertTeamScope(teamAdmin, '99'), { code: 'permission_denied' });
  assert.doesNotThrow(() => assertTeamScope(admin, '99'));
});

test('there are no write-like tools in phase 1 registry', () => {
  const names = Object.keys(TOOL_POLICIES);
  assert.ok(names.every((name) => !/^(create|update|delete|set|write|approve|reject)_/.test(name)));
});

