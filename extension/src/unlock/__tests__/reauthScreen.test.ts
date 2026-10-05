// @vitest-environment happy-dom
import {base64} from '@scure/base';
import {addPasskeyWrap, createEnvelope, unlockWithPassword, type EnvelopeV1} from '../../vault/envelope';
import {evaluatePrf, type CredentialsApi} from '../../vault/passkey';
import {deriveSessionAccounts} from '../../vault/accounts';
import {CHALLENGE_TTL_MS, challengeInfo, issueChallenge, type ChallengeAbout} from '../../background/reauthChallenges';
import {getSession, setSession} from '../../background/session';
import {prepareSend} from '../../background/prepare';
import {handleMessage} from '../../background/messages';
import {VAULT_KEY} from '../../background/accountsStore';
import {ACCOUNT, RECIPIENT, sendReader} from '../../background/__tests__/fixtures';
import {mountReauth} from '../screens/reauth';
import {UNLOCK_SENDER, click, el, harness, loadPage, testKdf, text, type, unstyled, visible} from './pageHarness';

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

// Review follow-up 2: a send whose validated account resumeTarget refuses (unreachable while both check the same
// alphabet) must fail closed. `refuseResume` forces that branch; every other test runs the real resumeTarget.
let refuseResume = false;
vi.mock('../page', async importOriginal => {
  const actual = await importOriginal<typeof import('../page')>();
  return {...actual, resumeTarget: (account: string) => (refuseResume ? null : actual.resumeTarget(account))};
});

const M = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const K0 = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const PW = 'correct horse battery';
const B = (n: number) => base64.encode(new Uint8Array(n).fill(1));
const SEND = (account: string): Extract<ChallengeAbout, {kind: 'send'}> => ({
  kind: 'send',
  account,
  token: 'SOL',
  recipient: RECIPIENT,
  amount: '2480000000',
  networkLamports: '5050',
  priorityLamports: '50',
  markupLamports: '0',
  markupReason: 'status-unknown',
  rentLamports: '0',
  reasons: ['first-send', 'over-usd-threshold'],
  thresholdCents: 10_000,
});

beforeEach(() => {
  loadPage();
  prfOutputs.length = 0;
  vi.mocked(evaluatePrf).mockClear();
  refuseResume = false;
});

const wallet = () => createEnvelope({mnemonic: M, password: PW, scheme: 'slip10', accounts: [{index: 0, name: 'A', publicKey: K0}], kdf: testKdf});

/** The real wallet M stored and unlocked, a challenge issued for `about`, #10 shown on it. */
async function shown(about: ChallengeAbout = SEND(K0), o: {holdSleep?: boolean; unlocked?: boolean; vault?: EnvelopeV1; credentials?: CredentialsApi} = {}) {
  const env = o.vault ?? (await wallet());
  const h = await harness({vault: env, holdSleep: o.holdSleep, credentials: o.credentials});
  const broadcast = watchBroadcasts(h);
  if (o.unlocked !== false) await setSession(h.ext, await deriveSessionAccounts(M, 'slip10', [0]));
  const id = await issueChallenge(h.ext, h.wallet, 'digest', about);
  const screen = mountReauth(h.deps);
  await screen.show(id);
  return {h, id, screen, broadcast};
}
const confirmWith = (password: string) => {
  type(el<HTMLInputElement>('ra-password'), password);
  click(el('ra-confirm'));
};
/** Every broadcast the background is asked for (D38: #10 must cause none, on any path). */
function watchBroadcasts(h: Awaited<ReturnType<typeof harness>>): Uint8Array[] {
  const seen: Uint8Array[] = [];
  h.wallet.broadcast = async wire => {
    seen.push(wire);
    throw new Error('#10 must not broadcast');
  };
  return seen;
}
/** D38: nothing is sent from #10 — no wallet.send, no broadcast. */
const nothingSent = (h: Awaited<ReturnType<typeof harness>>, broadcast: Uint8Array[]) => {
  expect(h.sent.filter(m => m.type === 'wallet.send')).toEqual([]);
  expect(broadcast).toEqual([]);
};
/** Records every wait the screen asks for (the 500 ms floor, a backoff wait), in order. Must run before mountReauth. */
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
/** Every place the page could still carry the password: each text node, each attribute value and each field's `value`. */
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

