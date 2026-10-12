import {useEffect, useRef, type ReactNode, type RefObject} from 'react';
import {ExtIcon} from './ExtIcon';

/**
 * The modal behavior every sheet (and, since Task 10 fix round 1, #49c's own-skinned dialog) shares: Esc closes it,
 * Tab stays inside it while it is open (a focus trap), the focus goes to the element marked `data-autofocus` when the
 * panel has one (B1b-2b's contact sheet: the name field) — React's own autoFocus would run before this effect and be
 * overridden — else its first control; `focusControl` false (the approval window's 2-second confirm, C15: no control
 * focused when it opens) puts it on the panel itself instead. Focus returns to where it was before the sheet opened,
 * when it closes. A control the sheet's own request disables while focused (the contact sheet's Cancel, Keep and Save
 * while a save or delete is out) keeps the panel focused instead of losing it to `<body>` (Chromium, Task 10 fix round
 * 0b, C1), and gets it back once enabled again — unless the focus moved on meanwhile.
 *
 * Runs once, on mount (B1b-2b plan 2 review H1): the latest `onClose` is held in a ref, as useEscape holds its
 * handler. Every caller passes an inline `onClose`, and the screen under a sheet re-renders on its own clock (#20
 * every second) — an effect keyed on `onClose` re-ran each time, pulled the focus back to `data-autofocus` and so
 * typed the rest of a name into #15's address field. The caller's panel needs `tabIndex={-1}` (the `focusControl`
 * false case, and the disabled-focus rescue, both focus the panel itself).
 */
export function useSheetFocus(panel: RefObject<HTMLElement | null>, onClose: () => void, focusControl = true): void {
  const close = useRef(onClose);
  close.current = onClose;
  // Read once, on mount, like everything the effect below uses.
  const focusFirst = useRef(focusControl);
  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusables = (): HTMLElement[] => Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input, a[href]') ?? []);
    if (focusFirst.current) (panel.current?.querySelector<HTMLElement>('[data-autofocus]') ?? focusables()[0])?.focus();
    else panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const list = focusables();
      const first = list[0];
      const last = list[list.length - 1];
      if (first === undefined || last === undefined) return;
      const at = document.activeElement;
      // From the panel itself (a control disabled under the focus) or from outside it, Tab enters the sheet, never the
      // screen behind the modal (Task 10 fix round 0b, C1).
      if (at === panel.current || at === null || !(panel.current?.contains(at) ?? false)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && at === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && at === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    /*
     * Task 10 fix round 0b (C1): a focused control the sheet's own request disables (the contact sheet's Cancel, Keep and
     * Save while a save or delete is out) drops the focus to <body> in Chromium — out of the modal. The panel (tabindex
     * -1) takes it instead, and the control gets it back when it is enabled again (a failed answer), unless the focus
     * has moved on meanwhile. The last control focused inside is tracked; `disabled` changes are watched.
     */
    const el = panel.current;
    let held: HTMLElement | null = null;
    const onFocusIn = (e: FocusEvent) => {
      if (e.target instanceof HTMLElement && e.target !== el) held = e.target;
    };
    el?.addEventListener('focusin', onFocusIn);
    const watch = new MutationObserver(records => {
      for (const r of records) {
        if (r.target !== held || !(r.target instanceof HTMLButtonElement || r.target instanceof HTMLInputElement)) continue;
        const at = document.activeElement;
        if (r.target.disabled) {
          if (at === r.target || at === null || at === document.body) el?.focus();
        } else if (at === el) r.target.focus();
      }
    });
    if (el !== null) watch.observe(el, {subtree: true, attributes: true, attributeFilter: ['disabled']});
    return () => {
      watch.disconnect();
      el?.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('keydown', onKey);
      before?.focus();
    };
  }, []);
}

/**
 * The design's bottom sheet (`.s8-sheet`, #43): 70 % of the height at most, a grabber, a title and a close button. The
 * backdrop and the grabber close it too; Esc, the focus trap and the focus restore are `useSheetFocus` above. `tall`:
 * the panel may take the popup's height but 48 px (the contact sheet: a full address, its warnings, a field and three
 * buttons do not fit the design's 70 % at 412 × 600, and a scrolled panel hid the address it saves).
 */
export function Sheet({title, onClose, children, tall = false, focusControl = true}: {title: string; onClose: () => void; children: ReactNode; tall?: boolean; focusControl?: boolean}) {
  const panel = useRef<HTMLDivElement>(null);
  useSheetFocus(panel, onClose, focusControl);
  return (
    <div className="app-sheet-layer">
      <div className="s8-sheet-overlay" data-testid="sheet-backdrop" onClick={onClose} />
      <div className={tall ? 's8-sheet app-sheet-tall' : 's8-sheet'} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={panel}>
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
