import {createHash} from 'node:crypto';
import {base64} from '@scure/base';
import {PRIVILEGED, handleMessage} from '../messages';
import {applySettingsChallenge, handleWallet} from '../walletApi';
import {applyPhraseChallenge} from '../phrase';
import {PHRASE_KEY} from '../phraseKey';
import {VAULT_KEY, WALLET_DATA_KEYS, forgetDamaged, forgetWallet, storeEnvelope} from '../accountsStore';
import {REAUTH_KEY, SESSION_KEY, getSession, setSession} from '../session';
import {readSettings} from '../settings';
import {lock} from '../autolock';
import {CHALLENGE_TTL_MS, challengeInfo, isAbout, issueChallenge, takePhraseChallenge, takeSettingsChallenge} from '../reauthChallenges';
import {runUnlockHook} from '../dapp/queue';
import {envelopeRevision} from '../../shared/envelopeRevision';
import {F, F_WALLETS, edited} from '../../shared/__tests__/vaultControls';
import {openPage} from '../dapp/__tests__/pageHarness';
import {fakeDeps, fakeReader} from './fakeDeps';
import {fakeExt} from './fakeExt';
import {ACCOUNT, RECIPIENT} from './fixtures';

// B1e §1.3–§1.6 (I2, I6, R1 = E18): the anti-phishing phrase in the background. Set when none is set needs an unlocked
// session and no proof; change and remove need #10's proof through a `phrase` challenge; the value rides on wallet.state,
// vault.status and dapp.pending only; it is wallet data (wiped by a delete, a damaged-vault removal and a first write,
// kept by a restore). Strings with characters that do not print are \u escapes.
const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
const ID = 'abcdefghijklmnopabcdefghijklmnop';
const from = (path: string) => ({id: ID, origin: ORIGIN, url: `${ORIGIN}${path}`});
const popup = from('/popup.html');
const tab = from('/wallet.html');
const vaultPage = from('/unlock.html');
const approve = from('/approve.html');
/** What Chrome reports for a content script (the relay) in a web page: this extension's id, the page's origin. */
const contentScript = {id: ID, origin: 'https://jup.ag', url: 'https://jup.ag/swap', tab: {id: 7}, frameId: 0};
const otherExtension = {id: 'someotherextensionidxxxxxxxxxxxx', origin: 'chrome-extension://someotherextensionidxxxxxxxxxxxx', url: 'chrome-extension://someotherextensionidxxxxxxxxxxxx/popup.html'};
const B = (n: number, fill: number) => base64.encode(new Uint8Array(n).fill(fill));
const STORED = {
  v: 1,
  scheme: 'slip10',
  kdf: {alg: 'argon2id', m: 65536, t: 3, p: 1, salt: B(16, 1)},
  seed: {iv: B(12, 2), ct: B(48, 3)},
  password: {wrapped: B(40, 4)},
  accounts: [{index: 0, name: 'Main', publicKey: ACCOUNT.publicKey}],
};
const REV = envelopeRevision(STORED as Parameters<typeof envelopeRevision>[0]);
const REPLACEMENT = {...STORED, kdf: {...STORED.kdf, salt: B(16, 9)}, seed: {iv: B(12, 8), ct: B(48, 7)}, password: {wrapped: B(40, 6)}};
/** C2's digest of a stored value — sha256(utf8(JSON.stringify)) — computed with node:crypto, independently of storedDigest. */
const digestOfStored = (raw: unknown): string => createHash('sha256').update(Buffer.from(JSON.stringify(raw), 'utf8')).digest('hex');
const BLUE = 'Blue horse 42';
const GREEN = 'Green fox 7';

async function setup(o: {unlocked?: boolean; phrase?: unknown} = {}) {
  const ext = fakeExt();
  await ext.local.set(VAULT_KEY, STORED);
  if (o.unlocked !== false) await setSession(ext, [ACCOUNT]);
  if (o.phrase !== undefined) await ext.local.set(PHRASE_KEY, o.phrase);
  const deps = fakeDeps({reader: fakeReader({getBalance: async () => 0n, getTokenAccountsByOwner: async () => []})});
  return {ext, deps};
}
type Ctx = Awaited<ReturnType<typeof setup>>;
const phrase = ({ext, deps}: Ctx, value: unknown, sender: Parameters<typeof handleMessage>[2] = popup) => handleMessage(ext, {type: 'settings.phrase', phrase: value}, sender, deps);
const stored = ({ext}: Ctx) => ext.local.get(PHRASE_KEY);
const reauthOk = ({ext, deps}: Ctx, challengeId: string) => handleMessage(ext, {type: 'vault.reauthOk', challengeId}, vaultPage, deps);
const challenges = async ({ext}: Ctx) => Object.keys(((await ext.session.get(REAUTH_KEY)) as Record<string, unknown> | undefined) ?? {});
/** settings.phrase answering reauth-required: the challenge's id. */
async function challengeFor(c: Ctx, value: unknown): Promise<string> {
  const r = await phrase(c, value);
  expect(r).toMatchObject({ok: false, error: 'reauth-required'});
  return (r.data as {challengeId: string}).challengeId;
}

