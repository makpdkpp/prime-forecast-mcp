import { createMcpExpressApp, requireBearerAuth } from '@modelcontextprotocol/express';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { randomUUID } from 'node:crypto';
import { LaravelGatewayClient } from './laravel-client.js';
import { AuditLogger } from './audit.js';
import { createPrimeMcpHandler, createTokenVerifier } from './mcp-server.js';
import { normalizePrincipal, visibleTools } from './permission-guard.js';

export function createApplication({ config, logger, fetchImpl = fetch }) {
  const gateway = new LaravelGatewayClient({
    baseUrl: config.laravelBaseUrl,
    serviceToken: config.laravelMcpServiceToken,
    timeoutMs: config.laravelTimeoutMs,
    fetchImpl
  });
  const audit = new AuditLogger({
    logger,
    gateway,
    sink: config.auditSink,
    timeoutMs: config.auditTimeoutMs
  });
  const verifier = createTokenVerifier({ gateway, logger });
  const handler = createPrimeMcpHandler({ gateway, audit });
  const resourceMetadataUrl = `${config.publicBaseUrl}/.well-known/oauth-protected-resource`;

  const app = createMcpExpressApp({
    host: config.host,
    allowedHosts: config.allowedHosts,
    allowedOrigins: config.allowedOrigins
  });

  app.disable('x-powered-by');

  app.get('/healthz', (_req, res) => {
    res.set('cache-control', 'no-store').status(200).json({
      status: 'ok',
      service: 'prime-forecast-mcp',
      version: '0.1.0',
      mode: 'read-only'
    });
  });

  app.get('/readyz', async (_req, res) => {
    try {
      await gateway.health();
      res.set('cache-control', 'no-store').status(200).json({ status: 'ready', gateway: 'ok' });
    } catch (error) {
      logger.warn('health.gateway_unavailable', { error });
      res.set('cache-control', 'no-store').status(503).json({ status: 'not_ready', gateway: 'unavailable' });
    }
  });

  app.get('/.well-known/oauth-protected-resource', (_req, res) => {
    res.set('cache-control', 'public, max-age=300').json({
      resource: config.publicBaseUrl,
      authorization_servers: [config.laravelBaseUrl],
      scopes_supported: ['mcp:read'],
      resource_documentation: `${config.publicBaseUrl}/docs`
    });
  });

  app.get('/docs', (_req, res) => {
    res.type('text/plain').send('Prime Forecast V3 MCP — Phase 1 is read-only. Contact the Prime administrator for access.');
  });

  const auth = requireBearerAuth({
    verifier,
    requiredScopes: ['mcp:read'],
    resourceMetadataUrl
  });
  const authDiagnostics = (req, res, next) => {
    const requestId = req.get('x-request-id') || randomUUID();
    const authorization = req.get('authorization') ?? '';
    const bearerPresent = /^Bearer\s+\S+/i.test(authorization);
    const startedAt = Date.now();

    res.set('x-request-id', requestId);
    res.set('cache-control', 'no-store');
    res.vary('Authorization');
    res.on('finish', () => {
      logger.info('http.mcp_auth', {
        request_id: requestId,
        http_status: res.statusCode,
        authorization_present: authorization.length > 0,
        bearer_present: bearerPresent,
        challenge_present: res.hasHeader('www-authenticate'),
        duration_ms: Date.now() - startedAt
      });
    });
    next();
  };
  const nodeHandler = toNodeHandler(handler);
  const auditRejectedTool = async (req, _res, next) => {
    try {
      const tool = req.body?.method === 'tools/call' ? req.body?.params?.name : null;
      if (typeof tool === 'string') {
        const principal = normalizePrincipal(req.auth);
        if (!visibleTools(principal).includes(tool)) {
          await audit.record({
            request_id: randomUUID(),
            actor_user_id: principal.userId,
            actor_role: principal.role,
            team_ids: principal.teamIds,
            tool,
            allowed: false,
            outcome: 'permission_denied',
            http_status: 403,
            argument_keys: Object.keys(req.body?.params?.arguments ?? {}).sort(),
            duration_ms: 0
          });
        }
      }
      next();
    } catch (error) {
      next(error);
    }
  };
  app.all('/mcp', authDiagnostics, auth, auditRejectedTool, (req, res) => void nodeHandler(req, res, req.body));

  app.use((error, _req, res, _next) => {
    logger.error('http.unhandled_error', { error });
    if (res.headersSent) return;
    res.status(500).json({ error: 'internal_server_error' });
  });

  return {
    app,
    gateway,
    close: () => handler.close()
  };
}
