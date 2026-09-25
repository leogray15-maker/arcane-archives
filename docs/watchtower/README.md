# Arcane Watchtower v2

A live global-situation dashboard for members of The Arcane Archives, served at
**`/watchtower/`**.

```
Browser (watchtower-app, Vite + vanilla TS)
  │  Firebase ID token on every request
  ▼
/api/watchtower/*  →  api/watchtower.ts (one Vercel function, Node runtime)
  │  verify token → membership (Firestore, cached 5 min) → rate limit
  ▼
Upstash Redis  ◀── Vercel Cron → /api/watchtower/cron/{fast,medium,slow,daily}
                     seed jobs: fetch → validate → write last-good + meta
                     derive jobs: signals, CII, convergence, spikes, AI…
```

The browser never calls an upstream source directly.

## Layout of the code

| Path | What |
|---|---|
| `watchtower-app/` | The front end: `src/app` (state, URL sync, auth gate, API client, bootstrap loader, poller), `src/config` (**layer registry**, media), `src/map` (globe, lazy 2D map, scene, LOD, popover), `src/panels` (**Panel base class** and panels), `src/ui` (header, layer panel, drawer, search, modals) |
| `api/watchtower.ts` | The single Vercel function (a `vercel.json` rewrite sends `/api/watchtower/*` here) |
| `lib/watchtower/` | Server code: `http` (router, auth, rate limit), `seed` (framework, registry, `jobs/*`), `intel` (scoring), `ai` (providers, briefs, output guard), `config` (**RSS feeds**, **CII countries**, regions/theatres), `geo`, `text`, `store.ts` (Upstash REST + in-memory) |
| `shared/watchtower/` | Types and the **feed list** (`feeds.ts`) used by both sides |
| `data/watchtower/` | Versioned reference datasets (bundled into the function, never public) |
| `tests/watchtower/` | Vitest suites + fixtures in each upstream's format |
| `scripts/build-site.mjs` | Builds `dist/` = static site (minus source/config) + the Watchtower app |
| `docs/watchtower/` | This README, SOURCES, METHODOLOGY, RUNBOOK, PERFORMANCE, PLAN |

## Running locally

```bash
npm install
npm run dev          # http://localhost:5178/watchtower/
```

The dev server serves the API from the same router, using an **in-memory store
seeded from test fixtures** and a dev sign-in. A `DEV` chip appears in the
header, and nothing in dev mode calls a real upstream source or AI model.

- Switch viewer tier with `?as=free`, `?as=member` or `?as=admin`.
- Set `WT_DEV_FIXTURES=0` to start with an empty store instead.

```bash
npm test             # 67 tests: scoring, pipeline, feeds, AI guard, smoke
npm run typecheck    # server + client
npm run build        # dist/ (what Vercel serves)
```

## Environment variables (Vercel → Settings → Environment Variables)

| Variable | Required | Purpose |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | **yes** | Service-account JSON for verifying ID tokens and reading `Users/{uid}` |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | **yes** | The cache/store. Without them the function falls back to per-instance memory, and the health panel shows `STORE MEMORY` |
| `CRON_SECRET` | **yes** | Vercel Cron sends it as a bearer token; cron routes reject anything else |
| `NASA_FIRMS_MAP_KEY` | for wildfires | Free key from NASA FIRMS |
| `UCDP_ACCESS_TOKEN` | for CII floors | Request by email (see SOURCES.md) |
| `WT_UCDP_VERSION` | with UCDP | Current GED candidate version, e.g. `25.0.8` |
| `FRED_API_KEY` | for macro | Free FRED key |
| `GROQ_API_KEY` / `OPENROUTER_API_KEY` | for AI | Either or both; Groq is tried first |
| `WT_GROQ_MODEL`, `WT_OPENROUTER_MODEL` | optional | Override the default models |
| `WT_AI_MONTHLY_BUDGET_USD` | recommended | Hard monthly AI cap (default 10) |
| `WT_AI_USER_DAILY_LIMIT` | optional | New country briefs per member per day (default 20) |
| `WT_AI_GLOBAL_RPM` | optional | AI calls per minute, all users (default 20) |
| `WT_ADMIN_UIDS` | optional | Comma-separated admin UIDs (defaults to the two in `auth-guard.js`); the Firebase custom claim `admin` also works |
| `WT_CHECKOUT_URL` | optional | Upgrade CTA target (default `/membership-assessment.html`) |
| `WT_FIRMS_SOURCE` | optional | FIRMS product, default `VIIRS_SNPP_NRT` |

Nothing secret is ever sent to the browser. The Firebase **web** config in
`auth-gate.ts` is public by design.

## How to add a feed

1. Add a `FeedDef` to `shared/watchtower/feeds.ts`: id, versioned `redisKey`,
   `boot` tier, `maxStaleMin`, `access` tier and source.
2. Write a job in `lib/watchtower/seed/jobs/<name>.ts`. `run()` fetches and
   normalises, and `validate()` rejects bad or collapsed data (there are
   helpers in `framework.ts`). Use `fetchJson`/`fetchText` from `seed/fetch.ts`.
3. Register it in `lib/watchtower/seed/registry.ts`, choosing a tier and
   `intervalMin`.
4. Add a fixture in the upstream's real format to `tests/watchtower/fixtures`,
   route it in `lib/watchtower/dev/fixture-fetch.ts`, and add a test to
   `tests/watchtower/feeds.test.ts`.
5. Record its licence, attribution and rate limits in `SOURCES.md` and the
   Sources modal (`watchtower-app/src/ui/sources-modal.ts`). **Check commercial
   use before building it.**

The bootstrap, health, freshness badges, footer and admin panel all pick up the
new feed automatically.

## How to add a layer

Add an entry to `watchtower-app/src/config/layers.ts`: id, label, category,
colour, shape, supported renderers, default on/off, `dataKeys`, geometry,
description and a `count()` for its badge. Tier gating is derived from the
feeds' `access`.

Then turn the data into markers, paths, arcs or areas in
`watchtower-app/src/map/scene.ts`. Both the globe and the 2D map draw from that
scene. The layer panel, ⌘K search, legend and Infrastructure panel read the
registry, so nothing else needs changing.

## How to add a panel

Extend `Panel` (`watchtower-app/src/panels/Panel.ts`) with the feeds it shows
(for the freshness badge and re-render) and an info tooltip, then implement
`renderBody()`. Return `null` for the empty state. Loading, error and locked
states, collapse, persisted height and viewport-aware rendering all come from
the base class. Mount it in `panels/index.ts`.

## Deploying

Vercel runs `npm run build` (see `vercel.json`) and serves `dist/`. The function
in `api/` and the four crons deploy with it. After a deploy:

```bash
WT_SMOKE_URL=https://arcanearchives.shop npm run smoke
```

Old URLs (`/world-map.html`, `/watchtower.html`, `/global-intelligence.html`)
redirect permanently to `/watchtower/`. The old pages are kept in `archive/`.