describe('settings.phrase: set when none is set — an unlocked session, no proof (R1, E18)', () => {
  it('unlocked with none stored: written at once, cleaned (NFC, trimmed); the answer carries no value', async () => {
    const c = await setup();
    expect(await phrase(c, '  cafe\u0301 noir ')).toEqual({ok: true, data: {outcome: 'set'}});
    expect(await stored(c)).toBe('caf\u00e9 noir');
    expect(await challenges(c)).toEqual([]);
  });

  it('locked with none stored: `locked`, nothing written — then unlocked, the same message sets it (positive control)', async () => {
    const c = await setup({unlocked: false});
    expect(await phrase(c, BLUE)).toEqual({ok: false, error: 'locked'});
    expect(await stored(c)).toBeUndefined();
    await setSession(c.ext, [ACCOUNT]);
    expect(await phrase(c, BLUE)).toEqual({ok: true, data: {outcome: 'set'}});
    expect(await stored(c)).toBe(BLUE);
  });

  it('the session check and the first write are one sessionMutex section: a lock started during the write waits for it', async () => {
    const c = await setup();
    const set = c.ext.local.set.bind(c.ext.local);
    let locking: Promise<void> | null = null;
    let lockedDuringWrite: boolean | null = null;
    c.ext.local.set = async (key, value) => {
      if (key === PHRASE_KEY && locking === null) {
        let done = false;
        locking = lock(c.ext).then(() => {
          done = true;
        });
        // A macrotask: a lock not held back by the section has run to its end by now.
        await new Promise(resolve => setTimeout(resolve, 0));
        lockedDuringWrite = done || (await getSession(c.ext)) === null;
      }
      await set(key, value);
    };
    expect(await phrase(c, BLUE)).toEqual({ok: true, data: {outcome: 'set'}});
    expect(lockedDuringWrite).toBe(false);
    // Positive control: the lock was started, and lands once the section ends.
    expect(locking).not.toBeNull();
    await locking;
    expect(await getSession(c.ext)).toBeNull();
    expect(await stored(c)).toBe(BLUE);
  });

  it('from every page the wallet runs in: the popup, the UI tab and the vault page (onboarding)', async () => {
    for (const sender of [popup, tab, vaultPage]) {
      const c = await setup();
      expect(await phrase(c, BLUE, sender)).toEqual({ok: true, data: {outcome: 'set'}});
      expect(await stored(c)).toBe(BLUE);
    }
  });

  it('the same value again is `unchanged`: nothing written, no challenge — locked or not; removing none is `unchanged` too', async () => {
    for (const unlocked of [true, false]) {
      const c = await setup({unlocked, phrase: BLUE});
      expect(await phrase(c, ` ${BLUE} `)).toEqual({ok: true, data: {outcome: 'unchanged'}});
      expect(await challenges(c)).toEqual([]);
      const none = await setup({unlocked});
      expect(await phrase(none, null)).toEqual({ok: true, data: {outcome: 'unchanged'}});
      expect(await stored(none)).toBeUndefined();
    }
  });

  it('a stored value that is not a clean phrase reads as none: shown as none, and set without a proof', async () => {
    for (const bad of ['ab\u202ecd', 'ab', ' padded ', 42, {phrase: BLUE}]) {
      const c = await setup({phrase: bad});
      expect(await handleMessage(c.ext, {type: 'wallet.state'}, popup, c.deps)).toMatchObject({ok: true, data: {phrase: null}});
      expect(await phrase(c, BLUE)).toEqual({ok: true, data: {outcome: 'set'}});
      expect(await stored(c)).toBe(BLUE);
    }
  });

  it('malformed — nothing written, no challenge: no `phrase` field, a non-string, a refused character, a `challengeId` alongside', async () => {
    const c = await setup();
    const settled = await issueChallenge(c.ext, c.deps, 'd', {kind: 'settings', autoLockMinutes: 10, reauthUsdCents: null});
    for (const m of [
      {type: 'settings.phrase'},
      {type: 'settings.phrase', phrase: undefined},
      {type: 'settings.phrase', phrase: 42},
      {type: 'settings.phrase', phrase: [BLUE]},
      {type: 'settings.phrase', phrase: 'ab\u202ecd'},
      {type: 'settings.phrase', phrase: 'ab'},
      {type: 'settings.phrase', phrase: BLUE, challengeId: settled},
    ]) {
      expect(await handleMessage(c.ext, m, popup, c.deps)).toEqual({ok: false, error: 'malformed'});
    }
    expect(await stored(c)).toBeUndefined();
    expect(await challenges(c)).toEqual([settled]);
  });
});

