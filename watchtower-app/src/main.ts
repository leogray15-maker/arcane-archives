import './styles/app.css';
import type { MeResponse } from '../../shared/watchtower/types';
import { api, ApiError, setSession } from './app/api-client';
import { authGate } from './app/auth-gate';
import { startBootstrap } from './app/bootstrap-loader';
import { state, update } from './app/state';
import { readUrl, startUrlSync } from './app/url-sync';
import { DEFAULT_LAYERS, LAYERS } from './config/layers';
import { h, replaceChildren } from './lib/dom';
import { buildMap } from './map/controller';
import { mountPanels } from './panels';
import { buildDrawer } from './ui/drawer';
import { buildFooter } from './ui/footer';
import { buildHeader } from './ui/header';
import { buildLayerPanel } from './ui/layer-panel';
import { installTooltips } from './ui/tooltip';

const root = document.getElementById('wt-root')!;
const boot = document.getElementById('wt-boot')!;

function bootMessage(...nodes: (Node | string)[]) {
  replaceChildren(boot.querySelector('.wt-boot-inner')!, ...nodes);
}

async function start() {
  const session = await authGate();
  setSession(session);

  let me: MeResponse;
  try {
    me = await api<MeResponse>('me', { timeoutMs: 8000 });
  } catch (e) {
    const msg = e instanceof ApiError && e.status === 500 ? 'The Watchtower server is not configured yet.' : 'Could not reach the Watchtower. Check your connection.';
    bootMessage(msg, h('a', { href: location.href }, 'RETRY'), h('a', { href: '/dashboard.html' }, '‹ DASHBOARD'));
    return;
  }
  state.uid = me.uid;
  state.email = me.email;
  state.tier = me.tier;
  state.checkoutUrl = me.checkoutUrl;

  readUrl(DEFAULT_LAYERS, new Set(LAYERS.map((l) => l.id)));
  mountShell();
  startUrlSync();
  boot.remove();
  update('tier', me.tier);
  void startBootstrap();
}

function mountShell() {
  installTooltips();
  const main = h('main', { class: 'wt-main', id: 'wt-main' });
  const map = h('section', { class: 'wt-map', id: 'wt-map', 'aria-label': 'Map' });
  const right = h('div', { class: 'wt-right' });
  const bottom = h('div', { class: 'wt-bottom' });
  const deck = h('div', { class: 'wt-deck' });
  main.append(buildLayerPanel(main), map, right, bottom, deck);
  const app = h('div', { class: 'wt-app' }, buildHeader(), main, buildFooter());
  root.append(app, ...buildDrawer());
  mountPanels({ right, bottom, deck });
  buildMap(map);
}

start().catch((e) => {
  console.error(e);
  bootMessage('Something went wrong starting the Watchtower.', h('a', { href: location.href }, 'RETRY'));
});
