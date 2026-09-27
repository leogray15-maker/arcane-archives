# Watchtower data sources

Every upstream the Watchtower uses, with its licence and terms for a **paid
commercial product**, the attribution we show, rate limits and whether a key is
needed. The browser never calls these directly: seed jobs fetch them on the
server and write to Redis (see README.md).

**Verdicts:** ✅ usable commercially with the noted conditions · ⚠️ usable under a
stated policy · ⛔ not used (commercial use restricted).

The terms were checked on 2026-09-25 from the providers' published terms pages.
Terms change, so re-check before adding a source or on the yearly review in
RUNBOOK.md.

## Live feeds (in use)

| Source | Used for | Licence / terms | Attribution we show | Key | Rate / etiquette | Verdict |
|---|---|---|---|---|---|---|
| **USGS Earthquake Hazards Program** GeoJSON summary feeds (`4.5_day`, `significant_week`) | Seismic layer, Seismic Watch, CII boosts | US Government work, public domain | "USGS" | No | Feeds regenerate every minute; we poll every 5 minutes | ✅ |
| **NASA EONET v3** | Natural events | NASA data, not copyrighted; NASA asks for credit | "NASA EONET" | No | Polite use; every 30 minutes | ✅ |
| **GDACS** (EC JRC / UN OCHA) event API | Disaster alerts (orange/red), cyclones | **CC BY 4.0**; GDACS asks users not to sensationalise | "GDACS" | No | GDACS recommends polling every 10–15 minutes; we use 15 | ✅ |
| **NASA FIRMS** (VIIRS S-NPP NRT, LANCE) | Wildfires layer, CII boost | NASA open data; cite FIRMS/LANCE | "NASA FIRMS" | **MAP_KEY** (free) | 5,000 transactions per 10 minutes; a world/1-day CSV counts as several. Hourly | ✅ |
| **GDELT 2.0** event export (15-minute files) and DOC API (tone) | Conflict and protest events, sentiment | "Unlimited and unrestricted use for any academic, commercial, or governmental use"; **must cite GDELT and link to gdeltproject.org** | "GDELT Project" plus a link | No | Every 15 minutes (their update cadence) | ✅ |
| **UCDP GED** (Uppsala) | Historical conflict floors for CII | **CC BY 4.0**; cite UCDP | "UCDP, Uppsala University" | **Token** (by email, 3–5 working days) | Daily | ✅ |
| **CelesTrak** GP data (TLE) | Satellites (propagated in the browser) | Free public data; credit CelesTrak | "CelesTrak" | No | **Strict: one download per group per update (~2h), otherwise 403 or an IP block.** We fetch every 3 hours and reuse the last copy on 403 | ✅ |
| **adsb.lol** API (`/v2/mil`) | Military aircraft | **ODbL 1.0**. Attribution is required. Share-alike applies only if we publicly redistribute a derived *database*; map display is a "Produced Work" | "Aircraft data: adsb.lol (ODbL)" | No (for now) | Dynamic limits; every 5 minutes | ✅ |
| **FRED** (St. Louis Fed) | Macro tab | FRED API terms; **only public-domain US series** (Fed Board, BLS, EIA, St. Louis Fed). Third-party copyrighted series are excluded | "FRED, Federal Reserve Bank of St. Louis" plus each series' source | **API key** (free) | 120 requests a minute; daily | ✅ |
| **Publisher RSS** (list in `lib/watchtower/config/feeds.ts`) | Live news, ranking, spikes, AI brief input | Publisher terms vary. **Our policy: store and show headline + link + outlet name only, never article text; always link to the publisher.** | Outlet name on every item | No | Every 15 minutes with conditional GET (ETag / Last-Modified) | ⚠️ (see note) |
| **YouTube** official embedded player | Live news streams, webcams | YouTube API Services terms allow the official embedded player; the channel must allow embedding | Channel shown in player | No | Loaded only on click | ✅ |

