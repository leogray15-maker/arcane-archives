// Admin-only: feed health, recent cron runs, AI spend, force refresh.
import type { HealthFeed } from '../../../shared/watchtower/types';
import { api } from '../app/api-client';
import { poller } from '../app/poller';
import { h, toast } from '../lib/dom';
import { ago } from '../lib/time';
import { Panel } from './Panel';

interface AdminStatus {
  status: string;
  counts: Record<string, number>;
  feeds: HealthFeed[];
  runs: { job: string; outcome: string; count: number; ms: number; error?: string; at: number }[];
  schedule: Record<string, { tier: string; intervalMin: number; lastRunAt: number | null }>;
  ai: { month: string; spentUsd: number; budgetUsd: number; calls: number; providers: { id: string; configured: boolean; model: string }[]; lastError?: { at: number; errors: string[] } | null } | null;
  store: string;
}

const STATUS_COLOR: Record<string, string> = { OK: '#5ee3a1', STALE: '#f59e42', EMPTY: '#8a8699', ok: '#5ee3a1', invalid: '#f59e42', error: '#f0526b', skipped: '#8a8699', locked: '#8a8699' };

export class AdminPanel extends Panel {
  private data: AdminStatus | null = null;
  private busy = new Set<string>();

  constructor() {
    super({ id: 'admin', title: 'ADMIN · FEED HEALTH', feeds: [], access: 'admin', className: 'wide', info: 'Admins only. Per-feed freshness from /health, the last cron runs, AI spend this month, and a button to force-refresh a job now.' });
    poller.add({ id: 'admin-status', intervalMs: 60000, run: () => this.load(), relevant: () => this.el.isConnected && !this.el.classList.contains('collapsed') });
    queueMicrotask(() => void this.load());
  }

  private async load() {
    try {
      this.data = await api<AdminStatus>('admin/status', { timeoutMs: 10000 });
      this.errorMessage = null;
    } catch (e) {
      this.errorMessage = `Could not load admin status: ${(e as Error).message}`;
    }
    this.scheduleRender();
  }

  private async refresh(job: string) {
    this.busy.add(job);
    this.scheduleRender();
    try {
      const r = await api<{ result: { outcome: string; count: number; error?: string } }>('admin/refresh', { method: 'POST', body: { job }, timeoutMs: 60000 });
      toast(`${job}: ${r.result.outcome}${r.result.error ? ` — ${r.result.error}` : ` (${r.result.count} records)`}`, 5000);
    } catch (e) {
      toast(`${job}: ${(e as Error).message}`, 5000);
    }
    this.busy.delete(job);
    await this.load();
  }

  protected renderBody() {
    const d = this.data;
    if (!d) return h('div', { class: 'wt-panel-state' }, 'Loading…');
    const jobFor = (feedId: string) => Object.keys(d.schedule).find((j) => j === feedId) ?? feedId;
    const ai = d.ai;
    return h(
      'div',
      null,
      h(
        'div',
        { class: 'wt-panel-state', style: 'padding:12px' },
        `${d.status.toUpperCase()} · ${d.counts.OK ?? 0} OK · ${d.counts.STALE ?? 0} STALE · ${d.counts.EMPTY ?? 0} EMPTY · STORE ${d.store.toUpperCase()}`,
        ai ? h('div', { style: 'margin-top:6px;color:#e0b24a' }, `AI ${ai.month}: $${ai.spentUsd.toFixed(2)} of $${ai.budgetUsd} · ${ai.calls} calls · ${ai.providers.map((p) => `${p.id} ${p.configured ? p.model : 'not configured'}`).join(' · ')}`) : null,
        ai?.lastError ? h('div', { style: 'margin-top:4px;color:#f0788a' }, `Last AI error ${ago(ai.lastError.at)} ago: ${ai.lastError.errors.join(' | ')}`) : null,
      ),
      h(
        'table',
        { class: 'wt-table' },
        h('thead', null, h('tr', null, ...['FEED', 'STATUS', 'AGE', 'MAX', 'RECORDS', 'NOTE', ''].map((t) => h('th', null, t)))),
        h(
          'tbody',
          null,
          ...d.feeds.map((f) =>
            h(
              'tr',
              null,
              h('td', null, f.label),
              h('td', { style: `color:${STATUS_COLOR[f.status]}` }, f.status),
              h('td', null, f.ageMin === null ? '—' : `${f.ageMin}m`),
              h('td', null, `${f.maxStaleMin}m`),
              h('td', null, String(f.recordCount)),
              h('td', { style: 'white-space:normal;max-width:320px;color:#f0788a' }, f.error ?? ''),
              h('td', null, h('button', { class: 'wt-link-btn', disabled: this.busy.has(f.id), onclick: () => this.refresh(jobFor(f.id)) }, this.busy.has(f.id) ? 'RUNNING…' : 'REFRESH')),
            ),
          ),
        ),
      ),
      h('div', { class: 'wt-panel-state', style: 'padding:12px 12px 4px' }, 'RECENT RUNS'),
      h(
        'table',
        { class: 'wt-table' },
        h('thead', null, h('tr', null, ...['JOB', 'OUTCOME', 'RECORDS', 'MS', 'WHEN', 'ERROR'].map((t) => h('th', null, t)))),
        h('tbody', null, ...d.runs.slice(0, 25).map((r) => h('tr', null, h('td', null, r.job), h('td', { style: `color:${STATUS_COLOR[r.outcome] ?? '#e9e6f2'}` }, r.outcome), h('td', null, String(r.count)), h('td', null, String(r.ms)), h('td', null, `${ago(r.at)} ago`), h('td', { style: 'white-space:normal;color:#f0788a' }, r.error ?? '')))),
      ),
    );
  }
}
