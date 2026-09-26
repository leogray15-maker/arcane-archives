// Panel layout: live media on the right, three analysis panels under the map,
// then a deck of further panels.
import { state } from '../app/state';
import { AdminPanel } from './admin';
import { ForecastsPanel, WorldBriefPanel } from './ai';
import { CiiPanel, InfrastructurePanel, SignalsPanel, SpikesPanel } from './intel';
import { LiveNewsPanel, WebcamsPanel } from './media';
import { SeismicPanel } from './seismic';
import { LiveIntelPanel, SupplyChainPanel } from './situation';

export interface PanelSlots {
  right: HTMLElement;
  bottom: HTMLElement;
  deck: HTMLElement;
}

export function mountPanels(slots: PanelSlots) {
  // Right column
  new LiveNewsPanel().mount(slots.right);
  new WebcamsPanel().mount(slots.right);
  // Under the map
  new LiveIntelPanel().mount(slots.bottom);
  new CiiPanel().mount(slots.bottom);
  new SupplyChainPanel().mount(slots.bottom);
  // Deck
  if (state.tier === 'admin') new AdminPanel().mount(slots.deck);
  new WorldBriefPanel().mount(slots.deck);
  new SignalsPanel().mount(slots.deck);
  new SeismicPanel().mount(slots.deck);
  new ForecastsPanel().mount(slots.deck);
  new InfrastructurePanel().mount(slots.deck);
  new SpikesPanel().mount(slots.deck);
}
