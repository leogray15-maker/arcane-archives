// Level of detail: clusters dense marker kinds into grid cells sized by camera
// altitude, then caps the total so the HTML marker layer stays near 60fps.
import type { Marker } from './types';

/** Kinds that can become numerous and are safe to cluster. */
const CLUSTERABLE = new Set(['wildfires', 'conflict', 'aircraft', 'satellites', 'nuclear', 'bases', 'natural', 'datacenters']);
export const MAX_MARKERS = 650;

export function cellSizeFor(altitude: number): number {
  if (altitude > 2.2) return 6;
  if (altitude > 1.4) return 4;
  if (altitude > 0.8) return 2;
  if (altitude > 0.4) return 1;
  return 0; // no clustering when zoomed right in
}

export function applyLod(markers: Marker[], altitude: number, max = MAX_MARKERS): Marker[] {
  const cell = cellSizeFor(altitude);
  let out: Marker[] = [];
  if (cell === 0) out = markers;
  else {
    const buckets = new Map<string, Marker[]>();
    for (const m of markers) {
      if (!CLUSTERABLE.has(m.kind)) {
        out.push(m);
        continue;
      }
      const k = `${m.kind}|${Math.floor(m.lat / cell)}|${Math.floor(m.lng / cell)}`;
      const b = buckets.get(k);
      if (b) b.push(m);
      else buckets.set(k, [m]);
    }
    for (const group of buckets.values()) {
      if (group.length < 3) {
        out.push(...group);
        continue;
      }
      out.push(cluster(group));
    }
  }
  if (out.length > max) out = [...out].sort((a, b) => b.priority - a.priority).slice(0, max);
  return out;
}

function cluster(group: Marker[]): Marker {
  let lat = 0;
  let lng = 0;
  let top = group[0];
  let count = 0;
  for (const m of group) {
    lat += m.lat;
    lng += m.lng;
    count += m.count ?? 1;
    if (m.priority > top.priority) top = m;
  }
  const n = group.length;
  return {
    ...top,
    id: `cl:${top.kind}:${top.id}`,
    lat: lat / n,
    lng: lng / n,
    count,
    size: Math.min(26, 12 + Math.log2(count) * 3),
    priority: Math.min(100, top.priority + Math.log2(count) * 4),
    title: `${count.toLocaleString('en-GB')} × ${top.label.toLowerCase()}`,
    meta: [`Zoom in to separate. Highest-priority item: ${top.title}`],
    rotation: undefined,
  };
}
