# Arcane Watchtower v2 — Phase 0: Recon & Plan

Status: **draft for approval** · Date: 2026-09-25 · No code has been written yet.

This document covers Phase 0 of the brief: what exists today, the target
structure, the data sources and their licences, the env vars and accounts you
need, cost estimates, and the changes I'd make to the brief. **Section 8** lists
the decisions I need from you before Phase 1.

---

## 1. What I found in the repo

### 1.1 Hosting is split between Netlify and Vercel (needs confirming)

| Thing | Where it lives | Notes |
|---|---|---|
| `vercel.json` | 3 proxy rewrites only (CoinGecko, metals, FX) | No build step, no crons, no headers. The site deploys as a flat static root. |
| `/api/*.js` (Vercel functions) | `create-checkout-session`, `markets`, `quotes`, `notion` | CommonJS. `notion.js` says "Vercel Hobby" in its header. |
| `netlify.toml` + `netlify/functions/*` | 13 functions, including **`stripe-webhook`**, `sync-subscription`, `verify`, the store checkouts and the agents | Still referenced by live pages: `auth-guard.js` → `/.netlify/functions/sync-subscription`, `success.html` → `verify`, `arcane-store.html` → the store functions. |
| `_headers` | Netlify-format CSP and cache headers | **Vercel ignores `_headers`.** If Vercel serves the site, this CSP is not in effect. |
| `functions/` | Firebase Cloud Functions (waitlist email) | Unrelated to the Watchtower. |

**Why this matters for the Watchtower:** the server-side membership gate will
read `Users/{uid}.isPaid` / `subscriptionStatus` from Firestore. Those fields
only stay correct if the Stripe webhook is actually receiving events. If
arcanearchives.shop is served by Vercel, `/.netlify/functions/*` returns 404
there, so cancellations may not propagate and the hourly sync safety net fails
silently. I need to know which host serves production and where the Stripe
webhook endpoint points (Decision D1).

### 1.2 How auth and subscription status are checked today

- **Client:** `auth-guard.js` (Firebase JS SDK 10.13.2 from gstatic, ES modules).
  `protectPage()` reads `Users/{uid}` and treats the user as paid when
  `isPaid === true || subscriptionStatus === 'active'`. Admins are a hard-coded
  UID list (`ADMIN_UIDS`, 2 UIDs) and bypass payment.
- **Firestore rules** use the same logic, plus `request.auth.token.admin == true`
  as a custom claim path. Users cannot change `isPaid`, `subscriptionStatus` or
  `role` themselves. Good: the server can trust these fields.
- **Server:** the Netlify functions use `firebase-admin` with the
  `FIREBASE_SERVICE_ACCOUNT` env var (JSON). No Vercel function verifies a
  Firebase ID token today. The Watchtower will be the first.
- `dashboard.html` does its own inline `onAuthStateChanged` → `login.html`.
- **`world-map.html` has no auth gate at all.** The current Watchtower is
  publicly reachable by anyone with the URL.

### 1.3 The current Watchtower pages

- `world-map.html` (1,978 lines, linked from the dashboard card and the portal
  sidebar via `portal-shell.js`). It has a hand-rolled canvas orthographic globe
  and equirectangular map, with country shapes from `world-geo.js` (Natural
  Earth 110m, public domain). The browser calls upstreams directly (USGS, EONET,
  OpenSky, Polymarket) and fetches RSS through the **third-party
  `api.allorigins.win` CORS proxy**. Much of it is static or demo data, and it
  shows a "DEFCON" badge.
- `watchtower.html` (Leaflet) and `global-intelligence.html` are **orphaned**:
  no page links to them. `portal-shell.js` maps `global-intelligence` to the
  Watchtower nav item.
- The dashboard ticker is `arcane-prices.js` → `/api/markets` (Yahoo Finance,
  Alpha Vantage and CoinPaprika). **It falls back to *simulated* prices** so
  "nothing is ever blank". Under your standing rule the Watchtower cannot reuse
  that fallback, and the licences are a problem too (see §3.4).

### 1.4 Styling

