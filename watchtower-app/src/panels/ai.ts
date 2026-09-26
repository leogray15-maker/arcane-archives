// World Brief and AI Forecasts panels.
import type { AiBrief, ForecastSet } from '../../../shared/watchtower/types';
import { feed } from '../app/state';
import { h, safeUrl } from '../lib/dom';
import { ago } from '../lib/time';
import { Panel } from './Panel';

/** Renders "text [1][2]" with the markers as links to the cited articles. */
export function citedParagraph(text: string, links: Map<number, string | undefined>): HTMLParagraphElement {
  const p = h('p');
  let last = 0;
  for (const m of text.matchAll(/\[(\d+)\]/g)) {
    p.append(text.slice(last, m.index));
    const n = Number(m[1]);
    const href = links.get(n);
    p.append(href ? h('a', { class: 'wt-cite', href, target: '_blank', rel: 'noopener noreferrer', 'aria-label': `Source ${n}` }, `[${n}]`) : h('span', { class: 'wt-cite' }, `[${n}]`));
    last = (m.index ?? 0) + m[0].length;
  }
  p.append(text.slice(last));
  return p;
}

export function briefBody(b: AiBrief, note = 'AI-GENERATED FROM RANKED HEADLINES · NOT ADVICE'): HTMLElement {
  const links = new Map(b.citations.map((c) => [c.n, safeUrl(c.link)]));
  return h(
    'div',
    { class: 'wt-brief' },
    ...b.paragraphs.map((t) => citedParagraph(t, links)),
    b.thinData ? h('p', { class: 'wt-ai-note' }, 'DATA IS THIN THIS CYCLE — TREAT AS PARTIAL.') : null,
    b.citations.length
      ? h('div', { class: 'wt-brief-cites' }, ...b.citations.map((c) => h('a', { href: safeUrl(c.link), target: '_blank', rel: 'noopener noreferrer' }, `[${c.n}] ${c.source} · ${ago(c.time)} — ${c.title}`)))
      : null,
    h('span', { class: 'wt-ai-note' }, b.provider === 'digest' ? `DIGEST OF TOP-RANKED HEADLINES · ${ago(b.generatedAt)} AGO` : `${note} · ${b.provider.toUpperCase()} · ${ago(b.generatedAt)} AGO`),
  );
}

export class WorldBriefPanel extends Panel {
  constructor() {
    super({
      id: 'brief', title: 'WORLD BRIEF', tag: 'AI', feeds: ['brief'],
      info: 'A short, neutral summary written by an AI model from the top-ranked headlines of the last cycle (refreshed about every 2 hours). Every sentence cites its source; sentences with figures not found in the sources are removed automatically. Not advice.',
      emptyText: 'No brief yet.',
    });
  }
  protected renderBody() {
    const b = feed<AiBrief | null>('brief');
    return b ? briefBody(b) : null;
  }
}

const CONF_COLOR = { high: '#c4b5fd', medium: '#e5c85a', low: '#a9a4b8' } as const;
export class ForecastsPanel extends Panel {
  constructor() {
    super({
      id: 'forecasts', title: 'WHAT TO WATCH', tag: 'AI', feeds: ['forecasts'],
      info: 'AI-generated list of developments worth watching, based only on current instability scores, signals, posture and headlines. Confidence says how well the data supports the item being worth watching — it is not a probability of anything happening. Not advice.',
    });
  }
  protected renderBody() {
    const f = feed<ForecastSet | null>('forecasts');
    if (!f?.items.length) return null;
    this.setCount(f.items.length);
    return [
      ...f.items.map((i) =>
        h(
          'div',
          { class: 'wt-sig' },
          h('span', { class: 'wt-sig-meta' }, h('span', { style: `color:${CONF_COLOR[i.confidence]};border:1px solid currentColor;padding:1px 5px;border-radius:2px` }, `${i.confidence.toUpperCase()} CONFIDENCE`), h('span', null, `${i.category.toUpperCase()} · ${i.region.toUpperCase()}`)),
          h('span', { class: 'wt-sig-title' }, i.title),
          h('span', { class: 'wt-sub', style: 'white-space:normal;line-height:1.5' }, i.rationale),
        ),
      ),
      h('div', { class: 'wt-panel-state', style: 'padding:12px' }, `AI-GENERATED · NOT A PREDICTION OR ADVICE · ${f.provider.toUpperCase()} · ${ago(f.generatedAt)} AGO`),
    ];
  }
}
