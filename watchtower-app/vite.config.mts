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
      // Seed the in-memory store from local fixtures (upstream APIs are not
      // called in dev unless WT_DEV_FIXTURES=0). The UI marks this as fixture data.
      // Re-seeds whenever the (in-memory) store is empty — e.g. after a hot
      // reload of server modules creates a fresh store instance.
      let seeding: Promise<void> | null = null;
      const seed = async () => {
        if (process.env.WT_DEV_FIXTURES === '0') return;
        const st = await server.ssrLoadModule(resolve(repo, 'lib/watchtower/store.ts'));
        if (await st.getStore().get('wt:meta:wt:seismic:v1')) return;
        seeding ??= (async () => {
          // Fixture keys so every job runs locally; the AI endpoint returns a labelled DEV STUB.
          for (const k of ['NASA_FIRMS_MAP_KEY', 'UCDP_ACCESS_TOKEN', 'FRED_API_KEY', 'GROQ_API_KEY']) process.env[k] ??= 'fixture';
          const fx = await server.ssrLoadModule(resolve(repo, 'lib/watchtower/dev/fixture-fetch.ts'));
          const reg = await server.ssrLoadModule(resolve(repo, 'lib/watchtower/seed/registry.ts'));
          fx.installFixtureFetch(resolve(repo, 'tests/watchtower/fixtures'));
          for (const tier of ['daily', 'slow', 'medium', 'fast', 'slow']) await reg.runTier(tier, st.getStore(), { force: true });
        })()
          .catch((e) => console.error('[watchtower dev] fixture seed failed', e))
          .finally(() => (seeding = null));
        await seeding;
      };
      server.middlewares.use('/api/watchtower', async (req, res) => {
        try {
          await seed();
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
        } catch (e) {
          console.error('[watchtower dev api]', e);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(e) }));
        }
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
  // MapLibre ships its worker inline; pre-bundling breaks it in dev.
  optimizeDeps: { exclude: ['maplibre-gl'] },
});
