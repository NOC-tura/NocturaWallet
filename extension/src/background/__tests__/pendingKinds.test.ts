import {readFileSync} from 'node:fs';
import {base64} from '@scure/base';
import {PENDING_KEY, inFlightFor, readPending, updatePending, viewOf, type PendingRecord} from '../pendingStore';
import {EXPIRY_MARGIN_BLOCKS, POLL_INTERVAL_MS, pollOnce, resend, submitSigned} from '../pending';
import {prepareSend} from '../prepare';
import {handleWallet} from '../walletApi';
import {knownRecipients} from '../knownRecipients';
import {VAULT_KEY} from '../accountsStore';
import {firstSignature} from '../../../../core/solana/broadcast';
import type {SignatureStatus} from '../../../../core/solana/rpc';
import {fakeDeps, fakeReader} from './fakeDeps';
import {fakeExt} from './fakeExt';
import {ACCOUNT, HOLDING_LARGE, RECIPIENT, pendingRecord, sendReader, signedWire, unlocked} from './fixtures';

/** What commit 0b79442 stored and read (the plan's capture step; never edited). */
interface Captured {
  capturedFrom: string;
  flow: {sent: string; polled: string};
  validator: {input: unknown[]; read: string; rewritten: string; ownNullIntent: 'dropped' | 'kept'};
}
const CAPTURED = JSON.parse(readFileSync(new URL('./captured/sends.0b79442.json', import.meta.url), 'utf8')) as Captured;

const WIRE = signedWire(7n);
/** B1d §2.3: a purchase in v1_pending — the wallet's own record, no intent, no origin, its kind and display data in `extra`. */
const PURCHASE: PendingRecord = pendingRecord({
  id: 'buy',
  account: ACCOUNT.publicKey,
  signature: firstSignature(WIRE),
  wire: base64.encode(WIRE),
  intent: null,
  fee: {networkLamports: '5050', markupLamports: '0'},
  extra: {
    kind: 'presale-buy',
    data: {currency: 'SOL', amount: '2000000000', stage: '2', priceTicks: '1501', nocBase: '1998667554963357', spentCents: '30000', destination: RECIPIENT, referrer: null},
  },
});
const confirmed: SignatureStatus = {err: null, confirmationStatus: 'confirmed'};
const ENVELOPE = {v: 1, scheme: 'slip10', accounts: [{index: 0, name: 'Account 1', publicKey: ACCOUNT.publicKey}]};

const withoutExtra = (records: PendingRecord[]) => records.map(r => Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'extra')));

describe('a record written before B1d survives the update (captured from commit 0b79442)', () => {
  it('the fixture is the capture step’s output', () => {
    expect(CAPTURED.capturedFrom).toMatch(/^commit 0b79442 /);
  });

  it('a send recorded by the old code, read after a restart: kept, extra null, still in flight, polled to the very bytes the old code wrote', async () => {
    const ext = fakeExt();
    await unlocked(ext);
    await ext.local.set(PENDING_KEY, JSON.parse(CAPTURED.flow.sent));
    const [record, ...rest] = await readPending(ext);
    expect(rest).toEqual([]);
    expect(record).toMatchObject({account: ACCOUNT.publicKey, state: 'pending', extra: null});
    expect(viewOf(record!).extra).toBeNull();
    const deps = fakeDeps({reader: sendReader({getSignatureStatuses: async sigs => sigs.map(() => confirmed), getBlockHeight: async () => 900})});
    await expect(prepareSend(ext, deps, ACCOUNT.publicKey, {token: 'SOL', recipient: RECIPIENT, amount: '1'})).rejects.toMatchObject({code: 'in-flight'});
    await pollOnce(ext, deps);
    expect(JSON.stringify(await ext.local.get(PENDING_KEY))).toBe(CAPTURED.flow.polled);
  });

  it('the validator’s verdict on every captured shape is the old one (extra null on each), and its rewrite is the old bytes', async () => {
    const ext = fakeExt();
    await ext.local.set(PENDING_KEY, CAPTURED.validator.input);
    const read = await readPending(ext);
    expect(JSON.stringify(withoutExtra(read))).toBe(CAPTURED.validator.read);
    expect(read.map(r => r.extra)).toEqual(read.map(() => null));
    await updatePending(ext, records => records);
    expect(JSON.stringify(await ext.local.get(PENDING_KEY))).toBe(CAPTURED.validator.rewritten);
  });

  it('the one verdict B1d changes (review H1): the wallet’s own record with no intent was dropped, and is now kept — extra null, counted', async () => {
    expect(CAPTURED.validator.ownNullIntent).toBe('dropped');
    const ext = fakeExt();
    const own = {...pendingRecord({id: 'own', account: ACCOUNT.publicKey}), intent: null};
    const {extra: _none, ...stored} = own;
    await ext.local.set(PENDING_KEY, [stored]);
    const read = await readPending(ext);
    expect(read).toEqual([own]);
    expect(inFlightFor(read, ACCOUNT.publicKey)?.id).toBe('own');
  });
});

