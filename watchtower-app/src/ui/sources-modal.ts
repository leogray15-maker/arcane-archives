// "Sources & Methodology": every data source with its required attribution,
// plus a plain-language summary of how the scores work.
import { h } from '../lib/dom';
import { openModal } from './modal';

const SOURCES: [string, string, string][] = [
  ['USGS Earthquake Hazards Program', 'Earthquakes', 'Public domain (US Government)'],
  ['NASA EONET', 'Natural events', 'NASA open data — credit NASA EONET'],
  ['GDACS (European Commission JRC / UN OCHA)', 'Disaster alerts', 'CC BY 4.0 — credit GDACS'],
  ['NASA FIRMS (LANCE)', 'Wildfire detections', 'NASA open data — credit NASA FIRMS'],
  ['The GDELT Project — gdeltproject.org', 'Conflict/protest events, news tone', 'Free incl. commercial use with citation and link'],
  ['UCDP, Uppsala University', 'Historical conflict baseline', 'CC BY 4.0'],
  ['CelesTrak', 'Satellite orbital elements', 'Free public data — credit CelesTrak'],
  ['adsb.lol', 'Military aircraft positions', 'ODbL 1.0 — attribution required'],
  ['FRED, Federal Reserve Bank of St. Louis', 'Macro indicators (public-domain series)', 'FRED terms; underlying sources credited per series'],
  ['BBC, Guardian, DW, France 24, NPR, Al Jazeera, Defense News, Bellingcat, UN News', 'Headlines (RSS)', 'Headline + link only; © each publisher'],
  ['NASA Visible Earth — Blue Marble', 'Globe imagery', 'NASA imagery (not copyrighted)'],
  ['Natural Earth', 'Country shapes, 2D basemap', 'Public domain'],
  ['IAEA PRIS', 'Nuclear power plant list', 'Used with acknowledgement; no IAEA endorsement implied'],
  ['Wikipedia and government pages', 'Reference layer facts (bases, spaceports, facilities)', 'Facts only, cited per entry'],
  ['YouTube (official broadcaster channels)', 'Live news streams', 'YouTube embedded player terms'],
];

export function openSources() {
  openModal(
    'SOURCES & METHODOLOGY',
    h(
      'div',
      null,
      h('h3', null, 'DATA SOURCES'),
      h('table', null, h('thead', null, h('tr', null, h('th', null, 'SOURCE'), h('th', null, 'USED FOR'), h('th', null, 'TERMS / ATTRIBUTION'))), h('tbody', null, ...SOURCES.map((r) => h('tr', null, ...r.map((c) => h('td', null, c)))))),
      h('p', { class: 'muted', style: 'font-size:12px' }, 'Not used because their licences restrict commercial use: ACLED, Cloudflare Radar API data, TeleGeography cable map, Open-Meteo free API, CoinGecko Demo, Yahoo Finance. Market quotes and internet outages stay switched off until licensed sources are in place.'),
      h('h3', null, 'HOW THE SCORES WORK'),
      h('p', null, h('b', null, 'Country Instability Index (0–100). '), 'A 40/60 blend of a structural baseline (our editorial judgement of long-run risk) and live events: unrest 25%, conflict 30%, security 20% and information 25%. Small capped boosts are added for major earthquakes, disaster alerts, fires and news urgency. Countries in active wars or under do-not-travel advisories have floors so they never look calm during a data gap. Bands: Critical 81+, High 66–80, Elevated 51–65, Normal 31–50, Low 0–30.'),
      h('p', null, h('b', null, 'Threat level (1–5). '), 'Our own roll-up of the five highest instability scores plus active critical signals. It is not DEFCON or any official alert status.'),
      h('p', null, h('b', null, 'Sentiment (0–100). '), 'Average tone of the last 24 hours of coverage (GDELT), 50 = neutral.'),
      h('p', null, h('b', null, 'Convergence. '), 'A 1°×1° cell with three or more different event types in 24 hours. Score = types × 25 + min(25, events × 2).'),
      h('p', null, h('b', null, 'News spikes. '), 'A term with more than 5 mentions in 2 hours, at least 3× its 7-day rate, from 2+ outlets (30-minute cooldown).'),
      h('p', null, h('b', null, 'AI text. '), 'World Brief, country briefs and "what to watch" are written by an AI model from the data shown, with numbered citations. Sentences containing figures that do not appear in the sources are removed automatically. AI output can still be wrong: check the cited sources.'),
      h('h3', null, 'LIMITS'),
      h('p', null, 'Open data has gaps: aircraft that do not broadcast ADS-B are invisible, event geocoding can be imprecise, and some regions are under-reported. Reference layers are simplified and approximate. Country attribution follows internationally recognised borders. Each panel shows how fresh its data is; stale or missing feeds are labelled, never shown as live.'),
      h('p', { style: 'color:#e0b24a' }, 'The Watchtower is for general situational awareness. It is not for operational, safety, travel or investment decisions.'),
      h('p', { class: 'muted', style: 'font-size:12px' }, '© The Arcane Archives. Third-party data remains the property of its owners.'),
    ),
  );
}
