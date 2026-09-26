// Panel layout: World Brief, Strategic Posture and Threat Timeline on the right,
// three analysis panels under the map, then a deck (live media first).
import { state } from '../app/state';
import { WEBCAMS } from '../config/media';
import { AdminPanel } from './admin';
import { ForecastsPanel, WorldBriefPanel } from './ai';
import { CiiPanel, InfrastructurePanel, SignalsPanel, SpikesPanel } from './intel';
import { LiveNewsPanel, WebcamsPanel } from './media';
import { StrategicPosturePanel, ThreatTimelinePanel } from './posture';
import { SeismicPanel } from './seismic';
import { LiveIntelPanel, SupplyChainPanel } from './situation';

export interface PanelSlots {
  right: HTMLElement;
  bottom: HTMLElement;
  deck: HTMLElement;
}

export function mountPanels(slots: PanelSlots) {
  // Right column
  new WorldBriefPanel().mount(slots.right);
  new StrategicPosturePanel().mount(slots.right);
  new ThreatTimelinePanel().mount(slots.right);
  // Under the map
  new LiveIntelPanel().mount(slots.bottom);
  new CiiPanel().mount(slots.bottom);
  new SupplyChainPanel().mount(slots.bottom);
  // Deck
  if (state.tier === 'admin') new AdminPanel().mount(slots.deck);
  new LiveNewsPanel().mount(slots.deck);
  if (WEBCAMS.length) new WebcamsPanel().mount(slots.deck);
  new SignalsPanel().mount(slots.deck);
  new SeismicPanel().mount(slots.deck);
  new ForecastsPanel().mount(slots.deck);
  new InfrastructurePanel().mount(slots.deck);
  new SpikesPanel().mount(slots.deck);
}
