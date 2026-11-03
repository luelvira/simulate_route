import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { createApp } from './app';

/** Starts the planning server; it also serves the built page from dist/. */
const app = createApp();
app.use('/*', serveStatic({ root: './dist' }));
serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3000) });
