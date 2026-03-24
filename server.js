#!/usr/bin/env node
import { serveStatic } from '@hono/node-server/serve-static';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { join } from 'node:path';
import { proxy } from 'hono/proxy';
import { getProviders, getProviderQuota, KNOWN_PROVIDERS } from './quota-api.js';

const app = new Hono();

app.get('/api/quota/providers', async (c) => {
  return c.json(await getProviders());
});

app.get('/api/quota/:providerId', async (c) => {
  const providerId = c.req.param('providerId');
  if (!KNOWN_PROVIDERS.some((p) => p.id === providerId)) {
    return c.json({ error: 'Unknown provider' }, 404);
  }
  const result = await getProviderQuota(providerId);
  if (!result) return c.json({ error: 'Unknown provider' }, 404);
  return c.json(result);
});

if (process.argv[2] === 'proxy') {
  const baseURL = process.argv[3] ?? 'https://xenodrive.github.io/vis';

  console.log('Proxy to ' + baseURL);

  app.use('*', (c) => {
    const url = new URL(baseURL);
    url.pathname = url.pathname.replace(/\/$/, '') + c.req.path;

    const q = c.req.queries();
    for (const k in q) {
      for (const v of q?.[k] ?? []) {
        url.searchParams.append(k, v);
      }
    }

    return proxy(url, {
      ...c.req,
    });
  });
} else {
  app.use('*', serveStatic({ root: join(import.meta.dirname, 'dist/') }));
}

serve(
  {
    fetch: app.fetch,
    port: process.env.VIS_PORT || 3000,
  },
  (info) => {
    console.log(`Listening on http://localhost:${info.port}`);
  },
);
