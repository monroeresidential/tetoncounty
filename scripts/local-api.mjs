// Development-only middleware. Production uses the unchanged Cloudflare Worker.
// SQLite and the local verification bypass are never bundled into dist/ or the Worker.
import { DatabaseSync } from 'node:sqlite';
import { mkdir } from 'node:fs/promises';
import { adaptDb } from './sqlite-adapter.mjs';
import { handleApi } from '../src/worker.mjs';
import { migrateLocal } from './local-migrations.mjs';

export function localApi() {
  return {
    name: 'local-submission-preview',
    configureServer: async (server) => {
      await mkdir('.local', { recursive: true });
      const database = new DatabaseSync('.local/submissions.sqlite');
      await migrateLocal(database);
      server.httpServer?.once('close', () => database.close());
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();
        try {
          const address = server.httpServer.address();
          const port = typeof address === 'object' && address ? address.port : 4321;
          const origin = `http://${req.headers.host || `localhost:${port}`}`;
          const request = new Request(new URL(req.url, origin), {
            method: req.method, headers: req.headers,
            ...(['GET', 'HEAD'].includes(req.method) ? {} : { body: req, duplex: 'half' }),
          });
          const response = await handleApi(request, { DB: adaptDb(database), LOCAL_PREVIEW: true, SITE_URL: origin });
          res.writeHead(response.status, Object.fromEntries(response.headers));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Local submission preview failed.' }));
        }
      });
    },
  };
}
