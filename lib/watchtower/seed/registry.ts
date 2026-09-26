// All seed jobs and the tier dispatcher called by Vercel Cron.
// vercel.json schedules: fast */5 min · medium */15 min · slow hourly · daily.
// A job runs when its tier fires AND its own interval has elapsed.
import type { Store } from '../store';
import { runSeed, type SeedJob, type SeedResult, type SeedTier } from './framework';
import { adsbJob } from './jobs/adsb';
import { aiBriefJob, aiForecastJob } from './jobs/ai';
import { celestrakJob } from './jobs/celestrak';
import { firmsJob } from './jobs/firms';
import { fredJob } from './jobs/fred';
import { gdeltEventsJob, gdeltToneJob } from './jobs/gdelt';
import { intelJob } from './jobs/intel';
import { eonetJob, gdacsJob } from './jobs/natural';
import { rssJob } from './jobs/rss';
import { ucdpJob } from './jobs/ucdp';
import { usgsJob } from './jobs/usgs';

export const JOBS: SeedJob<any>[] = [
  // fetch stage
  usgsJob, adsbJob, eonetJob, gdacsJob, gdeltEventsJob, rssJob, firmsJob, gdeltToneJob, celestrakJob, ucdpJob, fredJob,
  // derive stage (runs after the fetch jobs of the same tier)
  intelJob, aiBriefJob, aiForecastJob,
];

export function registerJob(job: SeedJob<any>) {
  if (!JOBS.some((j) => j.id === job.id)) JOBS.push(job);
}

export const JOB_BY_ID = () => Object.fromEntries(JOBS.map((j) => [j.id, j]));

const lastRunKey = (id: string) => `wt:lastrun:${id}`;

/** `tick` runs every due job outside the daily tier, so one external scheduler
 *  calling it every 5 minutes can stand in for the fast/medium/slow crons. */
export async function runTier(tier: SeedTier | 'tick', store: Store, opts: { force?: boolean; now?: number } = {}) {
  const now = opts.now ?? Date.now();
  const inTier = JOBS.filter((j) => (tier === 'tick' ? j.tier !== 'daily' : j.tier === tier));
  const due: SeedJob[] = [];
  const last = await store.mget<number>(inTier.map((j) => lastRunKey(j.id)));
  inTier.forEach((j, i) => {
    const prev = last[i];
    // 30s slack so a job with interval == cron period isn't skipped by jitter
    if (opts.force || !prev || now - prev >= j.intervalMin * 60000 - 30000) due.push(j);
  });

  const results: SeedResult[] = [];
  const mark = (j: SeedJob) => store.set(lastRunKey(j.id), now, { ex: 14 * 24 * 3600 });

  const fetchJobs = due.filter((j) => j.stage !== 'derive');
  const settled = await Promise.allSettled(fetchJobs.map(async (j) => (await mark(j), runSeed(j, store, now))));
  settled.forEach((s, i) =>
    results.push(s.status === 'fulfilled' ? s.value : { job: fetchJobs[i].id, outcome: 'error', count: 0, ms: 0, error: String(s.reason), at: now }),
  );

  // Derived jobs read the feeds above, so they run afterwards, in order.
  for (const j of due.filter((d) => d.stage === 'derive')) {
    await mark(j);
    results.push(await runSeed(j, store, now).catch((e) => ({ job: j.id, outcome: 'error' as const, count: 0, ms: 0, error: String(e), at: now })));
  }
  return { tier, ran: results.length, results };
}

export async function lastRuns(store: Store) {
  const vals = await store.mget<number>(JOBS.map((j) => lastRunKey(j.id)));
  return Object.fromEntries(JOBS.map((j, i) => [j.id, { tier: j.tier, intervalMin: j.intervalMin, lastRunAt: vals[i] ?? null }]));
}
