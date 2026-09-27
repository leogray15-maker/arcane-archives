# Watchtower methodology

How the Watchtower turns raw feeds into scores, in plain language. The weights
and lists live in config files, so they can be changed without touching code.

The Watchtower is for general situational awareness. **It is not for
operational, safety, travel or investment decisions.**

## Principles

- **Only show live data as live.** Every panel carries a freshness badge. When a
  source fails, the last good data stays, labelled STALE with its age; nothing
  is simulated. A derived score is not refreshed when its inputs are missing.
- **Separate volume from severity.** A country being in the news a lot doesn't
  make it unstable. Heavily covered countries get a dampening multiplier, and
  news counts are log-scaled.
- **Never let a data gap look like calm.** Countries in active wars or under
  do-not-travel advisories have floors.
- **Neutral attribution.** Country attribution follows internationally
  recognised (UN) borders. For example, events in Crimea count for Ukraine and
  events in Gaza for Palestine, even where the base map geometry draws them
  otherwise.

## Signal aggregator

Every live event becomes one **Signal** with a type, severity
(low / elevated / high / critical), location, country, region, time, source and
evidence:

| Type | Becomes a signal when | Severity |
|---|---|---|
| Earthquake | M5+ in 24h, or USGS "significant" | M7+ critical, M6+ high, M5.5+ elevated; +1 level for a tsunami flag or PAGER orange/red |
| Disaster (GDACS) | Orange or red alert | red → critical, orange → high |
| Natural event (EONET) | Open, updated in the last 3 days | storms/volcanoes elevated, others low |
| Wildfires (FIRMS) | 50+ high-confidence detections in a country in 24h | 500+ high, 150+ elevated |
| Conflict / protest (GDELT) | One event with 20+ mentions (or violence with 10+), or 4+ events in a country | by mentions / event count |
| Military air (adsb.lol) | 4+ military aircraft within one 5° cell | 15+ high, 8+ elevated |
| News spike | See below | ratio ≥ 6× or 15+ mentions → high |
| Convergence | See below | critical / high |
| Anomaly | See below | by z-score |

Signals are clustered by country and by region (our own region boxes in
`lib/watchtower/config/geo-areas.ts`).

## Country Instability Index (0–100)

For the countries listed in `lib/watchtower/config/cii.ts` (currently 35):

```
event    = Unrest × 0.25 + Conflict × 0.30 + Security × 0.20 + Information × 0.25
combined = Baseline × 0.40 + event × 0.60 + boosts
score    = max(combined, floor), limited to 0–100
```

- **Baseline:** our editorial estimate of long-run structural risk
  (governance, conflict history, fragility). It is reviewed monthly.
- **Unrest:** GDELT protest events in the country (each weighted by the log of
  its mention count), plus headlines about protests, riots or crackdowns.
- **Conflict:** GDELT violence, fighting and coercion events, log-weighted by
  mentions.
- **Security:** military aircraft over the country plus military-posture
  events.
- **Information:** headlines geo-tagged to the country in the last 24h,
  weighted by source tier and by how negative their tone is.
- Each component is multiplied by the country's **multiplier**, which dampens
  heavily covered countries, and capped at 100.
- **Boosts** (each capped): major earthquakes (≤20), GDACS alerts (≤12), wildfire
  activity (≤6), internet outages (≤8, currently 0: no licensed source), news
  urgency and spikes (≤5).
- **Floors:** a configured floor for active wars and do-not-travel advisories,
  or one derived from UCDP over two years (more than 1,000 deaths or 100 events
  → 70; more than 10 events → 50), whichever is higher.
- **Bands:** Critical 81+, High 66–80, Elevated 51–65, Normal 31–50, Low 0–30.
- **History:** an hourly sample kept for 30 days. The 24h arrow compares with
  the sample nearest to 24 hours ago (within ±3h). The sparkline shows one point
  per day.

## Geographic convergence

The last 24h of located events (protest, violence, military event, military
air, seismic, natural, wildfire) are binned into 1°×1° cells. A cell with **three
or more different types** raises an alert:

```
score = min(100, types × 25 + min(25, events × 2))
priority = critical if 4+ types or score ≥ 90, otherwise high
```

