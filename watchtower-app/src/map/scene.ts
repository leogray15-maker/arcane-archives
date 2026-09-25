// Builds the renderer-neutral Scene from app state and the layer registry.
import { canAccess } from '../../../shared/watchtower/feeds';
import type {
  Aircraft, Chokepoint, ChokepointStatus, CiiScore, ConflictEvent, ConvergenceCell, FireSummary, Hotspot,
  NaturalEvent, Quake, RefLine, RefPoint, SatGroup, Signal, StaticDataset,
} from '../../../shared/watchtower/types';
import { state } from '../app/state';
import { LAYER_BY_ID, layerAccess } from '../config/layers';
import { countryName } from '../lib/countries';
import { ago, utcStamp } from '../lib/time';
import { groundTrack, propagate } from './satellites';
import type { Arc, Area, Marker, PathLine, Ring, Scene } from './types';

const HOUR = 3600 * 1000;
const items = <T>(v: unknown): T[] => ((v as StaticDataset<T> | null)?.items ?? []);
const list = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export const BAND_COLORS: Record<string, string> = { CRITICAL: '#f0526b', HIGH: '#f59e42', ELEVATED: '#e5c85a', NORMAL: '#8b7cf6', LOW: '#5ee3a1' };
const CHOKE_COLORS = { DISRUPTED: '#f0526b', ELEVATED: '#f59e42', NORMAL: '#7dd3fc' } as const;

export function layerVisible(id: string) {
  const l = LAYER_BY_ID[id];
  return !!l && state.layers.has(id) && !l.disabledReason && canAccess(state.tier, layerAccess(l));
}

