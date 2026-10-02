import { createApplication } from './src/http-app.js';
import { loadConfig } from './src/config.js';
import { createLogger } from './src/logger.js';

const config = loadConfig();
const logger = createLogger({ level: config.logLevel });
const { app, close } = createApplication({ config, logger });

const server = app.listen(config.port, config.host, () => {
  logger.info('server.started', {
    host: config.host,
    port: config.port,
    publicBaseUrl: config.publicBaseUrl,
    node: process.version,
    phase: config.salesCreateEnabled ? 'sales-create-demo' : 'read-only'
  });
});

async function shutdown(signal) {
  logger.info('server.stopping', { signal });
  server.close(async () => {
    await close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