describe('#10 unlock-send (spec §3.10)', () => {
  it('idle: the action read from the background — amount, the full recipient in groups of four, each fee line, one reason line per engine reason', async () => {
    await shown();
    const screen = el('v-reauth');
    expect(text(screen.querySelector('.top-bar .title'))).toBe('Confirm with password');
    expect(visible(el('ra-loading'))).toBe(false);
    expect(text(el('ra-about'))).toBe('You are about to send');
    expect([text(el('ra-amount')), text(el('ra-symbol'))]).toEqual(['2.4800', 'SOL']);
    const rows = [...el('ra-rows').querySelectorAll('.intent-row')];
    expect(rows.map(r => [text(r.querySelector('.label')), text(r.querySelector('.value'))])).toEqual([
      ['To', RECIPIENT],
      ['Network fee', '0.000005 SOL'],
      ['Priority', '0.00000005 SOL'],
      ['No Noctura fee (status unknown)', ''],
    ]);
    expect([...rows[0]!.querySelectorAll('.addr-groups > span')].map(text)).toEqual(RECIPIENT.match(/.{1,4}/g));
    expect(text(screen.querySelector('#ra-entry h2'))).toBe('Enter your password');
    expect([...el('ra-reasons').querySelectorAll('p')].map(text)).toEqual(['Re-auth required for the first send to a new address.', 'Re-auth required for transactions over $100.']);
    expect(text(el('ra-confirm'))).toBe('Confirm');
    expect(text(el('ra-cancel'))).toBe('Cancel send');
    expect(visible(el('ra-passkey'))).toBe(false);
    expect(text(screen)).not.toMatch(/PIN|attempts left|Gabc/);
    expect(unstyled('v-reauth')).toEqual([]);
  });

  it('loading: "Reading the details…" until vault.challengeInfo answers; nothing to type or confirm yet', async () => {
    let release: () => void = () => undefined;
    let asked = false;
    const held = new Promise<void>(r => (release = r));
    const h = await harness({
      vault: await wallet(),
      send: inner => async m => {
        if ((m as {type?: string}).type === 'vault.challengeInfo') {
          asked = true;
          await held;
        }
        return inner(m);
      },
    });
    await setSession(h.ext, await deriveSessionAccounts(M, 'slip10', [0]));
    const id = await issueChallenge(h.ext, h.wallet, 'digest', SEND(K0));
    const showing = mountReauth(h.deps).show(id);
    await h.until(() => asked);
    expect(visible(el('v-reauth'))).toBe(true);
    expect(text(el('ra-loading'))).toBe('Reading the details…');
    expect(visible(el('ra-loading'))).toBe(true);
    expect([visible(el('ra-intent')), visible(el('ra-entry')), visible(el('ra-confirm')), visible(el('ra-cancel'))]).toEqual([false, false, false, false]);
    release();
    await showing;
    expect(visible(el('ra-loading'))).toBe(false);
    expect(visible(el('ra-entry'))).toBe(true);
  });

  it('confirmed: the challenge is satisfied and the SAME tab goes to the resume route — nothing is sent from here (D38)', async () => {
    const {h, id, broadcast} = await shown();
    confirmWith(PW);
    expect(text(el('ra-helper'))).toBe('Checking…');
    await h.until(() => h.went.length > 0);
    expect(h.went).toEqual([`wallet.html#/send/resume?account=${K0}`]);
    expect(h.sent.map(m => m.type)).toEqual(['vault.challengeInfo', 'vault.status', 'vault.reauthOk']);
    const stored = (await h.ext.session.get('v1_reauth')) as Record<string, {satisfied: boolean}>;
    expect(stored[id]?.satisfied).toBe(true);
    nothingSent(h, broadcast);
  });

  it('error: "That did not confirm it." (D11), the field shakes; the challenge stays unsatisfied', async () => {
    const {h} = await shown();
    confirmWith('not the password at all');
    await h.until(() => text(el('ra-helper')) === 'That did not confirm it.');
    expect(el('ra-helper').classList.contains('error')).toBe(true);
    expect(el('ra-password').classList.contains('is-error')).toBe(true);
    expect(h.sent.some(m => m.type === 'vault.reauthOk')).toBe(false);
    expect(unstyled('v-reauth')).toEqual([]);
  });

  it('cooldown: #9’s card with "That did not confirm it. Wait a moment before trying again." and [Confirm paused]', async () => {
    const {h} = await shown(SEND(K0), {holdSleep: true});
    confirmWith('wrong wrong wrong wrong');
    await h.until(() => text(el('ra-helper')) === 'That did not confirm it.');
    h.wake();
    await h.until(() => !h.deps.gate.isBusy());
    confirmWith('wrong wrong wrong wrong');
    await h.until(() => visible(el('ra-cooldown')));
    expect(text(el('ra-cooldown'))).toBe('Wait a moment That did not confirm it. Wait a moment before trying again. 0:01 Cooldown · 1 second remaining');
    expect(text(el('ra-paused'))).toBe('Confirm paused');
    expect(el<HTMLButtonElement>('ra-paused').disabled).toBe(true);
    expect(unstyled('v-reauth')).toEqual([]);
    h.wake();
  });

  // D39: the challenge expired while the password was typed — "expired", never "failed".
  it('expired while typing: vault.reauthOk answers unknown-challenge → "This confirmation has expired…"', async () => {
    const {h} = await shown();
    h.wallet.clock.t += CHALLENGE_TTL_MS + 1;
    confirmWith(PW);
    await h.until(() => visible(el('ra-notice')));
    expect(text(el('ra-notice-line'))).toBe('This confirmation has expired. Start the send again from the Noctura icon.');
    expect(text(document.body)).not.toContain('Something went wrong');
    expect(visible(el('ra-confirm'))).toBe(false);
  });

  it('a challenge id the background does not know (or expired) shows "expired" at once', async () => {
    const h = await harness({vault: await wallet()});
    await setSession(h.ext, await deriveSessionAccounts(M, 'slip10', [0]));
    await mountReauth(h.deps).show('cd'.repeat(16));
    expect(text(el('ra-notice-line'))).toBe('This confirmation has expired. Start the send again from the Noctura icon.');
    expect(visible(el('ra-intent'))).toBe(false);
  });

  it('locked: "The wallet locked while you were confirming…" + [Unlock] → ?mode=unlock (no return target, M7)', async () => {
    const {h} = await shown(SEND(K0), {unlocked: false});
    expect(text(el('ra-notice-line'))).toBe('The wallet locked while you were confirming. Unlock it and start the send again.');
    click(el('ra-unlock'));
    expect(h.went).toEqual(['unlock.html?mode=unlock']);
  });

  // E3's fail-closed rule: the background stored it, the page cannot describe it → only Cancel.
  it('undescribable: "The details of this action could not be shown." with only [Cancel send] — no Confirm, no field (negative control)', async () => {
    const {h} = await shown({...SEND(K0), markupReason: 'charged'});
    expect(text(el('ra-notice-line'))).toBe('The details of this action could not be shown.');
    expect(visible(el('ra-cancel'))).toBe(true);
    expect(text(el('ra-cancel'))).toBe('Cancel send');
    expect(visible(el('ra-confirm'))).toBe(false);
    expect(visible(el('ra-passkey'))).toBe(false);
    expect(visible(el('ra-entry'))).toBe(false);
    expect(visible(el('ra-intent'))).toBe(false);
    expect(document.querySelector('#v-reauth button:not([hidden]):not(#ra-cancel):not(#ra-x)')).toBeNull();
    expect(h.sent.map(m => m.type)).toEqual(['vault.challengeInfo']);
  });

  it('mismatch: a session that is not this wallet’s is locked, and the page says so', async () => {
    const h = await harness({vault: await wallet()});
    await setSession(h.ext, [ACCOUNT]);
    const id = await issueChallenge(h.ext, h.wallet, 'digest', SEND(ACCOUNT.publicKey));
    await mountReauth(h.deps).show(id);
    confirmWith(PW);
    await h.until(() => visible(el('ra-notice')));
    expect(text(el('ra-notice-line'))).toBe('That did not match this wallet, so the wallet has been locked.');
    expect(await getSession(h.ext)).toBeNull();
  });

  it('rule 6: a second Confirm before the first settles sends one vault.reauthOk', async () => {
    const {h} = await shown();
    confirmWith(PW);
    click(el('ra-confirm'));
    await h.until(() => h.went.length > 0);
    expect(h.sent.filter(m => m.type === 'vault.reauthOk')).toHaveLength(1);
  });
});