export function buildScene(now = Date.now()): Scene {
  const markers: Marker[] = [];
  const arcs: Arc[] = [];
  const paths: PathLine[] = [];
  const areas: Area[] = [];
  const rings: Ring[] = [];
  const d = state.data;
  const on = layerVisible;
  const col = (id: string) => LAYER_BY_ID[id].color;

  if (on('hotspots')) {
    for (const hs of items<Hotspot>(d.hotspots)) {
      markers.push({
        id: `hs:${hs.id}`, kind: 'hotspots', lat: hs.lat, lng: hs.lon, color: col('hotspots'), size: 8 + hs.baseline * 1.5, shape: 'diamond',
        priority: 60 + hs.baseline * 6, title: hs.name, label: 'INTEL HOTSPOT', source: 'Arcane hotspot list',
        meta: [`Baseline escalation ${hs.baseline}/5`, hs.summary], country: hs.countries[0] ?? null,
      });
    }
  }

  if (on('conflict')) {
    for (const e of list<ConflictEvent>(d.conflict)) {
      const kindLabel = { protest: 'PROTEST', violence: 'VIOLENCE', military: 'MILITARY ACTION', coercion: 'COERCION' }[e.kind];
      markers.push({
        id: `cf:${e.id}`, kind: 'conflict', lat: e.lat, lng: e.lon, color: e.kind === 'protest' ? '#f0788a' : col('conflict'),
        size: Math.min(12, 5 + Math.log2(1 + e.mentions)), shape: 'dot', priority: Math.min(90, 30 + e.mentions * 2 + (e.kind === 'violence' ? 15 : 0)),
        title: `${kindLabel.charAt(0)}${kindLabel.slice(1).toLowerCase()} — ${e.place || countryName(e.country)}`, label: kindLabel,
        source: 'GDELT', time: e.time, url: e.url, country: e.country,
        meta: [`${e.mentions} mentions · tone ${e.tone.toFixed(1)}`, `First seen ${ago(e.time, now)} ago`],
      });
    }
  }

  if (on('seismic')) {
    for (const q of list<Quake>(d.seismic)) {
      markers.push({
        id: `eq:${q.id}`, kind: 'seismic', lat: q.lat, lng: q.lon, color: q.mag >= 6 ? '#f0526b' : col('seismic'),
        size: Math.max(6, (q.mag - 3) * 4), shape: 'dot', priority: Math.min(100, q.mag * 12 + (q.significant ? 15 : 0)),
        title: `M${q.mag.toFixed(1)} — ${q.place}`, label: 'EARTHQUAKE', source: 'USGS', time: q.time, url: q.url,
        meta: [`${q.depthKm} km deep${q.tsunami ? ' · tsunami flag' : ''}${q.alert ? ` · PAGER ${q.alert}` : ''}`, `${utcStamp(q.time)} · ${ago(q.time, now)} ago`],
      });
      if (q.mag >= 6 || now - q.time < HOUR) rings.push({ id: `r:eq:${q.id}`, lat: q.lat, lng: q.lon, color: q.mag >= 6 ? '#f0526b' : '#f59e42', maxRadius: q.mag >= 6 ? 4 : 2.5 });
    }
  }

  if (on('natural')) {
    for (const e of [...list<NaturalEvent>(d.natural), ...list<NaturalEvent>(d.disasters)]) {
      const red = e.alertLevel === 'Red';
      markers.push({
        id: `nt:${e.source}:${e.id}`, kind: 'natural', lat: e.lat, lng: e.lon, color: red ? '#f0526b' : e.alertLevel === 'Orange' ? '#f59e42' : col('natural'),
        size: red ? 11 : 8, shape: 'dot', priority: red ? 85 : e.alertLevel === 'Orange' ? 65 : 40, title: e.title,
        label: `${e.category.toUpperCase()}${e.alertLevel ? ` · ${e.alertLevel.toUpperCase()} ALERT` : ''}`, source: e.source === 'GDACS' ? 'GDACS' : 'NASA EONET',
        time: e.time, url: e.url, country: e.country ?? null, meta: [`Updated ${ago(e.time, now)} ago`],
      });
      if (red) rings.push({ id: `r:nt:${e.id}`, lat: e.lat, lng: e.lon, color: '#f0526b', maxRadius: 3 });
    }
  }

  if (on('wildfires')) {
    const f = d.fires as FireSummary | null;
    for (const [lat, lon, frp, t] of f?.points ?? []) {
      markers.push({
        id: `fr:${lat.toFixed(3)}:${lon.toFixed(3)}`, kind: 'wildfires', lat, lng: lon, color: col('wildfires'), size: 4 + Math.min(6, Math.log2(1 + frp)),
        shape: 'dot', priority: Math.min(60, 10 + Math.log2(1 + frp) * 5), title: `Fire detection · ${Math.round(frp)} MW radiative power`,
        label: 'WILDFIRE (VIIRS)', source: 'NASA FIRMS', time: t, meta: [`Detected ${ago(t, now)} ago`],
      });
    }
  }

  if (on('aircraft')) {
    for (const a of list<Aircraft>(d.aircraft)) {
      markers.push({
        id: `ac:${a.hex}`, kind: 'aircraft', lat: a.lat, lng: a.lon, color: col('aircraft'), size: 9, shape: 'tri', rotation: a.track ?? 0,
        priority: 45, title: `${a.callsign || a.hex.toUpperCase()}${a.type ? ` · ${a.type}` : ''}`, label: 'MILITARY AIRCRAFT', source: 'adsb.lol (ODbL)',
        time: a.seenAt, url: `https://globe.adsb.lol/?icao=${a.hex}`,
        meta: [`${a.altFt === null ? 'Altitude n/a' : `${a.altFt.toLocaleString('en-GB')} ft`} · ${a.speedKt ?? '—'} kt`, `Seen ${ago(a.seenAt, now)} ago${a.reg ? ` · ${a.reg}` : ''}`],
      });
    }
  }

  if (on('satellites')) {
    const groups = list<SatGroup>(d.satellites);
    for (const s of propagate(groups, new Date(now))) {
      markers.push({
        id: `sat:${s.id}`, kind: 'satellites', lat: s.lat, lng: s.lng, color: col('satellites'), size: 5, shape: 'square', priority: s.group === 'Space stations' ? 70 : 20,
        title: s.name, label: `SATELLITE · ${s.group.toUpperCase()}`, source: 'CelesTrak', meta: [`Altitude ${Math.round(s.altKm).toLocaleString('en-GB')} km (propagated in your browser)`],
      });
    }
    const stations = groups.find((g) => g.group === 'stations');
    for (const [name, l1, l2] of (stations?.tles ?? []).filter(([n]) => /ISS|TIANGONG|CSS/i.test(n)).slice(0, 2)) {
      const track = groundTrack(l1, l2, 95, 2, new Date(now));
      splitAntimeridian(track).forEach((seg, i) => paths.push({ id: `orb:${name}:${i}`, kind: 'satellites', coords: seg, color: '#c4b5fd88', width: 0.6, label: `${name.trim()} ground track (next 95 min)`, dashed: true }));
    }
  }

  if (on('chokepoints')) {
    const status = new Map(list<ChokepointStatus>(d.chokepointStatus).map((c) => [c.id, c]));
    for (const c of items<Chokepoint>(d.chokepoints)) {
      const st = status.get(c.id);
      const color = CHOKE_COLORS[st?.status ?? 'NORMAL'];
      markers.push({
        id: `ck:${c.id}`, kind: 'chokepoints', lat: c.lat, lng: c.lon, color, size: 10, shape: 'diamond', priority: st?.status === 'DISRUPTED' ? 95 : 75,
        title: c.name, label: `CHOKEPOINT · ${st?.status ?? 'NO STATUS'}`, source: 'Arcane chokepoint monitor',
        meta: [st ? `${st.signals} nearby signals · ${st.newsMentions} news mentions (24h)` : 'Status not computed yet', ...(st?.reasons.slice(0, 2) ?? []), c.note],
      });
      for (const lane of c.lanes) {
        arcs.push({ id: `ln:${c.id}:${lane.name}`, kind: 'chokepoints', startLat: lane.from[0], startLng: lane.from[1], endLat: lane.to[0], endLng: lane.to[1], color: `${color}`, label: `${lane.name} (via ${c.name})` });
      }
    }
  }

  const refPoints = (id: string, label: string, shape: Marker['shape'], priority: number) => {
    if (!on(id)) return;
    for (const p of items<RefPoint>(d[id])) {
      markers.push({
        id: `${id}:${p.id}`, kind: id, lat: p.lat, lng: p.lon, color: col(id), size: 7, shape, priority, title: p.name,
        label: `${label}${p.kind ? ` · ${p.kind.toUpperCase()}` : ''}`, source: p.cite[0]?.title ?? 'Public source', url: p.cite[0]?.url, country: p.country,
        meta: [[p.operator, countryName(p.country)].filter(Boolean).join(' · '), p.status ?? '', p.note ?? ''].filter(Boolean),
      });
    }
  };
  refPoints('datacenters', 'AI DATA CENTRE', 'square', 30);
  refPoints('spaceports', 'SPACEPORT', 'diamond', 35);
  refPoints('nuclear', 'NUCLEAR SITE', 'dot', 30);
  refPoints('bases', 'MILITARY BASE', 'square', 30);

  const refLines = (id: string, width: number) => {
    if (!on(id)) return;
    for (const l of items<RefLine>(d[id])) {
      splitAntimeridian(l.coords.map(([lon, lat]) => [lat, lon] as [number, number])).forEach((seg, i) =>
        paths.push({ id: `${id}:${l.id}:${i}`, kind: id, coords: seg, color: col(id), width, label: l.name }),
      );
    }
  };
  refLines('cables', 0.35);
  refLines('pipelines', 0.5);

  if (on('convergence')) {
    for (const c of list<ConvergenceCell>(d.convergence)) {
      const crit = c.priority === 'critical';
      markers.push({
        id: `cv:${c.id}`, kind: 'convergence', lat: c.lat, lng: c.lon, color: crit ? '#f0526b' : col('convergence'), size: 13, shape: 'square', priority: 98,
        title: `Convergence: ${c.types.length} event types near ${c.label}`, label: `CONVERGENCE · ${c.priority.toUpperCase()}`, source: 'Arcane convergence engine',
        meta: [`Score ${c.score} · ${c.events} events in 24h`, `Types: ${c.types.join(', ')}`],
      });
      rings.push({ id: `r:cv:${c.id}`, lat: c.lat, lng: c.lon, color: crit ? '#f0526b' : '#f5b36b', maxRadius: 2.5 });
    }
  }

  if (on('cii')) {
    for (const c of list<CiiScore>(d.cii)) areas.push({ iso3: c.iso3, color: BAND_COLORS[c.band], label: `${c.name}: ${c.score} (${c.band})`, score: c.score });
  }

  // Critical signals get a pulse regardless of layer (they are the headline events).
  for (const s of list<Signal>(d.signals)) {
    if (s.severity === 'critical' && now - s.time < 6 * HOUR && on(signalLayer(s.type))) {
      rings.push({ id: `r:sg:${s.id}`, lat: s.lat, lng: s.lon, color: '#f0526b', maxRadius: 3 });
    }
  }

  return { markers, arcs, paths, areas, rings: rings.slice(0, 60), totalPoints: markers.length };
}

function signalLayer(type: Signal['type']) {
  return ({ seismic: 'seismic', natural: 'natural', wildfire: 'wildfires', conflict: 'conflict', protest: 'conflict', military_air: 'aircraft', convergence: 'convergence' } as Record<string, string>)[type] ?? 'conflict';
}

/** Split a [lat,lng] polyline where it crosses ±180° so renderers don't draw across the map. */
export function splitAntimeridian(pts: [number, number][]): [number, number][][] {
  const segs: [number, number][][] = [];
  let cur: [number, number][] = [];
  for (let i = 0; i < pts.length; i++) {
    if (i > 0 && Math.abs(pts[i][1] - pts[i - 1][1]) > 180) {
      if (cur.length > 1) segs.push(cur);
      cur = [];
    }
    cur.push(pts[i]);
  }
  if (cur.length > 1) segs.push(cur);
  return segs;
}