- Site tokens: `portal-shell.css` (`--aa-*`) and `arcane-globals.css`
  (`--bg #0B0A10`, violet `#9B7BF7`, gold `#F2C94C`, Inter / Inter Tight /
  JetBrains Mono).
- Your uploaded mockup (`Main.dc.html`, 1440×900) is the layout reference I'll
  implement:
  - **Header:** `‹ DASHBOARD`, logo, LIVE, ⌘K search, UTC clock, Threat Level
    1–5 bars, Sentiment with delta, MONITOR drawer button.
  - **Left:** Layers grouped *Live Events / Infrastructure / Analysis*.
  - **Centre:** the globe, with a 2D/3D toggle, VIEW chip, marker count/fps,
    popover, zoom controls, legend and imagery credit.
  - **Right column:** World Brief (AI) and Chokepoints.
  - **Bottom row:** Signals, Country Instability, Seismic Watch.
  - **Footer:** feed health ("FEEDS 14/16 OK · 2 STALE"), Sources & Methodology,
    brand.
  - Mockup palette: bg `#0b0a10`, panel `#12111a`, header `#0e0d15`, border
    `#221f2c`, text `#e9e6f2`, muted `#8a8699`, accent `#8b7cf6` / `#a78bfa` /
    `#c4b5fd`, critical `#f0526b`, high `#f59e42`, elevated `#e5c85a`, ok
    `#5ee3a1`.
  - **Fonts:** JetBrains Mono plus **Instrument Sans**. The rest of the site
    uses Inter (Decision D6).

### 1.5 Vercel plan and cron limits

I can't see your Vercel account from here, so I checked Vercel's published
terms:

- **Hobby is for non-commercial personal use only.** Vercel defines commercial
  use as including "any method of requesting or processing payment from
  visitors". A paid membership site needs **Pro ($20/month per seat)** whatever
  we do with the Watchtower.
- **Hobby cron jobs can run at most once a day**, and Vercel may fire them at
  any point within the hour. Sub-daily seeds cannot run on Hobby cron.
- **Pro:** up to 40 cron jobs per project with any cron expression.

**Recommendation:** upgrade to Pro, which is required for ToS compliance anyway,
and use **Vercel Cron**. If you stay on Hobby for now, the fallback is **Upstash
QStash** calling one dispatcher endpoint every 5 minutes (~288 calls a day).
GitHub Actions schedules are the weaker option: they're often delayed 5–15+
minutes, and on a private repo a 5-minute schedule would use more than the free
Actions minutes.

---

## 2. Target architecture (adjusted)

```
Browser (Vite + vanilla TS, served at /watchtower/)
  ├─ auth gate (Firebase JS SDK) → ID token
  ├─ bootstrap loader: GET /api/watchtower/bootstrap?tier=fast|slow  (Bearer token)
  ├─ smart poller (backoff ≤4×, tab-hidden pause, staggered catch-up, viewport-aware)
  ├─ globe.gl (default) │ MapLibre + deck.gl (lazy, on 2D toggle)
  └─ panels (Panel base class) + layer registry + URL-synced app state

Vercel Functions (Node runtime) — ONE router function
  api/watchtower/[...route].ts
     bootstrap · health · country-brief · search-index · admin/* · cron/<tier>
     └─ every non-cron route: verifyIdToken → membership (Redis-cached 5 min) → rate limit

Vercel Cron (Pro) → /api/watchtower/cron/{fast|medium|slow|daily}  (CRON_SECRET)
     each tier runs its due seed jobs in parallel with per-job timeouts
     seed framework: SET NX lock → fetch → normalise → validate → write key + wt:meta:<key>

Upstash Redis   wt:<feed>:v1 · wt:meta:<key> · wt:cii:hist:<iso> · wt:welford:* · wt:ai:*
Groq → OpenRouter (server only, cached by input hash, global + per-user caps)
```

Key changes from the brief (reasons in §7):

1. **One router function** instead of many `/api/watchtower/*` files.
2. **Node runtime**, not Edge, because `firebase-admin` needs Node.
3. **Tiered cron dispatchers** instead of one cron per feed.
4. **Private browser caching only.** Member-gated responses can't sit in a shared
   CDN cache.
