import {useEffect, useRef, type ReactNode} from 'react';
import {ExtIcon} from './ExtIcon';

/**
 * The design's bottom sheet (`.s8-sheet`, #43): 70 % of the height at most, a grabber, a title and a
 * close button. Esc, the backdrop and the grabber close it; Tab stays inside it while it is open
 * (focus trap), and focus returns to where it was when it closes.
 */
export function Sheet({title, onClose, children}: {title: string; onClose: () => void; children: ReactNode}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusables = (): HTMLElement[] => Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input, a[href]') ?? []);
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const list = focusables();
      const first = list[0];
      const last = list[list.length - 1];
      if (first === undefined || last === undefined) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      before?.focus();
    };
  }, [onClose]);
  return (
    <div className="app-sheet-layer">
      <div className="s8-sheet-overlay" data-testid="sheet-backdrop" onClick={onClose} />
      <div className="s8-sheet" role="dialog" aria-modal="true" aria-label={title} ref={panel}>
        <button type="button" className="grabber-hit" aria-label="Close" onClick={onClose}>
          <span className="grabber" />
        </button>
        <div className="head">
          <h3>{title}</h3>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <ExtIcon name="close" size={20} />
          </button>
        </div>
        <div className="app-sheet-body">{children}</div>
      </div>
    </div>
  );
}
