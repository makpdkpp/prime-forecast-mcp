const ROLE_VALUES = new Set(['sales', 'team_admin', 'admin']);

function required(name, env) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function positiveInteger(name, value, fallback) {
  const parsed = Number.parseInt(value ?? String(fallback), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function csv(value, fallback = []) {
  if (!value) return fallback;
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function httpsUrl(name, value, { allowHttp = false } = {}) {
  const url = new URL(value);
  if (!allowHttp && url.protocol !== 'https:') {
    throw new Error(`${name} must use HTTPS`);
  }
  return url.toString().replace(/\/$/, '');
}

export function loadConfig(env = process.env) {
  const production = (env.NODE_ENV ?? 'development') === 'production';
  const publicBaseUrl = httpsUrl(
    'PUBLIC_BASE_URL',
    env.PUBLIC_BASE_URL ?? 'https://mcp.primes.co.th',
    { allowHttp: !production }
  );
  const laravelBaseUrl = httpsUrl(
    'LARAVEL_BASE_URL',
    env.LARAVEL_BASE_URL ?? 'https://sale.primes.co.th',
    { allowHttp: !production }
  );

  const serviceToken = production
    ? required('LARAVEL_MCP_SERVICE_TOKEN', env)
    : (env.LARAVEL_MCP_SERVICE_TOKEN ?? 'local-test-service-token');

  if (production && serviceToken.length < 32) {
    throw new Error('LARAVEL_MCP_SERVICE_TOKEN must be at least 32 characters in production');
  }

  const allowedHosts = csv(env.ALLOWED_HOSTS, [new URL(publicBaseUrl).hostname]);
  if (allowedHosts.length === 0) throw new Error('ALLOWED_HOSTS cannot be empty');

  const auditSink = env.AUDIT_SINK ?? 'laravel';
  if (!['laravel', 'stdout'].includes(auditSink)) {
    throw new Error('AUDIT_SINK must be laravel or stdout');
  }
  const salesCreateEnabled = env.MCP_SALES_CREATE_ENABLED === 'true';
  if (salesCreateEnabled && (new URL(publicBaseUrl).protocol !== 'https:' || new URL(laravelBaseUrl).protocol !== 'https:'
      || new URL(publicBaseUrl).hostname !== 'mcp-demo.primes.co.th'
      || new URL(laravelBaseUrl).hostname !== 'demo.primes.co.th' || auditSink !== 'laravel')) {
    throw new Error('Sales creation is restricted to Demo hosts with Laravel audit enabled');
  }

  return Object.freeze({
    env: production ? 'production' : 'development',
    host: env.HOST ?? '0.0.0.0',
    port: positiveInteger('PORT', env.PORT, 3000),
    publicBaseUrl,
    laravelBaseUrl,
    laravelMcpServiceToken: serviceToken,
    laravelTimeoutMs: positiveInteger('LARAVEL_TIMEOUT_MS', env.LARAVEL_TIMEOUT_MS, 8000),
    auditSink,
    salesCreateEnabled,
    auditTimeoutMs: positiveInteger('AUDIT_TIMEOUT_MS', env.AUDIT_TIMEOUT_MS, 2000),
    logLevel: env.LOG_LEVEL ?? 'info',
    allowedHosts,
    allowedOrigins: csv(env.ALLOWED_ORIGINS),
    roleValues: ROLE_VALUES
  });
}

