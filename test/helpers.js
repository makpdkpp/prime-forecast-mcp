import { once } from 'node:events';
import { createApplication } from '../src/http-app.js';
import { createLogger } from '../src/logger.js';

export const PRINCIPALS = Object.freeze({
  sales: {
    user: { id: 101 }, role: 'sales', team_ids: ['10'],
    permissions: ['forecast.self.read']
  },
  team: {
    user: { id: 201 }, role: 'team_admin', team_ids: ['10'],
    permissions: ['forecast.self.read', 'forecast.team.read']
  },
  admin: {
    user: { id: 1 }, role: 'admin', team_ids: [],
    permissions: ['forecast.self.read', 'forecast.team.read', 'forecast.company.read']
  }
});

export function createMockGatewayFetch({ calls = [] } = {}) {
  return async (url, options = {}) => {
    const parsed = new URL(url);
    const authorization = options.headers?.authorization;
    const token = authorization?.replace(/^Bearer /, '');
    calls.push({
      path: parsed.pathname,
      method: options.method,
      token,
      headers: options.headers,
      body: options.body ? JSON.parse(options.body) : null
    });

    if (parsed.pathname === '/api/mcp/v1/auth/context') {
      const principal = PRINCIPALS[token];
      if (!principal) return Response.json({ code: 'invalid_token' }, { status: 401 });
      return Response.json({ data: { ...principal, token_expires_at: Math.floor(Date.now() / 1000) + 3600 } });
    }
    if (parsed.pathname === '/api/mcp/v1/health') return Response.json({ data: { status: 'ok' } });
    if (parsed.pathname === '/api/mcp/v1/audit-events') return Response.json({ data: { accepted: true } }, { status: 202 });
    if (parsed.pathname === '/api/mcp/v1/forecast/me') {
      return Response.json({
        data: [{ owner_id: Number(PRINCIPALS[token].user.id), total: 125000 }],
        summary: { project_count: 1, forecast_value: 125000 },
        meta: { current_page: 1, total: 1 }
      });
    }
    if (parsed.pathname === '/api/mcp/v1/teams/10/forecasts') return Response.json({ data: { team_id: 10, items: [] } });
    if (parsed.pathname === '/api/mcp/v1/forecast/company') return Response.json({ data: { total: 999000 } });
    if (parsed.pathname === '/api/mcp/v1/sales/404/forecast') {
      return Response.json({ error: { code: 'not_found', message: 'Forecast scope was not found.' } }, { status: 404 });
    }
    if (/^\/api\/mcp\/v1\/sales\/[^/]+\/forecast$/.test(parsed.pathname)) return Response.json({ data: { sales_id: parsed.pathname.split('/')[5] } });
    return Response.json({ message: 'not found' }, { status: 404 });
  };
}

export async function startTestApp({ calls = [], salesCreateEnabled = false, fetchImpl } = {}) {
  const config = {
    env: 'development', host: '127.0.0.1', port: 0,
    publicBaseUrl: 'http://127.0.0.1', laravelBaseUrl: 'http://laravel.test',
    laravelMcpServiceToken: 'test-service-token', laravelTimeoutMs: 1000,
    auditSink: 'laravel', auditTimeoutMs: 1000, logLevel: 'error',
    allowedHosts: ['127.0.0.1'], allowedOrigins: []
  };
  config.salesCreateEnabled = salesCreateEnabled;
  const silent = { log() {}, error() {} };
  const logger = createLogger({ level: 'error', destination: silent });
  const application = createApplication({ config, logger, fetchImpl: fetchImpl ?? createMockGatewayFetch({ calls }) });
  const server = application.app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  return {
    ...application,
    calls,
    baseUrl: `http://127.0.0.1:${address.port}`,
    async stop() {
      server.close();
      await once(server, 'close');
      await application.close();
    }
  };
}

export async function mcpRequest(baseUrl, token, body) {
  const response = await fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers: {
      host: new URL(baseUrl).host,
      authorization: token ? `Bearer ${token}` : '',
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream'
    },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  if (response.headers.get('content-type')?.includes('text/event-stream')) {
    const dataLine = text.split('\n').find((line) => line.startsWith('data: '));
    return { response, body: dataLine ? JSON.parse(dataLine.slice(6)) : null };
  }
  return { response, body: text ? JSON.parse(text) : null };
}
