import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {SendScreen} from '../SendScreen';

// The screen calls useNavigation() for the QR/address-book routes; the suite
// drives inputs, not navigation.
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({navigate: jest.fn(), goBack: jest.fn()}),
  useRoute: () => ({params: {}}),
}));

jest.mock('../../../modules/solana/simulation', () => ({
  simulateTransaction: jest.fn().mockResolvedValue({success: true}),
}));
jest.mock('../../../modules/solana/connection', () => ({
  getConnection: jest.fn(() => ({})),
}));
jest.mock('../../../modules/solana/transactionBuilder', () => ({
  buildTransferTx: jest.fn().mockResolvedValue({}),
  // Real implementation: the MAX/insufficient math must use the same markup
  // the builders charge, so stubbing it would test nothing.
  getTransferMarkupLamports: jest.requireActual(
    '../../../modules/solana/transactionBuilder',
  ).getTransferMarkupLamports,
}));

// Mock the wallet store
jest.mock('../../../store/zustand/walletStore', () => ({
  useWalletStore: jest.fn(() => ({
    publicKey: 'So11111111111111111111111111111111111111112',
    solBalance: '1000000000',
    tokens: [],
    tokenBalances: {},
  })),
}));

/**
 * Rewritten 2026-08-09. The previous suite was `describe.skip`'d against
 * Phase-2 chrome (placeholder-based queries, a "Review" CTA, token pills) that
 * no longer exists, leaving the app's money-entry screen at 3.4% coverage.
 *
 * These drive the screen through stable testIDs and assert behaviour rather
 * than copy, so a chrome change fails them instead of silently skipping them.
 */
describe('SendScreen', () => {
  const setup = () => render(<SendScreen onReview={jest.fn()} />);

  it('renders the recipient and amount inputs', () => {
    const {getByTestId} = setup();
    expect(getByTestId('recipient-input')).toBeTruthy();
    expect(getByTestId('amount-input')).toBeTruthy();
  });

  it('keeps the CTA disabled until both fields are valid', () => {
    const {getByTestId} = setup();
    expect(getByTestId('review-button').props.accessibilityState?.disabled).toBe(true);
  });

  it('rejects an off-curve recipient', () => {
    // findProgramAddressSync([b'noctura-test'], SystemProgram) — a real PDA.
    // The old validator was a base58 regex, so this passed as a wallet and SOL
    // sent here would be unrecoverable.
    const {getByTestId} = setup();
    fireEvent.changeText(
      getByTestId('recipient-input'),
      'E4E6ZBCXe3s5tBjEwTfXm2NthmxLQBZiPyTVoc2E8HNw',
    );
    fireEvent.changeText(getByTestId('amount-input'), '0.1');
    expect(getByTestId('review-button').props.accessibilityState?.disabled).toBe(true);
  });

  it('accepts a real on-curve recipient with a valid amount', () => {
    const {getByTestId} = setup();
    fireEvent.changeText(
      getByTestId('recipient-input'),
      'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk',
    );
    fireEvent.changeText(getByTestId('amount-input'), '0.1');
    expect(getByTestId('review-button').props.accessibilityState?.disabled).toBe(false);
  });

  it('blocks an amount larger than the balance', () => {
    // Balance is 1 SOL in the mocked store.
    const {getByTestId} = setup();
    fireEvent.changeText(
      getByTestId('recipient-input'),
      'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk',
    );
    fireEvent.changeText(getByTestId('amount-input'), '999');
    expect(getByTestId('review-button').props.accessibilityState?.disabled).toBe(true);
  });

  it('MAX leaves enough for fees — the resulting amount is payable', () => {
    // MAX used to subtract only base + priority while the builder also appended
    // a 20,000-lamport markup, so every MAX send failed on-chain. The markup is
    // now sourced from the same function the builder uses.
    const {getByTestId} = setup();
    fireEvent.changeText(
      getByTestId('recipient-input'),
      'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk',
    );
    fireEvent.press(getByTestId('max-button'));
    const amount = getByTestId('amount-input').props.value as string;
    expect(Number(amount)).toBeGreaterThan(0);
    expect(Number(amount)).toBeLessThan(1);
    expect(getByTestId('review-button').props.accessibilityState?.disabled).toBe(false);
  });

  it('rejects an amount with more decimals than the token has', () => {
    // parseTokenAmount throws on over-precision and SendScreen swallows it in a
    // catch {}, so the CTA just greys out. Asserting the CTA state pins the
    // behaviour; the missing user-visible message is tracked separately.
    const {getByTestId} = setup();
    fireEvent.changeText(
      getByTestId('recipient-input'),
      'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk',
    );
    fireEvent.changeText(getByTestId('amount-input'), '0.1234567891');
    expect(getByTestId('review-button').props.accessibilityState?.disabled).toBe(true);
  });
});
