import {CHALLENGE_TTL_MS, issueChallenge, type ChallengeAbout} from '../../background/reauthChallenges';
import {handleMessage} from '../../background/messages';
import {clearSession} from '../../background/session';
import {fakeDeps} from '../../background/__tests__/fakeDeps';
import {fakeExt} from '../../background/__tests__/fakeExt';
import {ACCOUNT, RECIPIENT, unlocked} from '../../background/__tests__/fixtures';
import {describeChallenge, discardPrepared, readChallenge} from '../challenge';
import type {Send} from '../types';
import {MAINNET_SOL_TREASURY, MAINNET_VAULT_USDC_ATA} from '../../../../core/presale/addresses';

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

// B1c-2: a dApp's transaction request.
const DAPP: ChallengeAbout = {
  kind: 'dapp',
  account: ACCOUNT.publicKey,
  site: 'jup.ag',
  transactions: 2,
  outgoing: [
    {mint: null, symbol: 'SOL', amount: '1005000', decimals: 9},
    {mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC', amount: '250000000', decimals: 6},
    {mint: RECIPIENT, symbol: null, amount: '777', decimals: null},
  ],
  omitted: 0,
  reasons: ['first-send', 'approval'],
  thresholdCents: 10_000,
  flags: [],
};

describe('describeChallenge: a dApp’s transaction (B1c-2)', () => {
  it('the site, the batch’s size, each token leaving the account (exact, never rounded), the reasons (positive control)', () => {
    expect(describeChallenge(DAPP)).toEqual({
      kind: 'dapp',
      site: 'jup.ag',
      transactions: 2,
      outgoing: [
        // B1c-3: unsigned — what leaves; #10's rows add the minus, its headline does not (reauth.ts).
        {label: 'SOL', amount: '0.001005', mint: null},
        {label: 'USDC', amount: '250', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'},
        {label: 'Token', amount: '777 (base units)', mint: RECIPIENT},
      ],
      omitted: 0,
      reasons: ['Re-auth required for the first send to a new address.', 'Re-auth required to approve a token allowance.'],
      overrides: [],
    });
  });

  it('fails closed: a key more or less, a site with a path, a named token with other decimals, SOL with a mint, an unknown reason, no reason, a count of omitted tokens that is not a whole number ≥ 0', () => {
    const outgoing = DAPP.kind === 'dapp' ? DAPP.outgoing : [];
    for (const bad of [
      {...DAPP, extra: 1},
      {...DAPP, site: 'jup.ag/x'},
      {...DAPP, transactions: 6},
      {...DAPP, outgoing: [{...outgoing[1], decimals: 9}]},
      {...DAPP, outgoing: [{...outgoing[0], mint: RECIPIENT}]},
      {...DAPP, outgoing: [{...outgoing[2], symbol: 'BONK'}]},
      {...DAPP, outgoing: [{...outgoing[0], amount: '-5'}]},
      {...DAPP, reasons: ['drain']},
      {...DAPP, reasons: []},
      {...DAPP, omitted: -1},
      {...DAPP, omitted: 1.5},
      {...DAPP, omitted: '2'},
    ]) {
      expect([bad, describeChallenge(bad)]).toEqual([bad, null]);
    }
  });
});

// B1c-3 (spec §3.3 rev 3.6): a request with a block re-authenticates with the reason `override` (Q33).
describe('describeChallenge: the override reason (B1c-3)', () => {
  it('`override` reads Q33’s line; an unknown reason still makes the whole description unshowable', () => {
    const flags = [{tx: 0, row: 'F3', word: 'ASSIGN', step: null}];
    expect(describeChallenge({...DAPP, reasons: ['approval', 'override'], flags})).toMatchObject({kind: 'dapp', reasons: ['Re-auth required to approve a token allowance.', 'Re-auth required to override a blocked transaction.']});
    expect(describeChallenge({...DAPP, reasons: ['override', 'overrides'], flags})).toBeNull();
  });
});

// B1c-3 (spec §3.3 rev 3.6, "#10's description names what is overridden"): one row per block — what is overridden and,
// in a batch, on which transaction; the warnings travel too (the re-issue compares them) but are not rows here.
describe('describeChallenge: what is overridden (B1c-3)', () => {
  const FLAGS = [
    {tx: 0, row: 'F5', word: 'USDC', step: null, scope: 'unlimited'},
    {tx: 0, row: 'F2', word: null, step: null},
    {tx: 1, row: 'F4', word: 'AUTHORITY', step: null},
    {tx: 1, row: 'F10', word: 'UNCHECKED', step: 1},
    {tx: 1, row: 'F3', word: 'ASSIGN', step: null},
    {tx: 1, row: 'F5', word: 'UNLIMITED', step: null, scope: 'unlimited'},
    {tx: 1, row: 'F7', word: null, step: null},
  ];
  const OVERRIDE = {...DAPP, reasons: ['first-send', 'override'], flags: FLAGS};

  it('one row per block, in the order given: the label and “Transaction <n> of <m>” in a batch; a single transaction’s rows carry no transaction', () => {
    expect(describeChallenge(OVERRIDE)).toMatchObject({
      kind: 'dapp',
      reasons: ['Re-auth required for the first send to a new address.', 'Re-auth required to override a blocked transaction.'],
      overrides: [
        {label: 'Unlimited USDC spend approval', transaction: 'Transaction 1 of 2'},
        {label: 'SetAuthority on an account you own', transaction: 'Transaction 2 of 2'},
        {label: 'Depends on step 1 — not checked on its own', transaction: 'Transaction 2 of 2'},
        {label: 'Assign / Allocate on your wallet account', transaction: 'Transaction 2 of 2'},
        {label: 'Unlimited token spend approval', transaction: 'Transaction 2 of 2'},
      ],
    });
    expect(describeChallenge({...OVERRIDE, transactions: 1, flags: [{tx: 0, row: 'F3', word: 'ASSIGN', step: null}]})).toMatchObject({overrides: [{label: 'Assign / Allocate on your wallet account', transaction: null}]});
    // O9: 99 % of the balance up to the whole of it, below u64::MAX — its own row (Q56), never "Unlimited".
    const nearlyAll = (word: string) => ({...OVERRIDE, transactions: 1, flags: [{tx: 0, row: 'F5', word, step: null, scope: 'nearly-all'}]});
    expect(describeChallenge(nearlyAll('USDC'))).toMatchObject({overrides: [{label: 'Spend approval for nearly all your USDC', transaction: null}]});
    // Review 3 L14: an unnamed token's word below u64::MAX is ALLOWANCE (Q58) — UNLIMITED there is refused.
    expect(describeChallenge(nearlyAll('ALLOWANCE'))).toMatchObject({overrides: [{label: 'Spend approval for nearly all of this token', transaction: null}]});
    expect(describeChallenge(nearlyAll('UNLIMITED'))).toBeNull();
    // Warnings only: no rows, and no `override` reason.
    expect(describeChallenge({...DAPP, flags: [{tx: 1, row: 'F8', word: null, step: null}]})).toMatchObject({overrides: []});
  });

  it('fails closed on anything the background never issues: the flags missing, an unknown row, F5 without its scope or with another, a scope on another row, a transaction past the batch, a wrong word, a step not before its own, a row twice, a block without `override` or `override` without a block', () => {
    const one = (f: Record<string, unknown>) => ({...OVERRIDE, flags: [{tx: 1, row: 'F3', word: 'ASSIGN', step: null, ...f}]});
    for (const bad of [
      Object.fromEntries(Object.entries(OVERRIDE).filter(([k]) => k !== 'flags')),
      {...OVERRIDE, flags: null},
      one({extra: 1}),
      one({row: 'F11'}),
      one({tx: 2}),
      one({tx: -1}),
      one({word: 'assign'}),
      one({word: null}),
      one({row: 'F2', word: 'ASSIGN'}),
      one({row: 'F5', word: 'SOL', scope: 'unlimited'}),
      one({row: 'F5', word: 'BONK', scope: 'unlimited'}),
      one({row: 'F5', word: 'USDC'}),
      one({row: 'F5', word: 'USDC', scope: 'all'}),
      one({scope: 'unlimited'}),
      one({row: 'F5', word: 'ALLOWANCE', scope: 'unlimited'}),
      one({row: 'F5', word: 'UNLIMITED', scope: 'nearly-all'}),
      one({row: 'F10', word: 'UNCHECKED', step: 2}),
      one({row: 'F10', word: 'UNCHECKED', step: 0}),
      one({row: 'F10', word: 'UNCHECKED', step: null}),
      one({step: 1}),
      {...OVERRIDE, flags: [...FLAGS, FLAGS[2]]},
      {...OVERRIDE, reasons: ['first-send']},
      {...DAPP, reasons: ['first-send', 'override']},
      {...OVERRIDE, flags: Array.from({length: 51}, (_, i) => ({tx: i % 2, row: 'F7', word: null, step: null}))},
    ]) {
      expect([bad, describeChallenge(bad)]).toEqual([bad, null]);
    }
    // Positive control: each one's valid form.
    expect(describeChallenge(one({}))).not.toBeNull();
    expect(describeChallenge(one({row: 'F10', word: 'UNCHECKED', step: 1}))).not.toBeNull();
    expect(describeChallenge(one({row: 'F5', word: 'USDC', scope: 'nearly-all'}))).not.toBeNull();
  });
});

// Final review I2: #10 accepts every site the background can issue (shared/site.ts — the same shape on all three sides).
describe('describeChallenge: a dApp’s site is any host `new URL` gives an https origin', () => {
  it('an underscore host, an IPv6 literal with a port, punycode: described; a path, a space, credentials, a query: refused', () => {
    for (const site of ['my_site.example.com', '[::1]:8443', 'xn--80ak6aa92e.com']) {
      expect(describeChallenge({...DAPP, site})).toMatchObject({kind: 'dapp', site});
    }
    for (const site of ['jup.ag/x', 'jup ag', 'user@jup.ag', 'jup.ag?x', '']) {
      expect([site, describeChallenge({...DAPP, site})]).toEqual([site, null]);
    }
  });
});

describe('describeChallenge: a dApp’s omitted tokens (review 1 L9)', () => {
  it('the count of the tokens past the listed ones is carried to #10', () => {
    expect(describeChallenge({...DAPP, omitted: 3})).toMatchObject({kind: 'dapp', omitted: 3});
  });
});

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

// B1d §4.2 (B1d-1b Task 5): #10's description of a purchase challenge — the presale entry's (`src/unlock/presale.ts`),
// re-validated there as a send's is here: in the build with presale, Q18 and #20's rows; in the build without it, the
// stub describes nothing and #10 offers only Cancel (C19). This file runs in both vitest runs.
const PURCHASE = {
  kind: 'presale-buy',
  account: ACCOUNT.publicKey,
  currency: 'SOL',
  amount: '2000000000',
  stage: 0,
  priceTicks: '1501',
  nocBase: '2643837441705',
  spentCents: '39684',
  destination: MAINNET_SOL_TREASURY,
  networkLamports: '11000',
  priorityLamports: '6000',
  rentLamports: '2189480',
  reasons: ['first-purchase', 'over-5-percent', 'over-usd-threshold'],
  thresholdCents: 10_000,
};
describe(`describeChallenge: a purchase in this build (${process.env.NOCTURA_PRESALE === '0' ? 'off' : 'on'})`, () => {
  const off = process.env.NOCTURA_PRESALE === '0';

  it(off ? 'off: not described — #10 offers only Cancel' : 'on: Q18 as the eyebrow and headline, #20’s rows (the recipient whole after Q10), the fees with Q09, Q17 and B1b’s reason lines', () => {
    expect(describeChallenge(PURCHASE)).toEqual(
      off
        ? null
        : {
            kind: 'other',
            account: ACCOUNT.publicKey,
            about: 'Confirm buying NOC with',
            amount: '2.0000',
            symbol: 'SOL',
            rows: [
              {label: 'You receive (est.)', value: '2,643.83 NOC', address: null},
              {label: 'Stage', value: '1 of 10', address: null},
              {label: 'Price', value: '$ 0.1501 / NOC', address: null},
              {label: 'To', value: 'Noctura presale', address: MAINNET_SOL_TREASURY},
              {label: 'Network fee', value: '0.000005 SOL', address: null},
              {label: 'Priority', value: '0.000006 SOL', address: null},
              {label: 'Account setup (first purchase)', value: '0.00218948 SOL', address: null},
            ],
            reasons: ['Re-auth required for your first presale purchase from this account.', 'Re-auth required for transactions over 5 % of balance.', 'Re-auth required for transactions over $100.'],
            cancelled: 'Purchase cancelled. Nothing was sent.',
          },
    );
  });

  it.skipIf(off)('on: a stablecoin purchase with no account setup — its exact amount, no Q09 row, the vault ATA as recipient', () => {
    const d = describeChallenge({...PURCHASE, currency: 'USDC', amount: '25000000', rentLamports: '0', destination: MAINNET_VAULT_USDC_ATA, reasons: ['over-5-percent']});
    expect(d === null ? null : {amount: d.kind === 'other' ? d.amount : null, symbol: d.kind === 'other' ? d.symbol : null, rows: d.kind === 'other' ? d.rows.map(r => r.label) : null}).toEqual({
      amount: '25.00',
      symbol: 'USDC',
      rows: ['You receive (est.)', 'Stage', 'Price', 'To', 'Network fee', 'Priority'],
    });
  });

  it.skipIf(off)('on: anything outside the record is not described (fail closed) — each field, each rule', () => {
    const {thresholdCents: _t, ...missing} = PURCHASE;
    for (const bad of [
      missing,
      {...PURCHASE, extra: 1},
      {...PURCHASE, kind: 'presale-claim'},
      {...PURCHASE, currency: 'NOC'},
      {...PURCHASE, amount: '0'},
      {...PURCHASE, amount: '2e9'},
      {...PURCHASE, stage: 10},
      {...PURCHASE, stage: '0'},
      {...PURCHASE, priceTicks: '1.5'},
      {...PURCHASE, nocBase: -1},
      {...PURCHASE, account: 'not-an-address'},
      {...PURCHASE, destination: '0'.repeat(44)},
      {...PURCHASE, priorityLamports: '11001'},
      {...PURCHASE, thresholdCents: 99},
      {...PURCHASE, thresholdCents: 100.5},
      {...PURCHASE, reasons: []},
      {...PURCHASE, reasons: ['first-purchase', 'first-purchase']},
      {...PURCHASE, reasons: ['first-send']},
    ]) {
      expect(describeChallenge(bad)).toBeNull();
    }
  });
});

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
