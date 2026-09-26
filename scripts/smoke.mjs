// Smoke test against a deployed Watchtower.
//   WT_SMOKE_URL=https://arcanearchives.shop node scripts/smoke.mjs
//   WT_SMOKE_TOKEN=<Firebase ID token of a member> also checks bootstrap.
// (Get a token from the browser console on the site: await firebase auth user.getIdToken())
const base = (process.env.WT_SMOKE_URL || '').replace(/\/$/, '');
if (!base) {
  console.error('Set WT_SMOKE_URL');
  process.exit(2);
}
let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

const page = await fetch(`${base}/watchtower/`);
check('page /watchtower/ loads', page.ok, `HTTP ${page.status}`);

const health = await fetch(`${base}/api/watchtower/health`);
const h = await health.json().catch(() => null);
check('health responds', health.ok && h, `HTTP ${health.status}`);
if (h) check('health status', h.status === 'ok', `${h.status} · ${JSON.stringify(h.counts)}`);

const unauth = await fetch(`${base}/api/watchtower/bootstrap?tier=fast`);
check('bootstrap rejects anonymous requests', unauth.status === 401, `HTTP ${unauth.status}`);

if (process.env.WT_SMOKE_TOKEN) {
  for (const tier of ['fast', 'slow']) {
    const t0 = Date.now();
    const r = await fetch(`${base}/api/watchtower/bootstrap?tier=${tier}`, { headers: { Authorization: `Bearer ${process.env.WT_SMOKE_TOKEN}` } });
    const b = await r.json().catch(() => null);
    const empty = b ? Object.entries(b.data).filter(([, v]) => v === null).map(([k]) => k) : [];
    check(`bootstrap ${tier}`, r.ok && b, `HTTP ${r.status} in ${Date.now() - t0}ms${empty.length ? ` · empty: ${empty.join(', ')}` : ''}`);
  }
}

const old = await fetch(`${base}/world-map.html`, { redirect: 'manual' });
check('old /world-map.html redirects', [301, 308].includes(old.status), `HTTP ${old.status} → ${old.headers.get('location')}`);

process.exit(failed ? 1 : 0);
