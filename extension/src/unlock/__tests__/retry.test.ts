// @vitest-environment happy-dom
import {addPasskeyWrap, createEnvelope, unlockWithPassword, type EnvelopeV1, type Kdf} from '../../vault/envelope';
import type {CredentialsApi} from '../../vault/passkey';
import {VAULT_KEY} from '../../background/accountsStore';
import {KNOWN_RECIPIENTS_KEY} from '../../background/knownRecipients';
import {getSession} from '../../background/session';
import {createRetryRun, type RetryRun} from '../screens/retryRun';
import {mountPassword, type PasswordScreen} from '../screens/password';
import type {Send} from '../types';
import {click, el, harness, loadPage, testKdf, text, type, unstyled, visible, type Harness} from './pageHarness';

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

const A = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const K_A = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const B = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
const A_PW = 'correct horse battery';
const B_PW = 'the new wallet password';
const C_PW = 'a third password, typed after';
const RECIPIENT = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';
const PRF = new Uint8Array(32).fill(7);

beforeEach(() => {
  loadPage();
  prfOutputs.length = 0;
});

let run: RetryRun;
let pw: PasswordScreen;
/** Every message the page sent — a refusal a test's `send` answers in the background's place included (h.sent has only what reached it). */
let asked: {type: string; [k: string]: unknown}[] = [];

async function oldWallet(): Promise<EnvelopeV1> {
  return createEnvelope({mnemonic: A, password: A_PW, scheme: 'slip10', accounts: [{index: 0, name: 'Account 1', publicKey: K_A}], kdf: testKdf});
}

async function retrying(
  o: {
    balance?: (owner: string) => bigint;
    send?: (inner: Send) => Send;
    vault?: EnvelopeV1 | null;
    credentials?: CredentialsApi;
    holdSleep?: boolean;
    sleep?: (ms: number) => Promise<void>;
    read?: (inner: () => Promise<unknown>) => () => Promise<unknown>;
    kdf?: (inner: Kdf) => Kdf;
  } = {},
) {
  asked = [];
  const old = o.vault === undefined ? await oldWallet() : o.vault;
  const h = await harness({
    ...(old === null ? {} : {vault: old}),
    send: inner => {
      const s = o.send === undefined ? inner : o.send(inner);
      return async m => {
        asked.push(JSON.parse(JSON.stringify(m)) as {type: string});
        return s(m);
      };
    },
    credentials: o.credentials,
    holdSleep: o.holdSleep,
    reader: {getBalance: async owner => o.balance?.(owner) ?? 0n, getMultipleLamports: async keys => keys.map(() => 0n)},
  });
  await h.ext.local.set(KNOWN_RECIPIENTS_KEY, [{address: RECIPIENT, at: 1}]);
  const kdfCalls = {n: 0};
  const counted: Kdf = (p, salt, params) => ((kdfCalls.n += 1), testKdf(p, salt, params));
  h.deps.kdf = o.kdf === undefined ? counted : o.kdf(counted);
  if (o.sleep !== undefined) h.deps.sleep = o.sleep;
  if (o.read !== undefined) h.deps.store = {...h.deps.store, readEnvelope: o.read(h.deps.store.readEnvelope)};
  pw = mountPassword(h.deps);
  run = createRetryRun(h.deps, {password: pw});
  await run.show();
  return {h, old, run, kdfCalls};
}
const NOTHING = {phrase: false, prepared: false, proof: false};
const ALL = {phrase: true, prepared: true, proof: true};
const idle = (h: Harness) => h.until(() => !h.deps.gate.isBusy());
const forgets = () => asked.filter(m => m.type === 'vault.forgetWallet');
const stores = () => asked.filter(m => m.type === 'vault.storeEnvelope');
/** A `send` that refuses vault.storeEnvelope while `fail.on` holds. */
const failingStore = (fail: {on: boolean}) => (inner: Send): Send => async m => ((m as {type: string}).type === 'vault.storeEnvelope' && fail.on ? {ok: false, error: 'something'} : inner(m));
const refusingForget = (error: string) => (inner: Send): Send => async m => ((m as {type: string}).type === 'vault.forgetWallet' ? {ok: false, error} : inner(m));

