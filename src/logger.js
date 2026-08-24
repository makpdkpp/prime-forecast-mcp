const LEVELS = Object.freeze({ debug: 10, info: 20, warn: 30, error: 40 });

function serializeError(error) {
  if (!(error instanceof Error)) return error;
  return { name: error.name, message: error.message, code: error.code };
}

export function createLogger({ level = 'info', destination = console } = {}) {
  const threshold = LEVELS[level] ?? LEVELS.info;

  function write(logLevel, event, fields = {}) {
    if (LEVELS[logLevel] < threshold) return;
    const record = {
      timestamp: new Date().toISOString(),
      level: logLevel,
      event,
      ...fields
    };
    for (const [key, value] of Object.entries(record)) {
      if (value instanceof Error) record[key] = serializeError(value);
    }
    const output = JSON.stringify(record);
    const method = logLevel === 'error' ? 'error' : 'log';
    destination[method](output);
  }

  return Object.freeze({
    debug: (event, fields) => write('debug', event, fields),
    info: (event, fields) => write('info', event, fields),
    warn: (event, fields) => write('warn', event, fields),
    error: (event, fields) => write('error', event, fields)
  });
}