const LOCKED_VAULT = {v: 1, scheme: 'slip10', kdf: {alg: 'argon2id', m: 65536, t: 3, p: 1, salt: B(16)}, seed: {iv: B(12), ct: B(48)}, password: {wrapped: B(40)}, accounts: [{index: 0, name: 'A', publicKey: ACCOUNT.publicKey}]};

/** A real prepared send for ACCOUNT (its challenge issued by the background); `about` replaces what #10 reads. */
async function prepared(about?: unknown) {
  const h = await harness({
    vault: LOCKED_VAULT,
    send: inner => async m => ((m as {type: string}).type === 'vault.challengeInfo' && about !== undefined ? {ok: true, data: about} : inner(m)),
  });
  await setSession(h.ext, [ACCOUNT]);
  h.wallet.reader = sendReader();
  const view = await prepareSend(h.ext, h.wallet, ACCOUNT.publicKey, {token: 'SOL', recipient: RECIPIENT, amount: '1000000'});
  const id = view.reauth!.challengeId;
  return {h, id};
}
const stillPrepared = async (h: Awaited<ReturnType<typeof harness>>) =>
  ((await handleMessage(h.ext, {type: 'wallet.preparedFor', account: ACCOUNT.publicKey}, UNLOCK_SENDER, h.wallet)) as {data: unknown}).data !== null;

