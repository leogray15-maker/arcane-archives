import type { Quake } from '../../../shared/watchtower/types';
import { feed } from '../app/state';
import { h } from '../lib/dom';
import { ago } from '../lib/time';
import { emit } from '../ui/header';
import { Panel } from './Panel';

export const magColor = (m: number) => (m >= 6 ? '#f0526b' : m >= 5 ? '#f59e42' : '#e5c85a');

export class SeismicPanel extends Panel {
  constructor() {
    super({
      id: 'seismic',
      title: 'SEISMIC WATCH',
      feeds: ['seismic'],
      info: 'Earthquakes of magnitude 4.5+ in the past 24 hours, plus events USGS classes as "significant" in the past week. Click a row to fly to it. Source: USGS (public domain).',
      emptyText: 'No M4.5+ earthquakes in the past 24 hours.',
    });
  }

  protected renderBody() {
    const all = feed<Quake[] | null>('seismic');
    if (!all) return null;
    const dayAgo = Date.now() - 24 * 3600 * 1000;
    const list = all.filter((q) => q.time >= dayAgo || q.significant).sort((a, b) => b.time - a.time);
    this.setCount(`24H · ${list.length}`);
    if (!list.length) return null;
    return list.map((q) => {
      const c = magColor(q.mag);
      return h(
        'button',
        {
          class: 'row wt-row-btn wt-quake',
          onclick: () => emit('wt:focus', { lat: q.lat, lng: q.lon, alt: 0.9, kind: 'seismic', id: q.id }),
          'aria-label': `Magnitude ${q.mag.toFixed(1)}, ${q.place}, ${ago(q.time)} ago`,
        },
        h('span', { class: 'wt-mag', style: `color:${c};border-color:${c}66;background:${c}14` }, q.mag.toFixed(1)),
        h(
          'span',
          { class: 'wt-quake-text' },
          h('span', { class: 'wt-quake-place' }, q.place),
          h('span', { class: 'wt-sub' }, `${q.depthKm} km depth${q.tsunami ? ' · TSUNAMI FLAG' : ''}${q.alert ? ` · PAGER ${q.alert.toUpperCase()}` : ''}${q.significant ? ' · SIGNIFICANT' : ''}`),
        ),
        h('span', { class: 'wt-sub' }, ago(q.time)),
      );
    });
  }
}
