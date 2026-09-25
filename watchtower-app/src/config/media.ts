// Live news streams and webcams — edit here. Only official channels that allow
// embedding, loaded with YouTube's privacy-enhanced embed and only on click.
// Channel IDs were written from memory in an offline build: confirm each one
// plays before launch (RUNBOOK.md › "Media embeds").

export interface Stream {
  id: string;
  name: string;
  /** YouTube channel ID; the embed plays that channel's current live stream */
  channel: string;
}

export const LIVE_NEWS: Stream[] = [
  { id: 'aljazeera', name: 'Al Jazeera English', channel: 'UCNye-wNBqNL5ZzHSJj3l8Bg' },
  { id: 'dw', name: 'DW News', channel: 'UCknLrEdhRCp1aegoMqRaCZg' },
  { id: 'france24', name: 'France 24 English', channel: 'UCQfwfsi5VrQ8yKZ-UWmAEFg' },
  { id: 'sky', name: 'Sky News', channel: 'UCoMdktPbSTixAyNGwb-UYkQ' },
  { id: 'euronews', name: 'Euronews', channel: 'UCSrZ3UV4jOidv8ppoVuvW9Q' },
  { id: 'bloomberg', name: 'Bloomberg Television', channel: 'UCIALMKvObZNtJ6AmdCLP7Lg' },
];

export interface Webcam {
  id: string;
  name: string;
  city: string;
  /** YouTube video ID of a permanent live stream, or a channel ID (prefix "channel:") */
  youtube: string;
}

/** Add publicly embeddable city cams here (official operators only). Left empty
 *  rather than guessing IDs offline — the panel explains how to add them. */
export const WEBCAMS: Webcam[] = [];

export const embedUrl = (yt: string) =>
  yt.startsWith('channel:')
    ? `https://www.youtube-nocookie.com/embed/live_stream?channel=${encodeURIComponent(yt.slice(8))}&autoplay=1&mute=1&rel=0`
    : `https://www.youtube-nocookie.com/embed/${encodeURIComponent(yt)}?autoplay=1&mute=1&rel=0`;