describe('#10 [Cancel send] discards the prepared send (E7), against the real background', () => {
  it('drops the prepared send and its challenge, says "Send cancelled. Nothing was sent." and closes the tab', async () => {
    const {h, id} = await prepared();
    await mountReauth(h.deps).show(id);
    click(el('ra-cancel'));
    await h.until(() => h.closed > 0);
    expect(text(el('ra-notice-line'))).toBe('Send cancelled. Nothing was sent.');
    expect(h.sent.find(m => m.type === 'wallet.discardPrepared')).toEqual({type: 'wallet.discardPrepared', account: ACCOUNT.publicKey});
    expect(await challengeInfo(h.ext, h.wallet.now(), id)).toBeNull();
    expect(await handleMessage(h.ext, {type: 'wallet.preparedFor', account: ACCOUNT.publicKey}, UNLOCK_SENDER, h.wallet)).toEqual({ok: true, data: null});
    expect(visible(el('ra-cancel'))).toBe(false);
  });

  it('the top bar’s X in idle is [Cancel send]: it discards the send, then "Send cancelled…" and the tab closes', async () => {
    const {h, id} = await prepared();
    await mountReauth(h.deps).show(id);
    expect(el('ra-x').getAttribute('aria-label')).toBe('Cancel');
    click(el('ra-x'));
    await h.until(() => h.closed > 0);
    expect(h.sent.filter(m => m.type === 'wallet.discardPrepared')).toEqual([{type: 'wallet.discardPrepared', account: ACCOUNT.publicKey}]);
    expect(await stillPrepared(h)).toBe(false);
    expect(text(el('ra-notice-line'))).toBe('Send cancelled. Nothing was sent.');
  });

  // H1 (plan review): an action the page cannot describe is still a prepared send — Cancel must drop it.
  it('undescribable, its account valid by itself: [Cancel send] discards that send, then "Send cancelled…"', async () => {
    const {h, id} = await prepared({...SEND(ACCOUNT.publicKey), markupReason: 'charged'});
    await mountReauth(h.deps).show(id);
    expect(text(el('ra-notice-line'))).toBe('The details of this action could not be shown.');
    expect(text(el('ra-cancel'))).toBe('Cancel send');
    click(el('ra-cancel'));
    await h.until(() => h.closed > 0);
    expect(h.sent.filter(m => m.type === 'wallet.discardPrepared')).toEqual([{type: 'wallet.discardPrepared', account: ACCOUNT.publicKey}]);
    expect(await stillPrepared(h)).toBe(false);
    expect(await challengeInfo(h.ext, h.wallet.now(), id)).toBeNull();
    expect(text(el('ra-notice-line'))).toBe('Send cancelled. Nothing was sent.');
  });

  it('undescribable with no valid account: [Close] and a true line — nothing is sent and nothing says "cancelled"', async () => {
    const {h, id} = await prepared({...SEND(ACCOUNT.publicKey), account: 'not an address', token: 'BONK'});
    await mountReauth(h.deps).show(id);
    expect(text(el('ra-notice-line'))).toBe('The details of this action could not be shown.');
    expect(text(el('ra-notice-help'))).toBe('Nothing was sent. Start the send again from the Noctura icon.');
    expect(text(el('ra-cancel'))).toBe('Close');
    expect(el('ra-x').getAttribute('aria-label')).toBe('Close');
    click(el('ra-cancel'));
    await h.until(() => h.closed > 0);
    expect(h.sent.some(m => m.type === 'wallet.discardPrepared')).toBe(false);
    expect(text(document.body)).not.toMatch(/cancelled/i);
    expect(await stillPrepared(h)).toBe(true);
  });

  it('rule 6: a second [Cancel send] before the first settles sends one wallet.discardPrepared', async () => {
    const {h, id} = await prepared();
    await mountReauth(h.deps).show(id);
    click(el('ra-cancel'));
    click(el('ra-cancel'));
    click(el('ra-x'));
    await h.until(() => h.closed > 0 && !h.deps.gate.isBusy());
    expect(h.sent.filter(m => m.type === 'wallet.discardPrepared')).toHaveLength(1);
    expect(h.closed).toBe(1);
  });

  // L4 (plan review): a notice with nothing to cancel still has a way out — the X closes, claiming nothing.
  it('expired, locked or mismatch: the top bar’s X closes the tab, sends nothing and says nothing was cancelled', async () => {
    const {h, id} = await prepared();
    h.wallet.clock.t += CHALLENGE_TTL_MS + 1;
    await mountReauth(h.deps).show(id);
    expect(text(el('ra-notice-line'))).toBe('This confirmation has expired. Start the send again from the Noctura icon.');
    expect(el<HTMLButtonElement>('ra-x').disabled).toBe(false);
    expect(el('ra-x').getAttribute('aria-label')).toBe('Close');
    click(el('ra-x'));
    expect(h.closed).toBe(1);
    expect(h.sent.some(m => m.type === 'wallet.discardPrepared')).toBe(false);
    expect(text(document.body)).not.toMatch(/cancelled/i);
  });

  it('a discard the background refuses keeps the screen and says so — no "Send cancelled" it cannot vouch for', async () => {
    const {h} = await shown(SEND(K0));
    const inner = h.deps.send;
    h.deps.send = async m => ((m as {type: string}).type === 'wallet.discardPrepared' ? {ok: false, error: 'failed'} : inner(m));
    click(el('ra-cancel'));
    await h.until(() => text(el('ra-helper')) === 'Something went wrong. Try again.');
    expect(h.closed).toBe(0);
    expect(visible(el('ra-notice'))).toBe(false);
  });

  it('a refused discard from `undescribable` keeps the notice and says so; no "cancelled"', async () => {
    const {h, id} = await prepared({...SEND(ACCOUNT.publicKey), markupReason: 'charged'});
    const inner = h.deps.send;
    h.deps.send = async m => ((m as {type: string}).type === 'wallet.discardPrepared' ? {ok: false, error: 'failed'} : inner(m));
    await mountReauth(h.deps).show(id);
    click(el('ra-cancel'));
    await h.until(() => text(el('ra-notice-help')) === 'Something went wrong. Try again.');
    expect(h.closed).toBe(0);
    expect(text(el('ra-notice-line'))).toBe('The details of this action could not be shown.');
    expect(text(document.body)).not.toMatch(/cancelled/i);
    expect(await stillPrepared(h)).toBe(true);
  });
});

