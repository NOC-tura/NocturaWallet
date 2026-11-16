/**
 * The shield screens' shared facts and the prepared-deposit holder.
 *
 * The two SOL amounts the screens state are read back from the committed landed deposit
 * 3DR6F7oW… (Task 1's fixture, fetched once from devnet) — the fee from `meta.fee`, the rent from
 * the account the deposit created (pre-balance 0) — never from the code under test.
 */
import {readFileSync} from 'fs';
import {join} from 'path';
import {
  A0_DEPOSIT_FEE_LAMPORTS,
  A0_RHO_MARKER_RENT_LAMPORTS,
  A0_TOKEN,
  a0ErrorText,
  displayAmount,
  holdPreparedA0Deposit,
  preparedA0Deposit,
  releasePreparedA0Deposit,
  resetPreparedA0DepositsForTests,
} from '../screenSupport';
import {A0} from '../constants';
import {A0DepositError} from '../depositFlow';
import type {A0PreparedDeposit} from '../depositFlow';

jest.mock('@solana/web3.js', () =>
  jest.requireActual<typeof import('../__testing__/realWeb3')>('../__testing__/realWeb3').loadRealWeb3(),
);

const landed = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/landed-deposit-3DR6F7oW.json'), 'utf8'),
) as {slot: number; result: {meta: {fee: number; preBalances: number[]; postBalances: number[]}}};

describe('the SOL a deposit costs — from the landed deposit 3DR6F7oW… (fixture)', () => {
  const {fee, preBalances, postBalances} = landed.result.meta;

  it('fee = meta.fee', () => {
    expect(landed.slot).toBe(520075903);
    expect(BigInt(fee)).toBe(A0_DEPOSIT_FEE_LAMPORTS);
  });

  it('rent = the post-balance of the one account the deposit created (pre-balance 0)', () => {
    const created = preBalances.map((b, i) => (b === 0 && postBalances[i]! > 0 ? i : -1)).filter(i => i >= 0);
    expect(created).toHaveLength(1);
    expect(BigInt(postBalances[created[0]!]!)).toBe(A0_RHO_MARKER_RENT_LAMPORTS);
  });

  it('the depositor (account 0, the fee payer) paid exactly fee + rent in SOL', () => {
    expect(BigInt(preBalances[0]! - postBalances[0]!)).toBe(A0_DEPOSIT_FEE_LAMPORTS + A0_RHO_MARKER_RENT_LAMPORTS);
  });
});

describe('A0_TOKEN', () => {
  it('is the A0 pool mint with its decimals', () => {
    expect(A0_TOKEN.mint).toBe(A0.mint);
    expect(A0_TOKEN.decimals).toBe(9);
  });
});

describe('displayAmount', () => {
  it.each([
    [0n, '0'],
    [1n, '0.000000001'],
    [1_234_567_000_000_001n, '1,234,567.000000001'],
    [2_500_000_000n, '2.5'],
  ])('%s → %s (exact, grouped)', (u, s) => {
    expect(displayAmount(u, 9)).toBe(s);
  });
});

describe('a0ErrorText', () => {
  it('an A0DepositError: its code, the message without the prefix', () => {
    expect(a0ErrorText(new A0DepositError('E_A0_DEPOSIT_CLUSTER', 'not devnet'))).toEqual({
      code: 'E_A0_DEPOSIT_CLUSTER',
      message: 'not devnet',
    });
  });
  it('a native rejection carrying the code only in its message', () => {
    expect(a0ErrorText(new Error('E_A0_KEYS_DIGEST: zkey digest mismatch'))).toEqual({
      code: 'E_A0_KEYS_DIGEST',
      message: 'zkey digest mismatch',
    });
  });
  it('anything else: no code, the text as it is', () => {
    expect(a0ErrorText(new Error('User canceled the operation.'))).toEqual({code: null, message: 'User canceled the operation.'});
    expect(a0ErrorText('boom')).toEqual({code: null, message: 'boom'});
  });
  it('a non-E_ `code` property (e.g. a numeric RPC code) is not taken for one', () => {
    expect(a0ErrorText(Object.assign(new Error('rpc'), {code: -32005}))).toEqual({code: null, message: 'rpc'});
  });
});

describe('the prepared-deposit holder', () => {
  const p = {amount: 1n} as unknown as A0PreparedDeposit;
  const q = {amount: 2n} as unknown as A0PreparedDeposit;
  beforeEach(resetPreparedA0DepositsForTests);

  it('holds one deposit under its id; release returns it ONCE', () => {
    const id = holdPreparedA0Deposit(p);
    expect(preparedA0Deposit(id)).toBe(p);
    expect(releasePreparedA0Deposit(id)).toBe(p);
    expect(releasePreparedA0Deposit(id)).toBeNull();
    expect(preparedA0Deposit(id)).toBeNull();
  });

  it('a new prepare replaces the old one: the old id finds nothing', () => {
    const a = holdPreparedA0Deposit(p);
    const b = holdPreparedA0Deposit(q);
    expect(a).not.toBe(b);
    expect(preparedA0Deposit(a)).toBeNull();
    expect(releasePreparedA0Deposit(a)).toBeNull();
    expect(preparedA0Deposit(b)).toBe(q);
  });

  it('an unknown id finds nothing', () => {
    holdPreparedA0Deposit(p);
    expect(preparedA0Deposit('a0-deposit-999')).toBeNull();
    expect(releasePreparedA0Deposit('a0-deposit-999')).toBeNull();
  });
});
