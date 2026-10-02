import { McpServer, OAuthError, OAuthErrorCode, createMcpHandler } from '@modelcontextprotocol/server';
import { registerReadOnlyTools } from './tools.js';
import { normalizePrincipal } from './permission-guard.js';
import { GatewayError } from './errors.js';
import { registerSalesCreateTools } from './sales-create-tools.js';

export function createTokenVerifier({ gateway, logger }) {
  return {
    async verifyAccessToken(token) {
      try {
        const authInfo = await gateway.introspectToken(token);
        const principal = normalizePrincipal(authInfo);
        if (!['sales', 'team_admin', 'admin'].includes(principal.role)) {
          throw new GatewayError('Unsupported user role', { status: 401, code: 'invalid_token' });
        }
        return authInfo;
      } catch (error) {
        logger.warn('auth.token_rejected', { code: error.code ?? 'invalid_token' });
        if (error instanceof GatewayError && [401, 403].includes(error.status)) {
          throw new OAuthError(OAuthErrorCode.InvalidToken, 'The access token is invalid or expired');
        }
        throw error;
      }
    }
  };
}

export function createPrimeMcpHandler({ gateway, audit, salesCreateEnabled = false }) {
  return createMcpHandler(({ authInfo }) => {
    const principal = normalizePrincipal(authInfo);
    const server = new McpServer(
      { name: 'prime-forecast-v3', version: '0.1.0' },
      {
        instructions: salesCreateEnabled
          ? 'Respect caller scope. To add a sales project, look up catalog IDs, gather required fields and prepare a draft. Give its confirmation URL to the user and wait. NEVER open or submit the approval page on their behalf. A draft is not a project. Check draft status after the user confirms; only status created proves success. Do not claim to edit/delete existing projects.'
          : 'Read-only Prime Forecast V3 access. Never claim to update, create, or delete data. Respect the caller scope returned by each tool.'
      }
    );
    registerReadOnlyTools(server, {
      principal,
      token: authInfo.token,
      gateway,
      audit
    });
    registerSalesCreateTools(server, { principal, token: authInfo.token, gateway, audit, enabled: salesCreateEnabled });
    return server;
  });
}

