// Tiny DOM helpers — no framework.
type Child = Node | string | number | null | undefined | false | Child[];
type Attrs = Record<string, unknown> & { class?: string; style?: string | Partial<CSSStyleDeclaration> };

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs | null = null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = String(v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      else if (k === 'dataset' && typeof v === 'object') Object.assign(el.dataset, v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    }
  }
  append(el, children);
  return el;
}

export function append(el: Node, children: Child[]) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  }
}

export function svg(markup: string): SVGElement {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.firstElementChild as SVGElement;
}

export function clear(el: Element) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function replaceChildren(el: Element, ...children: Child[]) {
  clear(el);
  append(el, children);
}

export function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Only allow http(s) links from data into href attributes. */
export function safeUrl(u: string | undefined | null): string | undefined {
  if (!u) return undefined;
  try {
    const url = new URL(u, location.href);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function debounce<T extends (...a: any[]) => void>(fn: T, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...a: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function lsGet<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}

export function lsSet(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(msg: string, ms = 2600) {
  document.querySelector('.wt-toast')?.remove();
  const el = h('div', { class: 'wt-toast', role: 'status' }, msg);
  document.body.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), ms);
}

export const ICONS = {
  logo: `<svg width="26" height="24" viewBox="0 0 26 24" aria-hidden="true"><path d="M13 2 L24 22 L2 22 Z" fill="none" stroke="#a78bfa" stroke-width="1.6" stroke-linejoin="round"/><path d="M13 9 L18.5 19 L7.5 19 Z" fill="#8b7cf6" opacity=".35"/><circle cx="13" cy="15.5" r="1.6" fill="#e9e6f2"/></svg>`,
  search: `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M20 20 L16 16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  panel: `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15 4 V20" stroke="currentColor" stroke-width="2"/></svg>`,
  layers: `<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 L21 8 L12 13 L3 8 Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M3 13 L12 18 L21 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`,
  home: `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>`,
  chevron: `<svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9 L12 15 L18 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  close: `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6 L18 18 M18 6 L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  play: `<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5 L19 12 L8 19 Z" fill="currentColor"/></svg>`,
  expand: `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9 V4 H9 M15 4 H20 V9 M20 15 V20 H15 M9 20 H4 V15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  star: `<svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 l2.7 5.6 6.1 .9 -4.4 4.3 1 6.1 -5.4 -2.9 -5.4 2.9 1 -6.1 -4.4 -4.3 6.1 -.9 Z" fill="var(--fill, none)" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
  mute: `<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9 h4 l5 -4 v14 l-5 -4 h-4 Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M17 9 l5 6 M22 9 l-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  sound: `<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9 h4 l5 -4 v14 l-5 -4 h-4 Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M17 8 q3 4 0 8 M19.5 5.5 q5 6.5 0 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  grid: `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4 h7 v7 h-7 Z M13 4 h7 v7 h-7 Z M4 13 h7 v7 h-7 Z M13 13 h7 v7 h-7 Z" fill="currentColor"/></svg>`,
  single: `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="6" width="16" height="12" rx="1" fill="currentColor"/></svg>`,
  share: `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12 v7 h16 v-7 M12 3 v12 M7 8 l5 -5 l5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};
