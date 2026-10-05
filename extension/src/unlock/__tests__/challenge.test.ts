import {CHALLENGE_TTL_MS, issueChallenge, type ChallengeAbout} from '../../background/reauthChallenges';
import {handleMessage} from '../../background/messages';
import {clearSession} from '../../background/session';
import {fakeDeps} from '../../background/__tests__/fakeDeps';
import {fakeExt} from '../../background/__tests__/fakeExt';
import {ACCOUNT, RECIPIENT, unlocked} from '../../background/__tests__/fixtures';
import {describeChallenge, discardPrepared, readChallenge} from '../challenge';
import type {Send} from '../types';

// Spec B1b-2a E3, the vault page's half (plan-1 carry): #10 renders `about` only after re-validating
// every field against a closed alphabet; anything else is "could not be shown".
const SEND: ChallengeAbout = {
  kind: 'send',
  account: ACCOUNT.publicKey,
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
};

describe('describeChallenge: the closed-alphabet renderer', () => {
  it('describes a send from fixed strings and validated values only (positive control)', () => {
    expect(describeChallenge(SEND)).toEqual({
      kind: 'send',
      account: ACCOUNT.publicKey,
      amount: '2.4800',
      symbol: 'SOL',
      recipient: RECIPIENT,
      // Spec §4.5's fee rows, the same on #19, #20 and #10 (plan 3, carry 1): the base fee is the network
      // fee less its priority part; then the priority; then the Noctura fee's reason line.
      fees: [
        {label: 'Network fee', value: '0.000005 SOL'},
        {label: 'Priority', value: '0.00000005 SOL'},
        {label: 'No Noctura fee (status unknown)', value: null},
      ],
      reasons: ['Re-auth required for the first send to a new address.', 'Re-auth required for transactions over $100.'],
    });
  });

  it('shows every base unit of the amount — a confirmation never rounds — and each non-zero fee on its own line', () => {
    const d = describeChallenge({...SEND, token: 'USDC', amount: '12345678', markupLamports: '20000', markupReason: 'charged', rentLamports: '2039280', reasons: ['over-5-percent', 'whole-balance-to-new'], thresholdCents: 12_550});
    expect(d).toMatchObject({
      amount: '12.345678',
      symbol: 'USDC',
      fees: [
        {label: 'Network fee', value: '0.000005 SOL'},
        {label: 'Priority', value: '0.00000005 SOL'},
        {label: 'New token account', value: '0.00203928 SOL'},
        {label: 'Noctura fee', value: '0.00002 SOL'},
      ],
      reasons: ['Re-auth required for transactions over 5 % of balance.', 'Re-auth required to send your whole balance to a new address.'],
    });
    expect(describeChallenge({...SEND, reasons: ['over-usd-threshold'], thresholdCents: 12_550})).toMatchObject({reasons: ['Re-auth required for transactions over $125.50.']});
    expect(describeChallenge({...SEND, markupReason: 'pre-tge'})).toMatchObject({fees: [{label: 'Network fee'}, {label: 'Priority'}, {label: 'No Noctura fee before TGE', value: null}]});
    // A priority equal to the whole network fee (no base fee) still describes; it is never negative.
    expect(describeChallenge({...SEND, networkLamports: '50'})).toMatchObject({fees: [{label: 'Network fee', value: '0 SOL'}, {label: 'Priority', value: '0.00000005 SOL'}, {}]});
  });

  // Each field outside its alphabet → null → #10's "could not be shown" with only Cancel.
  it.each<[string, Record<string, unknown>]>([
    ['an unknown token', {token: 'BONK'}],
    ['a token named by an inherited key', {token: 'constructor'}],
    ['an amount with a decimal point', {amount: '2.48'}],
    ['an amount of 21 digits', {amount: '1'.repeat(21)}],
    ['a negative fee', {networkLamports: '-5'}],
    ['a priority with a decimal point', {priorityLamports: '0.5'}],
    ['a priority as a number', {priorityLamports: 50}],
    ['a priority larger than the network fee it is part of', {priorityLamports: '5051'}],
    ['a recipient with markup', {recipient: '<img src=x onerror=alert(1)>'}],
    ['a recipient with a 0 (outside base58)', {recipient: `0${RECIPIENT.slice(1)}`}],
    // ADDRESS's end anchor: a valid 32–44-char run with one more character tacked on must not pass by
    // matching only the valid prefix. Each case stays within the {32,44} length range after the valid
    // run, so only the `$` anchor (not the length bound) can reject it.
    ['a recipient with a trailing right-to-left override', {recipient: `${RECIPIENT}‮`}],
    ['a recipient with a trailing newline', {recipient: `${RECIPIENT}\n`}],
    ['a recipient of 40 valid characters plus a trailing zero-width space', {recipient: `${RECIPIENT.slice(0, 40)}​`}],
    ['a short account', {account: 'abc'}],
    ['an unknown reason', {reasons: ['because']}],
    ['reasons that are not a list', {reasons: 'first-send'}],
    // prepare.ts issues a 'send' challenge only when sendReauthReasons returned at least one code,
    // and that function pushes each code at most once: neither shape is a real challenge.
    ['an empty reasons list (the background never issues a challenge without one)', {reasons: []}],
    ['a duplicated reason', {reasons: ['first-send', 'first-send']}],
    ['a threshold below $1', {thresholdCents: 99}],
    ['a threshold above $1 000', {thresholdCents: 100_001}],
    ['a fractional threshold', {thresholdCents: 100.5}],
    ['an unknown fee reason', {markupReason: 'free'}],
    ['a fee charged with no fee', {markupReason: 'charged'}],
    ['a fee with a reason that is not "charged"', {markupLamports: '20000', markupReason: 'pre-tge'}],
    ['an extra field', {memo: 'hi'}],
  ])('%s is not described', (_name, change) => {
    expect(describeChallenge({...SEND, ...change})).toBeNull();
  });

  it('a missing field, another kind, and a non-object are not described', () => {
    const {thresholdCents: _drop, ...missing} = SEND;
    expect(describeChallenge(missing)).toBeNull();
    const {priorityLamports: _noPriority, ...elevenKeys} = SEND;
    expect(describeChallenge(elevenKeys)).toBeNull();
    expect(describeChallenge({...SEND, kind: 'sign'})).toBeNull();
    for (const x of [null, undefined, 'send', 7, [SEND]]) expect(describeChallenge(x)).toBeNull();
  });

  it('describes a settings change (used from B1b-2b), and refuses one that changes nothing or is out of range', () => {
    expect(describeChallenge({kind: 'settings', autoLockMinutes: 15, reauthUsdCents: 50_000})).toEqual({kind: 'settings', lines: ['Auto-lock → 15 minutes', 'Re-authentication threshold → $500']});
    expect(describeChallenge({kind: 'settings', autoLockMinutes: 1, reauthUsdCents: null})).toEqual({kind: 'settings', lines: ['Auto-lock → 1 minute']});
    expect(describeChallenge({kind: 'settings', autoLockMinutes: null, reauthUsdCents: null})).toBeNull();
    expect(describeChallenge({kind: 'settings', autoLockMinutes: 61, reauthUsdCents: null})).toBeNull();
    expect(describeChallenge({kind: 'settings', autoLockMinutes: 5, reauthUsdCents: null, extra: 1})).toBeNull();
  });
});