5. **A clean build output directory**, so server code and raw data aren't served
   as static files.

---

## 3. Data sources and licence notes

Legend: ✅ commercial use OK (with the conditions noted) · ⚠️ OK with a caveat
or needs a decision · ⛔ **forbids or restricts commercial use: will not build
without your decision.**

I flag anything commercially restricted here, before building it, as the brief
asks. Each entry goes into `SOURCES.md` in Phase 4 with the exact terms page.

### 3.1 Live feeds

| Feed | Source | Licence / terms | Key? | Rate / etiquette | Verdict |
|---|---|---|---|---|---|
| Seismic | USGS GeoJSON summary feeds (`4.5_day`, `significant_day`/`_week`) | US Government work, public domain; credit "USGS" | No | Feeds refresh about once a minute; we poll every 5 minutes | ✅ |
| Natural events | NASA EONET v3 | NASA data, no copyright; attribution requested | No | Be polite; every 30 minutes | ✅ |
| Disasters / cyclones | GDACS (JRC / UN OCHA) API + RSS | **CC BY 4.0**, credit GDACS; "don't sensationalise" guidance | No | GDACS asks for polling every 10–15 minutes | ✅ |
| Wildfires | NASA FIRMS (VIIRS / MODIS NRT) | NASA open data; cite FIRMS / LANCE | **MAP_KEY** (free) | 5,000 transactions per 10 minutes; we'll do hourly country or area pulls | ✅ |
| Conflict / news events | GDELT 2.0 Events + DOC / GEO APIs | "Unlimited and unrestricted use for any academic, **commercial**, or governmental use"; must **cite GDELT and link** | No | Every 15 minutes (GDELT's own update cadence) | ✅ |
| Conflict (real-time) | ACLED | **Commercial use (including "situational awareness" products sold to users) requires a paid written Commercial License.** | Account | — | ⛔ **Excluded unless you license it** (D3) |
| Conflict baseline | UCDP GED / Candidate | **CC BY 4.0** | **Token since 2025**: request by email, 3–5 working days | Daily | ✅ (start the token request now) |
| Satellites | CelesTrak GP (OMM / TLE) | Free; credit CelesTrak | No | **Strict: one download per 2-hour update, else 403 or IP block.** We fetch each group at most every 2 hours and cache in Redis | ✅ |
| Orbit maths | satellite.js | MIT | — | Runs client-side | ✅ |
| Military aircraft | adsb.lol API (`/v2/mil` etc.) | **ODbL 1.0**: attribution required; share-alike applies only if we publicly redistribute a derived *database* (on-screen maps are a "Produced Work" that needs attribution only) | No (for now) | Dynamic limits; every 1–2 minutes at most, cached | ✅ (attribution in footer and modal) |
| Internet outages | Cloudflare Radar API | **Radar API data is CC BY-NC 4.0 (non-commercial).** Only the embeddable graphs are CC BY 4.0 | Token | — | ⛔ **Blocked** (D4). Options: ask radar@cloudflare.com for commercial permission, use IODA (licence to be checked), or show a link-out only |
| News RSS | Publisher feeds (see §3.2) | Publisher terms vary; the industry norm is **headline + link + attribution, no full text** | No | Every 10–15 minutes, conditional GET (ETag / Last-Modified) | ⚠️ (D5) |
| Severe weather | Open-Meteo | **Free API is non-commercial only.** Commercial is from $29/month | — | — | ⛔ Drop it: use GDACS cyclones plus NOAA NHC (public domain) instead |
| Markets: crypto | CoinGecko Demo | **Demo plan carries no commercial licence.** Paid plans (about $35/month) require "Data provided by CoinGecko" | Key | 10k calls a month on Demo | ⛔ as free (D7) |
| Markets: macro | FRED API | FRED-owned series OK with citation. **Third-party-copyrighted series (S&P, ICE, etc.) need the owner's permission** | Free key | 120 requests a minute | ⚠️ use public-domain Fed / Treasury / BLS series only |
| Markets: indices, oil, gold, DXY, VIX, US10Y | Current `/api/markets` (Yahoo, unofficial; Alpha Vantage) | **Yahoo's terms prohibit this use.** Free tiers of AV / Twelve Data are generally not licensed for redistribution in a paid product | — | — | ⛔ (D7) |
| Live TV | Official YouTube live embeds (Bloomberg, Sky News, DW, France 24, Al Jazeera, Euronews) | YouTube API ToS allows the official embedded player; the channel must allow embedding | No | Load on click only | ✅ |
| Webcams | YouTube live cams from the operator's own channel only | Same as above | No | On click | ✅ (no scraping of camera sites) |

### 3.2 RSS list: availability notes

| Outlet | Official RSS? | Tier (proposed) | State-affiliated |
|---|---|---|---|
| Reuters | **No: Reuters killed its RSS feeds in June 2020.** Coverage comes via GDELT article links instead | — | — |
| AP | **No official public RSS** | — | — |
| BBC World | Yes | 1 | No (public broadcaster, editorially independent) |
| Al Jazeera English | Yes | 2 | **Yes** (Qatar state-funded) |
| DW | Yes | 1 | Yes (German public broadcaster, federally funded; label it "public broadcaster") |
| France 24 | Yes | 1 | Yes (France Médias Monde, state-owned; same labelling question) |
| Guardian World | Yes | 1 | No |
| Defense News | Yes | 2 | No |
| Bellingcat | Yes | 2 | No |

I'll confirm each exact feed URL and its terms page in Phase 4. How to label
public broadcasters versus state-controlled media is a judgement call, so the
config file will carry a separate `ownership` field
(`private` / `public-broadcaster` / `state`).

### 3.3 Static reference layers (Phase 5)

| Layer | Source | Licence | Verdict |
|---|---|---|---|
| Country shapes | Natural Earth 110m / 50m (already used via `world-geo.js`) | Public domain | ✅ |
| Globe texture | NASA Visible Earth "Blue Marble: Next Generation" | NASA imagery, not copyrighted; credit NASA | ✅ |
| Night sky | Hand-made starfield (procedural) or NASA/ESA imagery | Own work, or NASA public domain | ✅ |
| 2D basemap | **OpenFreeMap** (MapLibre vector) | Free including commercial, no key; © OpenStreetMap contributors (ODbL) | ✅. CARTO's free commercial allowance is capped, so I'd avoid it |
| Military bases | Wikipedia lists + government pages, **facts only** (name, operator, lat/lon, citation URL per entry) | Facts aren't copyrightable; we won't copy prose (Wikipedia text is CC BY-SA) | ✅ |
| Nuclear power reactors | IAEA PRIS | IAEA terms allow use "in commercial and non-commercial products" **with acknowledgement and no implied endorsement** | ✅ |
| Other nuclear facilities | Public government lists / IAEA public docs, cited per entry | — | ✅ |
| Spaceports | Public lists, cited per entry | — | ✅ |
| AI data centres | Company announcements / press releases, cited per entry | — | ✅ |
| Undersea cables | TeleGeography | **CC BY-NC-SA 3.0 (non-commercial)** | ⛔ Use instead: **OpenStreetMap `submarine=yes` cable ways (ODbL, attribution)**, simplified, plus a hand-built set of major named cables |
| Pipelines | Global Energy Monitor (GOIT / GGIT) | **CC BY 4.0** | ✅ (attribute GEM) |
| Chokepoints | Hand-built (9 named) with lane arcs | Own work | ✅ |
| Intel hotspots | Your editable list; I'll draft ~15 with neutral one-liners | Own work | ✅ |

**Clean-room note:** none of these come from World Monitor's repo. I read only
its public docs (ARCHITECTURE, algorithms, CII, convergence, AI, data-sources,
map-engine) for concepts and published formulas. I won't open its source or data
files at any point.

---

## 4. Folder structure

```
watchtower-app/                     # Vite + vanilla TS source (not deployed as-is)
  index.html
  vite.config.ts                    # base: '/watchtower/', outDir → build output (§7.5)
  tsconfig.json
  src/
    main.ts
    app/        state.ts · url-sync.ts · auth-gate.ts · api-client.ts
                bootstrap-loader.ts · poller.ts · shortcuts.ts
    config/     layers.ts (layer registry) · panels.ts · theme.css (tokens)
    map/        renderer.ts (shared interface) · markers.ts (kind-discriminated)
                popover.ts · lod.ts
                globe/ globe-renderer.ts · textures.ts · autorotate.ts
                flat/  flat-renderer.ts (lazy: maplibre-gl + deck.gl)
    panels/     Panel.ts (base) · signals.ts · seismic.ts · instability.ts
                infrastructure.ts · world-brief.ts · chokepoints.ts · posture.ts
                live-news.ts · webcams.ts · admin-health.ts
    ui/         header.ts · layer-panel.ts · drawer.ts · command-palette.ts
                sources-modal.ts · freshness-badge.ts · upgrade-cta.ts
    lib/        time.ts · geo.ts · dom.ts · format.ts
  public/textures/                  # Blue Marble (resized, credited)

api/watchtower/[...route].ts        # the ONE Vercel function (router)

lib/watchtower/                     # server-only code, bundled into the function
  http/     router.ts · auth.ts (verifyIdToken + membership) · cache-headers.ts
            ratelimit.ts · errors.ts
  store/    redis.ts · keys.ts
  seed/     framework.ts (lock → validate → write → meta) · registry.ts (tiers)
            jobs/ usgs.ts · eonet.ts · gdacs.ts · firms.ts · gdelt.ts · ucdp.ts
                  celestrak.ts · adsb.ts · rss.ts · markets.ts · static-layers.ts
  intel/    signals.ts · cii.ts · convergence.ts · spikes.ts · ranking.ts
            anomaly.ts · header-metrics.ts · chokepoints.ts · posture.ts
  ai/       provider.ts (Groq → OpenRouter) · budget.ts · brief.ts
            country-brief.ts · forecasts.ts · prompts.ts
  config/   feeds.ts (RSS list: tier, ownership) · cii-countries.ts (baselines, weights)
            theatres.ts · hotspots.ts · chokepoints.ts

shared/watchtower/                  # types used by client and server
  types.ts (Signal, FeedMeta, LayerDef …) · keys.ts · tiers.ts

data/watchtower/                    # versioned static datasets, one citation per entry
  bases.v1.json · nuclear.v1.json · spaceports.v1.json · ai-datacenters.v1.json
  cables.v1.json · pipelines.v1.json · chokepoints.v1.json · hotspots.v1.json

tests/watchtower/                   # vitest: scoring fixtures + bootstrap/health smoke test
docs/watchtower/                    # PLAN.md (this) · README.md · SOURCES.md · METHODOLOGY.md · RUNBOOK.md
archive/world-map.html              # Phase 10 (old URL → 301 /watchtower/)
```

Static datasets are delivered through the gated API (seeded into Redis on
deploy or daily), **not** served as public files. That keeps the tier gating
meaningful.

---

## 5. Env vars and accounts

### Vercel env vars (Production + Preview)

| Var | Purpose | Phase |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Service-account JSON for `firebase-admin` (verify ID tokens, read `Users`). You have this on Netlify; it may not be on Vercel yet | 1 |
| `WT_ADMIN_UIDS` | Comma-separated admin UIDs (defaults to the two in `auth-guard.js`); the `admin` custom claim is also honoured | 1 |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Cache / store | 2 |
| `CRON_SECRET` | Vercel sends it as `Authorization: Bearer …` to cron routes | 2 |
| `NASA_FIRMS_MAP_KEY` | Wildfires | 4 |
| `UCDP_ACCESS_TOKEN` | Conflict baseline | 4 |
| `FRED_API_KEY` | Macro tab (public-domain series only) | 4 |
| `GROQ_API_KEY`, `OPENROUTER_API_KEY` | AI | 7 |
| `WT_AI_MONTHLY_BUDGET_USD` (e.g. `10`) | Hard global AI spend cap | 7 |
| `WT_AI_USER_DAILY_LIMIT` (e.g. `20`) | Per-user country-brief requests a day | 7 |
| *(only if approved)* `CLOUDFLARE_RADAR_TOKEN`, `ACLED_*`, market-data key | See §8 | 4 |

The Firebase **web** config is public by design, so the app reuses the values
already in `auth-guard.js`.

### Accounts to create or request

1. **Vercel Pro** upgrade (see §1.5).
2. **Upstash** (Redis database in a region near your Vercel functions, e.g.
   `eu-west` / `iad`). Choose pay-as-you-go with a **monthly budget cap**.
3. **NASA Earthdata / FIRMS MAP_KEY:** instant, by email.
4. **UCDP API token:** email the UCDP API maintainer and describe the use. Takes
   3–5 working days, so start now.
5. **FRED API key:** instant.
6. **Groq** and **OpenRouter:** set a credit limit on OpenRouter.
7. *(QStash, only if you stay on Hobby.)*

---

## 6. Cost estimates (monthly)

The assumptions are rough: 20% of members active on a given day, about 30 minutes
per session, fast tier polled every 2 minutes and slow tier every 10. Seeds run
on a fixed schedule whatever the member count.

| Item | ~100 members | ~1,000 members | Notes |
|---|---|---|---|
| Vercel Pro | $20 | $20 | Needed for commercial use regardless. Watchtower usage (~20k and ~200k function calls a month, plus about 60k cron runs) fits inside Pro's included usage |
| Upstash Redis | $0–1 | $2–4 | Seeds use about 0.6M commands a month on their own (above the 500k free tier). Reads add ~0.1M / ~0.8M. At $0.20 per 100k commands, with a budget cap set |
| AI (Groq, then OpenRouter) | $0–2 | $3–15 | World Brief 12 a day + forecasts 4 a day ≈ fixed cost. Country briefs cached 2 hours per country are capped at 30 × 12 a day. Worst case ≈ 27M tokens a month ≈ $17 at Groq 70B paid rates; realistic is much lower. **Hard cap via `WT_AI_MONTHLY_BUDGET_USD`** |
| Firebase | $0 | $0 | Membership decisions cached 5 minutes in Redis, so Firestore reads are negligible |
| Data sources (licence-clean set) | $0 | $0 | USGS, EONET, GDACS, FIRMS, GDELT, UCDP, CelesTrak, adsb.lol, OSM, GEM, PRIS |
| **Total (clean set)** | **≈ $20–23** | **≈ $25–40** | |
| *Optional:* licensed market data | +$30–80 | +$30–80 | Only if you want indices, oil, gold, DXY, VIX, US10Y in the drawer (D7) |
| *Optional:* ACLED commercial licence | quote-based | quote-based | D3 |

Nothing paid gets enabled without your go-ahead.

Groq's free-tier model line-up changes often (reports say Llama 3.3 70B left
the free tier in August 2026). I'll pick the model in Phase 7 from Groq's
current list and confirm the price with you then.

