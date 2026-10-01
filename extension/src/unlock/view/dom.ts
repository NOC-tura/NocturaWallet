/**
 * The vault page's own DOM helpers (spec B1b-2a §1.2 item 2, S1): no React, no UI kit — the page that
 * holds the seed stays small. Text is only ever set with textContent (a gate forbids innerHTML and its
 * kin in src/unlock), so nothing the page shows can become markup.
 */

/** An element of unlock.html by id; a missing one is a bug in the page, never a state. */
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (el === null) throw new Error(`unlock.html has no #${id}`);
  return el as T;
}

/** A new element with its classes and, optionally, its text. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text?: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (cls !== '') el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
}

export function setText(el: Element, text: string): void {
  el.textContent = text;
}

export function shown(el: HTMLElement, on: boolean): void {
  el.hidden = !on;
}

/** The vault page's screens: one <section> each, under main#vault. */
export const SCREENS = [
  'v-welcome',
  'v-intro',
  'v-seed',
  'v-confirm',
  'v-password',
  'v-passkey',
  'v-import',
  'v-retry',
  'v-unlock',
  'v-forgot',
  'v-reauth',
  'v-accounts',
  'v-reveal',
] as const;
export type ScreenId = (typeof SCREENS)[number];

/** Shows one screen and hides the others; the tab starts it at the top. */
export function showScreen(id: ScreenId): void {
  for (const s of SCREENS) {
    const el = document.getElementById(s);
    if (el !== null) el.hidden = s !== id;
  }
  if (typeof window.scrollTo === 'function') window.scrollTo(0, 0);
}

/**
 * Closes the tab, or — when the browser refuses (a tab it did not open) — hides the button that offered
 * it. `check` runs after the delay the caller gives: the page is still here, so the close was refused.
 */
export function closeOrHide(close: () => void, later: (f: () => void) => void, button: HTMLElement): void {
  close();
  later(() => {
    button.hidden = true;
  });
}
