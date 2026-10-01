// @vitest-environment happy-dom
import {base64} from '@scure/base';
import {addPasskeyWrap, createEnvelope, unlockWithPassword, type EnvelopeV1} from '../../vault/envelope';
import {evaluatePrf} from '../../vault/passkey';
import type {CredentialsApi} from '../../vault/passkey';
import {getSession} from '../../background/session';
import {VAULT_KEY} from '../../background/accountsStore';
import {pageMode} from '../mode';
import {CLOSE_CHECK_MS} from '../page';
import {mountUnlock} from '../screens/unlock';
import {click, el, harness, loadPage, testKdf, text, type, unstyled, visible} from './pageHarness';

// The PRF output evaluatePrf hands the screen is key material (spec §2): every one it returns is recorded so a test
// can see it zeroed on every path. Every call runs the real code.
const prfOutputs: Uint8Array[] = [];
vi.mock('../../vault/passkey', async importOriginal => {
  const actual = await importOriginal<typeof import('../../vault/passkey')>();
  return {
    ...actual,
    evaluatePrf: vi.fn(async (...a: Parameters<typeof actual.evaluatePrf>) => {
      const out = await actual.evaluatePrf(...a);
      if (out !== null) prfOutputs.push(out);
      return out;
    }),
  };
});

const M = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const K0 = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const PW = 'correct horse battery';
const wallet = () => createEnvelope({mnemonic: M, password: PW, scheme: 'slip10', accounts: [{index: 0, name: 'A', publicKey: K0}], kdf: testKdf});

beforeEach(() => {
  loadPage();
  prfOutputs.length = 0;
  vi.mocked(evaluatePrf).mockClear();
});

async function shown(vault: unknown, o: {returnTo?: 'created' | 'imported' | null; holdSleep?: boolean; credentials?: Parameters<typeof harness>[0] extends infer X ? (X extends {credentials?: infer C} ? C : never) : never} = {}) {
  const h = await harness({vault, holdSleep: o.holdSleep, credentials: o.credentials});
  const screen = mountUnlock(h.deps);
  await screen.show(o.returnTo ?? null);
  return Object.assign(h, {screen});
}
const submit = (password: string) => {
  type(el<HTMLInputElement>('unl-password'), password);
  click(el('unl-submit'));
};
/** Records every wait the screen asks for (the 500 ms floor, a backoff wait), in order. Must run before mountUnlock. */
function recordSleeps(h: {deps: {sleep(ms: number): Promise<void>}}): number[] {
  const asked: number[] = [];
  const inner = h.deps.sleep;
  h.deps.sleep = ms => (asked.push(ms), inner(ms));
  return asked;
}
/** A stray event on a button the page drew disabled or hidden: happy-dom drops clicks on disabled buttons, so lift it first. */
function force(id: string): void {
  el<HTMLButtonElement>(id).disabled = false;
  click(el(id));
}

/**
 * Every place the page could still carry the password as a string: each text node, each attribute value and each
 * field's `value` (the leak detector of Tasks 7–9, with input.value added — a password lives in a field).
 */
const carries = (secret: string): string[] => {
  const out: string[] = [];
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n !== null; n = walk.nextNode()) if ((n.nodeValue ?? '').includes(secret)) out.push('text');
  for (const e of document.body.querySelectorAll('*')) for (const a of e.attributes) if (a.value.includes(secret)) out.push(`@${a.name}`);
  for (const f of document.body.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')) if (f.value.includes(secret)) out.push(`#${f.id}.value`);
  return out;
};

/** A WebAuthn stand-in whose get() returns `prf` as the PRF result (a fresh buffer each time, as a browser would). */
function prfCredentials(prf: Uint8Array): CredentialsApi {
  const cred = {rawId: new Uint8Array(16).fill(1).buffer, getClientExtensionResults: () => ({prf: {results: {first: prf.slice().buffer}}})} as unknown as Credential;
  return {create: async () => null, get: async () => cred};
}
/** The wallet with a real passkey wrap for `prf` (envelope.ts addPasskeyWrap). */
async function withPasskey(prf: Uint8Array): Promise<EnvelopeV1> {
  const env = await wallet();
  const dataKey = await unlockWithPassword(env, PW, testKdf);
  return addPasskeyWrap(env, dataKey, prf, new Uint8Array(16).fill(1), new Uint8Array(32).fill(2));
}
const PRF = new Uint8Array(32).fill(7);

