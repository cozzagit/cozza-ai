import { serve } from '@hono/node-server';
import { app } from './index';
import { config } from './config';

const server = serve(
  {
    fetch: app.fetch,
    port: config.PORT,
    hostname: config.HOST,
  },
  (info) => {
    console.warn(
      JSON.stringify({
        event: 'server.listen',
        host: info.address,
        port: info.port,
        commit: config.COMMIT_SHA,
        env: config.NODE_ENV,
      }),
    );
  },
);

function shutdown(signal: string): void {
  console.warn(JSON.stringify({ event: 'server.shutdown', signal }));
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