describe('change and remove need #10: a `phrase` challenge (R1, E18)', () => {
  it('change: `reauth-required`, nothing written; vault.reauthOk applies the value bound at issue', async () => {
    const c = await setup({phrase: BLUE});
    const id = await challengeFor(c, GREEN);
    expect(await stored(c)).toBe(BLUE);
    expect(await challengeInfo(c.ext, c.deps.now(), id)).toEqual({kind: 'phrase', phrase: GREEN});
    expect(await reauthOk(c, id)).toEqual({ok: true, data: {applied: 'phrase'}});
    expect(await stored(c)).toBe(GREEN);
  });

  it.each([null, '', '   '])('remove (%j): `reauth-required`, kept; vault.reauthOk removes it', async value => {
    const c = await setup({phrase: BLUE});
    const id = await challengeFor(c, value);
    expect(await stored(c)).toBe(BLUE);
    expect(await challengeInfo(c.ext, c.deps.now(), id)).toEqual({kind: 'phrase', phrase: null});
    expect(await reauthOk(c, id)).toEqual({ok: true, data: {applied: 'phrase'}});
    expect(await stored(c)).toBeUndefined();
  });

  it('change and remove while locked: `locked`, no challenge issued, kept', async () => {
    const c = await setup({unlocked: false, phrase: BLUE});
    for (const value of [GREEN, null]) expect(await phrase(c, value)).toEqual({ok: false, error: 'locked'});
    expect(await challenges(c)).toEqual([]);
    expect(await stored(c)).toBe(BLUE);
  });

  it('a lock landing while the challenge is issued: `locked`, and the challenge it raced past is removed', async () => {
    const c = await setup({phrase: BLUE});
    const set = c.ext.session.set.bind(c.ext.session);
    c.ext.session.set = async (key, value) => {
      await set(key, value);
      // The lock's clear lands right after the challenge is written.
      if (key === REAUTH_KEY) await c.ext.session.remove(SESSION_KEY);
    };
    expect(await phrase(c, GREEN)).toEqual({ok: false, error: 'locked'});
    expect(await c.ext.session.get(REAUTH_KEY)).toBeUndefined();
    expect(await stored(c)).toBe(BLUE);
  });

  it('applied exactly once: a replayed vault.reauthOk is `unknown-challenge`', async () => {
    const c = await setup({phrase: BLUE});
    const id = await challengeFor(c, GREEN);
    expect(await reauthOk(c, id)).toEqual({ok: true, data: {applied: 'phrase'}});
    await c.ext.local.set(PHRASE_KEY, BLUE);
    expect(await reauthOk(c, id)).toEqual({ok: false, error: 'unknown-challenge'});
    expect(await stored(c)).toBe(BLUE);
  });

  it('expired: `unknown-challenge`, kept', async () => {
    const c = await setup({phrase: BLUE});
    const id = await challengeFor(c, GREEN);
    c.deps.clock.t += CHALLENGE_TTL_MS;
    expect(await reauthOk(c, id)).toEqual({ok: false, error: 'unknown-challenge'});
    expect(await stored(c)).toBe(BLUE);
  });

  it('locked at apply: `locked`, kept — vault.reauthOk refuses, and so does the take itself (a lock landing after that check)', async () => {
    const c = await setup({phrase: BLUE});
    const id = await challengeFor(c, GREEN);
    // The session gone with the challenge left in place: what a lock landing between vault.reauthOk's session check and
    // the take leaves for an instant (a lock clears the challenges too — below).
    await c.ext.session.remove(SESSION_KEY);
    expect(await reauthOk(c, id)).toEqual({ok: false, error: 'locked'});
    expect(await applyPhraseChallenge(c.ext, c.deps, id)).toEqual({ok: false, error: 'locked'});
    expect(await takePhraseChallenge(c.ext, c.deps.now(), id)).toBe('locked');
    expect(await challenges(c)).toEqual([id]);
    expect(await stored(c)).toBe(BLUE);
    await lock(c.ext);
    expect(await challenges(c)).toEqual([]);
  });

  it('the last confirmed proof wins: a challenge applied after another change landed applies its own bound value', async () => {
    const c = await setup({phrase: BLUE});
    const toGreen = await challengeFor(c, GREEN);
    const toRemove = await challengeFor(c, null);
    expect(await reauthOk(c, toRemove)).toEqual({ok: true, data: {applied: 'phrase'}});
    expect(await stored(c)).toBeUndefined();
    expect(await reauthOk(c, toGreen)).toEqual({ok: true, data: {applied: 'phrase'}});
    expect(await stored(c)).toBe(GREEN);
  });

  it('a storage failure: `failed` — on set, and on apply (the challenge is spent, nothing written)', async () => {
    const quota = (c: Ctx) => {
      const set = c.ext.local.set.bind(c.ext.local);
      c.ext.local.set = async (key, value) => {
        if (key === PHRASE_KEY) throw new Error('quota');
        await set(key, value);
      };
    };
    const fresh = await setup();
    quota(fresh);
    expect(await phrase(fresh, BLUE)).toEqual({ok: false, error: 'failed'});
    const c = await setup({phrase: BLUE});
    const id = await challengeFor(c, GREEN);
    quota(c);
    expect(await reauthOk(c, id)).toEqual({ok: false, error: 'failed'});
    expect(await stored(c)).toBe(BLUE);
  });

  it('#10 is told what it is for, never the value: vault.challengeInfo answers `change` or `remove`', async () => {
    const c = await setup({phrase: BLUE});
    const change = await challengeFor(c, GREEN);
    const remove = await challengeFor(c, null);
    const info = (challengeId: string) => handleMessage(c.ext, {type: 'vault.challengeInfo', challengeId}, vaultPage, c.deps);
    expect(await info(change)).toEqual({ok: true, data: {kind: 'phrase', action: 'change'}});
    expect(await info(remove)).toEqual({ok: true, data: {kind: 'phrase', action: 'remove'}});
  });
});

