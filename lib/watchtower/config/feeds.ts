// Curated RSS list — edit here to add/remove outlets.
//   tier: 1 = major international outlet with strong corrections record,
//         2 = specialist / regional outlet, 3 = aggregator or niche.
//   ownership: 'private' | 'public-broadcaster' (publicly funded, editorially
//         independent charter) | 'state' (state-owned or state-directed).
// Use policy (SOURCES.md): we store and show headline + link + outlet name only,
// never article text, and always link to the publisher.
//
// Not available: Reuters (ended public RSS in 2020) and AP (no official public
// RSS). Their stories reach the Watchtower through GDELT's article index.

export interface RssFeed {
  id: string;
  name: string;
  url: string;
  tier: 1 | 2 | 3;
  ownership: 'private' | 'public-broadcaster' | 'state';
  enabled: boolean;
}

export const RSS_FEEDS: RssFeed[] = [
  { id: 'bbc-world', name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', tier: 1, ownership: 'public-broadcaster', enabled: true },
  { id: 'guardian-world', name: 'Guardian World', url: 'https://www.theguardian.com/world/rss', tier: 1, ownership: 'private', enabled: true },
  { id: 'dw-world', name: 'DW', url: 'https://rss.dw.com/rdf/rss-en-world', tier: 1, ownership: 'public-broadcaster', enabled: true },
  { id: 'france24', name: 'France 24', url: 'https://www.france24.com/en/rss', tier: 1, ownership: 'public-broadcaster', enabled: true },
  { id: 'npr-world', name: 'NPR World', url: 'https://feeds.npr.org/1004/rss.xml', tier: 1, ownership: 'public-broadcaster', enabled: true },
  { id: 'aljazeera', name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', tier: 2, ownership: 'state', enabled: true },
  { id: 'defense-news', name: 'Defense News', url: 'https://www.defensenews.com/arc/outboundfeeds/rss/?outputType=xml', tier: 2, ownership: 'private', enabled: true },
  { id: 'bellingcat', name: 'Bellingcat', url: 'https://www.bellingcat.com/feed/', tier: 2, ownership: 'private', enabled: true },
  { id: 'un-news', name: 'UN News', url: 'https://news.un.org/feed/subscribe/en/news/all/rss.xml', tier: 2, ownership: 'public-broadcaster', enabled: true },
];
