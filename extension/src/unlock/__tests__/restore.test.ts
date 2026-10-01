// @vitest-environment happy-dom
import {createEnvelope, decryptMnemonic, unlockWithPassword, type EnvelopeV1} from '../../vault/envelope';
import {derivePublicKeys} from '../../vault/accounts';
import {VAULT_KEY} from '../../background/accountsStore';
import {KNOWN_RECIPIENTS_KEY} from '../../background/knownRecipients';
import {PENDING_KEY} from '../../background/pendingStore';
import {getSession} from '../../background/session';
import {pendingRecord} from '../../background/__tests__/fixtures';
import {mountForgot} from '../screens/forgot';
import {createRestoreRun, type RestoreRun} from '../screens/restoreRun';
import {mountPassword, type PasswordScreen} from '../screens/password';
import type {Send} from '../types';
import {click, el, harness, loadPage, testKdf, text, type, unstyled, visible, type Harness} from './pageHarness';

// A pass-through spy: the restore test makes restoreWallet's own re-derivation disagree with a genuine proof
// (Task 2's carry: its `not-this-wallet` is handled as the proof's). Every other call runs the real code.
vi.mock('../../vault/accounts', async importOriginal => {
  const actual = await importOriginal<typeof import('../../vault/accounts')>();
  return {...actual, derivePublicKeys: vi.fn(actual.derivePublicKeys)};
});

const M = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const OTHER = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
const OLD_PW = 'correct horse battery';
const NEW_PW = 'a brand new long password';
const RECIPIENT = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';

const idle = (h: Harness) => h.until(() => !h.deps.gate.isBusy());

beforeEach(loadPage);