describe('the shared validator reads a purchase (B1d §1.3, §2.3, review H1)', () => {
  it('a presale-buy record is read back whole, and its rewrite keeps extra', async () => {
    const ext = fakeExt();
    await ext.local.set(PENDING_KEY, [PURCHASE]);
    expect(await readPending(ext)).toEqual([PURCHASE]);
    await updatePending(ext, records => records);
    expect(await ext.local.get(PENDING_KEY)).toEqual([PURCHASE]);
  });

  it('a send and a dApp record are written without extra (their stored form is unchanged); a purchase with it', async () => {
    const ext = fakeExt();
    const dapp = pendingRecord({id: 'dapp', account: 'B', intent: null, origin: 'https://noc-tura.io', firstBroadcast: 'held'});
    await updatePending(ext, () => [pendingRecord({id: 'send'}), dapp, PURCHASE]);
    const stored = (await ext.local.get(PENDING_KEY)) as Record<string, unknown>[];
    expect(stored.map(r => 'extra' in r)).toEqual([false, false, true]);
  });

  it('viewOf copies extra: a fresh object, data as stored', async () => {
    const ext = fakeExt();
    await ext.local.set(PENDING_KEY, [PURCHASE]);
    const [record] = await readPending(ext);
    const view = viewOf(record!);
    expect(view.extra).toEqual(PURCHASE.extra);
    expect(view.extra).not.toBe(record!.extra);
    expect('wire' in view).toBe(false);
  });

  it.each([
    ['missing', undefined],
    ['null', null],
    ['a string', 'presale-buy'],
    ['an array', ['presale-buy']],
    ['a number kind', {kind: 3, data: {}}],
    ['an empty kind', {kind: '', data: {}}],
    ['an upper-case kind', {kind: 'Presale-buy', data: {}}],
    ['a kind with a space', {kind: 'presale buy', data: {}}],
    ['a kind starting with a digit', {kind: '1buy', data: {}}],
    ['a kind of 33 characters', {kind: `p${'a'.repeat(32)}`, data: {}}],
    ['no kind', {data: {}}],
  ])('a malformed extra (%s) keeps the record, with extra null', async (_what, extra) => {
    const ext = fakeExt();
    await ext.local.set(PENDING_KEY, [{...PURCHASE, extra}]);
    const read = await readPending(ext);
    expect(read).toEqual([{...PURCHASE, extra: null}]);
    expect(inFlightFor(read, ACCOUNT.publicKey)?.id).toBe('buy');
  });

  it('the kind’s boundaries are read: one letter, 32 characters; data missing reads as null, any other data as stored', async () => {
    const ext = fakeExt();
    const long = `p${'a'.repeat(31)}`;
    await ext.local.set(PENDING_KEY, [
      {...PURCHASE, id: 'one', extra: {kind: 'b'}},
      {...PURCHASE, id: 'long', extra: {kind: long, data: [1, 'x', null]}},
    ]);
    expect((await readPending(ext)).map(r => r.extra)).toEqual([
      {kind: 'b', data: null},
      {kind: long, data: [1, 'x', null]},
    ]);
  });

  it('extra is read only on the wallet’s own record without an intent: on a send and on a dApp record it is null', async () => {
    const ext = fakeExt();
    const dapp = pendingRecord({id: 'dapp', intent: null, origin: 'https://noc-tura.io'});
    await ext.local.set(PENDING_KEY, [pendingRecord({id: 'send', extra: PURCHASE.extra}), {...dapp, extra: PURCHASE.extra}]);
    expect((await readPending(ext)).map(r => [r.id, r.extra])).toEqual([
      ['send', null],
      ['dapp', null],
    ]);
  });

  it('a record without an intent is still dropped when anything else is wrong (negative controls)', async () => {
    const ext = fakeExt();
    const {intent: _i, ...noIntent} = PURCHASE;
    await ext.local.set(PENDING_KEY, [
      {...PURCHASE, id: 'http', origin: 'http://noc-tura.io'},
      {...PURCHASE, id: 'origin-number', origin: 7},
      noIntent,
      {...PURCHASE, id: 'state', state: 'bogus'},
      {...PURCHASE, id: 'signature', signature: null},
      {...PURCHASE, id: 'failure', failure: 'weird'},
      {...PURCHASE, id: 'intent', intent: {token: 'SOL'}},
    ]);
    expect(await readPending(ext)).toEqual([]);
  });
});

