// Live news streams and webcams — edit here. Only official channels that allow
// embedding, loaded with YouTube's privacy-enhanced embed and only on click.
// Channel IDs were written from memory in an offline build: confirm each one
// plays before launch (RUNBOOK.md › "Media embeds").

export interface Stream {
  id: string;
  name: string;
  /** Label on the channel tab */
  short: string;
  /** YouTube channel ID; the embed plays that channel's current live stream */
  channel: string;
}

export const LIVE_NEWS: Stream[] = [
  { id: 'aljazeera', name: 'Al Jazeera English', short: 'Al Jazeera', channel: 'UCNye-wNBqNL5ZzHSJj3l8Bg' },
  { id: 'dw', name: 'DW News', short: 'DW', channel: 'UCknLrEdhRCp1aegoMqRaCZg' },
  { id: 'france24', name: 'France 24 English', short: 'France 24', channel: 'UCQfwfsi5VrQ8yKZ-UWmAEFg' },
  { id: 'sky', name: 'Sky News', short: 'Sky News', channel: 'UCoMdktPbSTixAyNGwb-UYkQ' },
  { id: 'euronews', name: 'Euronews', short: 'Euronews', channel: 'UCSrZ3UV4jOidv8ppoVuvW9Q' },
  { id: 'bloomberg', name: 'Bloomberg Television', short: 'Bloomberg', channel: 'UCIALMKvObZNtJ6AmdCLP7Lg' },
];

export const WEBCAM_REGIONS = ['MIDEAST', 'EUROPE', 'AMERICAS', 'ASIA', 'AFRICA', 'SPACE'] as const;
export type WebcamRegion = (typeof WEBCAM_REGIONS)[number];

export interface Webcam {
  id: string;
  name: string;
  city: string;
  region: WebcamRegion;
  /** YouTube video ID of a permanent live stream, or a channel ID (prefix "channel:") */
  youtube: string;
}

/** Add publicly embeddable city cams here (official operators only). Left empty
 *  rather than guessing IDs offline — the panel explains how to add them. */
export const WEBCAMS: Webcam[] = [];

export function embedUrl(yt: string, opts: { muted?: boolean; api?: boolean } = {}) {
  const q = `autoplay=1&mute=${opts.muted === false ? 0 : 1}&rel=0&playsinline=1${opts.api ? '&enablejsapi=1' : ''}`;
  return yt.startsWith('channel:')
    ? `https://www.youtube-nocookie.com/embed/live_stream?channel=${encodeURIComponent(yt.slice(8))}&${q}`
    : `https://www.youtube-nocookie.com/embed/${encodeURIComponent(yt)}?${q}`;
}