describe('#39 forgot password (spec §3.11)', () => {
  const cards = () => [1, 2, 3].map(n => el(`fg-card-${n}`));
  async function forgot(o: {holdSleep?: boolean} = {}) {
    const h = await harness(o);
    mountForgot(h.deps).show();
    return h;
  }

  it('step 1: the adapted copy, card 1 highlighted, the footer; [Restore from seed] → step 2 (review L1), not #8', async () => {
    const h = await forgot();
    const screen = el('v-forgot');
    expect(visible(screen)).toBe(true);
    expect(text(screen.querySelector('.top-bar .title'))).toBe('Recovery');
    expect(text(el('fg-step'))).toBe('1 / 3');
    expect(text(el('fg-title'))).toBe('Forgot your password?');
    expect(text(el('fg-lede'))).toBe('Your recovery phrase is the only way back. Three steps to restore.');
    expect(cards().map(c => [c.className, text(c)])).toEqual([
      ['s8-step-card vlt-gap-3b active', "1 Recover from seed phrase You'll need the 12 or 24 words you wrote down during setup. Make sure you have them on paper or steel — not on this computer. If you don't have your seed, your funds cannot be recovered. That's the security tradeoff of self-custody."],
      ['s8-step-card vlt-gap-3b', "2 Enter your words You'll be taken to the import screen. Type or paste your words."],
      ['s8-step-card', "3 Set a new password Once your phrase is verified against this wallet, you'll choose a new password (at least 12 characters). The old password stops working."],
    ]);
    expect(text(el('fg-foot'))).toBe('The recovery flow is offline-only. We never see your seed phrase, your password, or your wallet address.');
    expect(visible(el('fg-foot'))).toBe(true);
    expect(visible(el('fg-warn'))).toBe(false);
    expect(text(el('fg-next'))).toBe('Restore from seed');
    expect(text(el('fg-cancel'))).toBe('Cancel');
    expect(text(screen)).not.toMatch(/PIN|FLAG_SECURE|Your 24-word|address-book/);
    expect(unstyled('v-forgot')).toEqual([]);
    click(el('fg-next'));
    await idle(h);
    expect(h.went).toEqual([]);
    expect(text(el('fg-step'))).toBe('2 / 3');
    expect(h.sent).toEqual([]);
  });

  it('step 2: card 1 done, card 2 highlighted, the warning card (no address book in B1b-2a); step 3: [Continue to import] → #8 restore', async () => {
    const h = await forgot();
    click(el('fg-next'));
    await idle(h);
    expect(text(el('fg-title'))).toBe('Enter your words');
    expect(text(el('fg-lede'))).toBe('Type or paste the 12 or 24 words, in order.');
    expect(cards().map(c => c.className)).toEqual(['s8-step-card vlt-gap-3b vlt-done', 's8-step-card vlt-gap-3b active', 's8-step-card']);
    expect(text(el('fg-card-1-body'))).toBe('Done — you confirmed you have your words.');
    expect(visible(el('fg-card-1-hint'))).toBe(false);
    expect(text(el('fg-card-2-body'))).toBe("You'll be taken to the import screen. Type or paste your words.");
    expect(text(el('fg-card-3-body'))).toBe('After your phrase is verified.');
    expect(visible(el('fg-warn'))).toBe(true);
    expect(text(el('fg-warn'))).toBe('One warning before you proceed Restoring from seed replaces the wallet in this browser — including any unconfirmed transactions. Your funds on Solana are unaffected.');
    expect(visible(el('fg-foot'))).toBe(false);
    expect(text(el('fg-next'))).toBe('Continue');
    expect(unstyled('v-forgot')).toEqual([]);
    click(el('fg-next'));
    await idle(h);
    expect(text(el('fg-step'))).toBe('3 / 3');
    expect(text(el('fg-title'))).toBe('Set a new password');
    expect(text(el('fg-lede'))).toBe("Once your phrase is verified against this wallet, you'll choose a new password (at least 12 characters). The old password stops working.");
    expect(cards().map(c => c.className)).toEqual(['s8-step-card vlt-gap-3b vlt-done', 's8-step-card vlt-gap-3b vlt-done', 's8-step-card active']);
    expect(text(el('fg-card-1-body'))).toBe('Done.');
    expect(text(el('fg-card-2-body'))).toBe('Done — seed verified against your existing public key.');
    expect(text(el('fg-card-3-body'))).toBe("You'll choose a new password. The old password stops working. A passkey is not carried over; you can add one again later.");
    expect(visible(el('fg-warn'))).toBe(false);
    expect(text(el('fg-next'))).toBe('Continue to import');
    expect(unstyled('v-forgot')).toEqual([]);
    expect(h.went).toEqual([]);
    click(el('fg-next'));
    await idle(h);
    expect(h.went).toEqual(['unlock.html?mode=import&source=forgot']);
    expect(h.sent).toEqual([]);
  });

  it('back walks the steps back, then → #9; [Cancel] → #9', async () => {
    const h = await forgot();
    click(el('fg-next'));
    await idle(h);
    click(el('fg-next'));
    await idle(h);
    click(el('fg-back'));
    await idle(h);
    expect(text(el('fg-step'))).toBe('2 / 3');
    expect(visible(el('fg-warn'))).toBe(true);
    click(el('fg-back'));
    await idle(h);
    expect(text(el('fg-step'))).toBe('1 / 3');
    expect(h.went).toEqual([]);
    click(el('fg-back'));
    await idle(h);
    expect(h.went).toEqual(['unlock.html?mode=unlock']);
    loadPage();
    const c = await forgot();
    click(el('fg-next'));
    await idle(c);
    click(el('fg-cancel'));
    await idle(c);
    expect(c.went).toEqual(['unlock.html?mode=unlock']);
  });

  it('rule 6: a second [Restore from seed] inside the floor (disabled lifted) cannot skip step 2’s warning; nothing else acts while busy', async () => {
    const h = await forgot({holdSleep: true});
    click(el('fg-next'));
    expect(text(el('fg-step'))).toBe('2 / 3');
    for (const id of ['fg-next', 'fg-back', 'fg-cancel']) {
      expect(el<HTMLButtonElement>(id).disabled).toBe(true);
      el<HTMLButtonElement>(id).disabled = false;
      click(el(id));
    }
    expect(text(el('fg-step'))).toBe('2 / 3');
    expect(h.went).toEqual([]);
    h.wake();
    await idle(h);
    expect(el<HTMLButtonElement>('fg-next').disabled).toBe(false);
    // Step 3's Continue, clicked twice: one navigation.
    click(el('fg-next'));
    h.wake();
    await idle(h);
    click(el('fg-next'));
    el<HTMLButtonElement>('fg-next').disabled = false;
    click(el('fg-next'));
    h.wake();
    await idle(h);
    expect(h.went).toEqual(['unlock.html?mode=import&source=forgot']);
    // The screen has ended: nothing on it acts again.
    for (const id of ['fg-next', 'fg-back', 'fg-cancel']) {
      el<HTMLButtonElement>(id).disabled = false;
      click(el(id));
      h.wake();
      await idle(h);
    }
    expect(h.went).toEqual(['unlock.html?mode=import&source=forgot']);
  });
});

