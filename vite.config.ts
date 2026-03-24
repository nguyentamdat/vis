import { execSync } from 'node:child_process';
import vue from '@vitejs/plugin-vue';
import { defineConfig, type Plugin } from 'vite';

const gitRevision = execSync('git rev-parse --short HEAD').toString().trim();

function quotaApiPlugin(): Plugin {
  return {
    name: 'quota-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/quota')) return next();

        try {
          const { getProviders, getProviderQuota, KNOWN_PROVIDERS } = await import(
            './quota-api.js'
          );

          if (req.url === '/api/quota/providers') {
            const data = await getProviders();
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
            return;
          }

          const match = req.url.match(/^\/api\/quota\/([^/?]+)/);
          if (match) {
            const providerId = match[1];
            if (!KNOWN_PROVIDERS.some((p: { id: string }) => p.id === providerId)) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: 'Unknown provider' }));
              return;
            }
            const result = await getProviderQuota(providerId);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(result));
            return;
          }

          next();
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(e) }));
        }
      });
    },
  };
}

export default defineConfig({
  base: './',
  root: 'app',
  plugins: [vue(), quotaApiPlugin()],
  worker: {
    format: 'es',
  },
  define: {
    __GIT_REVISION__: JSON.stringify(gitRevision),
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
