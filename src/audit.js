export class AuditLogger {
  constructor({ logger, gateway, sink = 'laravel', timeoutMs = 2000 }) {
    this.logger = logger;
    this.gateway = gateway;
    this.sink = sink;
    this.timeoutMs = timeoutMs;
  }

  async record(event) {
    const safeEvent = {
      occurred_at: new Date().toISOString(),
      phase: 'read-only',
      ...event
    };
    this.logger.info('audit.tool_call', safeEvent);
    if (this.sink !== 'laravel') return;
    try {
      await this.gateway.writeAudit(safeEvent, this.timeoutMs);
    } catch (error) {
      this.logger.error('audit.delivery_failed', {
        request_id: event.request_id,
        tool: event.tool,
        error
      });
    }
  }
}