/** A two-account SLIP-0010 wallet of M (names kept), stored, with a known recipient. */
async function storedWallet(): Promise<EnvelopeV1> {
  const keys = await derivePublicKeys(M, 'slip10', [0, 1]);
  return createEnvelope({mnemonic: M, password: OLD_PW, scheme: 'slip10', accounts: [{index: 0, name: 'Main', publicKey: keys[0] ?? ''}, {index: 1, name: 'Savings', publicKey: keys[1] ?? ''}], kdf: testKdf});
}

let run: RestoreRun;
let pw: PasswordScreen;
async function restoring(o: {vault?: unknown; send?: (inner: Send) => Send; holdSleep?: boolean} = {}) {
  const h = await harness({vault: 'vault' in o ? o.vault : await storedWallet(), send: o.send, holdSleep: o.holdSleep});
  await h.ext.local.set(KNOWN_RECIPIENTS_KEY, [{address: RECIPIENT, at: 1}]);
  pw = mountPassword(h.deps);
  run = createRestoreRun(h.deps, {password: pw});
  await run.show();
  return h;
}
async function phrase(h: Harness, words: string) {
  type(el<HTMLTextAreaElement>('imp-phrase'), words);
  click(el('imp-continue'));
  await h.until(() => !h.deps.gate.isBusy() && (visible(el('v-password')) || visible(el('imp-notice'))));
}
async function newPassword(h: Harness) {
  type(el<HTMLInputElement>('pw-field'), NEW_PW);
  click(el('pw-cta'));
  await h.until(() => text(el('pw-title')) === 'Confirm your password' && !h.deps.gate.isBusy());
  type(el<HTMLInputElement>('pw-field'), NEW_PW);
  click(el('pw-cta'));
}
const forgets = (h: Harness) => h.sent.filter(m => m.type === 'vault.forgetWallet');

