// @vitest-environment happy-dom
import {addPasskeyWrap, createEnvelope, decryptMnemonic, unlockWithPassword, type EnvelopeV1, type Kdf} from '../../vault/envelope';
import {deriveSessionAccounts} from '../../vault/accounts';
import {VAULT_KEY} from '../../background/accountsStore';
import {setSession} from '../../background/session';
import {lock} from '../../background/autolock';
import {mountChangePassword, HOLD_TTL_MS, type ChangePasswordScreen} from '../screens/changePassword';
import {startMode} from '../modes';
import {pageMode} from '../mode';
import type {Send} from '../types';
import {click, el, harness, loadPage, testKdf, text, type, unstyled, visible, type Harness} from './pageHarness';

// Task 8 fix round 1 (I1): the real proveCurrent, with each proven data key's buffer kept so a test can see it zeroed.
const proofs = vi.hoisted(() => ({keys: [] as Uint8Array[]}));
vi.mock('../passwordFlow', async importOriginal => {
  const actual = await importOriginal<typeof import('../passwordFlow')>();
  return {
    ...actual,
    proveCurrent: async (...args: Parameters<typeof actual.proveCurrent>) => {
      const r = await actual.proveCurrent(...args);
      if (r.outcome === 'proven') proofs.keys.push(r.held.dataKey);
      return r;
    },
  };
});
const lastKey = (): Uint8Array => {
  const k = proofs.keys.at(-1);
  if (k === undefined) throw new Error('no proof was made');
  return k;
};
const zeroed = (k: Uint8Array) => k.every(b => b === 0);

// B1b-2b §3.1 (#36, E10, D8, C20) against the REAL background and the real unlock.html.
const M = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const K0 = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const OLD = 'correct horse battery';
const NEW = 'a brand new long password';

beforeEach(loadPage);

async function shown(o: {passkey?: boolean; unlocked?: boolean; holdSleep?: boolean; send?: (inner: Send) => Send} = {}): Promise<{h: Harness; screen: ChangePasswordScreen; env: EnvelopeV1}> {
  let env = await createEnvelope({mnemonic: M, password: OLD, scheme: 'slip10', accounts: [{index: 0, name: 'Main', publicKey: K0}], kdf: testKdf});
  if (o.passkey === true) env = await addPasskeyWrap(env, await unlockWithPassword(env, OLD, testKdf), crypto.getRandomValues(new Uint8Array(32)), crypto.getRandomValues(new Uint8Array(16)), crypto.getRandomValues(new Uint8Array(32)));
  const h = await harness({vault: env, ...(o.holdSleep === true ? {holdSleep: true} : {}), ...(o.send === undefined ? {} : {send: o.send})});
  if (o.unlocked !== false) await setSession(h.ext, await deriveSessionAccounts(M, 'slip10', [0]));
  const screen = mountChangePassword(h.deps);
  screen.show();
  return {h, screen, env};
}
const cta = () => el<HTMLButtonElement>('cp-cta');
const field = () => el<HTMLInputElement>('cp-field');
const idle = (h: Harness) => h.until(() => !h.deps.gate.isBusy());
async function submit(h: Harness, value: string): Promise<void> {
  await idle(h);
  type(field(), value);
  click(cta());
}
async function toStep2(h: Harness): Promise<void> {
  await submit(h, OLD);
  await h.until(() => text(el('cp-step')) === 'Step 2 of 3' && !h.deps.gate.isBusy());
}
async function toStep3(h: Harness): Promise<void> {
  await toStep2(h);
  await submit(h, NEW);
  await h.until(() => text(el('cp-step')) === 'Step 3 of 3' && !h.deps.gate.isBusy());
}
const changes = (h: Harness) => h.sent.filter(m => m.type === 'vault.changePassword');

