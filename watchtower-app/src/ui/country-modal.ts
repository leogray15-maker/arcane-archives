// Country brief: CII breakdown + recent signals + AI situational summary.
import { canAccess } from '../../../shared/watchtower/feeds';
import type { CiiScore, CountryBrief, SignalSet } from '../../../shared/watchtower/types';
import { api, ApiError } from '../app/api-client';
import { feed, state, update } from '../app/state';
import { h, replaceChildren } from '../lib/dom';
import { countryName } from '../lib/countries';
import { ago } from '../lib/time';
import { BAND_COLORS } from '../map/scene';
import { briefBody } from '../panels/ai';
import { SEV_LABEL, sparkline } from '../panels/intel';
import { emit } from './header';
import { openModal } from './modal';

let close: (() => void) | null = null;

function bar(label: string, v: number, color: string) {
  return h(
    'div',
    { style: 'display:grid;grid-template-columns:110px 1fr 34px;gap:10px;align-items:center;margin:4px 0' },
    h('span', { class: 'mono', style: 'font-size:10px;letter-spacing:.12em;color:#a9a4b8' }, label),
    h('span', { class: 'wt-bar' }, h('span', { style: `width:${Math.max(1, v)}%;background:${color}` })),
    h('span', { class: 'mono', style: 'font-size:11px;text-align:right' }, String(v)),
  );
}

export function openCountry(iso3: string) {
  if (!canAccess(state.tier, 'member')) {
    emit('wt:locked');
    return;
  }
  close?.();
  update('country', iso3);
  const cii = feed<CiiScore[] | null>('cii')?.find((c) => c.iso3 === iso3) ?? null;
  const signals = (feed<SignalSet | null>('signals')?.items ?? []).filter((s) => s.country === iso3).slice(0, 8);
  const name = cii?.name ?? countryName(iso3);
  const briefBox = h('div', null, h('div', { class: 'wt-skel', style: 'width:80%' }), h('div', { class: 'wt-skel' }), h('div', { class: 'wt-skel', style: 'width:60%' }));

  const color = cii ? BAND_COLORS[cii.band] : '#8b7cf6';
  const body = h(
    'div',
    null,
    cii
      ? h(
          'div',
          null,
          h('h3', null, 'COUNTRY INSTABILITY INDEX'),
          h(
            'div',
            { style: 'display:flex;align-items:center;gap:14px;margin-bottom:10px' },
            h('span', { class: 'mono', style: `font-size:30px;font-weight:700;color:${color}` }, String(cii.score)),
            h('span', { class: 'mono', style: `font-size:10px;letter-spacing:.16em;color:${color}` }, cii.band),
            h('span', { class: 'mono muted', style: 'font-size:11px' }, cii.change24h === null ? 'NO 24H HISTORY YET' : `${cii.change24h > 0 ? '▲' : cii.change24h < 0 ? '▼' : '—'} ${Math.abs(cii.change24h)} IN 24H`),
            h('span', { style: 'margin-left:auto' }, sparkline(cii.spark, color, 140, 30)),
          ),
          bar('BASELINE', cii.baseline, '#6c4ce6'),
          bar('UNREST ×.25', cii.components.unrest, '#f0788a'),
          bar('CONFLICT ×.30', cii.components.conflict, '#f0526b'),
          bar('SECURITY ×.20', cii.components.security, '#f59e42'),
          bar('INFORMATION ×.25', cii.components.information, '#8b7cf6'),
          h('p', { class: 'mono muted', style: 'font-size:10.5px;margin:8px 0 0' },
            `Event score ${cii.event}. ${Object.keys(cii.boosts).length ? `Boosts: ${Object.entries(cii.boosts).map(([k, v]) => `${k} +${v}`).join(', ')}. ` : ''}${cii.floorReason ? `Floor ${cii.floor} applied: ${cii.floorReason}.` : cii.floor ? `Floor ${cii.floor} (not binding).` : ''}`),
        )
      : h('p', { class: 'muted' }, `${name} is not on the Country Instability Index list. The brief below uses signals and headlines only.`),
    h('h3', null, 'RECENT SIGNALS'),
    signals.length
      ? h('div', null, ...signals.map((s) => h('div', { style: 'display:flex;gap:10px;align-items:baseline;margin:6px 0' }, h('span', { class: `sev ${s.severity}` }, SEV_LABEL[s.severity]), h('span', { style: 'flex:1;font-size:13px' }, s.title), h('span', { class: 'mono muted', style: 'font-size:10px' }, ago(s.time)))))
      : h('p', { class: 'muted' }, 'No signals for this country in the current window.'),
    h('h3', null, 'SITUATION BRIEF · AI'),
    briefBox,
  );

  close = openModal(`${name.toUpperCase()} · COUNTRY BRIEF`, body, {
    onClose: () => {
      close = null;
      if (state.country === iso3) update('country', null);
    },
  });

  api<CountryBrief & { cached: boolean }>(`country-brief?iso=${iso3}`, { timeoutMs: 45000 })
    .then((b) => replaceChildren(briefBox, briefBody(b, 'AI-GENERATED SITUATIONAL SUMMARY · NOT ADVICE')))
    .catch((e: ApiError) => replaceChildren(briefBox, h('p', { class: 'muted' }, e.status === 429 || e.status === 503 ? e.message : `The AI brief is unavailable right now (${e.message}). The index and signals above are live.`)));
}

export function installCountryModal() {
  document.addEventListener('wt:country', (e) => openCountry((e as CustomEvent).detail as string));
}
