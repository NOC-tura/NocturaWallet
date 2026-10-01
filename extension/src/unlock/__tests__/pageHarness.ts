import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {argon2idAsync} from '@noble/hashes/argon2.js';
import type {Kdf} from '../../vault/envelope';
import type {CredentialsApi} from '../../vault/passkey';
import {VAULT_KEY} from '../../background/accountsStore';
import {handleMessage} from '../../background/messages';
import {fakeDeps, fakeReader} from '../../background/__tests__/fakeDeps';
import {fakeExt} from '../../background/__tests__/fakeExt';
import type {WalletDeps} from '../../background/deps';
import {createPageGate, type PageDeps, type PageTarget} from '../page';
import {backgroundVaultStore} from '../vaultStore';
import type {Send} from '../types';
import {VAULT_PAGE_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
import {fakeTimers} from './fakeTimers';

/**
 * The real unlock.html, in happy-dom: its <body> without the module script. Screen tests run the
 * screen against this markup, so every string they assert is the page's own — static copy from the
 * HTML, state copy set from strings.ts.
 */
export function loadPage(): void {
  const html = readFileSync(join(__dirname, '..', '..', '..', 'unlock.html'), 'utf8');
  const body = /<body>([\s\S]*)<\/body>/.exec(html)?.[1] ?? '';
  document.body.innerHTML = body.replace(/<script\b[\s\S]*?<\/script>/g, '');
}

/** Declares production Argon2id (the envelope refuses less), computes a tiny cost (see envelope.test.ts). */
export const testKdf: Kdf = (pw, salt) => argon2idAsync(pw, salt, {m: 64, t: 1, p: 1, dkLen: 32});
const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
export const UNLOCK_SENDER = {id: 'abcdefghijklmnopabcdefghijklmnop', origin: ORIGIN, url: `${ORIGIN}/unlock.html`};

export interface Harness {
  deps: PageDeps;
  ext: ReturnType<typeof fakeExt>;
  wallet: ReturnType<typeof fakeDeps>;
  timers: ReturnType<typeof fakeTimers>;
  sent: {type: string; [k: string]: unknown}[];
  went: PageTarget[];
  closed: number;
  /** The tab hidden (default), or `pagehide`: runs every `onLeave` callback with that reason. */
  leave(why?: 'hidden' | 'pagehide'): void;
  /** The tab shown again (default), or `restored` from the back/forward cache: runs every `onReturn` callback. */
  back(why?: 'visible' | 'restored'): void;
  /** With `holdSleep`: resolves every pending sleep (the 500 ms floor, a backoff wait). */
  wake(): void;
  /** Lets pending work run until `done()` holds (the page awaits the background and the KDF); fails after 10 s. */
  until(done: () => boolean): Promise<void>;
}

/**
 * A vault page wired to the REAL background (handleMessage over an in-memory storage, fake chain
 * reader), with a manual clock and the page's real gate (createPageGate). `vault` is what v1_vault holds
 * (absent when undefined). `sleep` resolves at once — or, with `holdSleep`, only on `wake()`: the 500 ms
 * floor and the backoff waits are asserted through the clock where a test needs them.
 */
export async function harness(
  o: {vault?: unknown; reader?: Partial<WalletDeps['reader']>; send?: (inner: Send) => Send; credentials?: CredentialsApi; mnemonic?: string; holdSleep?: boolean} = {},
): Promise<Harness> {
  const ext = fakeExt();
  if ('vault' in o && o.vault !== undefined) await ext.local.set(VAULT_KEY, o.vault);
  const wallet = fakeDeps({reader: fakeReader({getBalance: async () => 0n, getTokenAccountsByOwner: async () => [], ...o.reader})});
  const sent: Harness['sent'] = [];
  const inner: Send = async m => {
    sent.push(JSON.parse(JSON.stringify(m)) as {type: string});
    return (await handleMessage(ext, JSON.parse(JSON.stringify(m)), UNLOCK_SENDER, wallet)) as {ok: boolean; error?: string; data?: unknown};
  };
  const outer = o.send === undefined ? inner : o.send(inner);
  // E5's boundary, enforced under every screen test (plan review M5): the page never sends a bare
  // delete — every vault.forgetWallet carries a `replacement` (the seed proof) or the unfunded guard.
  // Checked on the page's own send, before a test's `send` wrapper can answer in the background's place.
  const send: Send = async m => {
    const f = m as {type?: unknown; replacement?: unknown; guard?: unknown};
    if (f.type === 'vault.forgetWallet' && f.replacement === undefined && f.guard !== 'unfunded') throw new Error('forgetWallet without replacement or guard');
    return outer(m);
  };
  const read = () => ext.local.get(VAULT_KEY);
  const timers = fakeTimers();
  const gate = createPageGate();
  const leaves: ((why: 'hidden' | 'pagehide') => void)[] = [];
  const returns: ((why: 'visible' | 'restored') => void)[] = [];
  const sleeping: (() => void)[] = [];
  const h: Harness = {
    ext,
    wallet,
    timers,
    sent,
    went: [],
    closed: 0,
    deps: {
      send,
      store: backgroundVaultStore(send, read),
      kdf: testKdf,
      credentials: o.credentials ?? {create: async () => null, get: async () => null},
      randomBytes: n => crypto.getRandomValues(new Uint8Array(n)),
      newMnemonic: () => o.mnemonic ?? 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art',
      timers,
      sleep: () => (o.holdSleep === true ? new Promise<void>(r => sleeping.push(r)) : Promise.resolve()),
      gate,
      go: t => void h.went.push(t),
      closeTab: () => void (h.closed += 1),
      onLeave: f => void leaves.push(f),
      onReturn: f => void returns.push(f),
    },
    leave: (why = 'hidden') => leaves.forEach(f => f(why)),
    back: (why = 'visible') => returns.forEach(f => f(why)),
    wake: () => sleeping.splice(0).forEach(r => r()),
    until: async done => {
      const end = Date.now() + 10_000;
      while (!done()) {
        if (Date.now() > end) throw new Error('until: timed out');
        await new Promise(r => setTimeout(r, 1));
      }
    },
  };
  return h;
}

/** The visible text of an element, whitespace collapsed. */
export const text = (el: Element | null): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

/** The element by id, typed. */
export const el = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const e = document.getElementById(id);
  if (e === null) throw new Error(`no #${id}`);
  return e as T;
};

/** Is the element shown: neither it nor an ancestor carries `hidden`. */
export function visible(e: Element | null): boolean {
  for (let x = e; x !== null; x = x.parentElement) if ((x as HTMLElement).hidden) return false;
  return e !== null;
}

const SELECTORS = selectorsOf(VAULT_PAGE_SHEETS);
/** Every class on the screen (shown or not) is styled where it stands (src/__tests__/styled.ts). */
export const unstyled = (screenId: string): string[] => unstyledClasses(el(screenId), SELECTORS);

/** Click, typed as a user event. */
export function click(e: HTMLElement): void {
  e.dispatchEvent(new MouseEvent('click', {bubbles: true}));
}

/** Type into a field: set its value and fire `input`. */
export function type(field: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  field.value = value;
  field.dispatchEvent(new Event('input', {bubbles: true}));
}