async function prove(h: Harness, password: string) {
  type(el<HTMLInputElement>('rp-password'), password);
  click(el('rp-confirm'));
  await h.until(() => !h.deps.gate.isBusy() && (visible(el('v-import')) || text(el('rp-helper')) !== ''));
}
async function phraseB(h: Harness) {
  type(el<HTMLTextAreaElement>('imp-phrase'), B);
  click(el('imp-continue'));
  await h.until(() => visible(el('v-password')) && !h.deps.gate.isBusy());
}
/** Enter and confirm `password` on #5, then wait for the run's answer. */
async function newPassword(h: Harness, password: string) {
  type(el<HTMLInputElement>('pw-field'), password);
  click(el('pw-cta'));
  await h.until(() => text(el('pw-title')) === 'Confirm your password' && !h.deps.gate.isBusy());
  type(el<HTMLInputElement>('pw-field'), password);
  click(el('pw-cta'));
  await settled(h);
}
const settled = (h: Harness) =>
  h.until(() => !h.deps.gate.isBusy() && (h.went.length > 0 || text(el('pw-helper')) !== '' || visible(el('pw-notice')) || visible(el('imp-notice'))));
async function importB(h: Harness) {
  await phraseB(h);
  await newPassword(h, B_PW);
}

describe('#8 retry path: the password of the wallet being replaced (D41, E5 factor proof)', () => {
  it('asks first, in the design’s chrome; a wrong password is refused and nothing changes', async () => {
    const {h, old} = await retrying();
    expect(visible(el('v-retry'))).toBe(true);
    expect(text(el('v-retry').querySelector('h1'))).toBe('Confirm with the password of the wallet you are replacing');
    expect(text(el('rp-confirm'))).toBe('Confirm');
    expect(visible(el('rp-passkey'))).toBe(false);
    expect(unstyled('v-retry')).toEqual([]);
    await prove(h, 'not the password at all');
    expect(text(el('rp-helper'))).toBe('That did not confirm it.');
    expect(el<HTMLInputElement>('rp-password').value).toBe('');
    expect(visible(el('v-import'))).toBe(false);
    expect(await h.ext.local.get(VAULT_KEY)).toEqual(old);
    expect(h.sent).toEqual([]);
    expect(run.holds()).toEqual(NOTHING);
  });

  it('the right password → #8 → B → #5 → the old wallet deleted under the guard, B stored and unlocked → #/imported', async () => {
    const {h} = await retrying();
    await prove(h, A_PW);
    expect(visible(el('v-import'))).toBe(true);
    expect(el<HTMLTextAreaElement>('imp-phrase').value).toBe('');
    expect(run.holds()).toEqual({phrase: false, prepared: false, proof: true});
    await phraseB(h);
    expect(text(el('pw-step'))).toBe('Import · 2 / 2');
    expect(run.holds()).toEqual({phrase: true, prepared: false, proof: true});
    await newPassword(h, B_PW);
    expect(h.went).toEqual(['wallet.html#/imported']);
    const forget = forgets();
    expect(forget).toHaveLength(1);
    expect(forget[0]?.guard).toBe('unfunded');
    expect(forget[0]?.replacement).toBeUndefined();
    const env = (await h.ext.local.get(VAULT_KEY)) as EnvelopeV1;
    expect(env.accounts.map(a => a.publicKey)).not.toContain(K_A);
    await unlockWithPassword(env, B_PW, testKdf);
    await expect(unlockWithPassword(env, A_PW, testKdf)).rejects.toThrow();
    expect((await getSession(h.ext))?.map(a => a.publicKey)).toEqual(env.accounts.map(a => a.publicKey));
    expect(await h.ext.local.get(KNOWN_RECIPIENTS_KEY)).toBeUndefined();
    expect(run.holds()).toEqual(NOTHING);
    expect(pw.holds()).toBe(false);
  }, 30_000);

  // C6, the spec's E2E 12 second run at unit scale: funds arrive after #40 rendered empty.
  it('funds that arrived meanwhile: "This wallet now holds funds. Nothing was changed." — the stored envelope is byte-identical', async () => {
    const {h, old} = await retrying({balance: owner => (owner === K_A ? 1n : 0n)});
    await prove(h, A_PW);
    await importB(h);
    expect(text(el('pw-notice-line'))).toBe('This wallet now holds funds. Nothing was changed.');
    // H2 (plan review): a `stop` keeps nothing of B (its envelope, its session secret keys, its phrase) nor the proof.
    expect(run.holds()).toEqual(NOTHING);
    expect(pw.holds()).toBe(false);
    expect(visible(el('pw-cta'))).toBe(false);
    expect(JSON.stringify(await h.ext.local.get(VAULT_KEY))).toBe(JSON.stringify(old));
    expect(h.went).toEqual([]);
  }, 30_000);

  it('a failed store after the delete: "The new wallet was not saved. Try again." — [Try again] stores B alone', async () => {
    const fail = {on: true};
    const {h} = await retrying({send: failingStore(fail)});
    await prove(h, A_PW);
    await importB(h);
    expect(text(el('pw-helper'))).toBe('The new wallet was not saved. Try again.');
    expect(text(el('pw-cta'))).toBe('Try again');
    expect(run.holds()).toEqual(ALL);
    expect(pw.holds()).toBe(true);
    expect(await h.ext.local.get(VAULT_KEY)).toBeUndefined();
    fail.on = false;
    click(el('pw-cta'));
    await h.until(() => h.went.length > 0);
    expect(h.went).toEqual(['wallet.html#/imported']);
    expect(forgets()).toHaveLength(1);
    await unlockWithPassword((await h.ext.local.get(VAULT_KEY)) as EnvelopeV1, B_PW, testKdf);
    await idle(h);
    expect(run.holds()).toEqual(NOTHING);
    expect(pw.holds()).toBe(false);
  }, 30_000);

  it('a [Try again] answered wallet-exists (another tab created one) says so and stops — no second delete (R2-L6)', async () => {
    const fail = {on: true};
    const {h} = await retrying({send: failingStore(fail)});
    await prove(h, A_PW);
    await importB(h);
    expect(run.holds()).toEqual(ALL);
    const third = await createEnvelope({mnemonic: A, password: A_PW, scheme: 'cli', accounts: [{index: 0, name: 'X', publicKey: 'EHqmfkN89RJ7Y33CXM6uCzhVeuywHoJXZZLszBHHZy7o'}], kdf: testKdf});
    await h.ext.local.set(VAULT_KEY, third);
    fail.on = false;
    click(el('pw-cta'));
    await h.until(() => text(el('pw-notice-line')) === 'A wallet already exists in this browser. Nothing was changed.' && !h.deps.gate.isBusy());
    expect(visible(el('pw-cta'))).toBe(false);
    expect(forgets()).toHaveLength(1);
    expect(await h.ext.local.get(VAULT_KEY)).toEqual(third);
    expect(run.holds()).toEqual(NOTHING);
    expect(pw.holds()).toBe(false);
    expect(h.went).toEqual([]);
  }, 30_000);

  // H2 + L5 (plan review): a hidden tab drops the held password AND B prepared under it — B is stored
  // under the password typed next, never under the one the user was told to replace.
  it('a tab hidden behind [Try again]: B prepared goes with the password; B is stored under the new one', async () => {
    const fail = {on: true};
    const {h} = await retrying({send: failingStore(fail)});
    await prove(h, A_PW);
    await importB(h);
    expect(text(el('pw-cta'))).toBe('Try again');
    h.leave();
    expect(run.holds()).toEqual({phrase: true, prepared: false, proof: true});
    expect(pw.holds()).toBe(false);
    expect(text(el('pw-helper'))).toBe('Enter a new password to try again.');
    fail.on = false;
    await newPassword(h, C_PW);
    await h.until(() => h.went.length > 0);
    const env = (await h.ext.local.get(VAULT_KEY)) as EnvelopeV1;
    await unlockWithPassword(env, C_PW, testKdf);
    await expect(unlockWithPassword(env, B_PW, testKdf)).rejects.toThrow();
    expect(forgets()).toHaveLength(1);
    expect(run.holds()).toEqual(NOTHING);
  }, 30_000);

  it('a tab hidden while the delete runs, whose store then fails: B prepared is not kept; #5 asks for a new password (L5)', async () => {
    let release: () => void = () => undefined;
    let started = false;
    const fail = {on: true};
    const {h} = await retrying({
      send: inner => async m => {
        const t = (m as {type: string}).type;
        if (t === 'vault.forgetWallet') {
          started = true;
          await new Promise<void>(r => (release = r));
        }
        return failingStore(fail)(inner)(m);
      },
    });
    await prove(h, A_PW);
    await phraseB(h);
    type(el<HTMLInputElement>('pw-field'), B_PW);
    click(el('pw-cta'));
    await idle(h);
    type(el<HTMLInputElement>('pw-field'), B_PW);
    click(el('pw-cta'));
    await h.until(() => started);
    h.leave();
    release();
    await settled(h);
    expect(text(el('pw-helper'))).toBe('Enter a new password to try again.');
    expect(text(el('pw-cta'))).toBe('Continue');
    expect(run.holds()).toEqual({phrase: true, prepared: false, proof: true});
    expect(pw.holds()).toBe(false);
    fail.on = false;
    await newPassword(h, C_PW);
    await h.until(() => h.went.length > 0);
    const env = (await h.ext.local.get(VAULT_KEY)) as EnvelopeV1;
    await unlockWithPassword(env, C_PW, testKdf);
    await expect(unlockWithPassword(env, B_PW, testKdf)).rejects.toThrow();
    expect(forgets()).toHaveLength(1);
    expect(run.holds()).toEqual(NOTHING);
  }, 30_000);

  it.each([
    ['busy', 'The wallet changed while you were typing. Start again.', 'Start again', 'unlock.html?mode=import&source=retry'],
    ['unlocked', 'The wallet was unlocked while this was running, so nothing was deleted. Start again.', 'Start again', 'unlock.html?mode=import&source=retry'],
    ['no-wallet', 'No wallet on this browser yet.', 'Set up a wallet', 'unlock.html?mode=welcome'],
    ['stored-invalid', "This wallet's stored data is damaged.", null, null],
  ])('the forget answered %s ends the run on #8’s notice, keeping nothing', async (error, line, label, target) => {
    const {h} = await retrying({send: refusingForget(error)});
    await prove(h, A_PW);
    await importB(h);
    expect(visible(el('v-import'))).toBe(true);
    expect(text(el('imp-notice-line'))).toBe(line);
    expect(run.holds()).toEqual(NOTHING);
    expect(pw.holds()).toBe(false);
    expect(visible(el('imp-action'))).toBe(label !== null);
    if (label !== null) {
      expect(text(el('imp-action'))).toBe(label);
      click(el('imp-action'));
      click(el('imp-action'));
      await idle(h);
      expect(h.went).toEqual([target]);
    }
  }, 30_000);

  it.each([
    ['unreachable', 'Balances could not be checked, so nothing was changed. Try again later.'],
    ['coordinator-refused', 'The server is not answering for now — try again in 10 minutes.'],
  ])("the guard's %s: %s — and the run stops, keeping nothing", async (error, line) => {
    const {h, old} = await retrying({send: refusingForget(error)});
    await prove(h, A_PW);
    await importB(h);
    expect(text(el('pw-notice-line'))).toBe(line);
    expect(visible(el('pw-cta'))).toBe(false);
    expect(run.holds()).toEqual(NOTHING);
    expect(pw.holds()).toBe(false);
    expect(await h.ext.local.get(VAULT_KEY)).toEqual(old);
  }, 30_000);

  it('the guard’s send-open: its line + [Try again], B and the proof kept; the retry (send closed) deletes under the guard and stores', async () => {
    let open = true;
    const {h} = await retrying({send: inner => async m => ((m as {type: string}).type === 'vault.forgetWallet' && open ? {ok: false, error: 'send-open'} : inner(m))});
    await prove(h, A_PW);
    await importB(h);
    expect(text(el('pw-helper'))).toBe('A transaction from this wallet is still pending. Wait until it confirms or expires — about two minutes — then try again.');
    expect(text(el('pw-cta'))).toBe('Try again');
    expect(run.holds()).toEqual(ALL);
    open = false;
    click(el('pw-cta'));
    await h.until(() => h.went.length > 0);
    expect(h.went).toEqual(['wallet.html#/imported']);
    // Nothing was deleted by the refused one: the retry is the first delete, with the guard again.
    expect(forgets().map(f => f.guard)).toEqual(['unfunded', 'unfunded']);
    await unlockWithPassword((await h.ext.local.get(VAULT_KEY)) as EnvelopeV1, B_PW, testKdf);
    expect(run.holds()).toEqual(NOTHING);
  }, 30_000);

  // Task 2 carry: a store whose reply was lost had landed — the [Try again] finds B stored (wallet-exists with
  // B's own revision) and goes on, instead of a false "a wallet already exists".
  it('a lost store reply after the delete: [Try again] finds B stored and goes on — no second delete', async () => {
    let lose = true;
    const {h} = await retrying({
      send: inner => async m => {
        const r = await inner(m);
        if ((m as {type: string}).type === 'vault.storeEnvelope' && lose) {
          lose = false;
          throw new Error('the reply was lost');
        }
        return r;
      },
    });
    await prove(h, A_PW);
    await importB(h);
    expect(text(el('pw-helper'))).toBe('The new wallet was not saved. Try again.');
    click(el('pw-cta'));
    await h.until(() => h.went.length > 0);
    expect(h.went).toEqual(['wallet.html#/imported']);
    expect(forgets()).toHaveLength(1);
    expect(stores()).toHaveLength(2);
    expect(await getSession(h.ext)).not.toBeNull();
    expect(run.holds()).toEqual(NOTHING);
  }, 30_000);

  // Controller addition (Task 13): a delete whose reply was lost may have landed. [Try again] reads the vault first:
  // gone → the delete landed, and the store runs alone. Never a second delete.
  it('a lost delete reply: [Try again] finds the old wallet gone and stores B alone — no second delete', async () => {
    let lose = true;
    const {h} = await retrying({
      send: inner => async m => {
        const r = await inner(m);
        if ((m as {type: string}).type === 'vault.forgetWallet' && lose) {
          lose = false;
          throw new Error('the reply was lost');
        }
        return r;
      },
    });
    await prove(h, A_PW);
    await importB(h);
    expect(text(el('pw-helper'))).toBe('Something went wrong. Try again.');
    expect(run.holds()).toEqual(ALL);
    click(el('pw-cta'));
    await h.until(() => h.went.length > 0);
    expect(h.went).toEqual(['wallet.html#/imported']);
    expect(forgets()).toHaveLength(1);
    await unlockWithPassword((await h.ext.local.get(VAULT_KEY)) as EnvelopeV1, B_PW, testKdf);
  }, 30_000);

  it('a failed delete that did not land: [Try again] finds the proven wallet still stored and deletes under the guard again', async () => {
    let fail = true;
    const {h} = await retrying({send: inner => async m => ((m as {type: string}).type === 'vault.forgetWallet' && fail ? ((fail = false), {ok: false, error: 'failed'}) : inner(m))});
    await prove(h, A_PW);
    await importB(h);
    expect(text(el('pw-helper'))).toBe('Something went wrong. Try again.');
    click(el('pw-cta'));
    await h.until(() => h.went.length > 0);
    expect(forgets().map(f => f.guard)).toEqual(['unfunded', 'unfunded']);
  }, 30_000);

  it('a failed delete, then the stored wallet changed: [Try again] sends nothing and says "Start again"', async () => {
    const {h} = await retrying({send: refusingForget('failed')});
    await prove(h, A_PW);
    await importB(h);
    // Another tab stored a different wallet meanwhile (a valid cli wallet of A stands for it).
    const changed = await createEnvelope({mnemonic: A, password: A_PW, scheme: 'cli', accounts: [{index: 0, name: 'X', publicKey: 'EHqmfkN89RJ7Y33CXM6uCzhVeuywHoJXZZLszBHHZy7o'}], kdf: testKdf});
    await h.ext.local.set(VAULT_KEY, changed);
    click(el('pw-cta'));
    await h.until(() => visible(el('imp-notice')) && !h.deps.gate.isBusy());
    expect(text(el('imp-notice-line'))).toBe('The wallet changed while you were typing. Start again.');
    expect(forgets()).toHaveLength(1);
    expect(run.holds()).toEqual(NOTHING);
  }, 30_000);

  it('back from the password step returns to #40', async () => {
    const {h} = await retrying();
    click(el('rp-back'));
    expect(h.went).toEqual(['wallet.html#/imported']);
  });

  it('back from #8 returns to the password step and drops the proof; back from #5 puts B back in the field, not in memory', async () => {
    const {h} = await retrying();
    await prove(h, A_PW);
    await phraseB(h);
    click(el('pw-back'));
    await idle(h);
    expect(visible(el('v-import'))).toBe(true);
    expect(el<HTMLTextAreaElement>('imp-phrase').value).toBe(B);
    expect(run.holds()).toEqual({phrase: false, prepared: false, proof: true});
    click(el('imp-back'));
    await idle(h);
    expect(visible(el('v-retry'))).toBe(true);
    expect(el<HTMLTextAreaElement>('imp-phrase').value).toBe('');
    expect(run.holds()).toEqual(NOTHING);
    expect(asked.map(m => m.type)).toEqual(['wallet.probeBalances']);
    // The proof again, then the run as before.
    await prove(h, A_PW);
    await importB(h);
    expect(h.went).toEqual(['wallet.html#/imported']);
  }, 30_000);

  it('no wallet / a damaged one / an unreadable read at the start: #8’s notice, no password field offered', async () => {
    let h = (await retrying({vault: null})).h;
    expect(text(el('imp-notice-line'))).toBe('No wallet on this browser yet.');
    expect(text(el('imp-action'))).toBe('Set up a wallet');
    click(el('imp-action'));
    await idle(h);
    expect(h.went).toEqual(['unlock.html?mode=welcome']);
    loadPage();
    h = (await retrying({vault: {not: 'an envelope'} as unknown as EnvelopeV1})).h;
    expect(text(el('imp-notice'))).toBe(
      "This wallet's stored data is damaged. Your funds stay on Solana; your recovery phrase still controls them. To use them here, remove Noctura from this browser, install it again and import the phrase.",
    );
    expect(visible(el('imp-action'))).toBe(false);
    loadPage();
    h = (
      await retrying({
        read: () => async () => {
          throw new Error('Extension context invalidated');
        },
      })
    ).h;
    expect(text(el('imp-notice-line'))).toBe("This wallet's stored data could not be read. Reload this page.");
    expect(visible(el('v-retry'))).toBe(false);
    expect(h.sent).toEqual([]);
  });

  it('the proof answered no-wallet or damaged (the vault changed after the screen was shown): #8’s notice', async () => {
    const {h} = await retrying();
    await h.ext.local.remove(VAULT_KEY);
    await prove(h, A_PW);
    expect(text(el('imp-notice-line'))).toBe('No wallet on this browser yet.');
    expect(run.holds()).toEqual(NOTHING);
  });
});

