/**
 * Shielded UX part B, decision B-6 (spec §4 "Import, smart account choice"): one funded account →
 * "We found your wallet"; several → the funded ones; none → standard account 0 with "No funds found
 * yet"; the balance RPC failed → the warning and the full list. Never a silent pick. The detection
 * (`detectFundedAccounts`) is stubbed: its own suite proves it.
 */
import React from 'react';
import {render, fireEvent, waitFor} from '@testing-library/react-native';
import type {AccountCandidate, DetectionResult} from '../../../modules/keyDerivation/accountDetection';
import type {TransparentScheme} from '../../../modules/keyDerivation/transparent';

jest.mock('../../../modules/screenSecurity/screenSecurityModule', () => ({
  ScreenSecurityManager: class {
    enableSecureScreen() {
      return Promise.resolve();
    }
    disableSecureScreen() {
      return Promise.resolve();
    }
  },
}));
jest.mock('../../../modules/keyDerivation/mnemonicUtils', () => ({
  mnemonicToSeed: () => Promise.resolve(new Uint8Array(64).fill(7)),
}));
const mockDetect = jest.fn<Promise<DetectionResult>, [Uint8Array]>();
jest.mock('../../../modules/keyDerivation/accountDetection', () => ({
  detectFundedAccounts: (seed: Uint8Array) => mockDetect(seed),
}));

import {SelectAccountScreen, accountChoiceView} from '../SelectAccountScreen';

const S = (account: number): TransparentScheme => ({kind: 'slip10', account});
const CLI: TransparentScheme = {kind: 'cli'};
const addr = (tag: string) => `${tag}${'x'.repeat(44 - tag.length)}`;
function cand(scheme: TransparentScheme, tag: string, lamports = 0n, nocAmount = 0n): AccountCandidate {
  return {scheme, address: addr(tag), lamports, nocAmount, funded: lamports > 0n || nocAmount > 0n};
}
/** detection's order: funded first, then the rest in derivation order */
function all(funded: AccountCandidate[]): AccountCandidate[] {
  const rest = [S(0), S(1), S(2), S(3), S(4), CLI]
    .filter(s => !funded.some(f => JSON.stringify(f.scheme) === JSON.stringify(s)))
    .map((s, i) => cand(s, `Empty${i}`));
  return [...funded, ...rest];
}

const onSelect = jest.fn();
beforeEach(() => {
  mockDetect.mockReset();
  onSelect.mockReset();
});

async function screen() {
  const r = render(<SelectAccountScreen mnemonic="abandon abandon" onSelect={onSelect} />);
  await waitFor(() => expect(r.queryByText('Looking for your accounts…')).toBeNull());
  return r;
}
type R = Awaited<ReturnType<typeof screen>>;
const ids = (r: R) => r.queryAllByTestId(/^account-candidate-/).map(e => e.props.testID as string);