describe('#36 change password: the steps', () => {
  it('step-1: the adapted copy, the stepper at 1 of 3, a password field — and no passkey button', async () => {
    await shown({passkey: true});
    expect(pageMode('?mode=password')).toEqual({mode: 'password'});
    expect(text(el('v-change-password').querySelector('.top-bar .title'))).toBe('Change password');
    expect(text(el('cp-step'))).toBe('Step 1 of 3');
    expect(el('cp-seg-1').classList.contains('cur')).toBe(true);
    expect(text(el('cp-title'))).toBe('Enter current password');
    expect(text(el('cp-lede'))).toBe("Verify it's you before changing your password.");
    expect(field().autocomplete).toBe('current-password');
    expect(text(cta())).toBe('Continue');
    expect(cta().disabled).toBe(true);
    expect(visible(el('cp-toggle'))).toBe(false);
    expect(document.querySelector('#v-change-password [id*="passkey"]')).toBeNull();
    expect(unstyled('v-change-password')).toEqual([]);
    expect(unstyled('v-cp-cancel')).toEqual([]);
  });

  it('step-1 wrong: "That did not confirm it."; the typed password left the field at the click', async () => {
    const {h} = await shown();
    await submit(h, 'nope nope nope nope');
    expect(field().value).toBe('');
    await h.until(() => text(el('cp-helper')) === 'That did not confirm it.');
    expect(text(el('cp-step'))).toBe('Step 1 of 3');
  });

  it('step-2: the adapted copy, new-password field with show/hide and the length meter; Continue from 12 characters', async () => {
    const {h} = await shown();
    await toStep2(h);
    expect(text(el('cp-title'))).toBe('Choose a new password');
    expect(text(el('cp-lede'))).toBe('At least 12 characters. A few unrelated words work well.');
    expect(field().autocomplete).toBe('new-password');
    expect(text(el('cp-meter-label'))).toBe('0 of 12 characters');
    type(field(), 'short');
    expect(text(el('cp-meter-label'))).toBe('5 of 12 characters');
    expect(cta().disabled).toBe(true);
    type(field(), NEW);
    expect(text(el('cp-meter-label'))).toBe('Long enough');
    expect(cta().disabled).toBe(false);
    click(el('cp-toggle'));
    expect(field().type).toBe('text');
    expect(el('cp-toggle').getAttribute('aria-label')).toBe('Hide password');
  });

  it('step-2 same (review H2): the current password again → O02, nothing sent, no cooldown', async () => {
    const {h} = await shown();
    await toStep2(h);
    await submit(h, OLD);
    await h.until(() => text(el('cp-helper')) === 'That is your current password. Choose a new one.');
    expect(text(el('cp-step'))).toBe('Step 2 of 3');
    expect(changes(h)).toEqual([]);
    expect(visible(el('cp-cooldown'))).toBe(false);
  });

  it('step-2 check failed (the KDF threw, not WrongPassword): O07, still step 2 with the proof held, Continue usable again', async () => {
    const {h, screen} = await shown();
    await toStep2(h);
    const deps = h.deps as {kdf: Kdf};
    deps.kdf = async () => {
      throw new Error('argon2 out of memory');
    };
    await submit(h, NEW);
    await h.until(() => text(el('cp-helper')) === 'Something went wrong. Your password was not changed.');
    await idle(h);
    expect(text(el('cp-step'))).toBe('Step 2 of 3');
    expect(screen.holds().key).toBe(true);
    expect(field().disabled).toBe(false);
    expect(field().value).toBe(NEW);
    expect(cta().disabled).toBe(false);
    expect(changes(h)).toEqual([]);
    // Not stuck: the next try (a working KDF) moves on.
    deps.kdf = testKdf;
    click(cta());
    await h.until(() => text(el('cp-step')) === 'Step 3 of 3');
  });

  it('step-2 check failed AFTER a pagehide: the page shows dropped (O10), never O07 over it', async () => {
    const {h, screen} = await shown();
    await toStep2(h);
    const deps = h.deps as {kdf: Kdf};
    deps.kdf = async () => {
      h.leave('pagehide');
      throw new Error('argon2 out of memory');
    };
    await submit(h, NEW);
    await idle(h);
    expect(text(el('cp-helper'))).toBe('Enter your current password again.');
    expect(text(el('cp-step'))).toBe('Step 1 of 3');
    expect(screen.holds()).toEqual({key: false, password: false});
  });

  it('step-3 mismatch: the adapted line, the shake, the field cleared after 600 ms; no attempt counter', async () => {
    const {h} = await shown();
    await toStep3(h);
    expect(text(el('cp-title'))).toBe('Confirm new password');
    expect(text(el('cp-lede'))).toBe('Enter the same password again.');
    expect(text(cta())).toBe('Change password');
    await submit(h, `${NEW}!`);
    await h.until(() => text(el('cp-helper')) === "Passwords don't match — try again");
    expect(field().classList.contains('is-error')).toBe(true);
    expect(field().value).toBe(`${NEW}!`);
    h.timers.advance(599);
    expect(field().value).toBe(`${NEW}!`);
    h.timers.advance(1);
    expect(field().value).toBe('');
    expect(changes(h)).toEqual([]);
  });

  it('done: only the salt and the wrap changed; "Password updated." + O05 + O06 with a passkey; the key zeroed', async () => {
    const {h, screen, env} = await shown({passkey: true});
    await toStep3(h);
    await submit(h, NEW);
    await h.until(() => text(el('cp-notice-line')) === 'Password updated.');
    expect(text(el('cp-notice-help'))).toBe('You can close this tab. Your passkey still works.');
    expect(visible(el('cp-close'))).toBe(true);
    const after = (await h.ext.local.get(VAULT_KEY)) as EnvelopeV1;
    expect([after.seed, after.passkey, after.accounts]).toEqual([env.seed, env.passkey, env.accounts]);
    expect(after.password.wrapped).not.toBe(env.password.wrapped);
    expect(screen.holds()).toEqual({key: false, password: false});
    click(el('cp-close'));
    await h.until(() => h.closed === 1);
  });

  it('done without a passkey: no passkey line', async () => {
    const {h} = await shown();
    await toStep3(h);
    await submit(h, NEW);
    await h.until(() => text(el('cp-notice-line')) === 'Password updated.');
    expect(text(el('cp-notice-help'))).toBe('You can close this tab.');
  });

  it('busy (the envelope moved after step 1): RESTORE busy + [Start again] → step 1; locked → not-unlocked + [Unlock]', async () => {
    const busy = await shown({send: inner => async m => ((m as {type: string}).type === 'vault.changePassword' ? {ok: false, error: 'busy'} : inner(m))});
    await toStep3(busy.h);
    await submit(busy.h, NEW);
    await busy.h.until(() => text(el('cp-notice-line')) === 'The wallet changed while you were typing. Start again.');
    expect(busy.screen.holds().key).toBe(false);
    await idle(busy.h);
    click(el('cp-again'));
    await busy.h.until(() => text(el('cp-step')) === 'Step 1 of 3' && visible(el('cp-entry')));

    loadPage();
    const locked = await shown();
    await toStep3(locked.h);
    await lock(locked.h.ext);
    await submit(locked.h, NEW);
    await locked.h.until(() => text(el('cp-notice-line')) === 'The wallet is locked. Unlock it first, then try again.');
    await idle(locked.h);
    click(el('cp-unlock'));
    await locked.h.until(() => locked.h.went.length === 1);
    expect(locked.h.went).toEqual(['unlock.html?mode=unlock']);
  });

  it('not unlocked at step 1: the common notice with [Unlock]', async () => {
    const {h} = await shown({unlocked: false});
    await submit(h, OLD);
    await h.until(() => text(el('cp-notice-line')) === 'The wallet is locked. Unlock it first, then try again.');
    expect(visible(el('cp-unlock'))).toBe(true);
  });
});

