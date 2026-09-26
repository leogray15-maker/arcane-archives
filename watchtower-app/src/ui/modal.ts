import { h, ICONS, svg } from '../lib/dom';

/** Opens an accessible modal; returns a close function. */
export function openModal(title: string, body: Node, opts: { className?: string; onClose?: () => void; bare?: boolean } = {}) {
  const prev = document.activeElement as HTMLElement | null;
  const scrim = h('div', { class: 'wt-scrim' });
  const closeBtn = h('button', { class: 'wt-panel-collapse', 'aria-label': 'Close' });
  closeBtn.appendChild(svg(ICONS.close));
  const modal = h(
    'div',
    { class: `wt-modal ${opts.className ?? ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    opts.bare ? null : h('div', { class: 'wt-modal-head' }, h('span', null, title), h('span', { style: 'flex:1' }), closeBtn),
    opts.bare ? body : h('div', { class: 'wt-modal-body' }, body),
  );
  const close = () => {
    scrim.remove();
    modal.remove();
    document.removeEventListener('keydown', onKey, true);
    opts.onClose?.();
    prev?.focus?.();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab') {
      const f = modal.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,select,[tabindex]:not([tabindex="-1"])');
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  scrim.addEventListener('click', close);
  closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', onKey, true);
  document.body.append(scrim, modal);
  requestAnimationFrame(() => (modal.querySelector<HTMLElement>('input,button,a[href]') ?? modal).focus());
  return close;
}
