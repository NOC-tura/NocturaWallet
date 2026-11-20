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

/** fix round 1 (review M-1): the card the list marks — the radio whose state is selected */
const marked = (r: R) =>
  r.queryAllByTestId(/^account-candidate-/)
    .filter(e => e.props.accessibilityState?.selected === true)
    .map(e => e.props.testID as string);
const continueDisabled = (r: R) => r.getByTestId('select-account-continue').props.accessibilityState?.disabled === true;

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
    mockDetect.mockResolvedValue({candidates: all([cand(S(2), 'Funded2', 1_500_000_000n, 25_000_000_000n)]), balancesResolved: true, nocResolved: true});
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
    mockDetect.mockResolvedValue({candidates: all([cand(S(2), 'Funded2', 1n)]), balancesResolved: true, nocResolved: true});
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
      nocResolved: true,
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
    mockDetect.mockResolvedValue({candidates: all([]), balancesResolved: true, nocResolved: true});
    const r = await screen();
    expect(r.getByText('No funds found yet. You can receive to this address.')).toBeTruthy();
    expect(r.getByTestId('select-account-none-address').props.children).toBe(addr('Empty0')); // fix round 1 (M-4): "receive to this address" shows all of it
    expect(r.queryByText('We found your wallet')).toBeNull();
    expect(ids(r)).toEqual([]);
    fireEvent.press(r.getByTestId('select-account-continue'));
    expect(onSelect).toHaveBeenCalledWith(S(0));
    fireEvent.press(r.getByTestId('select-account-different'));
    expect(ids(r)).toHaveLength(6);
  });

  it('the balance RPC failed: today\'s warning, Retry, the FULL list; neither smart view', async () => {
    mockDetect.mockResolvedValue({candidates: all([]), balancesResolved: false, nocResolved: false});
    const r = await screen();
    expect(r.getByText(/Couldn't check balances right now/)).toBeTruthy();
    expect(r.getByTestId('select-account-retry')).toBeTruthy();
    expect(ids(r)).toHaveLength(6);
    expect(r.queryByText('We found your wallet')).toBeNull();
    expect(r.queryByText(/No funds found yet/)).toBeNull();
    expect(r.queryByTestId('select-account-different')).toBeNull();
    // fix round 1 (review I-1, spec §4 "never silently auto-picks"): nothing marked, Continue disabled
    expect(r.queryByText(/switch later/)).toBeNull();
    expect(marked(r)).toEqual([]);
    expect(continueDisabled(r)).toBe(true);
    fireEvent.press(r.getByTestId('select-account-continue'));
    expect(onSelect).not.toHaveBeenCalled();
    // the person picks; Continue hands over exactly that pick
    fireEvent.press(r.getByTestId('account-candidate-cli'));
    expect(marked(r)).toEqual(['account-candidate-cli']);
    expect(continueDisabled(r)).toBe(false);
    fireEvent.press(r.getByTestId('select-account-continue'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(CLI);
  });

  it('Review Focus 4: a Retry after a failed RPC that now finds ONE funded account shows "We found your wallet" (the full-list state is reset)', async () => {
    mockDetect.mockResolvedValueOnce({candidates: all([]), balancesResolved: false, nocResolved: false});
    mockDetect.mockResolvedValueOnce({candidates: all([cand(S(3), 'Funded3', 9n)]), balancesResolved: true, nocResolved: true});
    const r = await screen();
    fireEvent.press(r.getByTestId('select-account-retry'));
    await waitFor(() => expect(r.getByText('We found your wallet')).toBeTruthy());
    fireEvent.press(r.getByTestId('select-account-continue'));
    expect(onSelect).toHaveBeenCalledWith(S(3));
  });

  it('Review Focus 4: a wallet whose only funded account is the CLI scheme is offered that account', async () => {
    mockDetect.mockResolvedValue({candidates: all([cand(CLI, 'FundedC', 5n)]), balancesResolved: true, nocResolved: true});
    const r = await screen();
    expect(r.getByText('We found your wallet')).toBeTruthy();
    expect(r.getByText('Solana CLI (solana-keygen)')).toBeTruthy();
    fireEvent.press(r.getByTestId('select-account-continue'));
    expect(onSelect).toHaveBeenCalledWith(CLI);
  });

  it('detection threw: the warning and Retry; nothing selected, Continue disabled (fix round 1, review I-1 / M-2)', async () => {
    mockDetect.mockRejectedValue(new Error('boom'));
    const r = await screen();
    expect(r.getByText(/Couldn't check balances right now/)).toBeTruthy();
    expect(r.getByTestId('select-account-retry')).toBeTruthy();
    expect(continueDisabled(r)).toBe(true);
    fireEvent.press(r.getByTestId('select-account-continue'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('an empty mnemonic: the warning, nothing selected, Continue disabled (review M-2)', async () => {
    const r = render(<SelectAccountScreen mnemonic="" onSelect={onSelect} />);
    await waitFor(() => expect(r.getByText(/Couldn't check balances right now/)).toBeTruthy());
    expect(continueDisabled(r)).toBe(true);
    expect(mockDetect).not.toHaveBeenCalled();
  });

  it('review I-2: SOL resolved but a NOC lookup failed → the failed view: warning, the full list (the NOC account in it), nothing selected', async () => {
    mockDetect.mockResolvedValue({candidates: all([cand(S(1), 'Dust1', 1n)]), balancesResolved: true, nocResolved: false});
    const r = await screen();
    expect(r.getByText(/Couldn't check balances right now/)).toBeTruthy();
    expect(r.queryByText('We found your wallet')).toBeNull();
    expect(r.queryByText(/No funds found yet/)).toBeNull();
    expect(ids(r)).toHaveLength(6);
    expect(ids(r)).toContain('account-candidate-cli'); // e.g. the presale buyer's NOC-only account is on screen
    expect(marked(r)).toEqual([]);
    expect(continueDisabled(r)).toBe(true);
  });

  it('review M-5: a manual pick in the failed list, then a Retry that resolves none funded → the pick resets to standard account 0', async () => {
    mockDetect.mockResolvedValueOnce({candidates: all([]), balancesResolved: false, nocResolved: false});
    mockDetect.mockResolvedValueOnce({candidates: all([]), balancesResolved: true, nocResolved: true});
    const r = await screen();
    fireEvent.press(r.getByTestId('account-candidate-slip10:4'));
    fireEvent.press(r.getByTestId('select-account-retry'));
    await waitFor(() => expect(r.getByText('No funds found yet. You can receive to this address.')).toBeTruthy());
    expect(r.getByTestId('select-account-none-address').props.children).toBe(addr('Empty0'));
    fireEvent.press(r.getByTestId('select-account-continue'));
    expect(onSelect).toHaveBeenCalledWith(S(0));
  });

  it('review M-5: several funded → a pick of the second funded is what Continue uses', async () => {
    mockDetect.mockResolvedValue({
      candidates: all([cand(S(1), 'Funded1', 2n), cand(CLI, 'FundedC', 0n, 3n)]),
      balancesResolved: true,
      nocResolved: true,
    });
    const r = await screen();
    expect(marked(r)).toEqual(['account-candidate-slip10:1']);
    fireEvent.press(r.getByTestId('account-candidate-cli'));
    expect(marked(r)).toEqual(['account-candidate-cli']);
    fireEvent.press(r.getByTestId('select-account-continue'));
    expect(onSelect).toHaveBeenCalledWith(CLI);
  });

  it('review M-7: a new mnemonic whose detection throws shows none of the old candidates and no old pick', async () => {
    mockDetect.mockResolvedValueOnce({candidates: all([]), balancesResolved: false, nocResolved: false});
    mockDetect.mockRejectedValueOnce(new Error('boom'));
    const r = await screen();
    fireEvent.press(r.getByTestId('account-candidate-cli'));
    r.rerender(<SelectAccountScreen mnemonic="zoo zoo" onSelect={onSelect} />);
    await waitFor(() => expect(mockDetect).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(r.queryByText('Looking for your accounts…')).toBeNull());
    expect(ids(r)).toEqual([]);
    expect(continueDisabled(r)).toBe(true);
  });

  it('review M-6: one title header; the found line is not a second h2 header', async () => {
    mockDetect.mockResolvedValue({candidates: all([cand(S(2), 'Funded2', 1n)]), balancesResolved: true, nocResolved: true});
    const r = await screen();
    expect(r.getAllByRole('header').map(h => h.props.children)).toEqual(['Choose account']);
    expect(r.getByText('We found your wallet').props.accessibilityRole).toBeUndefined();
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
      return Promise.resolve({candidates: all([]), balancesResolved: true, nocResolved: true});
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