---

## 7. Changes I'd make to the brief, and why

1. **Upgrade to Vercel Pro and use Vercel Cron.** Hobby forbids paid sites and
   limits cron to once a day. This makes the QStash / GitHub Actions question
   moot.
2. **One router function (`api/watchtower/[...route].ts`) instead of many
   endpoint files.** It shares warm Firebase Admin and Redis clients, means fewer
   cold starts, keeps the endpoint count small, and gives one place for the
   auth, rate-limit and cache-header middleware. The URLs are unchanged
   (`/api/watchtower/bootstrap`, `/health`, …).
3. **Tiered cron dispatchers (`cron/fast` every 5 minutes, `medium` every 15,
   `slow` hourly, `daily`)** instead of one cron per feed. Each tier runs its due
   jobs in parallel with per-job timeouts. Adding a feed means registering a
   job, not editing `vercel.json`.
4. **Cache tiers become private.** Every response is member-gated, so it must
   not sit in Vercel's shared CDN cache (anyone hitting the URL would get it).
   The tier values (5m / 10m / 30m / 2h / 24h) become Redis TTLs plus
   `Cache-Control: private, max-age=…`, with ETag / 304 to save bandwidth.
   `health` gets a public, redacted OK/STALE summary for uptime monitors; the
   full version stays admin-only.