describe('a proof of another kind never changes the phrase', () => {
  it('a satisfied settings challenge confirmed by vault.reauthOk applies its settings — the phrase is untouched', async () => {
    const c = await setup({phrase: BLUE});
    const id = await issueChallenge(c.ext, c.deps, 'd', {kind: 'settings', autoLockMinutes: 10, reauthUsdCents: null});
    expect(await reauthOk(c, id)).toEqual({ok: true, data: {applied: 'settings'}});
    expect((await readSettings(c.ext)).autoLockMinutes).toBe(10);
    expect(await stored(c)).toBe(BLUE);
  });

  it('takePhraseChallenge takes only a phrase challenge: a settings, send or dapp id is `unknown-challenge` and stays', async () => {
    const c = await setup({phrase: BLUE});
    const ids = [
      await issueChallenge(c.ext, c.deps, 'd1', {kind: 'settings', autoLockMinutes: 10, reauthUsdCents: null}),
      await issueChallenge(c.ext, c.deps, 'd2', {kind: 'send', account: ACCOUNT.publicKey, token: 'SOL', recipient: RECIPIENT, amount: '1', networkLamports: '5000', priorityLamports: '0', markupLamports: '0', markupReason: 'pre-tge', rentLamports: '0', reasons: ['first-send'], thresholdCents: 10_000}),
      await issueChallenge(c.ext, c.deps, 'd3', {kind: 'dapp', account: ACCOUNT.publicKey, site: 'jup.ag', transactions: 1, outgoing: [], omitted: 0, reasons: ['first-send'], thresholdCents: 10_000, flags: []}),
    ];
    for (const id of ids) expect(await takePhraseChallenge(c.ext, c.deps.now(), id)).toBe('unknown-challenge');
    expect((await challenges(c)).sort()).toEqual([...ids].sort());
  });

  it("the settings path cannot take a phrase challenge: applySettingsChallenge and takeSettingsChallenge say `unknown-challenge`; #10's proof still applies it", async () => {
    const c = await setup({phrase: BLUE});
    const id = await challengeFor(c, GREEN);
    expect(await applySettingsChallenge(c.ext, c.deps, id)).toEqual({ok: false, error: 'unknown-challenge'});
    expect(await takeSettingsChallenge(c.ext, c.deps.now(), id)).toBe('unknown-challenge');
    expect(await stored(c)).toBe(BLUE);
    expect(await reauthOk(c, id)).toEqual({ok: true, data: {applied: 'phrase'}});
    expect(await stored(c)).toBe(GREEN);
  });

  it('settings.set cannot carry it: a patch naming `phrase` is malformed', async () => {
    const c = await setup({phrase: BLUE});
    expect(await handleWallet(c.ext, c.deps, 'settings.set', {patch: {phrase: GREEN}})).toEqual({ok: false, error: 'malformed'});
    expect(await stored(c)).toBe(BLUE);
  });

  it('the `phrase` kind is exactly two keys, a clean phrase or null — anything else is no challenge', () => {
    expect(isAbout({kind: 'phrase', phrase: BLUE})).toBe(true);
    expect(isAbout({kind: 'phrase', phrase: null})).toBe(true);
    for (const bad of [
      {kind: 'phrase'},
      {kind: 'phrase', phrase: BLUE, extra: 1},
      {kind: 'phrase', phrase: 'ab'},
      {kind: 'phrase', phrase: 'ab\u202ecd'},
      {kind: 'phrase', phrase: ` ${BLUE}`},
      {kind: 'phrase', phrase: 'cafe\u0301 noir'},
      {kind: 'phrase', phrase: 42},
      {kind: 'phrase', phrase: ''},
    ]) {
      expect(isAbout(bad)).toBe(false);
    }
  });
});

