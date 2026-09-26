// Smart polling: exponential backoff (up to 4×) on errors, pause while the tab
// is hidden, staggered catch-up when it returns, and skip tasks whose panels
// are nowhere near the viewport.
export interface PollTask {
  id: string;
  intervalMs: number;
  run: () => Promise<void>;
  /** Return false to skip this tick (e.g. panel far off-screen) */
  relevant?: () => boolean;
}

interface Entry extends PollTask {
  backoff: number;
  nextAt: number;
  timer: number | null;
  running: boolean;
}

const MAX_BACKOFF = 4;
const STAGGER_MS = 150;

export class Poller {
  private tasks = new Map<string, Entry>();

  constructor() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pauseAll();
      else this.catchUp();
    });
  }

  add(task: PollTask, runNow = false) {
    const e: Entry = { ...task, backoff: 1, nextAt: Date.now() + task.intervalMs, timer: null, running: false };
    this.tasks.set(task.id, e);
    if (runNow) void this.tick(e);
    else this.schedule(e);
  }

  /** Run a task immediately (e.g. user pressed refresh). */
  trigger(id: string) {
    const e = this.tasks.get(id);
    if (e) void this.tick(e, true);
  }

  private schedule(e: Entry) {
    if (e.timer !== null) clearTimeout(e.timer);
    if (document.hidden) return;
    const delay = Math.max(0, e.nextAt - Date.now());
    e.timer = window.setTimeout(() => void this.tick(e), delay);
  }

  private async tick(e: Entry, force = false) {
    e.timer = null;
    if (e.running) return;
    if (!force && document.hidden) return;
    if (!force && e.relevant && !e.relevant()) {
      e.nextAt = Date.now() + e.intervalMs;
      return this.schedule(e);
    }
    e.running = true;
    try {
      await e.run();
      e.backoff = 1;
    } catch {
      e.backoff = Math.min(MAX_BACKOFF, e.backoff * 2);
    } finally {
      e.running = false;
      e.nextAt = Date.now() + e.intervalMs * e.backoff;
      this.schedule(e);
    }
  }

  private pauseAll() {
    for (const e of this.tasks.values()) {
      if (e.timer !== null) clearTimeout(e.timer);
      e.timer = null;
    }
  }

  /** On return to the tab: run overdue tasks one after another, 150ms apart. */
  private catchUp() {
    const now = Date.now();
    let i = 0;
    for (const e of this.tasks.values()) {
      if (e.nextAt <= now) {
        e.nextAt = now + STAGGER_MS * i++;
      }
      this.schedule(e);
    }
  }
}

export const poller = new Poller();