describe('#8 restore path (E5 with replacement, D35, D40)', () => {
  it('not-this-wallet: a different valid phrase changes nothing and sends nothing; [Try another phrase] clears the field', async () => {
    const h = await restoring();
    const before = JSON.stringify(await h.ext.local.get(VAULT_KEY));
    await phrase(h, OTHER);
    expect(text(el('imp-notice'))).toBe(
      'This phrase does not belong to the wallet in this browser. Nothing was changed. To replace that wallet without its password, remove Noctura from this browser and install it again.',
    );
    expect(text(el('imp-action'))).toBe('Try another phrase');
    expect(visible(el('imp-field'))).toBe(false);
    expect(visible(el('imp-continue'))).toBe(false);
    expect(el<HTMLTextAreaElement>('imp-phrase').value).toBe('');
    expect(run.holds()).toEqual({proof: false});
    expect(unstyled('v-import')).toEqual([]);
    expect(JSON.stringify(await h.ext.local.get(VAULT_KEY))).toBe(before);
    expect(h.sent).toEqual([]);
    click(el('imp-action'));
    await idle(h);
    expect(visible(el('imp-field'))).toBe(true);
    expect(visible(el('imp-notice'))).toBe(false);
    expect(visible(el('imp-action'))).toBe(false);
    expect(el<HTMLTextAreaElement>('imp-phrase').value).toBe('');
  });

  it('the right phrase → #5 "Restore · 2 / 2" (no scheme choice) → the same wallet under the new password, names and recipients kept → #/imported', async () => {
    const h = await restoring();
    expect(text(el('imp-line'))).toBe('');
    type(el<HTMLTextAreaElement>('imp-phrase'), M);
    click(el('imp-continue'));
    expect(text(el('imp-line'))).toBe('Checking this phrase against the wallet in this browser…');
    await h.until(() => visible(el('v-password')) && !h.deps.gate.isBusy());
    expect([text(el('pw-eyebrow')), text(el('pw-step'))]).toEqual(['Recovery', 'Restore · 2 / 2']);
    expect(visible(el('imp-choose'))).toBe(false);
    expect(el<HTMLTextAreaElement>('imp-phrase').value).toBe('');
    expect(run.holds()).toEqual({proof: true});
    expect(h.sent).toEqual([]);
    await newPassword(h);
    await h.until(() => h.went.length > 0);
    expect(h.went).toEqual(['wallet.html#/imported']);
    expect(run.holds()).toEqual({proof: false});
    expect(pw.holds()).toBe(false);
    expect(h.sent.map(m => m.type)).toEqual(['vault.forgetWallet', 'vault.setKeys']);
    const env = (await h.ext.local.get(VAULT_KEY)) as EnvelopeV1;
    expect(env.accounts.map(a => a.name)).toEqual(['Main', 'Savings']);
    expect(await decryptMnemonic(env, await unlockWithPassword(env, NEW_PW, testKdf))).toBe(M);
    await expect(unlockWithPassword(env, OLD_PW, testKdf)).rejects.toThrow();
    expect((await getSession(h.ext))?.map(a => a.index)).toEqual([0, 1]);
    expect(await h.ext.local.get(KNOWN_RECIPIENTS_KEY)).toEqual([{address: RECIPIENT, at: 1}]);
  }, 30_000);

  it('rule 6: a double submit on the confirm step sends exactly one vault.forgetWallet', async () => {
    const h = await restoring({holdSleep: true});
    type(el<HTMLTextAreaElement>('imp-phrase'), M);
    click(el('imp-continue'));
    await h.until(() => visible(el('v-password')));
    h.wake();
    await idle(h);
    type(el<HTMLInputElement>('pw-field'), NEW_PW);
    click(el('pw-cta'));
    h.wake();
    await idle(h);
    type(el<HTMLInputElement>('pw-field'), NEW_PW);
    click(el('pw-cta'));
    el<HTMLButtonElement>('pw-cta').disabled = false;
    click(el('pw-cta'));
    await h.until(() => forgets(h).length > 0);
    el<HTMLButtonElement>('pw-cta').disabled = false;
    click(el('pw-cta'));
    await h.until(() => h.went.length > 0);
    h.wake();
    await idle(h);
    expect(forgets(h)).toHaveLength(1);
    expect(h.went).toEqual(['wallet.html#/imported']);
  }, 30_000);

  it('a send still pending: the line and [Try again] with the password kept; once it closes, Try again restores — one forgetWallet per attempt', async () => {
    const h = await restoring();
    await h.ext.local.set(PENDING_KEY, [pendingRecord({state: 'pending'})]);
    const before = JSON.stringify(await h.ext.local.get(VAULT_KEY));
    await phrase(h, M);
    await newPassword(h);
    await h.until(() => text(el('pw-cta')) === 'Try again' && !h.deps.gate.isBusy());
    expect(text(el('pw-helper'))).toBe('A transaction from this wallet is still pending. Wait until it confirms or expires — about two minutes — then try again.');
    expect(visible(el('pw-helper'))).toBe(true);
    expect(visible(el('pw-form'))).toBe(false);
    expect(visible(el('pw-lede'))).toBe(false);
    expect(el<HTMLButtonElement>('pw-cta').disabled).toBe(false);
    expect(unstyled('v-password')).toEqual([]);
    expect(run.holds()).toEqual({proof: true});
    expect(pw.holds()).toBe(true);
    expect(forgets(h)).toHaveLength(1);
    // Refused before the vault write: the stored wallet is byte-identical.
    expect(JSON.stringify(await h.ext.local.get(VAULT_KEY))).toBe(before);
    // Still pending: [Try again] refuses again, with the same password still held.
    click(el('pw-cta'));
    await h.until(() => forgets(h).length === 2 && text(el('pw-cta')) === 'Try again' && !h.deps.gate.isBusy());
    expect(pw.holds()).toBe(true);
    await h.ext.local.set(PENDING_KEY, [pendingRecord({state: 'expired'})]);
    click(el('pw-cta'));
    await h.until(() => h.went.length > 0);
    expect(h.went).toEqual(['wallet.html#/imported']);
    expect(forgets(h)).toHaveLength(3);
    expect([run.holds(), pw.holds()]).toEqual([{proof: false}, false]);
    const env = (await h.ext.local.get(VAULT_KEY)) as EnvelopeV1;
    expect(await decryptMnemonic(env, await unlockWithPassword(env, NEW_PW, testKdf))).toBe(M);
  }, 30_000);

  it('rule 6: a double [Try again] (disabled lifted) is one attempt', async () => {
    const h = await restoring();
    await h.ext.local.set(PENDING_KEY, [pendingRecord({state: 'pending'})]);
    await phrase(h, M);
    await newPassword(h);
    await h.until(() => text(el('pw-cta')) === 'Try again' && !h.deps.gate.isBusy());
    click(el('pw-cta'));
    el<HTMLButtonElement>('pw-cta').disabled = false;
    click(el('pw-cta'));
    await h.until(() => text(el('pw-cta')) === 'Try again' && !h.deps.gate.isBusy());
    expect(forgets(h)).toHaveLength(2);
  }, 30_000);

  // L5 (plan review): §3.5's hidden-tab rule wins — the held password goes, and the helper says what is next.
  it('a tab hidden behind [Try again] drops the held password: "Enter a new password to try again."; the proof stays (Scope 19); a new one restores', async () => {
    const h = await restoring();
    await h.ext.local.set(PENDING_KEY, [pendingRecord({state: 'pending'})]);
    await phrase(h, M);
    await newPassword(h);
    await h.until(() => text(el('pw-cta')) === 'Try again' && !h.deps.gate.isBusy());
    h.leave();
    expect(pw.holds()).toBe(false);
    expect(run.holds()).toEqual({proof: true});
    expect(text(el('pw-helper'))).toBe('Enter a new password to try again.');
    expect(el('pw-helper').classList.contains('error')).toBe(false);
    expect(text(el('pw-cta'))).toBe('Continue');
    expect(text(el('pw-title'))).toBe('Create a password');
    expect(visible(el('pw-form'))).toBe(true);
    expect(el<HTMLInputElement>('pw-field').value).toBe('');
    expect(el<HTMLButtonElement>('pw-cta').disabled).toBe(true);
    h.back();
    expect(text(el('pw-helper'))).toBe('Enter a new password to try again.');
    await h.ext.local.set(PENDING_KEY, [pendingRecord({state: 'expired'})]);
    await newPassword(h);
    await h.until(() => h.went.length > 0);
    expect(h.went).toEqual(['wallet.html#/imported']);
    const env = (await h.ext.local.get(VAULT_KEY)) as EnvelopeV1;
    expect(await decryptMnemonic(env, await unlockWithPassword(env, NEW_PW, testKdf))).toBe(M);
  }, 30_000);

  it('back from [Try again] drops the held password and returns to #8 with the phrase (L3)', async () => {
    const h = await restoring();
    await h.ext.local.set(PENDING_KEY, [pendingRecord({state: 'pending'})]);
    await phrase(h, M);
    await newPassword(h);
    await h.until(() => text(el('pw-cta')) === 'Try again' && !h.deps.gate.isBusy());
    expect(el<HTMLButtonElement>('pw-back').disabled).toBe(false);
    click(el('pw-back'));
    await idle(h);
    expect(visible(el('v-import'))).toBe(true);
    expect(el<HTMLTextAreaElement>('imp-phrase').value).toBe(M);
    expect([run.holds(), pw.holds()]).toEqual([{proof: false}, false]);
    expect(forgets(h)).toHaveLength(1);
  }, 30_000);

  it('a tab hidden while the restore runs: a send-open answer then holds no password — the line, and a new password to retype', async () => {
    let release: () => void = () => undefined;
    let started = false;
    const h = await restoring({
      send: inner => async m => {
        if ((m as {type: string}).type !== 'vault.forgetWallet') return inner(m);
        started = true;
        await new Promise<void>(r => (release = r));
        return inner(m);
      },
    });
    await h.ext.local.set(PENDING_KEY, [pendingRecord({state: 'pending'})]);
    await phrase(h, M);
    await newPassword(h);
    await h.until(() => started);
    expect(visible(el('pw-creating'))).toBe(true);
    h.leave();
    release();
    await h.until(() => !h.deps.gate.isBusy() && !visible(el('pw-creating')));
    expect(text(el('pw-helper'))).toBe('A transaction from this wallet is still pending. Wait until it confirms or expires — about two minutes — then try again.');
    expect(text(el('pw-cta'))).toBe('Continue');
    expect(visible(el('pw-form'))).toBe(true);
    expect(pw.holds()).toBe(false);
    expect(run.holds()).toEqual({proof: true});
  }, 30_000);

  it('a tab hidden on #5 keeps the phrase and the proof (Scope 19): the typed password goes, the next one restores', async () => {
    const h = await restoring();
    await phrase(h, M);
    type(el<HTMLInputElement>('pw-field'), 'half typed pass');
    h.leave();
    h.back();
    expect(pw.holds()).toBe(false);
    expect(run.holds()).toEqual({proof: true});
    expect(text(el('pw-helper'))).toBe('Enter a new password to try again.');
    await newPassword(h);
    await h.until(() => h.went.length > 0);
    expect(h.went).toEqual(['wallet.html#/imported']);
  }, 30_000);

  it('pagehide drops everything — the proof, the password, the field; restored from the back/forward cache, the run starts again on an empty #8', async () => {
    const h = await restoring();
    await phrase(h, M);
    type(el<HTMLInputElement>('pw-field'), NEW_PW);
    h.leave('pagehide');
    expect(run.holds()).toEqual({proof: false});
    expect(pw.holds()).toBe(false);
    expect(el<HTMLTextAreaElement>('imp-phrase').value).toBe('');
    h.back('restored');
    await idle(h);
    expect(visible(el('v-import'))).toBe(true);
    expect(visible(el('imp-field'))).toBe(true);
    expect(el<HTMLTextAreaElement>('imp-phrase').value).toBe('');
    expect(h.sent).toEqual([]);
    await phrase(h, M);
    expect(visible(el('v-password'))).toBe(true);
    expect(run.holds()).toEqual({proof: true});
  }, 30_000);

  it('pagehide while the restore runs: what lands afterwards does not move the run on, and nothing is held', async () => {
    let release: () => void = () => undefined;
    let started = false;
    const h = await restoring({
      send: inner => async m => {
        if ((m as {type: string}).type !== 'vault.forgetWallet') return inner(m);
        started = true;
        await new Promise<void>(r => (release = r));
        return inner(m);
      },
    });
    await phrase(h, M);
    await newPassword(h);
    await h.until(() => started);
    h.leave('pagehide');
    release();
    await h.until(() => !h.deps.gate.isBusy() && h.sent.some(m => m.type === 'vault.setKeys'));
    await new Promise(r => setTimeout(r, 20));
    expect(h.went).toEqual([]);
    expect([run.holds(), pw.holds()]).toEqual([{proof: false}, false]);
  }, 30_000);

  it('back from #5 returns to #8 with the phrase in the field, as the plain import does (L3); the proof is dropped', async () => {
    const h = await restoring();
    await phrase(h, M);
    expect(run.holds()).toEqual({proof: true});
    click(el('pw-back'));
    await idle(h);
    expect(visible(el('v-import'))).toBe(true);
    expect(el<HTMLTextAreaElement>('imp-phrase').value).toBe(M);
    expect(run.holds()).toEqual({proof: false});
    expect(h.sent).toEqual([]);
    // Continue again proves it again.
    click(el('imp-continue'));
    await h.until(() => visible(el('v-password')) && !h.deps.gate.isBusy());
    expect(run.holds()).toEqual({proof: true});
  });

  // M5 (plan review): the harness itself refuses a bare delete, so every screen test enforces E5's rule.
  it('the page harness refuses a vault.forgetWallet with neither replacement nor guard (positive control)', async () => {
    const h = await restoring();
    await expect(h.deps.send({type: 'vault.forgetWallet', expectedRevision: 'r'})).rejects.toThrow('forgetWallet without replacement or guard');
    await expect(h.deps.send({type: 'vault.forgetWallet', expectedRevision: 'r', guard: 'none'})).rejects.toThrow('forgetWallet without replacement or guard');
    expect(h.sent).toEqual([]);
    // Negative controls: the two shapes E5 allows pass through to the background (which refuses the stale revision).
    const stale = '0'.repeat(64);
    expect(await h.deps.send({type: 'vault.forgetWallet', expectedRevision: stale, guard: 'unfunded'})).toEqual({ok: false, error: 'busy'});
    expect(await h.deps.send({type: 'vault.forgetWallet', expectedRevision: stale, replacement: await storedWallet()})).toEqual({ok: false, error: 'busy'});
    expect(h.sent.map(m => m.type)).toEqual(['vault.forgetWallet', 'vault.forgetWallet']);
  });

  it.each([
    ['busy', 'The wallet changed while you were typing. Start again.'],
    // Carry 4 (controller addition — confirmed by the owner 2026-10-01): an unlock landed mid-forget — the wallet is NOT locked, so not the busy line.
    ['unlocked', 'The wallet was unlocked while this was running, so nothing was deleted. Start again.'],
  ])('%s: back to #8 with "%s" and [Start again] → #39', async (error, line) => {
    const h = await restoring({send: inner => async m => ((m as {type: string}).type === 'vault.forgetWallet' ? {ok: false, error} : inner(m))});
    await phrase(h, M);
    await newPassword(h);
    await h.until(() => visible(el('imp-notice')) && !h.deps.gate.isBusy());
    expect(visible(el('v-import'))).toBe(true);
    expect(text(el('imp-notice-line'))).toBe(line);
    expect(visible(el('imp-notice-help'))).toBe(false);
    expect(visible(el('imp-field'))).toBe(false);
    expect([run.holds(), pw.holds()]).toEqual([{proof: false}, false]);
    expect(unstyled('v-import')).toEqual([]);
    expect(text(el('imp-action'))).toBe('Start again');
    // Rule 6: a second click (disabled lifted) is not a second navigation.
    click(el('imp-action'));
    el<HTMLButtonElement>('imp-action').disabled = false;
    click(el('imp-action'));
    await idle(h);
    click(el('imp-action'));
    await idle(h);
    expect(h.went).toEqual(['unlock.html?mode=forgot']);
  }, 30_000);

  it('the replacement re-derived as another wallet (restoreWallet’s own check): the not-this-wallet notice, nothing sent, nothing held', async () => {
    const h = await restoring();
    await phrase(h, M);
    const spy = vi.mocked(derivePublicKeys);
    spy.mockImplementationOnce(async () => ['11111111111111111111111111111111', '11111111111111111111111111111111']);
    await newPassword(h);
    await h.until(() => visible(el('imp-notice')) && !h.deps.gate.isBusy());
    expect(text(el('imp-notice'))).toBe(
      'This phrase does not belong to the wallet in this browser. Nothing was changed. To replace that wallet without its password, remove Noctura from this browser and install it again.',
    );
    expect(text(el('imp-action'))).toBe('Try another phrase');
    expect(h.sent).toEqual([]);
    expect([run.holds(), pw.holds()]).toEqual([{proof: false}, false]);
  }, 30_000);

  it('no wallet, and a damaged one, are said before any phrase is typed', async () => {
    const none = await restoring({vault: undefined});
    expect(text(el('imp-notice-line'))).toBe('No wallet on this browser yet.');
    expect(text(el('imp-action'))).toBe('Set up a wallet');
    expect(visible(el('imp-field'))).toBe(false);
    click(el('imp-action'));
    await idle(none);
    expect(none.went).toEqual(['unlock.html?mode=welcome']);
    loadPage();
    const damaged = await restoring({vault: null});
    expect(text(el('imp-notice'))).toBe("This wallet's stored data is damaged. Your funds stay on Solana; your recovery phrase still controls them. To use them here, remove Noctura from this browser, install it again and import the phrase.");
    expect(visible(el('imp-action'))).toBe(false);
    expect(damaged.sent).toEqual([]);
  });

  it('back from #8 goes to #39 — from the field and from a notice', async () => {
    const h = await restoring();
    click(el('imp-back'));
    await idle(h);
    expect(h.went).toEqual(['unlock.html?mode=forgot']);
    loadPage();
    const n = await restoring();
    await phrase(n, OTHER);
    click(el('imp-back'));
    await idle(n);
    expect(n.went).toEqual(['unlock.html?mode=forgot']);
  });
});

describe('the restore run in the page (startMode)', () => {
  it('?mode=forgot shows #39; ?mode=import&source=forgot shows #8 on the restore path — not the B1b-1 section', async () => {
    const {startMode} = await import('../modes');
    const h = await harness({vault: await storedWallet()});
    startMode({mode: 'forgot'}, h.deps);
    expect(visible(el('v-forgot'))).toBe(true);
    expect(visible(el('import'))).toBe(false);
    loadPage();
    const r = await harness({vault: await storedWallet()});
    startMode({mode: 'import', source: 'forgot'}, r.deps);
    expect(visible(el('v-import'))).toBe(true);
    expect(visible(el('import'))).toBe(false);
    type(el<HTMLTextAreaElement>('imp-phrase'), OTHER);
    click(el('imp-continue'));
    await r.until(() => visible(el('imp-notice')) && !r.deps.gate.isBusy());
    expect(text(el('imp-notice-line'))).toBe('This phrase does not belong to the wallet in this browser. Nothing was changed.');
    expect(r.sent).toEqual([]);
  });
});
