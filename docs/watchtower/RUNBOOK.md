# Watchtower runbook

## First-time setup (checklist)

1. **Vercel:** move the project to Pro (Hobby is non-commercial only, and its
   crons run at most daily).
2. **Upstash:** create a Redis database in the region closest to your Vercel
   functions. Choose pay-as-you-go with a monthly budget cap, and copy the REST
   URL and token.
3. **Vercel environment variables:** set everything marked "required" in
   README.md, plus the optional keys you have. Generate `CRON_SECRET` with
   `openssl rand -hex 32`.
4. **Keys:** get a NASA FIRMS map key and a FRED key (both instant), email for a
   UCDP token (3–5 working days), and create Groq and/or OpenRouter keys. Set a
   credit limit on OpenRouter.
5. **Deploy**, then run `WT_SMOKE_URL=https://arcanearchives.shop npm run smoke`.
6. **Crons:** in Vercel → Crons, confirm four jobs are registered. Either wait
   5 minutes or use the admin panel's REFRESH buttons to seed immediately.
7. **Admin check:** open `/watchtower/` as an admin and scroll to
   **Admin · Feed Health**. Every feed you've configured should read OK within
   an hour. Feeds without keys show "Not configured: set …".

## When a feed goes stale

The panel badge turns **STALE** and the footer lists the feed. Last-good data
keeps showing, with its age.

1. Open **Admin · Feed Health**. The NOTE column shows the last error:
   - `Not configured: set X` → add the env var in Vercel and redeploy.
   - `HTTP 401/403` → the key or token is wrong or expired. For CelesTrak,
     403 means we downloaded too often; wait for the next 2-hour update.
   - `HTTP 429` → rate limited. Leave it; the next scheduled run retries. If it
     keeps happening, raise that job's `intervalMin` in
     `lib/watchtower/seed/registry.ts`.
   - `timeout` / `HTTP 5xx` → the upstream is down. Usually nothing to do.
   - `Rejected: …` → the data failed validation (empty, or collapsed versus the
     previous run). This protects last-good data. If the upstream really did
     change format, update that job's normaliser and fixture.
2. Press **REFRESH** on the row to run the job now. The result shows as a toast.
3. Check **RECENT RUNS** to confirm crons are firing. If nothing has run for a
   while, look at Vercel → Crons and the function logs, and confirm
   `CRON_SECRET` is set (without it the cron routes return 500).
4. If a derived feed (CII, signals, …) shows "Waiting for input: X", fix feed X
   first; the derived feed recovers on the next intel run (every 5 minutes).

## When everything is stale

- The header reads **OFFLINE** or the footer shows no feeds → the API is failing.
  Check the Vercel function logs for `api/watchtower`.
- `STORE MEMORY` in the admin panel → the Upstash env vars are missing in this
  environment.
- Upstash budget reached → raise the budget in the Upstash console.

## AI

- The admin panel shows this month's spend against `WT_AI_MONTHLY_BUDGET_USD`,
  the call count and the last provider error.
- "Monthly AI budget reached" → AI panels keep their last output until the next
  month or until you raise the cap.
- If Groq retires a model, the provider error names it. Set `WT_GROQ_MODEL` to a
  current model; OpenRouter covers the gap meanwhile if it's configured.

## Monthly review

- CII baselines, multipliers and floors: `lib/watchtower/config/cii.ts`. Check
  advisory changes and wars starting or ending.
- Intel hotspots and their baseline levels: `data/watchtower/hotspots.v1.json`.
- The RSS list: `lib/watchtower/config/feeds.ts`. Remove dead feeds and check
  outlets' terms.
- Glance at the AI spend trend.

## Refreshing reference data

The datasets in `data/watchtower/*.v1.json` were hand-built and are flagged
`"approximate": true`. To review:

1. Open each entry's `cite` URL and check the name, coordinates and status.
2. Fix entries in place. When the dataset changes materially, bump `version`
   (and the file name, e.g. `bases.v2.json`, and its import in
   `lib/watchtower/static-data.ts`) and set `updated`.
3. Once a dataset has been fully checked, set `"approximate": false`.
4. Run `npm test`; the static-dataset test checks shape and citations.

For pipelines, Global Energy Monitor's trackers (CC BY 4.0) can replace the
hand-built routes. Add GEM to SOURCES.md and the Sources modal if you do.

## Media embeds

- Live news channel IDs are in `watchtower-app/src/config/media.ts`. They were
  entered from memory in an offline build: press play on each one after the
  first deploy, and fix any that don't play.
- Webcams ship empty. Add only official operators' YouTube live streams that
  allow embedding.

## Performance check

```bash
npx vite build --config watchtower-app/vite.config.mts --mode lighthouse --outDir /tmp/wt-lh
npm run dev   # keep running: the preview proxies the API to it
npx vite preview --config watchtower-app/vite.config.mts --outDir /tmp/wt-lh --port 5190
npx lighthouse http://localhost:5190/watchtower/ --only-categories=performance,accessibility
```

## Yearly

Re-check every source's terms in SOURCES.md, and the Vercel, Upstash, Groq and
OpenRouter pricing.
