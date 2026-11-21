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

// M1d (spec §3.3): #12 sends from the account selected when it opened, with that account's balances
const MAIN_SRC = {scheme: 'slip10:0', address: 'So11111111111111111111111111111111111111112', label: 'Account 1', number: 1, role: 'main', isMain: true, linked: false};
const A3_SRC = {scheme: 'slip10:3', address: '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k', label: 'Account 4', number: 4, role: 'fresh-exit', isMain: false, linked: false};
const READY_1_SOL = {status: 'ready', syncedAt: 1, solBalance: '1000000000', nocBalance: '0', tokens: [], tokenBalances: {}};
const mockSendSelected: {current: unknown} = {current: MAIN_SRC};
const mockSendList: {current: unknown} = {current: null};
const mockSendRefresh = jest.fn();
jest.mock('../../../hooks/useSelectedAccount', () => ({
  useSelectedAccount: () => mockSendSelected.current,
  useAccountList: () => mockSendList.current,
  useRefreshAccounts: () => mockSendRefresh,
}));
const mockSendPublic: {current: unknown} = {current: READY_1_SOL};
jest.mock('../../../hooks/useAccountPublicData', () => ({
  NO_PUBLIC_DATA: {solBalance: '0', nocBalance: '0', tokenBalances: {}, tokens: []},
  useAccountPublicData: () => ({data: mockSendPublic.current, refetch: () => undefined}),
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

describe('M1d — #12 sends from the account selected when it opened (spec §3.3)', () => {
  const FOREIGN = 'E48cosDiQZK1iDSsyUzhvW4WxJeoKuDk5qgcdkmANV4N';
  beforeEach(() => {
    mockSendSelected.current = MAIN_SRC;
    mockSendList.current = null;
    mockSendPublic.current = READY_1_SOL;
  });
  const fill = (r: ReturnType<typeof render>) => {
    fireEvent.changeText(r.getByTestId('recipient-input'), FOREIGN);
    fireEvent.changeText(r.getByTestId('amount-input'), '0.001');
  };

  it('the intent carries the source (scheme, address, label, main) and the source\'s balances', () => {
    mockSendSelected.current = A3_SRC;
    mockSendPublic.current = {status: 'ready', syncedAt: 1, solBalance: '3000000', nocBalance: '0', tokens: [], tokenBalances: {}};
    const onReview = jest.fn();
    const r = render(<SendScreen onReview={onReview} />);
    fill(r);
    fireEvent.press(r.getByTestId('review-button'));
    expect(onReview).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: FOREIGN,
        from: {scheme: 'slip10:3', address: A3_SRC.address, label: 'Account 4', isMain: false},
        sourceBalances: {solBalance: '3000000', tokenBalances: {}},
      }),
    );
  });

  it('Review Focus 2: a selection change after #12 opened does not move the Send', () => {
    mockSendSelected.current = A3_SRC;
    const onReview = jest.fn();
    const r = render(<SendScreen onReview={onReview} />);
    mockSendSelected.current = MAIN_SRC;
    r.rerender(<SendScreen onReview={onReview} />);
    fill(r);
    fireEvent.press(r.getByTestId('review-button'));
    expect(onReview.mock.calls[0]![0].from.scheme).toBe('slip10:3');
  });

  it('Review Focus 4: the source\'s data not loaded → Available "—", the CTA disabled', () => {
    mockSendPublic.current = {status: 'loading'};
    const r = render(<SendScreen onReview={jest.fn()} />);
    fill(r);
    expect(r.getByTestId('send-available')).toHaveTextContent('— SOL');
    expect(r.getByTestId('review-button').props.accessibilityState?.disabled).toBe(true);
  });

  it('no account known (no wallet) → the CTA disabled', () => {
    mockSendSelected.current = null;
    const r = render(<SendScreen onReview={jest.fn()} />);
    fill(r);
    expect(r.getByTestId('review-button').props.accessibilityState?.disabled).toBe(true);
  });

  it('plan A11 (ruling C1): the source\'s pool token is in the picker and can be sent', () => {
    const TEST_MINT = 'ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs';
    mockSendSelected.current = A3_SRC;
    mockSendPublic.current = {
      status: 'ready',
      syncedAt: 1,
      solBalance: '3000000',
      nocBalance: '0',
      tokenBalances: {[TEST_MINT]: '1250000000'},
      tokens: [{mint: TEST_MINT, symbol: 'TEST', name: 'Devnet test token', decimals: 9, trust: 'unknown'}],
    };
    const onReview = jest.fn();
    const r = render(<SendScreen onReview={onReview} />);
    fireEvent.press(r.getByTestId('token-picker'));
    fireEvent.press(r.getByLabelText('Select TEST'));
    fill(r);
    fireEvent.press(r.getByTestId('review-button'));
    expect(onReview).toHaveBeenCalledWith(expect.objectContaining({tokenMint: TEST_MINT, tokenSymbol: 'TEST', decimals: 9, amount: '0.001'}));
  });
});