describe('#36 memory (M2 ruling, C20)', () => {
  it('hidden → visible keeps step 2 and its field', async () => {
    const {h, screen} = await shown();
    await toStep2(h);
    type(field(), 'half typed new');
    h.leave('hidden');
    h.back('visible');
    expect(text(el('cp-step'))).toBe('Step 2 of 3');
    expect(field().value).toBe('half typed new');
    expect(screen.holds().key).toBe(true);
  });

  it('pagehide zeroes the held data key and empties the field: step 1 with O10', async () => {
    const {h, screen} = await shown();
    await toStep2(h);
    type(field(), 'half typed new');
    const key = lastKey();
    expect(zeroed(key)).toBe(false);
    h.leave('pagehide');
    expect(zeroed(key)).toBe(true);
    expect(screen.holds()).toEqual({key: false, password: false});
    expect(text(el('cp-step'))).toBe('Step 1 of 3');
    expect(text(el('cp-helper'))).toBe('Enter your current password again.');
  });

  it('C20: held key zeroed and fields emptied at 5 min with no keystroke', async () => {
    const {h, screen} = await shown();
    await toStep2(h);
    type(field(), 'half typed new');
    h.timers.advance(HOLD_TTL_MS - 1);
    expect(screen.holds().key).toBe(true);
    h.timers.advance(1);
    expect(zeroed(lastKey())).toBe(true);
    expect(screen.holds()).toEqual({key: false, password: false});
    expect(text(el('cp-helper'))).toBe('Enter your current password again.');
  });

  it('C20: a keystroke at 4 min moves the deadline to 9 min', async () => {
    const {h, screen} = await shown();
    await toStep2(h);
    h.timers.advance(4 * 60_000);
    type(field(), 'x');
    h.timers.advance(4 * 60_000 + 59_000);
    expect(screen.holds().key).toBe(true);
    h.timers.advance(1_000);
    expect(screen.holds().key).toBe(false);
  });

  it('C20: `visible` after the deadline shows dropped at once — the timer suppressed (a throttled tab) — no button enabled', async () => {
    const {h, screen} = await shown();
    await toStep2(h);
    type(field(), NEW);
    h.leave('hidden');
    h.timers.skip(HOLD_TTL_MS + 1);
    h.back('visible');
    expect(screen.holds()).toEqual({key: false, password: false});
    expect(text(el('cp-helper'))).toBe('Enter your current password again.');
    expect(cta().disabled).toBe(true);
  });

  it('C20: [Change password] pressed past the deadline (timer suppressed) sends nothing', async () => {
    const {h, screen} = await shown();
    await toStep3(h);
    type(field(), NEW);
    h.timers.skip(HOLD_TTL_MS + 1);
    click(cta());
    await new Promise(r => setTimeout(r, 20));
    expect(changes(h)).toEqual([]);
    expect(screen.holds().key).toBe(false);
  });

  it('C20: the deadline passing DURING step 2\'s same-password check (timer suppressed) drops the proof — step 3 never opens', async () => {
    const {h, screen} = await shown();
    await toStep2(h);
    // The check's one Argon2id run outlives the deadline, and the throttled tab's timer never fires.
    const deps = h.deps as {kdf: Kdf};
    deps.kdf = async (pw, salt, params) => {
      h.timers.skip(HOLD_TTL_MS + 1);
      return testKdf(pw, salt, params);
    };
    await submit(h, NEW);
    await h.until(() => text(el('cp-helper')) === 'Enter your current password again.');
    expect(text(el('cp-step'))).toBe('Step 1 of 3');
    expect(screen.holds()).toEqual({key: false, password: false});
    expect(changes(h)).toEqual([]);
  });

  it('review M1: pagehide DURING step 1\'s proof — the proof that settles after is not kept: step 1 with O10, nothing held', async () => {
    const {h, screen} = await shown();
    const deps = h.deps as {kdf: Kdf};
    deps.kdf = async (pw, salt, params) => {
      // The user leaves while Argon2id runs (back/forward, a navigation): nothing is held yet.
      h.leave('pagehide');
      return testKdf(pw, salt, params);
    };
    await submit(h, OLD);
    await h.until(() => text(el('cp-helper')) === 'Enter your current password again.');
    expect(text(el('cp-step'))).toBe('Step 1 of 3');
    expect(screen.holds()).toEqual({key: false, password: false});
    // Restored from the back/forward cache: still step 1, and nothing to drop.
    h.back('restored');
    expect(text(el('cp-step'))).toBe('Step 1 of 3');
  });

  it('review M1: `restored` (back/forward cache, timers frozen) past the deadline drops the proof at once', async () => {
    const {h, screen} = await shown();
    await toStep2(h);
    h.leave('hidden');
    h.timers.skip(HOLD_TTL_MS + 1);
    h.back('restored');
    expect(screen.holds()).toEqual({key: false, password: false});
    expect(text(el('cp-helper'))).toBe('Enter your current password again.');
  });

  it('cancel-confirm: the X over step 2 asks; [Keep changing] returns with the field; [Cancel change] zeroes and closes', async () => {
    const {h, screen} = await shown();
    await toStep2(h);
    type(field(), 'kept while asking');
    click(el('cp-x'));
    await h.until(() => visible(el('v-cp-cancel')));
    expect(text(el('cpc-title'))).toBe('Cancel password change?');
    expect([text(el('cpc-keep')), text(el('cpc-cancel'))]).toEqual(['Keep changing', 'Cancel change']);
    await idle(h);
    click(el('cpc-keep'));
    await h.until(() => visible(el('v-change-password')));
    expect(field().value).toBe('kept while asking');
    await idle(h);
    click(el('cp-x'));
    await h.until(() => visible(el('v-cp-cancel')));
    await idle(h);
    const key = lastKey();
    expect(zeroed(key)).toBe(false);
    click(el('cpc-cancel'));
    await h.until(() => h.closed === 1);
    expect(zeroed(key)).toBe(true);
    expect(screen.holds()).toEqual({key: false, password: false});
  });

  /**
   * Task 8 fix round 1 (C1): once step 3 sends, changePassword owns the proof. A drop during its Argon2id run must not
   * zero the key it is about to wrap — that stored a wrap of an all-zero key, both self-checks passed, the page said
   * "Password updated." and neither password opened the wallet again.
   */
  async function duringStep3Kdf(during: (h: Harness) => void) {
    const {h, screen, env} = await shown();
    await toStep3(h);
    const original = await unlockWithPassword(env, OLD, testKdf);
    const key = lastKey();
    let mid: {held: boolean; changing: boolean; step: string; intact: boolean} | null = null;
    const deps = h.deps as {kdf: Kdf};
    deps.kdf = async (pw, salt, params) => {
      during(h);
      mid = {held: screen.holds().key, changing: visible(el('cp-changing')), step: text(el('cp-step')), intact: !zeroed(key)};
      return testKdf(pw, salt, params);
    };
    await submit(h, NEW);
    await h.until(() => text(el('cp-notice-line')) === 'Password updated.');
    // The screen had handed the proof over (it holds nothing), the change kept going, and the key was intact.
    expect(mid).toEqual({held: false, changing: true, step: 'Step 3 of 3', intact: true});
    const after = (await h.ext.local.get(VAULT_KEY)) as EnvelopeV1;
    const opened = await unlockWithPassword(after, NEW, testKdf);
    expect(zeroed(opened)).toBe(false);
    expect([...opened]).toEqual([...original]);
    expect(await decryptMnemonic(after, opened)).toBe(M);
    // changePassword zeroed the key it was handed once it answered.
    expect(zeroed(key)).toBe(true);
  }

  it('C1: pagehide during step 3\'s KDF — the change completes with the ORIGINAL data key, the seed decrypts', async () => {
    await duringStep3Kdf(h => h.leave('pagehide'));
  });

  it.each(['visible', 'restored'] as const)('C1: hidden → the deadline skipped → %s during step 3\'s KDF — the change completes with the ORIGINAL data key', async why => {
    await duringStep3Kdf(h => {
      h.leave('hidden');
      h.timers.skip(HOLD_TTL_MS + 1);
      h.back(why);
    });
  });

  it('M1 (fix round 1): hidden at step 1 empties the field AND disables Continue', async () => {
    const {h} = await shown();
    await idle(h);
    type(field(), OLD);
    expect(cta().disabled).toBe(false);
    h.leave('hidden');
    expect(field().value).toBe('');
    expect(cta().disabled).toBe(true);
  });

  it('the X at step 1 closes at once (nothing held)', async () => {
    const {h} = await shown();
    click(el('cp-x'));
    await h.until(() => h.closed === 1);
    expect(visible(el('v-cp-cancel'))).toBe(false);
  });
});