describe('never echoed (§1.5)', () => {
  // Characters that appear in no answer's keys or codes (ok, error, data, challengeId, outcome, applied, hex ids).
  const TRIED = ['ZQXW\u202e', 'ZQXW', 'WQZX'];
  const noneOf = (answer: unknown, value: string) => [...value].filter(ch => JSON.stringify(answer).includes(ch));

  it('a refusal carries no character of the tried value, and nothing is logged', async () => {
    const logs = (['log', 'warn', 'error', 'info', 'debug'] as const).map(k => vi.spyOn(console, k));
    try {
      const malformed = await phrase(await setup(), TRIED[0]);
      const locked = await phrase(await setup({unlocked: false}), TRIED[1]);
      const proof = await phrase(await setup({phrase: BLUE}), TRIED[2]);
      expect([malformed.ok, locked.ok, proof.ok]).toEqual([false, false, false]);
      expect([malformed, locked, proof].map((a, i) => noneOf(a, TRIED[i] ?? ''))).toEqual([[], [], []]);
      for (const spy of logs) expect(spy).not.toHaveBeenCalled();
    } finally {
      for (const spy of logs) spy.mockRestore();
    }
  });
});

describe('the phrase rides on three answers only (I2, R2)', () => {
  it('wallet.state carries it — locked and unlocked, from the popup and the tab; null when none is set', async () => {
    for (const unlocked of [true, false]) {
      const c = await setup({unlocked, phrase: BLUE});
      for (const sender of [popup, tab]) expect(await handleMessage(c.ext, {type: 'wallet.state'}, sender, c.deps)).toMatchObject({ok: true, data: {hasWallet: true, unlocked, phrase: BLUE}});
      const none = await setup({unlocked});
      expect(await handleMessage(none.ext, {type: 'wallet.state'}, popup, none.deps)).toMatchObject({ok: true, data: {phrase: null}});
    }
  });

  it('vault.status carries it — locked and unlocked, to the vault page; null when none is set', async () => {
    for (const unlocked of [true, false]) {
      const c = await setup({unlocked, phrase: BLUE});
      expect(await handleMessage(c.ext, {type: 'vault.status'}, vaultPage, c.deps)).toEqual({
        ok: true,
        data: {unlocked, accounts: unlocked ? [{index: 0, publicKey: ACCOUNT.publicKey}] : [], phrase: BLUE},
      });
      const none = await setup({unlocked});
      expect(await handleMessage(none.ext, {type: 'vault.status'}, vaultPage, none.deps)).toMatchObject({ok: true, data: {phrase: null}});
    }
  });

  it('dapp.pending carries it at the top level in every state: none, locked, request', async () => {
    const empty = await setup({phrase: BLUE});
    expect(await handleMessage(empty.ext, {type: 'dapp.pending'}, approve, empty.deps)).toEqual({ok: true, data: {state: 'none', phrase: BLUE}});
    for (const unlocked of [false, true]) {
      const c = await setup({unlocked, phrase: BLUE});
      if (unlocked) await runUnlockHook(c.ext, c.deps);
      await openPage(c.ext, c.deps, 'https://dapp.test').ask({type: 'page.connect', id: 'c1', silent: false});
      const r = await handleMessage(c.ext, {type: 'dapp.pending'}, approve, c.deps);
      expect(r).toMatchObject({ok: true, data: {state: unlocked ? 'request' : 'locked', phrase: BLUE}});
    }
    const none = await setup();
    expect(await handleMessage(none.ext, {type: 'dapp.pending'}, approve, none.deps)).toEqual({ok: true, data: {state: 'none', phrase: null}});
  });

  // Task 5 fix round 1 (Minor 1, a controller ruling — M3's principle): the accepted apply-vs-delete race can leave a phrase
  // behind with no wallet. dapp.pending then answers null — the window draws no line — in every state; an envelope this
  // background refuses is no wallet either.
  it('no envelope stored, a phrase left behind (the accepted race): dapp.pending answers null in every state', async () => {
    for (const vault of [undefined, {v: 1}]) {
      const c = await setup({unlocked: false, phrase: BLUE});
      if (vault === undefined) await c.ext.local.remove(VAULT_KEY);
      else await c.ext.local.set(VAULT_KEY, vault);
      // The race's state: the phrase is stored, and wallet.state says there is no wallet.
      expect([await stored(c), await handleMessage(c.ext, {type: 'wallet.state'}, popup, c.deps)]).toMatchObject([BLUE, {ok: true, data: {hasWallet: false}}]);
      expect(await handleMessage(c.ext, {type: 'dapp.pending'}, approve, c.deps)).toEqual({ok: true, data: {state: 'none', phrase: null}});
      await openPage(c.ext, c.deps, 'https://dapp.test').ask({type: 'page.connect', id: 'c1', silent: false});
      expect(await handleMessage(c.ext, {type: 'dapp.pending'}, approve, c.deps)).toMatchObject({ok: true, data: {state: 'locked', phrase: null}});
    }
  });

  // Rev 2.6 (the final review's Minor 1 and its probe P1; ledger T5): one reading of "a wallet is stored" on the phrase
  // path — wallet.state's phrase and dapp.pending's are null unless the stored vault is a wallet this version accepts
  // (envelopeShape). A later format (v: 2) still reads as a wallet to wallet.state's hasWallet (scheme + accounts only),
  // so the popup routes to its locked screen — and draws no phrase there, as no approval window draws one.
  it('a later format ({...ENV, v: 2}): hasWallet still true, and wallet.state and dapp.pending both answer phrase null', async () => {
    for (const unlocked of [false, true]) {
      const c = await setup({unlocked, phrase: BLUE});
      await c.ext.local.set(VAULT_KEY, {...STORED, v: 2});
      expect(await stored(c)).toBe(BLUE);
      for (const sender of [popup, tab]) expect(await handleMessage(c.ext, {type: 'wallet.state'}, sender, c.deps)).toMatchObject({ok: true, data: {hasWallet: true, phrase: null}});
      expect(await handleMessage(c.ext, {type: 'dapp.pending'}, approve, c.deps)).toEqual({ok: true, data: {state: 'none', phrase: null}});
      // Positive control: the same store with v: 1 answers the phrase on both.
      await c.ext.local.set(VAULT_KEY, STORED);
      expect(await handleMessage(c.ext, {type: 'wallet.state'}, popup, c.deps)).toMatchObject({ok: true, data: {hasWallet: true, phrase: BLUE}});
      expect(await handleMessage(c.ext, {type: 'dapp.pending'}, approve, c.deps)).toEqual({ok: true, data: {state: 'none', phrase: BLUE}});
    }
  });

  const idOf = (name: string): string => name.slice(0, name.indexOf(' '));
  it('probe P1: every F control stored with a phrase, locked — the popup (wallet.state) and the window (dapp.pending) agree; only F_WALLETS show it', async () => {
    const seen: [string, unknown, unknown][] = [];
    for (const [name, vault] of F) {
      const c = await setup({unlocked: false, phrase: BLUE});
      await c.ext.local.set(VAULT_KEY, vault);
      const state = await handleMessage(c.ext, {type: 'wallet.state'}, popup, c.deps);
      const pend = await handleMessage(c.ext, {type: 'dapp.pending'}, approve, c.deps);
      const id = idOf(name);
      seen.push([id, (state.data as {phrase: unknown}).phrase, (pend.data as {phrase: unknown}).phrase]);
    }
    expect(seen).toEqual(F.map(([name]) => idOf(name)).map(id => [id, ...(F_WALLETS.includes(id) ? [BLUE, BLUE] : [null, null])]));
    // The refused controls the review's probe found drawing the phrase in the popup: still routed as a wallet (hasWallet).
    const refused = await setup({unlocked: false, phrase: BLUE});
    await refused.ext.local.set(VAULT_KEY, F.find(([n]) => n.startsWith('F2 '))?.[1]);
    expect(await handleMessage(refused.ext, {type: 'wallet.state'}, popup, refused.deps)).toMatchObject({ok: true, data: {hasWallet: true, unlocked: false, phrase: null}});
  });

  it('no wallet: wallet.state and vault.status still answer the field (null)', async () => {
    const ext = fakeExt();
    const deps = fakeDeps();
    expect(await handleMessage(ext, {type: 'wallet.state'}, popup, deps)).toMatchObject({ok: true, data: {hasWallet: false, phrase: null}});
    expect(await handleMessage(ext, {type: 'vault.status'}, vaultPage, deps)).toMatchObject({ok: true, data: {unlocked: false, phrase: null}});
  });

  it('every other privileged answer omits it — from the popup, the vault page and the approval window, a phrase challenge open', async () => {
    const THREE = ['wallet.state', 'vault.status', 'dapp.pending'];
    const others = PRIVILEGED.filter(t => !THREE.includes(t));
    expect(others).toContain('settings.get');
    expect(others).toContain('vault.challengeInfo');
    for (const type of others) {
      for (const sender of [popup, vaultPage, approve]) {
        const c = await setup({phrase: BLUE});
        // Two values in play: the stored phrase, and the one an open challenge would set.
        const challengeId = await challengeFor(c, GREEN);
        const r = await handleMessage(c.ext, {type, challengeId, account: ACCOUNT.publicKey, phrase: BLUE, expectedRevision: REV}, sender, c.deps);
        const text = JSON.stringify(r);
        expect([type, text.includes(BLUE) || text.includes(GREEN)]).toEqual([type, false]);
      }
    }
  });
});