describe('#10: the carried rules (Task 10’s password, passkey, cooldown and rule-6 rules; D38 on every path)', () => {
  it('the typed password leaves the field and every reference: at the click, on a wrong password, in the cooldown, once confirmed', async () => {
    const {h, screen} = await shown(SEND(K0), {holdSleep: true});
    const wrong = 'near miss horse battery';
    type(el<HTMLInputElement>('ra-password'), wrong);
    expect(screen.holds()).toBe(true);
    expect(carries(wrong)).toEqual(['#ra-password.value']);
    click(el('ra-confirm'));
    // Handed to the attempt at the click: the field is empty while Argon2id runs, and the screen keeps no copy.
    expect([carries(wrong), screen.holds()]).toEqual([[], false]);
    await h.until(() => text(el('ra-helper')) === 'That did not confirm it.');
    expect([carries(wrong), screen.holds()]).toEqual([[], false]);
    h.wake();
    await h.until(() => !h.deps.gate.isBusy());
    confirmWith(wrong);
    await h.until(() => visible(el('ra-cooldown')));
    expect([carries(wrong), screen.holds()]).toEqual([[], false]);
    h.wake();
    await h.until(() => !h.deps.gate.isBusy());
    confirmWith(PW);
    expect([carries(PW), screen.holds()]).toEqual([[], false]);
    await h.until(() => h.went.length > 0);
    expect([carries(PW), screen.holds()]).toEqual([[], false]);
    h.wake();
  });

  it.each(['hidden', 'pagehide'] as const)('the tab %s: a typed, unsent password is dropped from the field', async why => {
    const {h, screen} = await shown();
    type(el<HTMLInputElement>('ra-password'), PW);
    expect(screen.holds()).toBe(true);
    h.leave(why);
    expect([carries(PW), screen.holds()]).toEqual([[], false]);
    expect(h.sent.map(m => m.type)).toEqual(['vault.challengeInfo']);
  });

  it('an empty field sends nothing', async () => {
    const {h} = await shown();
    click(el('ra-confirm'));
    el('ra-form').dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
    await new Promise(r => setTimeout(r, 5));
    expect(h.sent.map(m => m.type)).toEqual(['vault.challengeInfo']);
  });

  it('[Confirm with passkey] only when the envelope has one: it confirms, hands over, and the PRF output is zeroed', async () => {
    const {h, broadcast} = await shown(SEND(K0), {vault: await withPasskey(PRF), credentials: prfCredentials(PRF)});
    expect(visible(el('ra-passkey'))).toBe(true);
    expect(text(el('ra-passkey'))).toBe('Confirm with passkey');
    click(el('ra-passkey'));
    await h.until(() => h.went.length > 0);
    expect(h.went).toEqual([`wallet.html#/send/resume?account=${K0}`]);
    expect(prfOutputs).toHaveLength(1);
    expect(prfOutputs.every(o => o.every(b => b === 0))).toBe(true);
    nothingSent(h, broadcast);
  });

  it('passkey: a PRF output that does not open the wrap is "wrong", and zeroed', async () => {
    const {h} = await shown(SEND(K0), {vault: await withPasskey(PRF), credentials: prfCredentials(new Uint8Array(32).fill(9))});
    click(el('ra-passkey'));
    await h.until(() => text(el('ra-helper')) === 'That did not confirm it.');
    expect(h.sent.some(m => m.type === 'vault.reauthOk')).toBe(false);
    expect(prfOutputs).toHaveLength(1);
    expect(prfOutputs.every(o => o.every(b => b === 0))).toBe(true);
  });

  it('passkey: a device without PRF says so; the password still works', async () => {
    const {h} = await shown(SEND(K0), {vault: await withPasskey(PRF), credentials: {create: async () => null, get: async () => null}});
    click(el('ra-passkey'));
    await h.until(() => text(el('ra-helper')) === 'This device cannot confirm with a passkey; your password still works.');
    await h.until(() => !h.deps.gate.isBusy());
    confirmWith(PW);
    await h.until(() => h.went.length > 0);
    expect(h.went).toEqual([`wallet.html#/send/resume?account=${K0}`]);
  });

  it('cooldown: the ring is set only as a number; the wait is announced once (polite), not every second', async () => {
    const {h} = await shown(SEND(K0), {holdSleep: true});
    confirmWith('wrong wrong wrong wrong');
    await h.until(() => text(el('ra-helper')) === 'That did not confirm it.');
    h.wake();
    await h.until(() => !h.deps.gate.isBusy());
    confirmWith('wrong wrong wrong wrong');
    await h.until(() => visible(el('ra-cooldown')));
    expect(el('ra-ring').style.getPropertyValue('--vlt-ring')).toBe('1');
    expect(el('ra-cooldown').querySelector('[aria-live]')).toBeNull();
    expect(el('ra-cooldown-live').getAttribute('aria-live')).toBe('polite');
    expect(text(el('ra-cooldown-live'))).toBe('Cooldown · 1 second remaining');
    h.timers.advance(1_000);
    expect(text(el('ra-timer'))).toBe('0:00');
    expect(el('ra-ring').style.getPropertyValue('--vlt-ring')).toBe('0');
    expect(text(el('ra-cooldown-live'))).toBe('Cooldown · 1 second remaining');
    h.wake();
    await h.until(() => !visible(el('ra-cooldown')));
    expect(text(el('ra-cooldown-live'))).toBe('');
    expect(text(el('ra-helper'))).toBe('That did not confirm it.');
    expect(h.timers.pending()).toBe(0);
  });

  // Observed, not inferred: after one wrong the streak is 1; had a damaged (or vanished) vault been charged, a 1 s
  // backoff wait would follow it.
  it.each([
    ['damaged', null, "This wallet's stored data is damaged."],
    ['no-wallet', undefined, 'No wallet on this browser yet.'],
  ] as const)('a vault %s during the run is named, never charged to the backoff', async (_kind, stored, line) => {
    const h = await harness({vault: await wallet()});
    const asked = recordSleeps(h);
    await setSession(h.ext, await deriveSessionAccounts(M, 'slip10', [0]));
    const id = await issueChallenge(h.ext, h.wallet, 'digest', SEND(K0));
    await mountReauth(h.deps).show(id);
    confirmWith('not the password at all');
    await h.until(() => text(el('ra-helper')) === 'That did not confirm it.');
    await h.until(() => !h.deps.gate.isBusy());
    expect(asked).toEqual([500]);
    if (stored === undefined) await h.ext.local.remove(VAULT_KEY);
    else await h.ext.local.set(VAULT_KEY, stored);
    confirmWith(PW);
    await h.until(() => visible(el('ra-notice')) && !h.deps.gate.isBusy());
    expect(text(el('ra-notice-line'))).toBe(line);
    expect(asked).toEqual([500, 500]);
    expect([visible(el('ra-cooldown')), visible(el('ra-entry')), visible(el('ra-confirm'))]).toEqual([false, false, false]);
    expect(h.sent.some(m => m.type === 'vault.reauthOk')).toBe(false);
  });

  it.each([
    ['damaged', null, "This wallet's stored data is damaged. Your funds stay on Solana; your recovery phrase still controls them. To use them here, remove Noctura from this browser, install it again and import the phrase."],
    ['no-wallet', undefined, 'No wallet on this browser yet.'],
  ] as const)('a vault %s when #10 opens: the notice, nothing to type; the X only closes', async (_kind, stored, line) => {
    const h = await harness({vault: stored});
    await mountReauth(h.deps).show('ab'.repeat(16));
    expect(text(el('ra-notice'))).toBe(line);
    expect([visible(el('ra-entry')), visible(el('ra-confirm')), visible(el('ra-cancel'))]).toEqual([false, false, false]);
    expect(h.sent).toEqual([]);
    click(el('ra-x'));
    expect(h.closed).toBe(1);
    expect(text(document.body)).not.toMatch(/cancelled/i);
  });

  it('a store that cannot be read says so; nothing to type', async () => {
    const h = await harness({vault: await wallet()});
    h.deps.store.readEnvelope = async () => {
      throw new Error('Extension context invalidated.');
    };
    await mountReauth(h.deps).show('ab'.repeat(16));
    expect(text(el('ra-notice-line'))).toBe("This wallet's stored data could not be read. Reload this page.");
    expect(visible(el('ra-notice-help'))).toBe(false);
    expect(visible(el('ra-entry'))).toBe(false);
  });

  it('a lock that lands after the status read (vault.reauthOk answers locked) is not-unlocked, with [Unlock]', async () => {
    const {h} = await shown();
    const inner = h.deps.send;
    h.deps.send = async m => ((m as {type: string}).type === 'vault.reauthOk' ? {ok: false, error: 'locked'} : inner(m));
    confirmWith(PW);
    await h.until(() => visible(el('ra-notice')));
    expect(text(el('ra-notice-line'))).toBe('The wallet locked while you were confirming. Unlock it and start the send again.');
    expect(visible(el('ra-unlock'))).toBe(true);
    expect(h.went).toEqual([]);
  });

  it('a settings challenge (B1b-2b): "You are about to change" and its lines; confirmed → "Confirmed. You can close this tab."', async () => {
    const {h, broadcast} = await shown({kind: 'settings', autoLockMinutes: 5, reauthUsdCents: 25_000});
    expect(text(el('ra-about'))).toBe('You are about to change');
    expect(visible(el('ra-amount-row'))).toBe(false);
    expect([...el('ra-rows').querySelectorAll('.intent-row')].map(text)).toEqual(['Auto-lock → 5 minutes', 'Re-authentication threshold → $250']);
    expect(el('ra-reasons').childElementCount).toBe(0);
    expect(text(el('ra-cancel'))).toBe('Cancel');
    expect(unstyled('v-reauth')).toEqual([]);
    confirmWith(PW);
    await h.until(() => visible(el('ra-notice')));
    expect(text(el('ra-notice-line'))).toBe('Confirmed. You can close this tab.');
    expect(h.went).toEqual([]);
    nothingSent(h, broadcast);
  });

  it('a settings challenge’s Cancel only closes the tab: no discard, no "cancelled"', async () => {
    const {h} = await shown({kind: 'settings', autoLockMinutes: 5, reauthUsdCents: null});
    click(el('ra-cancel'));
    await h.until(() => h.closed > 0);
    expect(h.sent.map(m => m.type)).toEqual(['vault.challengeInfo']);
    expect(text(document.body)).not.toMatch(/cancelled/i);
  });

  it('rule 6: inside the 500 ms floor after the hand-over, a lifted Confirm, passkey, Cancel or X runs nothing', async () => {
    const {h} = await shown(SEND(K0), {holdSleep: true, vault: await withPasskey(PRF), credentials: prfCredentials(PRF)});
    confirmWith(PW);
    await h.until(() => h.went.length > 0);
    expect(h.deps.gate.isBusy()).toBe(true);
    type(el<HTMLInputElement>('ra-password'), PW);
    force('ra-confirm');
    force('ra-passkey');
    force('ra-cancel');
    force('ra-x');
    await new Promise(r => setTimeout(r, 5));
    expect([h.sent.filter(m => m.type === 'vault.reauthOk').length, h.went.length, h.closed, prfOutputs.length, h.sent.some(m => m.type === 'wallet.discardPrepared')]).toEqual([1, 1, 0, 0, false]);
    // The hand-over ends the screen: once the floor passes, a lifted button still runs nothing.
    h.wake();
    await h.until(() => !h.deps.gate.isBusy());
    const settled = async () => {
      await new Promise(r => setTimeout(r, 20));
      h.wake();
      await h.until(() => !h.deps.gate.isBusy());
    };
    force('ra-cancel');
    await settled();
    force('ra-x');
    await settled();
    type(el<HTMLInputElement>('ra-password'), PW);
    force('ra-confirm');
    await settled();
    expect([h.sent.filter(m => m.type === 'vault.reauthOk').length, h.went.length, h.closed, h.sent.some(m => m.type === 'wallet.discardPrepared')]).toEqual([1, 1, 0, false]);
  });

  it('rule 6: while an attempt is in flight, a lifted Confirm (with a password typed again), passkey, Cancel or X runs nothing', async () => {
    let release: () => void = () => undefined;
    let inFlight = 0;
    const held = new Promise<void>(r => (release = r));
    const h = await harness({
      vault: await withPasskey(PRF),
      credentials: prfCredentials(PRF),
      send: inner => async m => {
        if ((m as {type?: string}).type === 'vault.reauthOk') {
          inFlight += 1;
          await held;
        }
        return inner(m);
      },
    });
    await setSession(h.ext, await deriveSessionAccounts(M, 'slip10', [0]));
    const id = await issueChallenge(h.ext, h.wallet, 'digest', SEND(K0));
    await mountReauth(h.deps).show(id);
    confirmWith(PW);
    await h.until(() => inFlight > 0);
    type(el<HTMLInputElement>('ra-password'), PW);
    force('ra-confirm');
    force('ra-passkey');
    force('ra-cancel');
    force('ra-x');
    await new Promise(r => setTimeout(r, 5));
    expect([inFlight, prfOutputs.length, h.closed, h.sent.some(m => m.type === 'wallet.discardPrepared')]).toEqual([1, 0, 0, false]);
    release();
    await h.until(() => h.went.length > 0);
    expect(h.went).toEqual([`wallet.html#/send/resume?account=${K0}`]);
  });

  it('phase guards: in `undescribable` a lifted Confirm or passkey runs nothing; in `not-unlocked` a lifted Cancel discards nothing', async () => {
    const a = await shown({...SEND(K0), markupReason: 'charged'}, {vault: await withPasskey(PRF), credentials: prfCredentials(PRF)});
    type(el<HTMLInputElement>('ra-password'), PW);
    force('ra-confirm');
    force('ra-passkey');
    await new Promise(r => setTimeout(r, 5));
    expect([a.h.sent.map(m => m.type), prfOutputs.length, a.h.went]).toEqual([['vault.challengeInfo'], 0, []]);
    loadPage();
    const b = await shown(SEND(K0), {unlocked: false});
    force('ra-cancel');
    await new Promise(r => setTimeout(r, 5));
    expect([b.h.sent.map(m => m.type), b.h.closed]).toEqual([['vault.challengeInfo'], 0]);
  });
});