describe('#36 rule 6', () => {
  it('a second Continue inside the floor (its `disabled` lifted) runs no second proof', async () => {
    const {h} = await shown({holdSleep: true});
    type(field(), OLD);
    click(cta());
    cta().disabled = false;
    field().disabled = false;
    type(field(), OLD);
    click(cta());
    await h.until(() => h.sent.filter(m => m.type === 'vault.status').length >= 1);
    await new Promise(r => setTimeout(r, 20));
    expect(h.sent.filter(m => m.type === 'vault.status')).toHaveLength(1);
    h.wake();
  });

  it('a second [Change password] inside the floor (its `disabled` lifted) sends one vault.changePassword', async () => {
    const {h} = await shown({holdSleep: true});
    const wakeUntil = async (f: () => boolean) => {
      while (!f()) {
        h.wake();
        await new Promise(r => setTimeout(r, 5));
      }
    };
    type(field(), OLD);
    click(cta());
    await wakeUntil(() => text(el('cp-step')) === 'Step 2 of 3' && !h.deps.gate.isBusy());
    type(field(), NEW);
    click(cta());
    await wakeUntil(() => text(el('cp-step')) === 'Step 3 of 3' && !h.deps.gate.isBusy());
    type(field(), NEW);
    click(cta());
    cta().disabled = false;
    field().disabled = false;
    type(field(), NEW);
    click(cta());
    await wakeUntil(() => text(el('cp-notice-line')) === 'Password updated.' && !h.deps.gate.isBusy());
    expect(changes(h)).toHaveLength(1);
  });
});

describe('#36 through startMode', () => {
  it('?mode=password mounts #36', async () => {
    const h = await harness({vault: await createEnvelope({mnemonic: M, password: OLD, scheme: 'slip10', accounts: [{index: 0, name: 'Main', publicKey: K0}], kdf: testKdf})});
    startMode({mode: 'password'}, h.deps);
    expect(visible(el('v-change-password'))).toBe(true);
  });
});