describe('who may ask: no content-script, provider or relay context reads or writes it (§1.6, Minor 4)', () => {
  it('wallet.state, vault.status and settings.phrase from a content script or another extension: `forbidden`, nothing written', async () => {
    const c = await setup({phrase: BLUE});
    for (const sender of [contentScript, otherExtension]) {
      for (const m of [{type: 'wallet.state'}, {type: 'vault.status'}, {type: 'settings.phrase', phrase: GREEN}, {type: 'settings.phrase', phrase: null}, {type: 'dapp.pending'}]) {
        expect(await handleMessage(c.ext, m, sender, c.deps)).toEqual({ok: false, error: 'forbidden'});
      }
    }
    expect(await challenges(c)).toEqual([]);
    expect(await stored(c)).toBe(BLUE);
  });

  it('the approval window gets it only on dapp.pending: wallet.state, vault.status and settings.phrase from /approve.html are `forbidden`', async () => {
    const c = await setup();
    for (const m of [{type: 'wallet.state'}, {type: 'vault.status'}, {type: 'settings.phrase', phrase: GREEN}]) {
      expect(await handleMessage(c.ext, m, approve, c.deps)).toEqual({ok: false, error: 'forbidden'});
    }
    expect(await stored(c)).toBeUndefined();
    // Positive control: the window's own read carries the field; the popup may not send it.
    expect(await handleMessage(c.ext, {type: 'dapp.pending'}, approve, c.deps)).toEqual({ok: true, data: {state: 'none', phrase: null}});
    expect(await handleMessage(c.ext, {type: 'dapp.pending'}, popup, c.deps)).toEqual({ok: false, error: 'forbidden'});
  });

  it('the proof route is the vault page\'s alone: vault.reauthOk and vault.challengeInfo on a phrase challenge from the popup, the tab or /approve.html are `forbidden`', async () => {
    const c = await setup({phrase: BLUE});
    const id = await challengeFor(c, GREEN);
    for (const sender of [popup, tab, approve]) {
      for (const type of ['vault.reauthOk', 'vault.challengeInfo']) {
        expect(await handleMessage(c.ext, {type, challengeId: id}, sender, c.deps)).toEqual({ok: false, error: 'forbidden'});
      }
    }
    expect(await stored(c)).toBe(BLUE);
    expect(await challenges(c)).toEqual([id]);
    // Positive control: the vault page's proof applies it.
    expect(await reauthOk(c, id)).toEqual({ok: true, data: {applied: 'phrase'}});
    expect(await stored(c)).toBe(GREEN);
  });

  it("the relay's page port refuses every read and write of it: `invalid-request`, no answer carries it, nothing written", async () => {
    const c = await setup({phrase: BLUE});
    const page = openPage(c.ext, c.deps, 'https://jup.ag');
    for (const [i, m] of [{type: 'wallet.state'}, {type: 'vault.status'}, {type: 'dapp.pending'}, {type: 'settings.phrase', phrase: GREEN}, {type: 'settings.phrase', phrase: null}].entries()) {
      expect(await page.ask({...m, id: `p${i}`})).toEqual({id: `p${i}`, error: 'invalid-request'});
    }
    expect(JSON.stringify(page.port.posted).includes(BLUE)).toBe(false);
    expect(await stored(c)).toBe(BLUE);
    expect(await challenges(c)).toEqual([]);
  });
});

