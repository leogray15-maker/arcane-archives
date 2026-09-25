// Base class for every Watchtower panel: header (title, count, info tooltip,
// freshness badge, collapse), debounced render, loading / empty / error / locked
// states, persisted collapse + height, and "near viewport" tracking so hidden
// panels skip re-rendering until they scroll into view.
import { FEED_BY_ID, canAccess } from '../../../shared/watchtower/feeds';
import type { Tier } from '../../../shared/watchtower/types';
import { state, subscribe, type StateKey } from '../app/state';
import { h, ICONS, lsGet, lsSet, replaceChildren, svg } from '../lib/dom';
import { freshnessOf } from '../ui/freshness';

export interface PanelOptions {
  id: string;
  title: string;
  /** Feeds shown in the freshness badge and watched for re-render */
  feeds: string[];
  info: string;
  tag?: string;
  access?: Tier;
  resizable?: boolean;
  collapsible?: boolean;
  className?: string;
  /** Extra state keys that should trigger a re-render */
  watch?: StateKey[];
  emptyText?: string;
}

export type RenderResult = Node | Node[] | null;

export abstract class Panel {
  readonly el: HTMLElement;
  protected body: HTMLElement;
  protected tools: HTMLElement | null = null;
  private countEl: HTMLElement;
  private freshEl: HTMLElement;
  private collapseBtn: HTMLButtonElement | null = null;
  private dirty = true;
  private renderTimer: number | null = null;
  private nearViewport = true;
  private lockEl: HTMLElement | null = null;
  errorMessage: string | null = null;

  constructor(protected opts: PanelOptions) {
    const access = opts.access ?? this.feedAccess();
    this.opts.access = access;
    this.countEl = h('span', { class: 'wt-panel-count' });
    this.freshEl = h('span', { class: 'wt-fresh empty' }, 'NO DATA');
    const titleId = `wt-p-${opts.id}-title`;

    const head = h(
      'div',
      { class: 'wt-panel-head' },
      h('span', { class: 'wt-panel-title', id: titleId }, opts.title),
      opts.tag ? h('span', { class: 'wt-panel-tag' }, opts.tag) : null,
      this.countEl,
      h('button', { class: 'wt-panel-info', 'data-tip': opts.info, 'aria-label': `About ${opts.title}` }, 'ⓘ'),
      h('span', { style: 'flex:1' }),
      this.freshEl,
    );
    if (opts.collapsible !== false) {
      this.collapseBtn = h('button', { class: 'wt-panel-collapse', 'aria-label': `Collapse ${opts.title}`, 'aria-expanded': 'true', onclick: () => this.setCollapsed(!this.el.classList.contains('collapsed')) });
      this.collapseBtn.appendChild(svg(ICONS.chevron));
      head.appendChild(this.collapseBtn);
    }
    this.body = h('div', { class: 'wt-panel-body', tabindex: '-1' });
    this.el = h('section', { class: `wt-panel ${opts.className ?? ''} ${opts.resizable ? 'resizable' : ''}`, 'aria-labelledby': titleId, 'data-panel': opts.id }, head, this.body);

    this.setCollapsed(lsGet(`wt:panel:${opts.id}:collapsed`, false), false);
    if (opts.resizable) {
      const saved = lsGet<number | null>(`wt:panel:${opts.id}:h`, null);
      if (saved) this.el.style.height = `${saved}px`;
      let first = true;
      new ResizeObserver(() => {
        if (first) return void (first = false);
        if (this.el.style.height) lsSet(`wt:panel:${opts.id}:h`, Math.round(this.el.getBoundingClientRect().height));
      }).observe(this.el);
    }

    new IntersectionObserver(
      ([e]) => {
        this.nearViewport = e.isIntersecting;
        if (this.nearViewport && this.dirty) this.scheduleRender();
      },
      { rootMargin: '300px' },
    ).observe(this.el);

    const keys: StateKey[] = ['meta', 'tier', ...opts.feeds.map((f) => `data.${f}` as StateKey), ...(opts.watch ?? [])];
    subscribe(keys, () => this.scheduleRender());
    setInterval(() => this.updateFreshness(), 30000);
  }

  private feedAccess(): Tier {
    let t: Tier = 'free';
    for (const f of this.opts.feeds) {
      const a = FEED_BY_ID[f]?.access ?? 'member';
      if (a === 'admin' || (a === 'member' && t === 'free')) t = a;
    }
    return t;
  }