describe('#8 retry path: the factor proof follows #9/#10’s rules', () => {
  it('the backoff: the second wrong waits with the wait line (the field empty, every control disabled); damaged in between is not charged', async () => {
    const waits: number[] = [];
    let wake: () => void = () => undefined;
    const {h, old} = await retrying({
      sleep: ms => {
        if (ms <= 500) return Promise.resolve();
        waits.push(ms);
        return new Promise<void>(r => (wake = r));
      },
    });
    await prove(h, 'wrong password number one');
    expect(waits).toEqual([]);
    // A damaged read in between (twice): never a guess, so never charged (createWrongBackoff counts `wrong` only).
    for (let i = 0; i < 2; i++) {
      await h.ext.local.set(VAULT_KEY, null);
      await prove(h, A_PW);
      expect(text(el('imp-notice-line'))).toBe("This wallet's stored data is damaged.");
      click(el('imp-back'));
      await idle(h);
      expect(visible(el('v-retry'))).toBe(true);
    }
    await h.ext.local.set(VAULT_KEY, old);
    type(el<HTMLInputElement>('rp-password'), 'wrong password number two');
    click(el('rp-confirm'));
    expect(el<HTMLInputElement>('rp-password').value).toBe('');
    await h.until(() => waits.length > 0);
    expect(waits).toEqual([1000]);
    expect(text(el('rp-helper'))).toBe('That did not confirm it. Wait a moment before trying again.');
    expect([el<HTMLButtonElement>('rp-confirm').disabled, el<HTMLInputElement>('rp-password').disabled, el<HTMLButtonElement>('rp-back').disabled]).toEqual([true, true, true]);
    // The one polite region says the wait once: nothing in this screen counts it down.
    expect(el('v-retry').querySelectorAll('[aria-live]')).toHaveLength(1);
    wake();
    await idle(h);
    expect(text(el('rp-helper'))).toBe('That did not confirm it.');
    expect(h.sent).toEqual([]);
  });

  it('rule 6: a second [Confirm] (a password typed again, disabled lifted) before the first settles runs one proof (one KDF run)', async () => {
    const {h, kdfCalls} = await retrying();
    type(el<HTMLInputElement>('rp-password'), A_PW);
    click(el('rp-confirm'));
    expect(el<HTMLButtonElement>('rp-confirm').disabled).toBe(true);
    type(el<HTMLInputElement>('rp-password'), A_PW);
    el<HTMLButtonElement>('rp-confirm').disabled = false;
    el<HTMLButtonElement>('rp-back').disabled = false;
    click(el('rp-confirm'));
    click(el('rp-back'));
    await h.until(() => !h.deps.gate.isBusy() && visible(el('v-import')));
    expect(kdfCalls.n).toBe(1);
    expect(h.went).toEqual([]);
    // On #8 the password step's buttons act no more (the phase guard), whatever `disabled` says.
    type(el<HTMLInputElement>('rp-password'), A_PW);
    for (const id of ['rp-confirm', 'rp-back', 'rp-passkey']) {
      el<HTMLButtonElement>(id).disabled = false;
      click(el(id));
    }
    await idle(h);
    expect(kdfCalls.n).toBe(1);
    expect(h.went).toEqual([]);
    expect(visible(el('v-import'))).toBe(true);
  });

  it('rule 6: a double [Try again] stores once', async () => {
    const fail = {on: true};
    const {h} = await retrying({send: failingStore(fail)});
    await prove(h, A_PW);
    await importB(h);
    fail.on = false;
    click(el('pw-cta'));
    el<HTMLButtonElement>('pw-cta').disabled = false;
    click(el('pw-cta'));
    await h.until(() => h.went.length > 0);
    await idle(h);
    expect(stores()).toHaveLength(2);
    expect(h.went).toEqual(['wallet.html#/imported']);
  }, 30_000);

  it('[Confirm with passkey] when the wallet has one: it proves the factor, and the PRF output is zeroed', async () => {
    const old = await oldWallet();
    const dataKey = await unlockWithPassword(old, A_PW, testKdf);
    const withKey = await addPasskeyWrap(old, dataKey, PRF, new Uint8Array(16).fill(1), new Uint8Array(32).fill(2));
    const cred = {rawId: new Uint8Array(16).fill(1).buffer, getClientExtensionResults: () => ({prf: {results: {first: PRF.slice().buffer}}})} as unknown as Credential;
    const {h} = await retrying({vault: withKey, credentials: {create: async () => null, get: async () => cred}});
    expect(visible(el('rp-passkey'))).toBe(true);
    expect(text(el('rp-passkey'))).toBe('Confirm with passkey');
    click(el('rp-passkey'));
    await h.until(() => !h.deps.gate.isBusy() && visible(el('v-import')));
    expect(run.holds()).toEqual({phrase: false, prepared: false, proof: true});
    expect(prfOutputs).toHaveLength(1);
    expect(prfOutputs.every(o => o.every(b => b === 0))).toBe(true);
  });

  it('[Confirm with passkey] on a device without PRF says so; the password still works', async () => {
    const old = await oldWallet();
    const dataKey = await unlockWithPassword(old, A_PW, testKdf);
    const withKey = await addPasskeyWrap(old, dataKey, PRF, new Uint8Array(16).fill(1), new Uint8Array(32).fill(2));
    const {h} = await retrying({vault: withKey});
    click(el('rp-passkey'));
    await h.until(() => text(el('rp-helper')) === 'This device cannot confirm with a passkey; your password still works.' && !h.deps.gate.isBusy());
    await prove(h, A_PW);
    expect(visible(el('v-import'))).toBe(true);
  });

  it('a hidden tab or pagehide empties the password field', async () => {
    const {h} = await retrying();
    type(el<HTMLInputElement>('rp-password'), A_PW);
    h.leave();
    expect(el<HTMLInputElement>('rp-password').value).toBe('');
    type(el<HTMLInputElement>('rp-password'), A_PW);
    h.leave('pagehide');
    expect(el<HTMLInputElement>('rp-password').value).toBe('');
  });
});