describe('a purchase is one in-flight transaction of its account (C10)', () => {
  it('inFlightFor finds it; a send’s prepare and a send’s submit are then refused in-flight; another account and a closed purchase are not', async () => {
    const ext = fakeExt();
    await unlocked(ext);
    await ext.local.set(PENDING_KEY, [PURCHASE]);
    expect(inFlightFor(await readPending(ext), ACCOUNT.publicKey)?.id).toBe('buy');
    expect(inFlightFor(await readPending(ext), RECIPIENT)).toBeUndefined();
    const deps = fakeDeps({reader: sendReader()});
    await expect(prepareSend(ext, deps, ACCOUNT.publicKey, {token: 'SOL', recipient: RECIPIENT, amount: '1000000'})).rejects.toMatchObject({code: 'in-flight'});
    await expect(submitSigned(ext, deps, {account: ACCOUNT.publicKey, wire: signedWire(), lastValidBlockHeight: 1000, intent: {token: 'SOL', recipient: RECIPIENT, amount: '1'}, fee: null})).rejects.toMatchObject({code: 'in-flight'});
    await ext.local.set(PENDING_KEY, [{...PURCHASE, state: 'confirmed'}]);
    expect(inFlightFor(await readPending(ext), ACCOUNT.publicKey)).toBeUndefined();
  });
});

describe('the poller, expiry, resend and wallet.pending are kind-agnostic (B1d §1.3)', () => {
  it('pollOnce confirms it, and names no known recipient (it has no intent) — a send confirmed beside it does', async () => {
    const ext = fakeExt();
    await ext.local.set(VAULT_KEY, ENVELOPE);
    const send = pendingRecord({id: 'send', account: ACCOUNT.publicKey, signature: 's2', intent: {token: 'SOL', recipient: HOLDING_LARGE, amount: '1'}});
    await ext.local.set(PENDING_KEY, [PURCHASE, send]);
    const deps = fakeDeps({reader: fakeReader({getSignatureStatuses: async sigs => sigs.map(() => confirmed), getBlockHeight: async () => 900})});
    expect(await pollOnce(ext, deps)).toBe(false);
    expect(await readPending(ext)).toEqual([
      {...PURCHASE, state: 'confirmed'},
      {...send, state: 'confirmed'},
    ]);
    expect([...(await knownRecipients(ext))]).toEqual([HOLDING_LARGE]);
  });

  it('past its block height and two null rounds, it expires', async () => {
    const ext = fakeExt();
    await ext.local.set(PENDING_KEY, [PURCHASE]);
    const deps = fakeDeps({reader: fakeReader({getSignatureStatuses: async sigs => sigs.map(() => null), getBlockHeight: async () => 1000 + EXPIRY_MARGIN_BLOCKS + 1})});
    await pollOnce(ext, deps);
    deps.clock.t += POLL_INTERVAL_MS;
    await pollOnce(ext, deps);
    expect((await readPending(ext))[0]).toMatchObject({id: 'buy', state: 'expired', extra: PURCHASE.extra});
  });

  it('resend sends its very bytes again', async () => {
    const ext = fakeExt();
    await ext.local.set(PENDING_KEY, [{...PURCHASE, lastSentAt: -10_000}]);
    const deps = fakeDeps();
    deps.broadcast = async wire => {
      deps.broadcasts.push(wire);
      return firstSignature(wire);
    };
    const view = await resend(ext, deps, 'buy');
    expect(deps.broadcasts.map(w => base64.encode(w))).toEqual([PURCHASE.wire]);
    expect(view.extra).toEqual(PURCHASE.extra);
  });

  it('wallet.pending lists it with its extra (origin null: the wallet’s own)', async () => {
    const ext = fakeExt();
    await ext.local.set(PENDING_KEY, [PURCHASE, pendingRecord({id: 'dapp', account: 'B', intent: null, origin: 'https://noc-tura.io'})]);
    const r = await handleWallet(ext, fakeDeps(), 'wallet.pending', {});
    expect(r).toEqual({ok: true, data: [viewOf(PURCHASE)]});
  });
});
