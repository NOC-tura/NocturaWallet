import type {Kdf} from '../vault/envelope';
import type {CredentialsApi} from '../vault/passkey';
import {runExclusive, type BusyGate} from './orchestrate';
import type {Send, VaultStore} from './types';

/** The browser timers a screen uses, injectable so the hold, the cooldown and the idle timer are testable. */
export interface Timers {
  now(): number;
  setTimeout(f: () => void, ms: number): number;
  clearTimeout(id: number): void;
  setInterval(f: () => void, ms: number): number;
  clearInterval(id: number): void;
}

const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * Every page this vault page may send the tab to (spec B1b-2a §1.2, §1.6). A closed list: no target is
 * built from data except the resume route, whose one parameter is checked as an address first
 * (resumeTarget). The UI tab's hashes choose a screen and never act.
 */
export type PageTarget =
  | 'unlock.html?mode=welcome'
  | 'unlock.html?mode=unlock'
  | 'unlock.html?mode=forgot'
  | 'unlock.html?mode=import&source=forgot'
  | 'wallet.html#/created'
  | 'wallet.html#/imported'
  | `wallet.html#/send/resume?account=${string}`;

export function resumeTarget(account: string): PageTarget | null {
  return ADDRESS.test(account) ? `wallet.html#/send/resume?account=${account}` : null;
}

/** What every vault-page screen is given: the background, the stored vault, the KDF, the clock and the tab. */
export interface PageDeps {
  send: Send;
  store: VaultStore;
  kdf: Kdf;
  credentials: CredentialsApi;
  randomBytes(n: number): Uint8Array;
  newMnemonic(): string;
  timers: Timers;
  sleep(ms: number): Promise<void>;
  /** One busy flag for the whole page (cardinal rule 6): a passkey prompt and a password submit cannot race. */
  gate: BusyGate;
  /** Same-tab navigation (location.replace): the tab moves on and the page's memory goes with it. */
  go(target: PageTarget): void;
  /** window.close(); the screen hides [Close this tab] if the tab is still here a moment later. */
  closeTab(): void;
  /** pagehide, and visibilitychange to hidden: where a screen drops what it holds (spec §3.5 memory rule). */
  onLeave(f: () => void): void;
}

/** Rule 6 for the vault page (spec §7.6): the gate is held at least this long after a click. */
export const LOCK_MS = 500;

/**
 * Runs a page action under the page's one busy gate, held until the action settles AND at least
 * LOCK_MS have passed (spec §7.6: "the existing runExclusive gate plus the same 500 ms floor"). The
 * gate is taken synchronously, before the first await, so a second click in the same frame is
 * refused. `render` runs when the gate is taken and when it is released: a screen derives every
 * button's `disabled` from its own state and `gate.isBusy()`.
 */
export function exclusive<T>(deps: Pick<PageDeps, 'gate' | 'sleep'>, render: () => void, action: () => Promise<T>): Promise<T | 'busy'> {
  return runExclusive(deps.gate, async () => {
    const floor = deps.sleep(LOCK_MS);
    render();
    try {
      return await action();
    } finally {
      await floor;
    }
  }).finally(render);
}

/** How long to wait before deciding the browser refused window.close() (the tab is still alive). */
export const CLOSE_CHECK_MS = 500;