const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
const UNLOCK = {id: 'abcdefghijklmnopabcdefghijklmnop', origin: ORIGIN, url: `${ORIGIN}/unlock.html`};

async function background() {
  const ext = fakeExt();
  await unlocked(ext);
  const deps = fakeDeps();
  const send: Send = async m => (await handleMessage(ext, m, UNLOCK, deps)) as {ok: boolean; error?: string; data?: unknown};
  return {ext, deps, send};
}

describe('readChallenge against the real background', () => {
  it('a live challenge is described; an expired one is "expired"; while locked, "not-unlocked"', async () => {
    const {ext, deps, send} = await background();
    const id = await issueChallenge(ext, deps, 'digest', SEND);
    expect(await readChallenge(send, id)).toEqual({state: 'described', description: describeChallenge(SEND)});
    deps.clock.t += CHALLENGE_TTL_MS + 1;
    expect(await readChallenge(send, id)).toEqual({state: 'expired'});
    await clearSession(ext);
    expect(await readChallenge(send, id)).toEqual({state: 'not-unlocked'});
  });

  it('a reply it cannot describe, and a thrown message, are "undescribable"', async () => {
    expect(await readChallenge(async () => ({ok: true, data: {...SEND, token: 'BONK'}}), 'ab'.repeat(16))).toEqual({state: 'undescribable', account: ACCOUNT.publicKey});
    expect(await readChallenge(async () => ({ok: false, error: 'malformed'}), 'ab'.repeat(16))).toEqual({state: 'undescribable', account: null});
    expect(
      await readChallenge(async () => {
        throw new Error('gone');
      }, 'ab'.repeat(16)),
    ).toEqual({state: 'undescribable', account: null});
  });

  // H1: [Cancel send] can discard only an account it has validated by itself; anything else is null.
  it('an undescribable send carries its account only when that field is an address by itself', async () => {
    const read = (data: unknown) => readChallenge(async () => ({ok: true, data}), 'ab'.repeat(16));
    expect(await read({...SEND, markupReason: 'charged'})).toEqual({state: 'undescribable', account: ACCOUNT.publicKey});
    expect(await read({...SEND, account: 'not an address', token: 'BONK'})).toEqual({state: 'undescribable', account: null});
    expect(await read({...SEND, account: 42, token: 'BONK'})).toEqual({state: 'undescribable', account: null});
    // ADDRESS's end anchor again: a valid account with one extra character is not an address by itself.
    expect(await read({...SEND, account: `${ACCOUNT.publicKey}X`, token: 'BONK'})).toEqual({state: 'undescribable', account: null});
    expect(await read({kind: 'settings', account: ACCOUNT.publicKey, autoLockMinutes: 99, reauthUsdCents: null})).toEqual({state: 'undescribable', account: null});
    expect(await read('send')).toEqual({state: 'undescribable', account: null});
  });

  it('discardPrepared (E7) sends the account only when it is an address', async () => {
    const sent: unknown[] = [];
    const send: Send = async m => (sent.push(m), {ok: true});
    expect(await discardPrepared(send, ACCOUNT.publicKey)).toBe(true);
    expect(await discardPrepared(send, 'not an address')).toBe(false);
    // ADDRESS's end anchor: a valid account with one extra character is not an address by itself.
    expect(await discardPrepared(send, `${ACCOUNT.publicKey}X`)).toBe(false);
    // A non-string whose toString() produces a valid address is not a string: refused before ADDRESS.test
    // (which would otherwise coerce it).
    expect(await discardPrepared(send, {toString: () => ACCOUNT.publicKey} as unknown as string)).toBe(false);
    expect(sent).toEqual([{type: 'wallet.discardPrepared', account: ACCOUNT.publicKey}]);
    expect(await discardPrepared(async () => ({ok: false, error: 'malformed'}), ACCOUNT.publicKey)).toBe(false);
  });
});
