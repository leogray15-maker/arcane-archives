import { defineConfig, type Plugin, type ViteDevServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const here = fileURLToPath(new URL('.', import.meta.url));
const repo = resolve(here, '..');

/** Dev only: serves /api/watchtower/* from the same router the Vercel function
 *  uses, with an in-memory store and the dev auth bypass. */
function devApi(): Plugin {
  return {
    name: 'watchtower-dev-api',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      process.env.WT_DEV_AUTH_BYPASS = '1';
      server.middlewares.use('/api/watchtower', async (req, res) => {
        const { handle } = await server.ssrLoadModule(resolve(repo, 'lib/watchtower/routes.ts'));
        const url = new URL(req.url || '/', 'http://local');
        const query: Record<string, string> = {};
        url.searchParams.forEach((v, k) => (query[k] = v));
        let body: unknown;
        if (req.method === 'POST') {
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          try {
            body = JSON.parse(Buffer.concat(chunks).toString() || 'null');
          } catch {
            body = null;
          }
        }
        const out = await handle({
          method: req.method || 'GET',
          route: url.pathname.replace(/^\//, ''),
          query,
          headers: Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])),
          body,
        });
        res.statusCode = out.status;
        for (const [k, v] of Object.entries(out.headers)) res.setHeader(k, v as string);
        res.end(typeof out.body === 'string' ? out.body : JSON.stringify(out.body));
      });
    },
  };
}

export default defineConfig({
  root: here,
  base: '/watchtower/',
  publicDir: resolve(here, 'public'),
  envDir: here,
  plugins: [devApi()],
  build: {
    outDir: resolve(repo, 'dist/watchtower'),
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
    reportCompressedSize: true,
  },
  server: { port: 5178, fs: { allow: [repo] } },
});