5. **Add a real build output.** The site currently deploys the repo root as-is,
   so every file (including `netlify/functions/*.js` source, and in future
   `lib/watchtower/**` and `data/**`) is publicly downloadable. I'd add a small
   build script that copies the static site plus the Vite output into `dist/`,
   and set `outputDirectory: "dist"`. The existing pages are unchanged. It's a
   deploy-wide change, so I'd verify it on a Vercel preview before merging
   (Decision D2).
6. **Replace the non-commercial sources** (see §3): Cloudflare Radar, Open-Meteo,
   TeleGeography, ACLED, CoinGecko Demo, Yahoo. Reuters and AP have no official
   RSS, so tier-1 wire coverage comes from GDELT article links rather than
   feeds.
7. **Military aircraft via adsb.lol's own military-flagged endpoint** rather than
   maintaining hex ranges. It's simpler, and it avoids any temptation to borrow
   someone else's curated list. Theatre boxes and callsign patterns will be ours.
8. **Header "LIVE" is earned.** It turns amber "DEGRADED" when more than 25% of
   fast-tier feeds are stale, and grey "OFFLINE" when bootstrap fails. The
   footer shows "FEEDS n/m OK" from `/health`, as in your mockup.
9. **Layer list follows the mockup groups.** The old "Signal Routes" (demo data)
   is dropped, "Unstable States" becomes the *Instability Choropleth* analysis
   layer, and *Convergence Cells* is added.
