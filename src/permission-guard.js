import { PermissionDeniedError } from './errors.js';

export const ROLES = Object.freeze({
  SALES: 'sales',
  TEAM_ADMIN: 'team_admin',
  ADMIN: 'admin'
});

export const TOOL_POLICIES = Object.freeze({
  get_my_forecast: Object.freeze({
    roles: Object.freeze([ROLES.SALES, ROLES.TEAM_ADMIN, ROLES.ADMIN]),
    permission: 'forecast.self.read'
  }),
  list_team_forecasts: Object.freeze({
    roles: Object.freeze([ROLES.TEAM_ADMIN, ROLES.ADMIN]),
    permission: 'forecast.team.read'
  }),
  get_sales_forecast: Object.freeze({
    roles: Object.freeze([ROLES.TEAM_ADMIN, ROLES.ADMIN]),
    permission: 'forecast.team.read'
  }),
  get_company_forecast: Object.freeze({
    roles: Object.freeze([ROLES.ADMIN]),
    permission: 'forecast.company.read'
  })
});

export function normalizePrincipal(authInfo) {
  const principal = authInfo?.extra?.principal ?? authInfo?.principal;
  if (!principal || !principal.userId || !principal.role) {
    throw new PermissionDeniedError('unknown', principal?.role);
  }
  return Object.freeze({
    userId: String(principal.userId),
    role: principal.role,
    teamIds: Object.freeze((principal.teamIds ?? []).map(String)),
    permissions: Object.freeze([...(principal.permissions ?? [])])
  });
}

export function isToolAllowed(principal, toolName) {
  const policy = TOOL_POLICIES[toolName];
  if (!policy || !policy.roles.includes(principal.role)) return false;
  return principal.permissions.includes(policy.permission);
}

export function assertToolAllowed(principal, toolName) {
  if (!isToolAllowed(principal, toolName)) {
    throw new PermissionDeniedError(toolName, principal.role);
  }
}

export function visibleTools(principal) {
  return Object.keys(TOOL_POLICIES).filter((tool) => isToolAllowed(principal, tool));
}

export function assertTeamScope(principal, teamId) {
  if (principal.role === ROLES.ADMIN) return;
  if (principal.role !== ROLES.TEAM_ADMIN || !principal.teamIds.includes(String(teamId))) {
    throw new PermissionDeniedError(`team:${teamId}`, principal.role);
  }
}

