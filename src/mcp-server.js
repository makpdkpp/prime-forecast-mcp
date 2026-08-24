import { McpServer, OAuthError, OAuthErrorCode, createMcpHandler } from '@modelcontextprotocol/server';
import { registerReadOnlyTools } from './tools.js';
import { normalizePrincipal } from './permission-guard.js';
import { GatewayError } from './errors.js';

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

export function createPrimeMcpHandler({ gateway, audit }) {
  return createMcpHandler(({ authInfo }) => {
    const principal = normalizePrincipal(authInfo);
    const server = new McpServer(
      { name: 'prime-forecast-v3', version: '0.1.0' },
      {
        instructions: 'Read-only Prime Forecast V3 access. Never claim to update, create, or delete data. Respect the caller scope returned by each tool.'
      }
    );
    registerReadOnlyTools(server, {
      principal,
      token: authInfo.token,
      gateway,
      audit
    });
    return server;
  });
}