10. **2D mode moves from Phase 3 to Phase 8**, alongside the other lazy-loaded
    features. Phase 3 then focuses on a solid 60 fps globe. The renderer
    interface and layer registry are designed for both from day one.
11. **Archive the orphaned `watchtower.html` and `global-intelligence.html`**
    along with `world-map.html` in Phase 10. Otherwise `/watchtower.html` would
    keep serving the old Leaflet page next to the new `/watchtower/`.
12. **Add a "not for operational or safety use" line** to the Sources &
    Methodology modal, alongside the AI "not advice" label.
13. **Tests with Vitest** (TS-native, no config beyond Vite). CI via a GitHub
    Actions workflow that runs typecheck, tests and build on PRs.

---

## 8. Decisions I need from you before Phase 1

| # | Decision | My recommendation |
|---|---|---|
| **D1** | Which host serves arcanearchives.shop today (Vercel or Netlify), and where does the Stripe webhook point? | Confirm. If it's Vercel, porting `stripe-webhook` / `sync-subscription` is a separate, prerequisite fix; otherwise the server gate can't see cancellations. |
| **D2** | Vercel plan: upgrade to Pro? And OK to add a build step with `dist/` output? | Yes to both. |
| **D3** | ACLED | Leave out. Use GDELT for real-time and UCDP for the baseline. |
| **D4** | Internet outages (Cloudflare Radar is non-commercial) | Email Cloudflare for permission; until then ship the layer "off" with a link-out, and I'll check IODA's terms. |
| **D5** | News RSS: accept "headline + link + source attribution, no body text" as our use of publisher feeds? | Yes, with that exact policy written into SOURCES.md. |
| **D6** | Fonts: mockup (Instrument Sans + JetBrains Mono) or site (Inter + JetBrains Mono)? | Follow the mockup inside the Watchtower; it's a distinct "ops" surface. |
| **D7** | Markets drawer: pay for licensed data, or ship Macro (FRED public series) + Crypto only? | Ship FRED public series now. Decide on a paid quote provider later; I won't reuse the simulated-fallback ticker. |
| **D8** | Free / lapsed teaser: which layers are visible? | Seismic, Natural Events, Chokepoints, plus a locked CII panel with the upgrade CTA. |

Once you've answered (or said "go with your recommendations"), I'll start
**Phase 1 — Foundation**.