describe('#9 unlock (spec §3.9)', () => {
  it('idle: lock tile, "Welcome back", the adapted lede (D7), the password field, Unlock, "Forgot password?"; no passkey button without a passkey', async () => {
    await shown(await wallet());
    const screen = el('v-unlock');
    expect(text(screen.querySelector('h1'))).toBe('Welcome back');
    expect(text(screen.querySelector('h1 + p'))).toBe('Enter your password to unlock.');
    expect(el('unl-password').getAttribute('autocomplete')).toBe('current-password');
    expect(text(el('unl-submit'))).toBe('Unlock');
    expect(visible(el('unl-passkey'))).toBe(false);
    expect(text(el('unl-forgot'))).toBe('Forgot password?');
    expect(text(screen)).not.toMatch(/PIN|attempts left|Cycle 1 of 2|Final cycle/);
    expect(unstyled('v-unlock')).toEqual([]);
  });

  it('[Unlock with passkey] only when the envelope has one; a device without PRF says so', async () => {
    const env = await wallet();
    const withPk: EnvelopeV1 = {...env, passkey: {credentialId: base64.encode(new Uint8Array(16).fill(1)), prfSalt: base64.encode(new Uint8Array(32).fill(2)), wrapped: base64.encode(new Uint8Array(40).fill(3))}};
    const h = await shown(withPk, {credentials: {create: async () => null, get: async () => null}});
    expect(visible(el('unl-passkey'))).toBe(true);
    expect(text(el('unl-passkey'))).toBe('Unlock with passkey');
    click(el('unl-passkey'));
    await h.until(() => text(el('unl-helper')) === 'This device cannot unlock the wallet with a passkey; your password still works.');
  });

  it('error: "That did not unlock the wallet." (D11: no counter), the tile in --danger, the shake', async () => {
    const h = await shown(await wallet());
    submit('not the password at all');
    expect(text(el('unl-helper'))).toBe('Unlocking…');
    await h.until(() => text(el('unl-helper')) === 'That did not unlock the wallet.');
    expect(el('unl-helper').classList.contains('error')).toBe(true);
    expect(el('unl-tile').classList.contains('is-error')).toBe(true);
    expect(el('unl-password').classList.contains('is-error')).toBe(true);
    expect(await getSession(h.ext)).toBeNull();
    expect(unstyled('v-unlock')).toEqual([]);
  });

  it('cooldown: the engine’s wait as the design’s card — "Wait a moment", "0:01", [Unlock paused]; then the error', async () => {
    const h = await shown(await wallet(), {holdSleep: true});
    submit('wrong wrong wrong wrong');
    await h.until(() => text(el('unl-helper')) === 'That did not unlock the wallet.');
    h.wake();
    await h.until(() => !h.deps.gate.isBusy());
    submit('wrong wrong wrong wrong');
    await h.until(() => visible(el('unl-cooldown')));
    expect(text(el('unl-cooldown'))).toBe('Wait a moment That did not unlock the wallet. Wait a moment before trying again. 0:01 Cooldown · 0 minutes 1 seconds remaining');
    expect(visible(el('unl-paused'))).toBe(true);
    expect(el<HTMLButtonElement>('unl-paused').disabled).toBe(true);
    expect(text(el('unl-paused'))).toBe('Unlock paused');
    expect(visible(el('unl-submit'))).toBe(false);
    expect(el<HTMLInputElement>('unl-password').value).toBe('');
    expect(unstyled('v-unlock')).toEqual([]);
    h.wake();
    await h.until(() => !visible(el('unl-cooldown')));
    expect(text(el('unl-helper'))).toBe('That did not unlock the wallet.');
  });

  it('unlocked: the keys reach the background; "Unlocked." + "Open the Noctura icon to continue." + [Close this tab], hidden if the tab stays', async () => {
    const h = await shown(await wallet());
    submit(PW);
    await h.until(() => visible(el('unl-notice')));
    expect((await getSession(h.ext))?.map(a => a.publicKey)).toEqual([K0]);
    expect(text(el('unl-notice'))).toBe('Unlocked. Open the Noctura icon to continue.');
    expect(text(el('unl-close'))).toBe('Close this tab');
    expect(visible(el('unl-forgot'))).toBe(false);
    expect(unstyled('v-unlock')).toEqual([]);
    click(el('unl-close'));
    expect(h.closed).toBe(1);
    h.timers.advance(CLOSE_CHECK_MS);
    expect(visible(el('unl-close'))).toBe(false);
  });

  it.each([
    ['created', 'wallet.html#/created'],
    ['imported', 'wallet.html#/imported'],
  ] as const)('with return=%s, a successful unlock goes straight on to %s', async (returnTo, target) => {
    const h = await shown(await wallet(), {returnTo});
    submit(PW);
    await h.until(() => h.went.length > 0);
    expect(h.went).toEqual([target]);
  });

  it('no wallet: the line and [Set up a wallet] → #1; nothing to type', async () => {
    const h = await shown(undefined);
    expect(text(el('unl-notice-line'))).toBe('No wallet on this browser yet.');
    expect(visible(el('unl-entry'))).toBe(false);
    click(el('unl-setup'));
    expect(h.went).toEqual(['unlock.html?mode=welcome']);
  });

  it('a damaged vault (a stored null too) says so before any password is typed — never charged to the backoff', async () => {
    const h = await harness({vault: null});
    const asked = recordSleeps(h);
    await mountUnlock(h.deps).show(null);
    // No attempt ran, so nothing could be charged: no wait of any kind was asked for (the mid-run case is below).
    expect(asked).toEqual([]);
    expect(text(el('unl-notice'))).toBe("This wallet's stored data is damaged. Your funds stay on Solana; your recovery phrase still controls them. To use them here, remove Noctura from this browser, install it again and import the phrase.");
    expect(visible(el('unl-entry'))).toBe(false);
    expect(visible(el('unl-forgot'))).toBe(false);
    expect(h.sent).toEqual([]);
  });

  it('"Forgot password?" → #39', async () => {
    const h = await shown(await wallet());
    click(el('unl-forgot'));
    expect(h.went).toEqual(['unlock.html?mode=forgot']);
  });

  it('rule 6: a second Unlock before the first settles sends nothing more', async () => {
    const h = await shown(await wallet());
    submit(PW);
    click(el('unl-submit'));
    await h.until(() => visible(el('unl-notice')));
    expect(h.sent.filter(m => m.type === 'vault.setKeys')).toHaveLength(1);
  });
});

