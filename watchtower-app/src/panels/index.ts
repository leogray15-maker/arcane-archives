// Panel layout (matches the Global Situation mockup, plus a second deck below).
import { state } from '../app/state';
import { AdminPanel } from './admin';
import { ForecastsPanel, WorldBriefPanel } from './ai';
import { ChokepointsPanel, CiiPanel, InfrastructurePanel, PosturePanel, SignalsPanel, SpikesPanel } from './intel';
import { LiveNewsPanel, WebcamsPanel } from './media';
import { SeismicPanel } from './seismic';

export interface PanelSlots {
  right: HTMLElement;
  bottom: HTMLElement;
  deck: HTMLElement;
}

export function mountPanels(slots: PanelSlots) {
  // Right column
  new WorldBriefPanel().mount(slots.right);
  new ChokepointsPanel().mount(slots.right);
  // Bottom row
  new SignalsPanel().mount(slots.bottom);
  new CiiPanel().mount(slots.bottom);
  new SeismicPanel().mount(slots.bottom);
  // Deck
  if (state.tier === 'admin') new AdminPanel().mount(slots.deck);
  new PosturePanel().mount(slots.deck);
  new ForecastsPanel().mount(slots.deck);
  new InfrastructurePanel().mount(slots.deck);
  new SpikesPanel().mount(slots.deck);
  new LiveNewsPanel().mount(slots.deck);
  new WebcamsPanel().mount(slots.deck);
}
