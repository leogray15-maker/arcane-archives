// Panel layout. Each slot is filled by a Panel subclass.
import { h } from '../lib/dom';
import { Panel } from './Panel';

class Placeholder extends Panel {
  protected renderBody() {
    return h('div', { class: 'wt-panel-state' }, 'This panel is wired up in a later phase.');
  }
}

export interface PanelSlots {
  right: HTMLElement;
  bottom: HTMLElement;
  deck: HTMLElement;
}

export function mountPanels(slots: PanelSlots) {
  const mk = (id: string, title: string, info: string) => new Placeholder({ id, title, feeds: [], info, access: 'free' });
  mk('brief', 'WORLD BRIEF', 'AI summary of the top-ranked headlines.').mount(slots.right);
  mk('chokepoints', 'CHOKEPOINTS', 'Status of nine maritime chokepoints.').mount(slots.right);
  mk('signals', 'SIGNALS', 'Cross-source signal aggregator.').mount(slots.bottom);
  mk('cii', 'COUNTRY INSTABILITY', 'Country Instability Index.').mount(slots.bottom);
  mk('seismic', 'SEISMIC WATCH', 'USGS earthquakes.').mount(slots.bottom);
}