**RSS note:** BBC, Guardian, DW, France 24, NPR, Al Jazeera, Defense News,
Bellingcat and UN News publish public RSS feeds intended for syndication of
headlines and links. Showing a headline with a link back is standard practice,
but it isn't an explicit commercial licence. If a publisher objects, set
`enabled: false` on its entry in `feeds.ts`.

**Reuters** ended its public RSS in 2020 and **AP** has no official public RSS.
Neither is fetched directly; their stories reach us only as article links
inside GDELT.

## Static reference datasets (`data/watchtower/*.v1.json`)

These are built by us, with one citation per entry. The files are served only
through the gated API.

| Dataset | Built from | Licence notes | Verdict |
|---|---|---|---|
| Country shapes | Natural Earth 110m via the `world-atlas` npm package | Public domain | ✅ |
| Globe texture | NASA Visible Earth "Blue Marble" (copy distributed with the `three-globe` examples, MIT), resized | NASA imagery isn't copyrighted; credit NASA | ✅ |
| Night sky | Procedurally generated in the browser | Our own work | ✅ |
| 2D basemap | Natural Earth shapes (default); OpenFreeMap (opt-in) | Public domain; OpenFreeMap is free including commercial use, © OpenStreetMap contributors (ODbL) | ✅ |
| Military bases | Wikipedia articles and government pages, **facts only** (name, operator, location) | Facts aren't copyrightable; no Wikipedia prose copied | ✅ |
| Nuclear power plants | IAEA PRIS + Wikipedia | IAEA terms allow use "in commercial and non-commercial products" with acknowledgement and no implied endorsement | ✅ |
| Other nuclear facilities, spaceports | Wikipedia / public government sources | Facts only | ✅ |
| AI data centres | Company announcements (cited via Wikipedia pages summarising them) | Facts only | ✅ |
| Undersea cables | **Hand-built simplified routes** of 15 major systems | Our own drawing from public landing-point information | ✅ |
| Pipelines | **Hand-built simplified routes** of 17 major pipelines | Our own drawing. Global Energy Monitor data (CC BY 4.0) can replace it later | ✅ |
| Chokepoints, intel hotspots | Hand-built | Our own work | ✅ |

**Accuracy flag:** the build container for this release couldn't reach these
sites, so coordinates and citation URLs were written from public knowledge.
The datasets are marked `"approximate": true` until someone checks each entry
against its cited page (RUNBOOK.md › "Refreshing reference data").

## Sources not used (commercial use restricted)

| Source | Why not | What we do instead |
|---|---|---|
| **ACLED** | Its EULA forbids incorporating the data "in a product for sale or use by a commercial entity for situational awareness" without a written Commercial License | GDELT for real-time events, UCDP for the baseline. Ask ACLED for a quote if you want it |
| **Cloudflare Radar** API | Radar API data is **CC BY-NC 4.0 (non-commercial)**; only the embeddable graphs are CC BY 4.0 | The Internet Outages layer ships switched off with "Licence pending". Options: ask radar@cloudflare.com for permission, or evaluate IODA (Georgia Tech) after checking its terms |
| **TeleGeography Submarine Cable Map** | **CC BY-NC-SA 3.0 (non-commercial)** | Hand-built simplified cable set |
| **Open-Meteo** free API | The free API is non-commercial only (commercial plans start at $29/month) | GDACS cyclones and alerts |
| **CoinGecko** Demo plan | The Demo plan carries no commercial licence (paid plans start around $35/month) | Crypto quotes are off until a licensed provider is chosen |
| **Yahoo Finance** (unofficial endpoints used by the current dashboard ticker) | Yahoo's terms prohibit this use; not an API product | Market quotes are off in the drawer; no simulated fallback |
| **World Monitor** (koala73/worldmonitor) | AGPL-3.0; clean-room rule | Only its public docs were read, for concepts and published formulas. No code, CSS, config or data files were used |

## Attribution in the product

The **Sources & Methodology** modal (footer link) lists every source above with
its credit line. The map shows "Imagery: NASA Blue Marble" (3D) or the basemap
credit (2D). Aircraft popovers name adsb.lol (ODbL), and news items always name
the outlet.
