/**
 * M1d spec §3.1: the account list from the encrypted registry, without the seed. Pure: the
 * registry read is handed in. Addresses are the repo's vector addresses (real, on-curve).
 */
import {accountLabel, accountNumber, buildAccountList, shortAccountAddress} from '../accountList';
import {A0AccountRegistryError} from '../../shielded/a0/accountRegistry';
import type {A0AccountEntry, A0AccountRole} from '../../shielded/a0/accountRegistry';

const MAIN = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk'; // slip10:0
const A1 = 'Hh8QwFUA6MtVu1qAoq12ucvFHNwCcVTV7hpWjeY1Hztb'; // slip10:1
const A2 = '7WktogJEd2wQ9eH2oWusmcoFTgeYi6rS632UviTBJ2jm'; // slip10:2
const A3 = '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k'; // slip10:3
const CLI = 'EHqmfkN89RJ7Y33CXM6uCzhVeuywHoJXZZLszBHHZy7o';
const SLIP0 = {kind: 'slip10', account: 0} as const;
const e = (scheme: string, role: A0AccountRole, address: string, linked = false): A0AccountEntry =>
  linked ? {scheme, role, address, linked: true} : {scheme, role, address};
const throwing = (code: 'E_A0_STORE_LOCKED' | 'E_A0_ACCOUNTS_CORRUPT') => () => {
  throw new A0AccountRegistryError(code, 'test');
};

describe('labels (spec §3.1, the extension\'s rule)', () => {
  it('slip10:N → "Account N+1"; cli → "Account 1"', () => {
    expect(accountLabel({kind: 'slip10', account: 0})).toBe('Account 1');
    expect(accountLabel({kind: 'slip10', account: 3})).toBe('Account 4');
    expect(accountLabel({kind: 'cli'})).toBe('Account 1');
    expect(accountNumber({kind: 'slip10', account: 2})).toBe(3);
    expect(accountNumber({kind: 'cli'})).toBe(1);
  });
  it('the short address is first 6 … last 6 (screen.md §0 checksum convention)', () => {
    expect(shortAccountAddress(A3)).toBe('3YqEpf…JXT94k');
    expect(shortAccountAddress('abc')).toBe('abc');
  });
});

describe('the list (spec §3.1)', () => {
  it('no registry yet → exactly the main account, from walletStore.publicKey and the wallet scheme', () => {
    const l = buildAccountList(MAIN, SLIP0, () => null);
    expect(l.accounts).toEqual([
      {scheme: 'slip10:0', address: MAIN, label: 'Account 1', number: 1, role: 'main', isMain: true, linked: false},
    ]);
    expect(l.unreadable).toBe(false);
    expect(l.walletKind).toBe('slip10');
    expect(l.seed).toEqual([{address: MAIN, role: 'main'}]);
  });

  it('main first, then fresh-exit by ascending index; fresh-pending never listed (but in the seed set); linked kept', () => {
    const l = buildAccountList(MAIN, SLIP0, () => [
      e('slip10:0', 'main', MAIN),
      e('slip10:3', 'fresh-exit', A3),
      e('slip10:1', 'fresh-pending', A1),
      e('slip10:2', 'fresh-exit', A2, true),
    ]);
    expect(l.accounts.map(a => a.scheme)).toEqual(['slip10:0', 'slip10:2', 'slip10:3']);
    expect(l.accounts[1]).toEqual({scheme: 'slip10:2', address: A2, label: 'Account 3', number: 3, role: 'fresh-exit', isMain: false, linked: true});
    expect(l.accounts[2]).toEqual({scheme: 'slip10:3', address: A3, label: 'Account 4', number: 4, role: 'fresh-exit', isMain: false, linked: false});
    expect(l.accounts.some(a => a.address === A1)).toBe(false);
    expect(l.seed).toEqual(
      expect.arrayContaining([
        {address: MAIN, role: 'main'},
        {address: A1, role: 'fresh-pending'},
        {address: A2, role: 'fresh-exit'},
        {address: A3, role: 'fresh-exit'},
      ]),
    );
    expect(l.unreadable).toBe(false);
  });

  it.each(['E_A0_STORE_LOCKED', 'E_A0_ACCOUNTS_CORRUPT'] as const)('a read failure (%s) → the main account only and the line, never empty', code => {
    const l = buildAccountList(MAIN, SLIP0, throwing(code));
    expect(l.accounts.map(a => a.scheme)).toEqual(['slip10:0']);
    expect(l.unreadable).toBe(true);
    expect(l.seed).toEqual([{address: MAIN, role: 'main'}]);
  });

  it('Review Focus 1: a registry whose main is not this wallet\'s → unreadable; its exits are never listed', () => {
    const otherWallet = () => [e('slip10:0', 'main', A2), e('slip10:3', 'fresh-exit', A3)];
    const l = buildAccountList(MAIN, SLIP0, otherWallet);
    expect(l.accounts.map(a => a.address)).toEqual([MAIN]);
    expect(l.unreadable).toBe(true);
    expect(l.seed).toEqual([{address: MAIN, role: 'main'}]);
    // the scheme half: the registry's main is slip10:0, the wallet was imported as slip10:3
    const l2 = buildAccountList(A3, {kind: 'slip10', account: 3}, () => [e('slip10:0', 'main', A3)]);
    expect(l2.unreadable).toBe(true);
    // control: the same registry for the wallet it belongs to is read
    expect(buildAccountList(A2, SLIP0, otherWallet).accounts.map(a => a.address)).toEqual([A2, A3]);
  });

  it('a cli wallet lists its one account (S9), with or without a registry', () => {
    const none = buildAccountList(CLI, {kind: 'cli'}, () => null);
    expect(none.accounts.map(a => [a.scheme, a.label])).toEqual([['cli', 'Account 1']]);
    expect(none.walletKind).toBe('cli');
    expect(buildAccountList(CLI, {kind: 'cli'}, () => [e('cli', 'main', CLI)]).accounts).toHaveLength(1);
  });

  it('a slip10:3 main is "Account 4" and stays first, before a lower exit index (never renumbered)', () => {
    const l = buildAccountList(A3, {kind: 'slip10', account: 3}, () => [e('slip10:3', 'main', A3), e('slip10:0', 'fresh-exit', MAIN)]);
    expect(l.accounts.map(a => a.label)).toEqual(['Account 4', 'Account 1']);
    expect(l.accounts[0]!.isMain).toBe(true);
  });
});