describe('wallet data: wiped by a delete, a damaged-vault removal and a first write; kept by a restore (§1.4)', () => {
  it('v1_phishing_phrase is one of WALLET_DATA_KEYS', () => {
    expect(PHRASE_KEY).toBe('v1_phishing_phrase');
    expect(WALLET_DATA_KEYS).toContain(PHRASE_KEY);
  });

  it("#37's delete (vault.forgetWallet, no replacement) removes it", async () => {
    const c = await setup({phrase: BLUE});
    expect(await forgetWallet(c.ext, c.deps, {expectedRevision: REV})).toBe('forgotten');
    expect(await c.ext.local.get(VAULT_KEY)).toBeUndefined();
    expect(await stored(c)).toBeUndefined();
  });

  it("#39's restore (vault.forgetWallet with the same-key replacement) keeps it", async () => {
    const c = await setup({phrase: BLUE});
    expect(await forgetWallet(c.ext, c.deps, {expectedRevision: REV, replacement: REPLACEMENT})).toBe('forgotten');
    expect(await c.ext.local.get(VAULT_KEY)).toEqual(REPLACEMENT);
    expect(await stored(c)).toBe(BLUE);
  });

  it("§2's removal of an unreadable vault (vault.forgetDamaged) removes it", async () => {
    const ext = fakeExt();
    const unreadable = edited(e => (e.seed = 'damaged'));
    await ext.local.set(VAULT_KEY, unreadable);
    await ext.local.set(PHRASE_KEY, BLUE);
    expect(await forgetDamaged(ext, {expectedDigest: digestOfStored(await ext.local.get(VAULT_KEY))})).toBe('forgotten');
    expect(await ext.local.get(PHRASE_KEY)).toBeUndefined();
  });

  it('the vault page\'s vault.forgetDamaged removes it — a refused removal (another digest) keeps it (negative control)', async () => {
    const ext = fakeExt();
    const deps = fakeDeps();
    const unreadable = edited(e => (e.seed = 'damaged'));
    await ext.local.set(VAULT_KEY, unreadable);
    await ext.local.set(PHRASE_KEY, BLUE);
    const digest = digestOfStored(await ext.local.get(VAULT_KEY));
    const forget = (expectedDigest: string) => handleMessage(ext, {type: 'vault.forgetDamaged', expectedDigest}, vaultPage, deps);
    expect(await forget('0'.repeat(64))).toEqual({ok: false, error: 'busy'});
    expect(await ext.local.get(PHRASE_KEY)).toBe(BLUE);
    expect(await forget(digest)).toEqual({ok: true});
    expect(await ext.local.get(VAULT_KEY)).toBeUndefined();
    expect(await ext.local.get(PHRASE_KEY)).toBeUndefined();
  });

  it('a first write (onboarding’s storeEnvelope(null, …)) removes a phrase left behind — why onboarding sets it after commitWallet', async () => {
    const ext = fakeExt();
    await ext.local.set(PHRASE_KEY, BLUE);
    expect(await storeEnvelope(ext, null, STORED)).toBe('stored');
    expect(await ext.local.get(PHRASE_KEY)).toBeUndefined();
  });
});
