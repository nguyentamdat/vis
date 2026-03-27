#!/usr/bin/env node
import { serveStatic } from '@hono/node-server/serve-static';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { join, dirname } from 'node:path';
import { proxy } from 'hono/proxy';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
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

app.get('/api/plugin-versions', async (c) => {
  const result = {};
  try {
    const raw = await readFile(join(homedir(), '.cache', 'opencode', 'package.json'), 'utf8');
    const deps = JSON.parse(raw).dependencies || {};
    Object.assign(result, deps);
  } catch {}
  const plugins = c.req.queries('plugin') || [];
  for (const p of plugins) {
    if (result[p]) continue;
    let filePath = p;
    if (p.startsWith('file://')) {
      try { filePath = fileURLToPath(p); } catch { continue; }
    }
    if (filePath === p && !filePath.includes('/')) continue;
    let dir = dirname(filePath);
    for (let i = 0; i < 5; i++) {
      try {
        const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'));
        if (pkg.version) { result[p] = pkg.version; break; }
      } catch {}
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
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
