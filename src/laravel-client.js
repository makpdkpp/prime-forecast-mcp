import { GatewayError } from './errors.js';

const READ_PATHS = Object.freeze({
  authContext: '/api/mcp/v1/auth/context',
  health: '/api/mcp/v1/health',
  myForecast: '/api/mcp/v1/forecast/me',
  teamForecasts: (teamId) => `/api/mcp/v1/teams/${encodeURIComponent(teamId)}/forecasts`,
  salesForecast: (salesId) => `/api/mcp/v1/sales/${encodeURIComponent(salesId)}/forecast`,
  companyForecast: '/api/mcp/v1/forecast/company',
  audit: '/api/mcp/v1/audit-events'
});

function withQuery(path, query = {}) {
  const url = new URL(path, 'https://placeholder.invalid');
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  return `${url.pathname}${url.search}`;
}

function epochSeconds(value) {
  if (Number.isInteger(value)) return value;
  const millis = Date.parse(value);
  if (!Number.isFinite(millis)) throw new GatewayError('Laravel returned an invalid token expiry', { status: 401, code: 'invalid_token' });
  return Math.floor(millis / 1000);
}

function forecastResult(payload) {
  if (Array.isArray(payload?.data)) {
    return {
      items: payload.data,
      summary: payload.summary ?? null,
      meta: payload.meta ?? null
    };
  }
  return payload?.data ?? payload;
}

export class LaravelGatewayClient {
  constructor({ baseUrl, serviceToken, timeoutMs = 8000, fetchImpl = fetch }) {
    this.baseUrl = baseUrl;
    this.serviceToken = serviceToken;
    this.timeoutMs = timeoutMs;
    this.fetch = fetchImpl;
  }

  async request(path, {
    method = 'GET', userToken, body, timeoutMs = this.timeoutMs, unwrapData = true, requestContext
  } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await this.fetch(new URL(path, this.baseUrl), {
        method,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'x-prime-mcp-key': this.serviceToken,
          ...(requestContext?.requestId ? {
            'x-request-id': requestContext.requestId,
            'x-trace-id': requestContext.requestId
          } : {}),
          ...(requestContext?.tool ? { 'x-mcp-tool-name': requestContext.tool } : {}),
          ...(userToken ? { authorization: `Bearer ${userToken}` } : {})
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const errorPayload = payload?.error ?? payload;
        throw new GatewayError(errorPayload?.message ?? `Laravel Gateway returned HTTP ${response.status}`, {
          status: response.status,
          code: errorPayload?.code ?? (
            response.status === 401 ? 'invalid_token'
              : response.status === 403 ? 'permission_denied'
                : 'gateway_rejected'
          ),
          retryable: response.status >= 500
        });
      }
      return unwrapData ? (payload?.data ?? payload) : payload;
    } catch (error) {
      if (error instanceof GatewayError) throw error;
      const timeout = error?.name === 'AbortError';
      throw new GatewayError(timeout ? 'Laravel Gateway timed out' : 'Laravel Gateway is unavailable', {
        status: 503,
        code: timeout ? 'gateway_timeout' : 'gateway_unavailable',
        retryable: true
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async introspectToken(token) {
    const data = await this.request(READ_PATHS.authContext, { method: 'POST', userToken: token });
    const userId = data?.user?.id ?? data?.user_id;
    if (!userId || !data?.role || !data?.token_expires_at) {
      throw new GatewayError('Laravel auth context response is incomplete', { status: 401, code: 'invalid_token' });
    }
    return {
      token,
      clientId: String(userId),
      scopes: ['mcp:read'],
      expiresAt: epochSeconds(data.token_expires_at),
      extra: {
        principal: {
          userId: String(userId),
          role: data.role,
          teamIds: (data.team_ids ?? []).map(String),
          permissions: data.permissions ?? []
        }
      }
    };
  }

  health() {
    return this.request(READ_PATHS.health);
  }

  async getMyForecast(token, query, requestContext) {
    return forecastResult(await this.request(withQuery(READ_PATHS.myForecast, query), {
      userToken: token, unwrapData: false, requestContext
    }));
  }

  async listTeamForecasts(token, teamId, query, requestContext) {
    return forecastResult(await this.request(withQuery(READ_PATHS.teamForecasts(teamId), query), {
      userToken: token, unwrapData: false, requestContext
    }));
  }

  async getSalesForecast(token, salesId, query, requestContext) {
    return forecastResult(await this.request(withQuery(READ_PATHS.salesForecast(salesId), query), {
      userToken: token, unwrapData: false, requestContext
    }));
  }

  async getCompanyForecast(token, query, requestContext) {
    return forecastResult(await this.request(withQuery(READ_PATHS.companyForecast, query), {
      userToken: token, unwrapData: false, requestContext
    }));
  }

  writeAudit(event, timeoutMs) {
    return this.request(READ_PATHS.audit, { method: 'POST', body: event, timeoutMs });
  }

  salesCreateOptions(token, query, requestContext) {
    return this.request(withQuery('/api/mcp/v1/sales-create/options', query), { userToken: token, requestContext });
  }

  prepareSalesProject(token, body, requestContext) {
    return this.request('/api/mcp/v1/sales-drafts', { method: 'POST', userToken: token, body, requestContext });
  }

  salesProjectDraft(token, draftId, requestContext) {
    return this.request('/api/mcp/v1/sales-drafts/' + encodeURIComponent(draftId), { userToken: token, requestContext });
  }
}
