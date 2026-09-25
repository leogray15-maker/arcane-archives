// One shared tooltip for [data-tip] elements (hover + keyboard focus).
let tip: HTMLDivElement | null = null;

function show(target: HTMLElement) {
  const text = target.dataset.tip;
  if (!text) return;
  tip ??= Object.assign(document.createElement('div'), { className: 'wt-tip', role: 'tooltip' });
  tip.textContent = text;
  document.body.appendChild(tip);
  const r = target.getBoundingClientRect();
  const tw = Math.min(300, window.innerWidth - 16);
  let left = r.left + r.width / 2 - tw / 2;
  left = Math.max(8, Math.min(window.innerWidth - tw - 8, left));
  tip.style.maxWidth = `${tw}px`;
  tip.style.left = `${left}px`;
  const below = r.bottom + 8;
  tip.style.top = `${below}px`;
  requestAnimationFrame(() => {
    if (!tip) return;
    const th = tip.getBoundingClientRect().height;
    if (below + th > window.innerHeight - 8) tip.style.top = `${Math.max(8, r.top - th - 8)}px`;
  });
}

function hide() {
  tip?.remove();
}

export function installTooltips() {
  const find = (e: Event) => (e.target as HTMLElement | null)?.closest?.('[data-tip]') as HTMLElement | null;
  document.addEventListener('mouseover', (e) => {
    const t = find(e);
    if (t) show(t);
  });
  document.addEventListener('mouseout', (e) => {
    if (find(e)) hide();
  });
  document.addEventListener('focusin', (e) => {
    const t = find(e);
    if (t) show(t);
  });
  document.addEventListener('focusout', hide);
  document.addEventListener('scroll', hide, true);
}
