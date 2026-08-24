export class GatewayError extends Error {
  constructor(message, { status = 502, code = 'gateway_error', retryable = false } = {}) {
    super(message);
    this.name = 'GatewayError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

export class PermissionDeniedError extends Error {
  constructor(tool, role) {
    super(`Role ${role ?? 'unknown'} is not allowed to call ${tool}`);
    this.name = 'PermissionDeniedError';
    this.code = 'permission_denied';
    this.tool = tool;
    this.role = role;
  }
}

