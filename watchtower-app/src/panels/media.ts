// Live News and Webcams: nothing loads until the viewer presses play.
import { h, ICONS, lsGet, lsSet, replaceChildren, svg } from '../lib/dom';
import { embedUrl, LIVE_NEWS, WEBCAMS } from '../config/media';
import { Panel } from './Panel';

function player(url: string, title: string, onPlay?: () => void): HTMLElement {
  const box = h('div', { class: 'wt-embed' });
  const btn = h('button', { class: 'wt-play', 'aria-label': `Play ${title}` }, h('span', { class: 'wt-play-icon' }, svg(ICONS.play)), `PLAY ${title.toUpperCase()}`, h('span', { class: 'muted', style: 'font-size:9.5px;letter-spacing:.08em' }, 'Loads YouTube only when you press play'));
  btn.addEventListener('click', () => {
    onPlay?.();
    replaceChildren(box, h('iframe', { src: url, title, allow: 'autoplay; encrypted-media; picture-in-picture', allowfullscreen: true, referrerpolicy: 'strict-origin-when-cross-origin', loading: 'lazy' }));
  });
  box.appendChild(btn);
  return box;
}

export class LiveNewsPanel extends Panel {
  private current = lsGet('wt:news:ch', LIVE_NEWS[0]?.id ?? '');
  private playing = false;
  constructor() {
    super({ id: 'live-news', title: 'LIVE NEWS', feeds: [], access: 'member', className: 'wide', info: 'Official live streams from broadcasters that allow embedding. Nothing is loaded from YouTube until you press play.' });
    for (const s of LIVE_NEWS) {
      const b = this.tool(h('button', { class: 'wt-chip', 'aria-pressed': String(s.id === this.current) }, s.name.toUpperCase())) as HTMLButtonElement;
      b.addEventListener('click', () => {
        this.current = s.id;
        lsSet('wt:news:ch', s.id);
        this.tools?.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        this.scheduleRender();
      });
    }
  }
  protected renderBody() {
    const s = LIVE_NEWS.find((x) => x.id === this.current) ?? LIVE_NEWS[0];
    if (!s) return null;
    // keep playing when switching channels once the viewer has opted in
    if (this.playing) return h('div', { class: 'wt-embed' }, h('iframe', { src: embedUrl(`channel:${s.channel}`), title: s.name, allow: 'autoplay; encrypted-media; picture-in-picture', allowfullscreen: true }));
    return player(embedUrl(`channel:${s.channel}`), s.name, () => (this.playing = true));
  }
}

export class WebcamsPanel extends Panel {
  constructor() {
    super({ id: 'webcams', title: 'LIVE WEBCAMS', feeds: [], access: 'member', info: 'A small curated set of publicly embeddable city cams from their official operators, loaded only on click.' });
  }
  protected renderBody() {
    if (!WEBCAMS.length) {
      return h('div', { class: 'wt-panel-state' }, 'No webcams configured yet. Add official, embeddable YouTube live cams in watchtower-app/src/config/media.ts (see RUNBOOK.md › Media embeds).');
    }
    return WEBCAMS.map((c) => h('div', { style: 'padding:10px 12px;border-bottom:1px solid var(--wt-line-soft)' }, h('div', { class: 'wt-sub', style: 'margin-bottom:6px' }, `${c.city.toUpperCase()} · ${c.name}`), player(embedUrl(c.youtube), c.name)));
  }
}