A cell is named after the nearest hotspot or chokepoint within 350 km, otherwise
the country, otherwise its coordinates.

## Keyword spike detection

Headlines are split into content words, plus a short list of multi-word names.
Hourly buckets of term counts are kept for 8 days. A term **fires** when, in the
last 2 hours:

- it has **more than 5 mentions**,
- that is **at least 3× its 7-day average** for a 2-hour window,
- it comes from **at least 2 different outlets**, and
- it hasn't fired in the last **30 minutes**.

Until 24 hours of history exist, the detector is in learning mode and fires
nothing.

## Headline ranking

Headlines that share more than 60% of their content words (measured against the
shorter headline) are treated as one story. Each story scores:

- **source tier:** tier 1 +35, tier 2 +20, tier 3 +8;
- **corroboration:** +12 per distinct outlet, up to 6;
- **topic groups:** violence (+50, +12 per keyword), military (+40, +10),
  unrest (+35, +9), diplomacy (+35, +9), crisis (+15, +5);
- **recency:** a linear decay to half value at 16 hours, floored at half;
- **noise demotion:** business and celebrity stories with no topic keywords are
  multiplied by 0.35.

## Anomaly baselines

For each event type × region × weekday we keep a running mean and variance
(Welford's method), adding one daily count per combination. Today's rolling 24h
count is compared with that weekday's baseline:

z ≥ 1.5 → elevated, ≥ 2 → high, ≥ 3 → critical. Nothing is reported until a
combination has **at least 10 samples**, which means about ten weeks per
weekday.

## Header metrics

- **Threat level (1–5)** is our own roll-up, **not DEFCON or any official
  status**. It is the mean of the five highest CII scores × 0.85, plus 5 per
  critical signal in the last 24h (up to 15). Levels: ≥80 → 5, ≥65 → 4,
  ≥50 → 3, ≥35 → 2, otherwise 1.
- **Sentiment (0–100, 50 = neutral)** is the GDELT average tone for the last
  24h mapped as 50 + tone × 5. The arrow compares with the 24h before. If GDELT
  is unavailable, our headline word list is used instead (50 + tone × 40).

## Chokepoints and strategic posture

- **Chokepoints:** conflict or military events and disaster alerts within each
  strait's radius, military aircraft in the area, and 24h headlines naming the
  chokepoint. The status is DISRUPTED for 3+ kinetic events, 5+ headlines about
  disruption, or a red alert; ELEVATED for 2+ signals, 2+ disruption headlines
  or 6+ mentions; otherwise NORMAL.
- **Strategic posture** (Iran/Gulf, Taiwan Strait, Baltic, Black Sea, Korean
  Peninsula, Red Sea): military aircraft in the theatre box, high or critical
  signals there, and the highest CII of adjacent countries. CRITICAL at 25+
  aircraft, 2+ critical signals, or 12+ aircraft with a CII of 80+; ELEVATED
  at 8+ aircraft, 2+ high signals or a CII of 66+.

## AI text

Groq is used first, with OpenRouter as fallback, always server-side:

- The World Brief runs every ~2h from the top-ranked headlines. It is cached
  for 24h by headline set.
- Country briefs are generated on click and cached per country for 2h.
- "What to watch" runs every ~6h.

The prompts require neutral, attributed language, citations for every factual
sentence, no numbers except those given, and a plain statement when data is
thin. After generation, a guard removes:

- citations to sources that don't exist,
- sentences without a citation (unless they say the data is thin),
- any sentence containing a number that doesn't appear in the inputs.

Spending has a hard monthly cap, a global per-minute throttle and a per-member
daily limit on new country briefs.

## Known limits

- Open ADS-B only shows aircraft that broadcast. Many military flights don't.
- GDELT geocoding is automated and imperfect, and some regions are
  under-reported in English-language media.
- The base map is Natural Earth 110m, which is coarse. Its drawn borders for
  some disputed or occupied areas (e.g. Crimea) don't match the recognised
  borders used for attribution. Replace it with a point-of-view Natural Earth
  build if that matters for the map outline too.
- Reference datasets are simplified and marked approximate until reviewed.
- The CII countries, baselines and floors are editorial choices and should be
  reviewed monthly.