describe('#10: review follow-ups (cooldown cancel ruling, the fail-closed hand-over)', () => {
  /**
   * A prepared send in the cooldown: the 500 ms floor resolves at once, every backoff wait never does — so a cancel
   * that completes proves the wait was pre-empted, not waited out.
   */
  async function cooling(o: {refuse?: boolean} = {}) {
    const {h, id} = await prepared();
    h.deps.sleep = ms => (ms === 500 ? Promise.resolve() : new Promise<void>(() => undefined));
    if (o.refuse === true) {
      const inner = h.deps.send;
      h.deps.send = async m => ((m as {type: string}).type === 'wallet.discardPrepared' ? {ok: false, error: 'failed'} : inner(m));
    }
    await mountReauth(h.deps).show(id);
    confirmWith('wrong wrong wrong wrong');
    await h.until(() => text(el('ra-helper')) === 'That did not confirm it.' && !h.deps.gate.isBusy());
    confirmWith('wrong wrong wrong wrong');
    await h.until(() => visible(el('ra-cooldown')));
    expect(h.deps.gate.isBusy()).toBe(true);
    return {h, id};
  }

  it('ruling: [Cancel send] works during the cooldown — the wait ends, one discard, "Send cancelled…", the tab closes', async () => {
    const {h, id} = await cooling();
    expect(visible(el('ra-cancel'))).toBe(true);
    expect(el<HTMLButtonElement>('ra-cancel').disabled).toBe(false);
    expect(el<HTMLButtonElement>('ra-x').disabled).toBe(false);
    click(el('ra-cancel'));
    // The countdown stops at the click.
    expect(visible(el('ra-cooldown'))).toBe(false);
    await h.until(() => h.closed > 0);
    expect(h.sent.filter(m => m.type === 'wallet.discardPrepared')).toEqual([{type: 'wallet.discardPrepared', account: ACCOUNT.publicKey}]);
    expect(text(el('ra-notice-line'))).toBe('Send cancelled. Nothing was sent.');
    expect(await stillPrepared(h)).toBe(false);
    expect(await challengeInfo(h.ext, h.wallet.now(), id)).toBeNull();
    expect(h.timers.pending()).toBe(0);
    expect(text(el('ra-cooldown-live'))).toBe('');
  });

  it('ruling: a double click in the cooldown (Cancel, Cancel, X) still sends one discard and closes once', async () => {
    const {h} = await cooling();
    click(el('ra-cancel'));
    force('ra-cancel');
    force('ra-x');
    await h.until(() => h.closed > 0 && !h.deps.gate.isBusy());
    force('ra-cancel');
    await new Promise(r => setTimeout(r, 5));
    expect(h.sent.filter(m => m.type === 'wallet.discardPrepared')).toHaveLength(1);
    expect(h.closed).toBe(1);
  });

  it('ruling: after the pre-empted cooldown Confirm is not left on a dead screen — hidden, disabled, and a lifted one runs nothing', async () => {
    const {h} = await cooling();
    click(el('ra-x'));
    await h.until(() => h.closed > 0 && !h.deps.gate.isBusy());
    expect([visible(el('ra-confirm')), el<HTMLButtonElement>('ra-confirm').disabled, visible(el('ra-entry')), visible(el('ra-paused'))]).toEqual([false, true, false, false]);
    const proofs = h.sent.filter(m => m.type === 'vault.status').length;
    type(el<HTMLInputElement>('ra-password'), PW);
    force('ra-confirm');
    await new Promise(r => setTimeout(r, 5));
    expect(h.sent.filter(m => m.type === 'vault.status').length).toBe(proofs);
  });

  it('ruling: a discard refused after the pre-empted cooldown keeps the screen and says so — no "cancelled"', async () => {
    const {h} = await cooling({refuse: true});
    click(el('ra-cancel'));
    await h.until(() => text(el('ra-helper')) === 'Something went wrong. Try again.' && !h.deps.gate.isBusy());
    expect(h.closed).toBe(0);
    expect(text(document.body)).not.toMatch(/cancelled/i);
    expect([visible(el('ra-cooldown')), visible(el('ra-entry')), visible(el('ra-cancel'))]).toEqual([false, true, true]);
    expect(await stillPrepared(h)).toBe(true);
  });

  it('a proven send whose resume target is refused fails closed: "Something went wrong. Try again.", never "Confirmed…"', async () => {
    const {h, broadcast} = await shown();
    refuseResume = true;
    confirmWith(PW);
    await h.until(() => h.sent.some(m => m.type === 'vault.reauthOk') && !h.deps.gate.isBusy());
    expect(text(el('ra-helper'))).toBe('Something went wrong. Try again.');
    expect(h.went).toEqual([]);
    expect(text(document.body)).not.toContain('Confirmed. You can close this tab.');
    expect(visible(el('ra-notice'))).toBe(false);
    nothingSent(h, broadcast);
  });
});
