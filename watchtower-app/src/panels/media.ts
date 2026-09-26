// Live News (right column, top) and Live Webcams (right column, bottom).
// News starts muted once the page is idle on desktop; on small screens or with
// data-saver on it waits for a tap. Webcams load only when played.
import { embedUrl, LIVE_NEWS, WEBCAMS, WEBCAM_REGIONS, type WebcamRegion } from '../config/media';
import { h, ICONS, lsGet, lsSet, replaceChildren, svg } from '../lib/dom';
import { Panel } from './Panel';

const ytCommand = (frame: HTMLIFrameElement | null, func: string) =>
  frame?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args: [] }), '*');

function playButton(title: string, onPlay: () => void, note = 'Loads YouTube when you press play'): HTMLElement {
  const btn = h('button', { class: 'wt-play', 'aria-label': `Play ${title}` }, h('span', { class: 'wt-play-icon' }, svg(ICONS.play)), `PLAY ${title.toUpperCase()}`, h('span', { class: 'muted', style: 'font-size:9.5px;letter-spacing:.08em' }, note));
  btn.addEventListener('click', onPlay);
  return btn;
}

const frame = (src: string, title: string) =>
  h('iframe', { src, title, allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen', allowfullscreen: true, referrerpolicy: 'strict-origin-when-cross-origin' }) as HTMLIFrameElement;

export class LiveNewsPanel extends Panel {
  private current = lsGet('wt:news:ch', LIVE_NEWS[0]?.id ?? '');
  private playing = false;
  private muted = true;
  private stage = h('div', { class: 'wt-embed fill' });
  private iframe: HTMLIFrameElement | null = null;
  private muteBtn: HTMLButtonElement;

  constructor() {
    super({ id: 'live-news', title: 'LIVE NEWS', feeds: [], access: 'member', collapsible: false, info: 'Official live streams from broadcasters that allow embedding, via YouTube’s privacy-enhanced player. Streams start muted; use the speaker button for sound.' });
    const chips = LIVE_NEWS.map((s) => {
      const b = this.tool(h('button', { class: 'wt-chip live', 'aria-pressed': String(s.id === this.current), title: s.name }, s.short.toUpperCase())) as HTMLButtonElement;
      b.addEventListener('click', () => {
        this.current = s.id;
        lsSet('wt:news:ch', s.id);
        chips.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        if (this.playing) this.load();
        else this.scheduleRender();
      });
      return b;
    });
    this.muteBtn = this.tool(h('button', { class: 'wt-chip icon', 'aria-label': 'Unmute', style: 'margin-left:auto', onclick: () => this.toggleMute() })) as HTMLButtonElement;
    this.muteBtn.appendChild(svg(ICONS.mute));
    const fs = this.tool(h('button', { class: 'wt-chip icon', 'aria-label': 'Full screen', onclick: () => this.stage.requestFullscreen?.() }));
    fs.appendChild(svg(ICONS.expand));

    const saveData = (navigator as any).connection?.saveData === true;
    if (LIVE_NEWS.length && !saveData && window.matchMedia('(min-width: 1081px)').matches) {
      const idle = (window as any).requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 2500));
      window.setTimeout(() => idle(() => !this.playing && this.play(), { timeout: 4000 }), 2500);
    }
  }

  private src() {
    const s = LIVE_NEWS.find((x) => x.id === this.current) ?? LIVE_NEWS[0];
    return { s, url: embedUrl(`channel:${s.channel}`, { muted: this.muted, api: true }) };
  }
  private load() {
    const { s, url } = this.src();
    this.iframe = frame(url, s.name);
    replaceChildren(this.stage, this.iframe);
  }
  private play() {
    this.playing = true;
    this.load();
    this.scheduleRender();
  }
  private toggleMute() {
    if (!this.playing) return this.play();
    this.muted = !this.muted;
    ytCommand(this.iframe, this.muted ? 'mute' : 'unMute');
    replaceChildren(this.muteBtn, svg(this.muted ? ICONS.mute : ICONS.sound));
    this.muteBtn.setAttribute('aria-label', this.muted ? 'Unmute' : 'Mute');
  }

  protected renderBody() {
    if (!LIVE_NEWS.length) return null;
    if (!this.playing) {
      const { s } = this.src();
      replaceChildren(this.stage, playButton(s.name, () => this.play(), 'Starts muted'));
    }
    return this.stage;
  }
}

export class WebcamsPanel extends Panel {
  private region: 'ALL' | WebcamRegion = lsGet('wt:cams:region', 'ALL');
  private grid = lsGet('wt:cams:grid', true);
  private chips: HTMLButtonElement[] = [];
  private playing = new Set<string>();

  constructor() {
    super({ id: 'webcams', title: 'LIVE WEBCAMS', feeds: [], access: 'member', collapsible: false, info: 'Public live cams from their official operators, embedded with YouTube’s privacy-enhanced player. Each loads only when you press play.' });
    for (const r of ['ALL', ...WEBCAM_REGIONS] as const) {
      const b = this.tool(h('button', { class: 'wt-chip live', 'aria-pressed': String(r === this.region) }, r)) as HTMLButtonElement;
      b.addEventListener('click', () => {
        this.region = r;
        lsSet('wt:cams:region', r);
        this.chips.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        this.scheduleRender();
      });
      this.chips.push(b);
    }
    const gridBtn = this.tool(h('button', { class: 'wt-chip icon', style: 'margin-left:auto', 'aria-pressed': String(this.grid), 'aria-label': 'Grid view', onclick: () => this.setGrid(true) })) as HTMLButtonElement;
    gridBtn.appendChild(svg(ICONS.grid));
    const oneBtn = this.tool(h('button', { class: 'wt-chip icon', 'aria-pressed': String(!this.grid), 'aria-label': 'Single view', onclick: () => this.setGrid(false) })) as HTMLButtonElement;
    oneBtn.appendChild(svg(ICONS.single));
    this.layoutBtns = [gridBtn, oneBtn];
  }
  private layoutBtns: HTMLButtonElement[] = [];
  private setGrid(g: boolean) {
    this.grid = g;
    lsSet('wt:cams:grid', g);
    this.layoutBtns[0]?.setAttribute('aria-pressed', String(g));
    this.layoutBtns[1]?.setAttribute('aria-pressed', String(!g));
    this.scheduleRender();
  }

  protected renderBody() {
    if (!WEBCAMS.length) {
      return h('div', { class: 'wt-panel-state' }, 'No webcams configured yet. Add official, embeddable YouTube live cams (with a region) in watchtower-app/src/config/media.ts — see RUNBOOK.md › Media embeds.');
    }
    const cams = WEBCAMS.filter((c) => this.region === 'ALL' || c.region === this.region);
    this.setCount(cams.length);
    if (!cams.length) return h('div', { class: 'wt-panel-state' }, 'No cams in this region yet.');
    return h(
      'div',
      { class: `wt-cams ${this.grid ? 'grid' : 'one'}` },
      ...cams.map((c) => {
        const box = h('div', { class: 'wt-embed' });
        const show = () => replaceChildren(box, frame(embedUrl(c.youtube), c.name));
        if (this.playing.has(c.id)) show();
        else box.appendChild(playButton(c.name, () => { this.playing.add(c.id); show(); }, c.city));
        return h('figure', { class: 'wt-cam' }, h('figcaption', null, h('span', { class: 'dot' }), h('b', null, c.city.toUpperCase()), ` ${c.name}`), box);
      }),
    );
  }
}
