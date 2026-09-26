# Watchtower runbook

## First-time setup (checklist)

1. **Vercel plan:** Hobby's terms are for non-commercial use, so a paid
   membership site should be on Pro. The Watchtower itself deploys on either:
   Vercel runs only the daily cron, and the 5-minute refresh comes from an
   external scheduler (see **Scheduling** below).
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
6. **Scheduling:** set up the 5-minute tick (below). In Vercel → Crons, confirm
   the daily job is registered. Use the admin panel's REFRESH buttons to seed
   immediately instead of waiting.
7. **Admin check:** open `/watchtower/` as an admin and scroll to
   **Admin · Feed Health**. Every feed you've configured should read OK within
   an hour. Feeds without keys show "Not configured: set …".

## Scheduling

Every job has its own interval (`intervalMin` in `lib/watchtower/seed/registry.ts`).
`/api/watchtower/cron/tick` runs whichever fast, medium and slow jobs are due,
so one call every 5 minutes keeps everything current. Daily jobs run from the
Vercel cron in `vercel.json`.

Point any scheduler at the tick with the cron secret as a bearer token:

- **cron-job.org** (free): create a job for
  `https://arcanearchives.shop/api/watchtower/cron/tick`, every 5 minutes, and
  under *Advanced → Headers* add `Authorization: Bearer <CRON_SECRET>`. Set the
  request timeout to 60 s.
- **Upstash QStash** (free tier covers ~290 calls a day): create a schedule
  `*/5 * * * *` to the same URL with the header
  `Upstash-Forward-Authorization: Bearer <CRON_SECRET>`.
- **Vercel Pro instead:** add crons to `vercel.json` for `cron/tick`
  (`*/5 * * * *`) and drop the external scheduler.

GitHub Actions schedules also work but bill minutes on private repositories
(about 9,000 a month at this rate), so they are not recommended here.

Check it: `curl -H "Authorization: Bearer $CRON_SECRET" https://arcanearchives.shop/api/watchtower/cron/tick`
returns the jobs it ran. Without the header it returns 401.

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
3. Check **RECENT RUNS** to confirm the scheduler is firing. If nothing has run
   for a while, check the scheduler's own log (cron-job.org or QStash), the
   Vercel function logs, and that `CRON_SECRET` matches on both sides (without
   it the cron routes return 500; a wrong value returns 401).
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
  allow embedding, each with a `region` (MIDEAST, EUROPE, AMERICAS, ASIA,
  AFRICA or SPACE) so the region filter picks it up.
- Live News starts muted once the page is idle on desktop (not on phones or with
  data-saver on).

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