describe('the import\'s account choice (decision B-6)', () => {
  it('exactly one funded: "We found your wallet", its address and balance; no list; Continue picks it — not before the tap', async () => {
    mockDetect.mockResolvedValue({candidates: all([cand(S(2), 'Funded2', 1_500_000_000n, 25_000_000_000n)]), balancesResolved: true});
    const r = await screen();
    expect(r.getByText('We found your wallet')).toBeTruthy();
    expect(r.getByTestId('select-account-found-address').props.children).toBe('Funded...xxxx');
    expect(r.getByTestId('select-account-found-balance').props.children).toBe('1.5 SOL · 25 NOC');
    expect(ids(r)).toEqual([]);
    expect(onSelect).not.toHaveBeenCalled(); // never a silent pick
    fireEvent.press(r.getByTestId('select-account-continue'));
    expect(onSelect).toHaveBeenCalledWith(S(2));
  });

  it('one funded → "Use a different account" reveals all six; a pick there is what Continue uses', async () => {
    mockDetect.mockResolvedValue({candidates: all([cand(S(2), 'Funded2', 1n)]), balancesResolved: true});
    const r = await screen();
    fireEvent.press(r.getByTestId('select-account-different'));
    expect(ids(r)).toHaveLength(6);
    expect(r.queryByText('We found your wallet')).toBeNull();
    fireEvent.press(r.getByTestId('account-candidate-slip10:0'));
    fireEvent.press(r.getByTestId('select-account-continue'));
    expect(onSelect).toHaveBeenCalledWith(S(0));
  });

  it('several funded: only the funded ones are listed, the first preselected; the link reveals the rest', async () => {
    mockDetect.mockResolvedValue({
      candidates: all([cand(S(1), 'Funded1', 2n), cand(CLI, 'FundedC', 0n, 3n)]),
      balancesResolved: true,
    });
    const r = await screen();
    expect(ids(r)).toEqual(['account-candidate-slip10:1', 'account-candidate-cli']);
    expect(r.queryByText('We found your wallet')).toBeNull();
    fireEvent.press(r.getByTestId('select-account-different'));
    expect(ids(r)).toHaveLength(6);
    fireEvent.press(r.getByTestId('select-account-continue'));
    expect(onSelect).toHaveBeenCalledWith(S(1));
  });

  it('none funded (balances resolved): standard account 0 with "No funds found yet …" and its address; Continue picks account 0; the link reveals all', async () => {
    mockDetect.mockResolvedValue({candidates: all([]), balancesResolved: true});
    const r = await screen();
    expect(r.getByText('No funds found yet. You can receive to this address.')).toBeTruthy();
    expect(r.getByTestId('select-account-none-address').props.children).toBe('Empty0...xxxx');
    expect(r.queryByText('We found your wallet')).toBeNull();
    expect(ids(r)).toEqual([]);
    fireEvent.press(r.getByTestId('select-account-continue'));
    expect(onSelect).toHaveBeenCalledWith(S(0));
    fireEvent.press(r.getByTestId('select-account-different'));
    expect(ids(r)).toHaveLength(6);
  });

  it('the balance RPC failed: today\'s warning, Retry, the FULL list; neither smart view', async () => {
    mockDetect.mockResolvedValue({candidates: all([]), balancesResolved: false});
    const r = await screen();
    expect(r.getByText(/Couldn't check balances right now/)).toBeTruthy();
    expect(r.getByTestId('select-account-retry')).toBeTruthy();
    expect(ids(r)).toHaveLength(6);
    expect(r.queryByText('We found your wallet')).toBeNull();
    expect(r.queryByText(/No funds found yet/)).toBeNull();
    expect(r.queryByTestId('select-account-different')).toBeNull();
  });

  it('Review Focus 4: a Retry after a failed RPC that now finds ONE funded account shows "We found your wallet" (the full-list state is reset)', async () => {
    mockDetect.mockResolvedValueOnce({candidates: all([]), balancesResolved: false});
    mockDetect.mockResolvedValueOnce({candidates: all([cand(S(3), 'Funded3', 9n)]), balancesResolved: true});
    const r = await screen();
    fireEvent.press(r.getByTestId('select-account-retry'));
    await waitFor(() => expect(r.getByText('We found your wallet')).toBeTruthy());
    fireEvent.press(r.getByTestId('select-account-continue'));
    expect(onSelect).toHaveBeenCalledWith(S(3));
  });

  it('Review Focus 4: a wallet whose only funded account is the CLI scheme is offered that account', async () => {
    mockDetect.mockResolvedValue({candidates: all([cand(CLI, 'FundedC', 5n)]), balancesResolved: true});
    const r = await screen();
    expect(r.getByText('We found your wallet')).toBeTruthy();
    expect(r.getByText('Solana CLI (solana-keygen)')).toBeTruthy();
    fireEvent.press(r.getByTestId('select-account-continue'));
    expect(onSelect).toHaveBeenCalledWith(CLI);
  });

  it('detection threw: the warning, standard account 0 for Continue', async () => {
    mockDetect.mockRejectedValue(new Error('boom'));
    const r = await screen();
    expect(r.getByText(/Couldn't check balances right now/)).toBeTruthy();
    fireEvent.press(r.getByTestId('select-account-continue'));
    expect(onSelect).toHaveBeenCalledWith(S(0));
  });
});

describe('accountChoiceView (pure)', () => {
  const one = [cand(S(0), 'A', 1n), cand(S(1), 'B')];
  it.each([
    ['loading wins', true, false, false, one, 'loading'],
    ['a failed RPC shows all', false, true, false, one, 'all'],
    ['"Use a different account" shows all', false, false, true, one, 'all'],
    ['one funded', false, false, false, one, 'one'],
    ['two funded', false, false, false, [cand(S(0), 'A', 1n), cand(S(1), 'B', 1n)], 'funded'],
    ['none funded', false, false, false, [cand(S(0), 'A')], 'none'],
  ] as const)('%s', (_n, loading, failed, showAll, c, expected) => {
    expect(accountChoiceView(loading, failed, showAll, c)).toBe(expected);
  });
});

describe('the seed is zeroized on every path (unchanged handling, pinned here)', () => {
  it('after a resolved detection the seed handed to detection is all zeros', async () => {
    let seen: Uint8Array | undefined;
    mockDetect.mockImplementation(seed => {
      seen = seed;
      expect(seed.every(b => b === 7)).toBe(true); // positive control: it was the real seed while in use
      return Promise.resolve({candidates: all([]), balancesResolved: true});
    });
    await screen();
    expect(seen).toBeDefined();
    expect(seen!.every(b => b === 0)).toBe(true);
  });

  it('after detection threw the seed is all zeros too', async () => {
    let seen: Uint8Array | undefined;
    mockDetect.mockImplementation(seed => {
      seen = seed;
      return Promise.reject(new Error('boom'));
    });
    await screen();
    expect(seen!.every(b => b === 0)).toBe(true);
  });
});