  get isLocked() {
    return !canAccess(state.tier, this.opts.access ?? 'member');
  }

  mount(parent: Element) {
    parent.appendChild(this.el);
    this.scheduleRender();
    return this;
  }

  setCollapsed(c: boolean, persist = true) {
    this.el.classList.toggle('collapsed', c);
    this.collapseBtn?.setAttribute('aria-expanded', String(!c));
    if (this.collapseBtn) this.collapseBtn.style.transform = c ? 'rotate(-90deg)' : '';
    if (persist) lsSet(`wt:panel:${this.opts.id}:collapsed`, c);
    if (!c) this.scheduleRender();
  }

  setCount(n: number | string | null) {
    this.countEl.textContent = n === null ? '' : typeof n === 'number' ? n.toLocaleString('en-GB') : n;
  }

  /** Debounced render; skipped while the panel is far from the viewport. */
  scheduleRender() {
    this.dirty = true;
    if (!this.nearViewport || this.renderTimer !== null) return;
    this.renderTimer = window.setTimeout(() => {
      this.renderTimer = null;
      this.render();
    }, 60);
  }

  private updateFreshness() {
    this.freshEl.hidden = this.opts.feeds.length === 0 && !this.isLocked;
    if (this.isLocked) {
      this.freshEl.className = 'wt-fresh empty';
      this.freshEl.textContent = 'MEMBERS';
      this.freshEl.removeAttribute('data-tip');
      return;
    }
    const f = freshnessOf(this.opts.feeds, state.meta);
    this.freshEl.className = `wt-fresh ${f.cls}`;
    this.freshEl.textContent = f.text;
    this.freshEl.dataset.tip = f.title;
  }

  /** True while none of the panel's feeds have arrived from bootstrap yet. */
  protected get loading() {
    return this.opts.feeds.length > 0 && this.opts.feeds.every((f) => !(f in state.data));
  }

  private render() {
    this.dirty = false;
    this.updateFreshness();
    if (this.el.classList.contains('collapsed')) {
      this.dirty = true;
      return;
    }
    if (this.isLocked) {
      this.setCount(null);
      if (!this.lockEl) {
        this.lockEl = h(
          'div',
          { class: 'wt-locked' },
          h('p', null, this.lockedText()),
          h('a', { class: 'wt-cta', href: state.checkoutUrl }, 'UNLOCK WATCHTOWER'),
        );
        this.el.appendChild(this.lockEl);
      }
      replaceChildren(this.body, this.teaser());
      return;
    }
    this.lockEl?.remove();
    this.lockEl = null;

    if (this.loading) {
      replaceChildren(this.body, h('div', null, h('div', { class: 'wt-skel', style: 'width:70%' }), h('div', { class: 'wt-skel' }), h('div', { class: 'wt-skel', style: 'width:55%' })));
      return;
    }
    let out: RenderResult;
    try {
      out = this.renderBody();
    } catch (e) {
      console.error(`[panel ${this.opts.id}]`, e);
      out = null;
      this.errorMessage = 'Something went wrong drawing this panel.';
    }
    if (this.errorMessage) {
      replaceChildren(this.body, h('div', { class: 'wt-panel-state error', role: 'alert' }, this.errorMessage));
      return;
    }
    if (out === null || (Array.isArray(out) && out.length === 0)) {
      replaceChildren(this.body, h('div', { class: 'wt-panel-state' }, this.emptyText()));
      return;
    }
    replaceChildren(this.body, ...(Array.isArray(out) ? out : [out]));
  }

  protected emptyText(): string {
    const f = freshnessOf(this.opts.feeds, state.meta);
    if (f.cls === 'empty') return 'No data yet — this feed has not reported. It will appear here once the source responds.';
    return this.opts.emptyText ?? 'Nothing to show right now.';
  }

  protected lockedText() {
    return `${this.opts.title.charAt(0)}${this.opts.title.slice(1).toLowerCase()} is part of the Watchtower membership.`;
  }

  /** Placeholder content behind the lock overlay (never real data). */
  protected teaser(): Node {
    return h('div', null, ...Array.from({ length: 5 }, (_, i) => h('div', { class: 'wt-skel', style: `width:${90 - i * 9}%;animation:none` })));
  }

  protected tool(el: HTMLElement) {
    if (!this.tools) {
      this.tools = h('div', { class: 'wt-panel-tools' });
      this.el.insertBefore(this.tools, this.body);
    }
    this.tools.appendChild(el);
    return el;
  }

  protected abstract renderBody(): RenderResult;
}