// Task 12's pattern: pagehide while any await of the run is open — what settles afterwards keeps nothing and shows nothing.
describe('#8 retry path: pagehide at each await', () => {
  it('while the factor proof runs: the proof that resolves afterwards is never kept; #8 never shows', async () => {
    let release: () => void = () => undefined;
    let reading = false;
    let reads = 0;
    const {h} = await retrying({
      read: stored => async () => {
        reads += 1;
        // The first read is show()'s; the second is the factor proof's — held open until pagehide.
        if (reads === 2) {
          reading = true;
          await new Promise<void>(r => (release = r));
        }
        return stored();
      },
    });
    type(el<HTMLInputElement>('rp-password'), A_PW);
    click(el('rp-confirm'));
    await h.until(() => reading);
    h.leave('pagehide');
    expect(run.holds()).toEqual(NOTHING);
    release();
    await idle(h);
    await new Promise(r => setTimeout(r, 30));
    expect(run.holds()).toEqual(NOTHING);
    expect(visible(el('v-import'))).toBe(false);
    expect(text(el('rp-helper'))).toBe('');
    expect(h.sent).toEqual([]);
  });

  it('while the passkey prompt is open: the PRF output that arrives afterwards is zeroed and proves nothing', async () => {
    const old = await oldWallet();
    const dataKey = await unlockWithPassword(old, A_PW, testKdf);
    const withKey = await addPasskeyWrap(old, dataKey, PRF, new Uint8Array(16).fill(1), new Uint8Array(32).fill(2));
    let release: () => void = () => undefined;
    let asking = false;
    const cred = {rawId: new Uint8Array(16).fill(1).buffer, getClientExtensionResults: () => ({prf: {results: {first: PRF.slice().buffer}}})} as unknown as Credential;
    const {h, kdfCalls} = await retrying({
      vault: withKey,
      credentials: {
        create: async () => null,
        get: async () => {
          asking = true;
          await new Promise<void>(r => (release = r));
          return cred;
        },
      },
    });
    click(el('rp-passkey'));
    await h.until(() => asking);
    h.leave('pagehide');
    release();
    await idle(h);
    await new Promise(r => setTimeout(r, 30));
    expect(run.holds()).toEqual(NOTHING);
    expect(visible(el('v-import'))).toBe(false);
    expect(prfOutputs).toHaveLength(1);
    expect(prfOutputs.every(o => o.every(b => b === 0))).toBe(true);
    expect(kdfCalls.n).toBe(0);
  });

  it('while #8 detects B’s scheme (detectImport): #5 never shows, nothing is kept', async () => {
    let release: () => void = () => undefined;
    let probing = false;
    const {h} = await retrying({
      send: inner => async m => {
        if ((m as {type: string}).type === 'wallet.probeBalances') {
          probing = true;
          await new Promise<void>(r => (release = r));
        }
        return inner(m);
      },
    });
    await prove(h, A_PW);
    type(el<HTMLTextAreaElement>('imp-phrase'), B);
    click(el('imp-continue'));
    await h.until(() => probing);
    h.leave('pagehide');
    expect(run.holds()).toEqual(NOTHING);
    release();
    await idle(h);
    await new Promise(r => setTimeout(r, 30));
    expect(run.holds()).toEqual(NOTHING);
    expect(visible(el('v-password'))).toBe(false);
    expect(forgets()).toEqual([]);
  });

  it('while B is encrypted (prepareWallet): nothing is deleted, nothing stored, nothing kept', async () => {
    let release: () => void = () => undefined;
    let encrypting = false;
    const {h, old} = await retrying({
      kdf: inner => async (p, salt, params) => {
        // The first KDF run is the factor proof's; the second encrypts B.
        if (encrypting === false && run.holds().phrase) {
          encrypting = true;
          await new Promise<void>(r => (release = r));
        }
        return inner(p, salt, params);
      },
    });
    await prove(h, A_PW);
    await phraseB(h);
    type(el<HTMLInputElement>('pw-field'), B_PW);
    click(el('pw-cta'));
    await idle(h);
    type(el<HTMLInputElement>('pw-field'), B_PW);
    click(el('pw-cta'));
    await h.until(() => encrypting);
    h.leave('pagehide');
    expect(run.holds()).toEqual(NOTHING);
    release();
    await idle(h);
    await new Promise(r => setTimeout(r, 30));
    expect(run.holds()).toEqual(NOTHING);
    expect(pw.holds()).toBe(false);
    expect(h.sent).toEqual([{type: 'wallet.probeBalances', publicKeys: expect.any(Array)}]);
    expect(await h.ext.local.get(VAULT_KEY)).toEqual(old);
    expect(h.went).toEqual([]);
  }, 30_000);

  it('while the delete runs (replaceEmptyWallet): what lands afterwards does not move the run on, and nothing is kept', async () => {
    let release: () => void = () => undefined;
    let started = false;
    const {h} = await retrying({
      send: inner => async m => {
        if ((m as {type: string}).type === 'vault.forgetWallet') {
          started = true;
          await new Promise<void>(r => (release = r));
        }
        return inner(m);
      },
    });
    await prove(h, A_PW);
    await phraseB(h);
    type(el<HTMLInputElement>('pw-field'), B_PW);
    click(el('pw-cta'));
    await idle(h);
    type(el<HTMLInputElement>('pw-field'), B_PW);
    click(el('pw-cta'));
    await h.until(() => started);
    h.leave('pagehide');
    expect(run.holds()).toEqual(NOTHING);
    release();
    await h.until(() => !h.deps.gate.isBusy() && h.sent.some(m => m.type === 'vault.setKeys'));
    await new Promise(r => setTimeout(r, 30));
    expect(h.went).toEqual([]);
    expect(run.holds()).toEqual(NOTHING);
    expect(pw.holds()).toBe(false);
    expect(visible(el('pw-notice'))).toBe(false);
    expect(forgets()).toHaveLength(1);
  }, 30_000);

  it('restored from the back/forward cache: the run starts again at the password step, with an empty field', async () => {
    const {h} = await retrying();
    await prove(h, A_PW);
    type(el<HTMLTextAreaElement>('imp-phrase'), B);
    h.leave('pagehide');
    expect(run.holds()).toEqual(NOTHING);
    h.back('restored');
    await idle(h);
    await h.until(() => visible(el('v-retry')));
    expect(el<HTMLInputElement>('rp-password').value).toBe('');
    expect(el<HTMLTextAreaElement>('imp-phrase').value).toBe('');
    await prove(h, A_PW);
    expect(visible(el('v-import'))).toBe(true);
    expect(run.holds()).toEqual({phrase: false, prepared: false, proof: true});
  });
});

describe('the page routes source=retry to this run (one page gate)', () => {
  // Moved from import.test.ts (Task 12): the B1b-1 section it covered is gone.
  it('startMode shows the password step, whose [Confirm] runs under the page’s one gate', async () => {
    const {startMode} = await import('../modes');
    const h = await harness({vault: await oldWallet()});
    startMode({mode: 'import', source: 'retry'}, h.deps);
    await h.until(() => visible(el('v-retry')) && !el<HTMLInputElement>('rp-password').disabled);
    expect(document.getElementById('import')).toBeNull();
    h.deps.gate.setBusy(true);
    type(el<HTMLInputElement>('rp-password'), 'not the password at all');
    el<HTMLButtonElement>('rp-confirm').disabled = false;
    click(el('rp-confirm'));
    await new Promise(r => setTimeout(r, 20));
    expect(text(el('rp-helper'))).toBe('');
    h.deps.gate.setBusy(false);
    click(el('rp-confirm'));
    await h.until(() => text(el('rp-helper')) !== '');
    expect(text(el('rp-helper'))).toBe('That did not confirm it.');
    expect(h.sent).toEqual([]);
  });
});
