/**
 * post-M1d spec §4, R2, R3: the "linked" queue. The registry is written as raw records and read by the
 * real registry module (the harness of selectedAccount.test.ts).
 */
import {clearAllStores, initSecureMmkv, mmkvPublic, mmkvSecure} from '../../../store/mmkv/instances';
import {MMKV_KEYS} from '../../../constants/mmkvKeys';
import {storeTransparentScheme} from '../../keyDerivation/derivationScheme';
import {loadA0AccountRegistry, promoteA0FreshAccount, releaseA0FreshAccount} from '../../shielded/a0/accountRegistry';
import {drainLinkQueue, pendingLinkedAccounts, queueLinkedAccounts, recordConfirmedSendLinks} from '../linkQueue';

const MAIN = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const A1 = 'Hh8QwFUA6MtVu1qAoq12ucvFHNwCcVTV7hpWjeY1Hztb';
const A3 = '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k';
const FOREIGN = 'E48cosDiQZK1iDSsyUzhvW4WxJeoKuDk5qgcdkmANV4N';
const REG = 'v1_accounts';
const QUEUE = 'v1_accounts.linkPending';
const main = {scheme: 'slip10:0', role: 'main', address: MAIN};
const exit3 = {scheme: 'slip10:3', role: 'fresh-exit', address: A3};
const pending1 = {scheme: 'slip10:1', role: 'fresh-pending', address: A1};
const setRegistry = (accounts: object[]): void => mmkvSecure()!.set(REG, JSON.stringify({schema: 1, accounts}));
const linked = (address: string): boolean => loadA0AccountRegistry()!.find(e => e.address === address)!.linked === true;
const stored = (): unknown => {
  const raw = mmkvSecure()!.getString(QUEUE);
  return raw === undefined ? undefined : JSON.parse(raw);
};

beforeEach(() => {
  clearAllStores(); // also empties the memory queue through the reset hook (once the module registered it)
  initSecureMmkv('test-key');
  storeTransparentScheme({kind: 'slip10', account: 0});
});

it('the key is v1_accounts.linkPending', () => {
  expect(MMKV_KEYS.ACCOUNTS_LINK_PENDING).toBe(QUEUE);
});

// Q1
it('a fresh-exit participant is marked; the queue is cleared once written', () => {
  setRegistry([main, exit3]);
  expect(recordConfirmedSendLinks([A3])).toBe(1);
  expect(linked(A3)).toBe(true);
  expect(pendingLinkedAccounts()).toEqual([]);
  expect(stored()).toBeUndefined();
});

// Q2
it('never the main account; an address outside the registry is dropped', () => {
  setRegistry([main, exit3]);
  expect(recordConfirmedSendLinks([MAIN, FOREIGN])).toBe(0);
  expect(loadA0AccountRegistry()![0]!.linked).toBeUndefined();
  expect(pendingLinkedAccounts()).toEqual([]);
});

// Q3
it('idempotent; an empty list does nothing', () => {
  setRegistry([main, exit3]);
  expect(recordConfirmedSendLinks([A3])).toBe(1);
  expect(recordConfirmedSendLinks([A3])).toBe(0);
  expect(recordConfirmedSendLinks([])).toBe(0);
});

// Q4 (R3)
it('R3: a fresh-pending participant is queued, not written; it is applied when its entry is promoted', () => {
  setRegistry([main, exit3, pending1]);
  expect(recordConfirmedSendLinks([A1])).toBe(0);
  expect(loadA0AccountRegistry()!.find(e => e.address === A1)).toEqual(pending1); // no linked on a pending entry
  expect(pendingLinkedAccounts()).toEqual([A1]);
  expect(stored()).toEqual([A1]);
  expect(promoteA0FreshAccount('slip10:1')).toBe('promoted');
  expect(linked(A1)).toBe(true);
  expect(pendingLinkedAccounts()).toEqual([]);
  expect(stored()).toBeUndefined();
});

// Q5 (R3)
it('R3: a released reservation → the queued address is dropped at the next drain', () => {
  setRegistry([main, exit3, pending1]);
  recordConfirmedSendLinks([A1]);
  expect(releaseA0FreshAccount('slip10:1')).toBe(true);
  expect(drainLinkQueue()).toBe(0);
  expect(pendingLinkedAccounts()).toEqual([]);
  expect(stored()).toBeUndefined();
});

// Q6 (R2)
it('R2: an unreadable registry → nothing thrown, the queue is kept (memory AND store); it drains once the registry reads again', () => {
  mmkvSecure()!.set(REG, '{not json');
  expect(() => recordConfirmedSendLinks([A3])).not.toThrow();
  expect(pendingLinkedAccounts()).toEqual([A3]);
  expect(stored()).toEqual([A3]);
  setRegistry([main, exit3]);
  expect(drainLinkQueue()).toBe(1);
  expect(linked(A3)).toBe(true);
  expect(stored()).toBeUndefined();
});

// Q7 (R2, Review Focus 3)
it('R2: a locked store → held in memory, nothing thrown; a wipe + import clears it — the new wallet\'s account is never tagged', () => {
  setRegistry([main, exit3]);
  queueLinkedAccounts([]); // registers the module's hooks while a store is open
  clearAllStores(); // the wipe: the encrypted store is gone
  expect(() => recordConfirmedSendLinks([A3])).not.toThrow();
  expect(pendingLinkedAccounts()).toEqual([A3]); // memory only
  expect(drainLinkQueue()).toBe(0); // still locked
  initSecureMmkv('another-wallet-key'); // the import: a new instance → the reset hook
  storeTransparentScheme({kind: 'slip10', account: 0});
  setRegistry([main, exit3]);
  expect(pendingLinkedAccounts()).toEqual([]);
  expect(drainLinkQueue()).toBe(0);
  expect(linked(A3)).toBe(false);
});

// Q8 (R2)
it('R2: app start — a queue stored by an earlier process is drained after unlock', () => {
  setRegistry([main, exit3]);
  mmkvSecure()!.set(QUEUE, JSON.stringify([A3])); // written by the previous process; this one's memory is empty
  expect(drainLinkQueue()).toBe(1);
  expect(linked(A3)).toBe(true);
  expect(stored()).toBeUndefined();
});

// Q9 (Review Focus 3)
it.each([['not JSON', '{nope'], ['not a list', '{"a":1}'], ['a list of non-strings', '[1,2]']])(
  'a malformed stored queue (%s) never throws and never blocks a later confirmed Send',
  (_n, raw) => {
    setRegistry([main, exit3]);
    mmkvSecure()!.set(QUEUE, raw);
    expect(() => drainLinkQueue()).not.toThrow();
    expect(recordConfirmedSendLinks([A3])).toBe(1);
    expect(linked(A3)).toBe(true);
  },
);

// Q10
it('the queue is in the ENCRYPTED instance only (a list of one\'s own accounts is itself a link)', () => {
  setRegistry([main, exit3, pending1]);
  const publicBefore = mmkvPublic.getAllKeys().sort();
  recordConfirmedSendLinks([A1]);
  expect(mmkvPublic.getAllKeys().sort()).toEqual(publicBefore);
  expect(mmkvSecure()!.getString(QUEUE)).toBeDefined();
});

// Q11
it('queueLinkedAccounts alone writes no tag (the tag needs a drain)', () => {
  setRegistry([main, exit3]);
  queueLinkedAccounts([A3]);
  expect(linked(A3)).toBe(false);
  expect(pendingLinkedAccounts()).toEqual([A3]);
});