describe('#9 unlock: what the brief left implicit (carried rules)', () => {
  it('the typed password leaves the field and every reference: on a wrong password, in the cooldown, after it, and once unlocked', async () => {
    const h = await shown(await wallet(), {holdSleep: true});
    const wrong = 'near miss horse battery';
    type(el<HTMLInputElement>('unl-password'), wrong);
    expect(h.screen.holds()).toBe(true);
    expect(carries(wrong)).toEqual(['#unl-password.value']);
    click(el('unl-submit'));
    // Handed to the attempt at the click: the field is empty while Argon2id runs, and the screen keeps no copy.
    expect(carries(wrong)).toEqual([]);
    expect(h.screen.holds()).toBe(false);
    await h.until(() => text(el('unl-helper')) === 'That did not unlock the wallet.');
    expect([carries(wrong), h.screen.holds()]).toEqual([[], false]);
    h.wake();
    await h.until(() => !h.deps.gate.isBusy());
    submit(wrong);
    await h.until(() => visible(el('unl-cooldown')));
    expect([carries(wrong), h.screen.holds()]).toEqual([[], false]);
    h.wake();
    await h.until(() => !h.deps.gate.isBusy());
    expect([carries(wrong), h.screen.holds()]).toEqual([[], false]);
    submit(PW);
    await h.until(() => visible(el('unl-notice')));
    expect([carries(PW), h.screen.holds()]).toEqual([[], false]);
  });

  it.each(['hidden', 'pagehide'] as const)('the tab %s: a typed, unsent password is dropped from the field', async why => {
    const h = await shown(await wallet());
    type(el<HTMLInputElement>('unl-password'), PW);
    expect(h.screen.holds()).toBe(true);
    h.leave(why);
    expect([carries(PW), h.screen.holds()]).toEqual([[], false]);
    expect(h.sent).toEqual([]);
  });

  it('passkey: unlocks with the PRF output, which is zeroed after', async () => {
    const h = await shown(await withPasskey(PRF), {credentials: prfCredentials(PRF)});
    click(el('unl-passkey'));
    await h.until(() => visible(el('unl-notice')));
    expect((await getSession(h.ext))?.map(a => a.publicKey)).toEqual([K0]);
    expect(prfOutputs).toHaveLength(1);
    expect(prfOutputs.every(o => o.every(b => b === 0))).toBe(true);
  });

  it('passkey: a PRF output that does not open the wrap is "wrong", and zeroed', async () => {
    const h = await shown(await withPasskey(PRF), {credentials: prfCredentials(new Uint8Array(32).fill(9))});
    click(el('unl-passkey'));
    await h.until(() => text(el('unl-helper')) === 'That did not unlock the wallet.');
    expect(await getSession(h.ext)).toBeNull();
    expect(prfOutputs).toHaveLength(1);
    expect(prfOutputs.every(o => o.every(b => b === 0))).toBe(true);
  });

  it('passkey: the vault damaged after the page read it — "damaged", nothing sent, the PRF output zeroed', async () => {
    const h = await shown(await withPasskey(PRF), {credentials: prfCredentials(PRF)});
    await h.ext.local.set(VAULT_KEY, null);
    click(el('unl-passkey'));
    await h.until(() => visible(el('unl-notice')));
    expect(text(el('unl-notice-line'))).toBe("This wallet's stored data is damaged.");
    expect(h.sent).toEqual([]);
    expect(prfOutputs).toHaveLength(1);
    expect(prfOutputs.every(o => o.every(b => b === 0))).toBe(true);
  });

  it('passkey: a cancelled prompt (get() throws) is "unavailable"; the password still works', async () => {
    const h = await shown(await withPasskey(PRF), {
      credentials: {
        create: async () => null,
        get: async () => {
          throw new DOMException('cancelled', 'NotAllowedError');
        },
      },
    });
    click(el('unl-passkey'));
    await h.until(() => text(el('unl-helper')) === 'This device cannot unlock the wallet with a passkey; your password still works.');
    await h.until(() => !h.deps.gate.isBusy());
    submit(PW);
    await h.until(() => visible(el('unl-notice')));
    expect(text(el('unl-notice-line'))).toBe('Unlocked.');
  });

  it('[Unlock with passkey] is not offered over a damaged vault that carries a passkey-shaped field (passkeyOf)', async () => {
    const env = await withPasskey(PRF);
    await shown({...env, accounts: []});
    expect(visible(el('unl-passkey'))).toBe(false);
    expect(text(el('unl-notice-line'))).toBe("This wallet's stored data is damaged.");
  });

  it('cooldown: the ring is set only as a number; the countdown is announced once (polite), not every second', async () => {
    const h = await shown(await wallet(), {holdSleep: true});
    submit('wrong wrong wrong wrong');
    await h.until(() => text(el('unl-helper')) === 'That did not unlock the wallet.');
    h.wake();
    await h.until(() => !h.deps.gate.isBusy());
    submit('wrong wrong wrong wrong');
    await h.until(() => visible(el('unl-cooldown')));
    expect(el('unl-ring').style.getPropertyValue('--vlt-ring')).toBe('1');
    // The per-second figures are not a live region; one polite line says the wait once.
    expect(el('unl-cooldown').querySelector('[aria-live]')).toBeNull();
    expect(el('unl-cooldown').getAttribute('role')).toBeNull();
    expect(el('unl-cooldown-live').getAttribute('aria-live')).toBe('polite');
    expect(text(el('unl-cooldown-live'))).toBe('Cooldown · 0 minutes 1 seconds remaining');
    h.timers.advance(1_000);
    expect(text(el('unl-timer'))).toBe('0:00');
    expect(el('unl-ring').style.getPropertyValue('--vlt-ring')).toBe('0');
    expect(text(el('unl-cooldown-live'))).toBe('Cooldown · 0 minutes 1 seconds remaining');
    h.wake();
    await h.until(() => !visible(el('unl-cooldown')));
    expect(text(el('unl-cooldown-live'))).toBe('');
    // The countdown stopped with the wait.
    expect(h.timers.pending()).toBe(0);
  });

  // Review fix round 1, item 2: observed, not inferred — every wait the screen asks for is recorded. After one wrong
  // the streak is 1; had a damaged (or vanished) vault been charged, it would be 2 and a 1 s backoff wait would follow.
  it.each([
    ['damaged', null, "This wallet's stored data is damaged."],
    ['no-wallet', undefined, 'No wallet on this browser yet.'],
  ] as const)('a vault %s during the run is named, never charged to the backoff (no wait after it, even after a wrong)', async (_kind, stored, line) => {
    const h = await harness({vault: await wallet()});
    const asked = recordSleeps(h);
    await mountUnlock(h.deps).show(null);
    submit('not the password at all');
    await h.until(() => text(el('unl-helper')) === 'That did not unlock the wallet.');
    await h.until(() => !h.deps.gate.isBusy());
    expect(asked).toEqual([500]);
    if (stored === undefined) await h.ext.local.remove(VAULT_KEY);
    else await h.ext.local.set(VAULT_KEY, stored);
    submit(PW);
    await h.until(() => visible(el('unl-notice')) && !h.deps.gate.isBusy());
    expect(text(el('unl-notice-line'))).toBe(line);
    // Only the second click's floor: no backoff wait was asked for.
    expect(asked).toEqual([500, 500]);
    expect(visible(el('unl-cooldown'))).toBe(false);
    expect(visible(el('unl-entry'))).toBe(false);
    expect(h.sent.filter(m => m.type === 'vault.setKeys')).toEqual([]);
  });

  it('a store that cannot be read says so; nothing to type', async () => {
    const h = await harness({vault: await wallet()});
    h.deps.store.readEnvelope = async () => {
      throw new Error('Extension context invalidated.');
    };
    await mountUnlock(h.deps).show(null);
    expect(text(el('unl-notice-line'))).toBe("This wallet's stored data could not be read. Reload this page.");
    expect(visible(el('unl-notice-help'))).toBe(false);
    expect(visible(el('unl-entry'))).toBe(false);
    expect(visible(el('unl-forgot'))).toBe(false);
  });

  it('rule 6: inside the 500 ms floor a lifted Unlock, passkey or "Forgot password?" runs nothing', async () => {
    const h = await shown(await withPasskey(PRF), {holdSleep: true, credentials: prfCredentials(PRF)});
    submit(PW);
    await h.until(() => visible(el('unl-notice')));
    expect(h.deps.gate.isBusy()).toBe(true);
    force('unl-submit');
    force('unl-passkey');
    force('unl-forgot');
    force('unl-close');
    await new Promise(r => setTimeout(r, 5));
    expect([h.sent.filter(m => m.type === 'vault.setKeys').length, h.went.length, h.closed, prfOutputs.length]).toEqual([1, 0, 0, 0]);
  });

  // Review fix round 1, item 1 (ruling): during the cooldown the attempt has already settled as wrong, so "Forgot
  // password?" is plain navigation, outside the gate; it still waits for the gate while an attempt is in flight.
  it('cooldown: "Forgot password?" is enabled and navigates to #39 at once; a double click navigates once', async () => {
    const h = await shown(await wallet(), {holdSleep: true});
    submit('wrong wrong wrong wrong');
    await h.until(() => text(el('unl-helper')) === 'That did not unlock the wallet.');
    h.wake();
    await h.until(() => !h.deps.gate.isBusy());
    submit('wrong wrong wrong wrong');
    await h.until(() => visible(el('unl-cooldown')));
    expect(h.deps.gate.isBusy()).toBe(true);
    expect(visible(el('unl-forgot'))).toBe(true);
    expect(el<HTMLButtonElement>('unl-forgot').disabled).toBe(false);
    expect(el('unl-forgot').classList.contains('vlt-forgot-cool')).toBe(true);
    expect(unstyled('v-unlock')).toEqual([]);
    click(el('unl-forgot'));
    force('unl-forgot');
    expect(h.went).toEqual(['unlock.html?mode=forgot']);
    // The countdown stopped with it; the held wait settling later shows nothing.
    expect(h.timers.pending()).toBe(0);
    h.wake();
    await h.until(() => !h.deps.gate.isBusy());
    expect([visible(el('unl-entry')), visible(el('unl-cooldown')), h.went]).toEqual([false, false, ['unlock.html?mode=forgot']]);
  });

  it('rule 6: while an attempt is in flight, a lifted Unlock (with a password typed again), passkey or "Forgot password?" runs nothing', async () => {
    let release: () => void = () => undefined;
    let inFlight = 0;
    const held = new Promise<void>(r => (release = r));
    const h = await harness({
      vault: await withPasskey(PRF),
      credentials: prfCredentials(PRF),
      send: inner => async m => {
        if ((m as {type?: string}).type === 'vault.setKeys') {
          inFlight += 1;
          await held;
        }
        return inner(m);
      },
    });
    await mountUnlock(h.deps).show(null);
    submit(PW);
    await h.until(() => inFlight === 1);
    expect(el<HTMLButtonElement>('unl-submit').disabled).toBe(true);
    expect(el<HTMLInputElement>('unl-password').disabled).toBe(true);
    type(el<HTMLInputElement>('unl-password'), PW);
    force('unl-submit');
    el<HTMLFormElement>('unl-form').dispatchEvent(new Event('submit', {cancelable: true}));
    force('unl-passkey');
    force('unl-forgot');
    await new Promise(r => setTimeout(r, 20));
    release();
    await h.until(() => visible(el('unl-notice')) && !h.deps.gate.isBusy());
    expect([inFlight, h.sent.filter(m => m.type === 'vault.setKeys').length, h.went, prfOutputs.length]).toEqual([1, 1, [], 0]);
  });

  it('an empty field submits nothing — no "Unlocking…", no Argon2id run, nothing charged to the backoff', async () => {
    const h = await shown(await wallet());
    click(el('unl-submit'));
    el<HTMLFormElement>('unl-form').dispatchEvent(new Event('submit', {cancelable: true}));
    await new Promise(r => setTimeout(r, 5));
    expect([text(el('unl-helper')), h.deps.gate.isBusy(), h.sent]).toEqual(['', false, []]);
  });

  it('rule 6: each button acts only in its own phase (a lifted stray click elsewhere does nothing)', async () => {
    // No wallet: nothing to unlock (even with something in the hidden field), no "Forgot password?", no close.
    const none = await shown(undefined);
    type(el<HTMLInputElement>('unl-password'), PW);
    force('unl-submit');
    el<HTMLFormElement>('unl-form').dispatchEvent(new Event('submit', {cancelable: true}));
    force('unl-passkey');
    force('unl-forgot');
    force('unl-close');
    // Refused by the phase guard before the gate is taken: nothing runs at all.
    expect(none.deps.gate.isBusy()).toBe(false);
    await new Promise(r => setTimeout(r, 5));
    expect([none.sent, none.went, none.closed, text(el('unl-helper'))]).toEqual([[], [], 0, '']);
    // A wallet: no setup and no close before it is unlocked.
    loadPage();
    const some = await shown(await wallet());
    force('unl-setup');
    force('unl-close');
    await new Promise(r => setTimeout(r, 5));
    expect([some.sent, some.went, some.closed]).toEqual([[], [], 0]);
    // Unlocked: no second unlock, no setup.
    submit(PW);
    await some.until(() => visible(el('unl-notice')) && !some.deps.gate.isBusy());
    type(el<HTMLInputElement>('unl-password'), PW);
    force('unl-submit');
    force('unl-setup');
    force('unl-forgot');
    expect(some.deps.gate.isBusy()).toBe(false);
    await some.until(() => !some.deps.gate.isBusy());
    await new Promise(r => setTimeout(r, 50));
    expect([some.sent.filter(m => m.type === 'vault.setKeys').length, some.went]).toEqual([1, []]);
  });

  it('return= is a closed enum: anything else in the URL steers nowhere — the plain "Unlocked." notice', async () => {
    const {startMode} = await import('../modes');
    for (const search of ['?mode=unlock&return=https://example.com', '?mode=unlock&return=wallet.html%23/send', '?mode=forgot&return=created', '?return=created%20']) {
      loadPage();
      const h = await harness({vault: await wallet()});
      startMode(pageMode(search), h.deps);
      await h.until(() => visible(el('unl-entry')));
      submit(PW);
      await h.until(() => visible(el('unl-notice')));
      expect([search, text(el('unl-notice-line')), h.went]).toEqual([search, 'Unlocked.', []]);
    }
    loadPage();
    const h = await harness({vault: await wallet()});
    startMode(pageMode('?mode=unlock&return=imported'), h.deps);
    await h.until(() => visible(el('unl-entry')));
    submit(PW);
    await h.until(() => h.went.length > 0);
    expect(h.went).toEqual(['wallet.html#/imported']);
  });
});
