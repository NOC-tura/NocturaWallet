import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {TransactionDetailScreen} from '../TransactionDetailScreen';

// ── Module mocks (jest.mock is hoisted above all imports) ─────────────────────

const detail = {
  signature: 'SIG12345678ABCDEFGHIJ', status: 'confirmed' as const, type: 'Send',
  from: 'FROMxxxxxxxxxxxxxxxxxx', to: 'TOyyyyyyyyyyyyyyyyyyyy', amount: '0.01',
  tokenSymbol: 'SOL', feeLamports: 5005n, slot: 271408924, blockTime: 1760000000, memo: null,
};
jest.mock('../../../hooks/useSolanaQueries', () => ({
  useTransactionDetail: jest.fn(() => ({data: detail, isLoading: false})),
}));

jest.mock('../../../store/mmkv/instances', () => ({
  mmkvPublic: {
    set: jest.fn(),
    getString: jest.fn(),
    getBoolean: jest.fn().mockReturnValue(false),
    getAllKeys: jest.fn().mockReturnValue([]),
    remove: jest.fn(),
  },
  mmkvSecure: jest.fn().mockReturnValue(null),
  initSecureMmkv: jest.fn(),
  onSecureMmkvReady: jest.fn(),
}));

jest.mock('../../../store/zustand/shieldedStore', () => ({
  useShieldedStore: jest.fn((selector: (s: {mode: string}) => unknown) =>
    selector({mode: 'transparent'}),
  ),
}));

jest.mock('../../../utils/explorerUrl', () => ({
  getExplorerUrl: jest.fn((sig: string) => `https://solscan.io/tx/${sig}`),
}));

jest.mock('../../../modules/addressBook/addressBookModule', () => ({
  addressBook: {
    addContact: jest.fn(),
    findByAddress: jest.fn().mockReturnValue(null),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function withSafeArea(node: React.ReactElement) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        insets: {top: 0, bottom: 0, left: 0, right: 0},
        frame: {x: 0, y: 0, width: 0, height: 0},
      }}>
      {node}
    </SafeAreaProvider>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

it('renders the tx detail (amount, status, fee)', () => {
  const {getByText, getAllByText} = render(
    withSafeArea(
      <TransactionDetailScreen signature="SIG" onBack={jest.fn()} />,
    ),
  );
  expect(getByText('0.01 SOL')).toBeTruthy();
  // "Confirmed" appears in both the status pill and the Status detail row
  expect(getAllByText('Confirmed').length).toBeGreaterThanOrEqual(1);
  expect(getByText('Network fee')).toBeTruthy();
});

it('renders type and hash detail rows', () => {
  const {getByText} = render(
    withSafeArea(
      <TransactionDetailScreen signature="SIG" onBack={jest.fn()} />,
    ),
  );
  expect(getByText('Type')).toBeTruthy();
  expect(getByText('Send')).toBeTruthy();
  expect(getByText('Hash')).toBeTruthy();
});

it('renders "Transaction" heading in top bar', () => {
  const {getByText} = render(
    withSafeArea(
      <TransactionDetailScreen signature="SIG" onBack={jest.fn()} />,
    ),
  );
  expect(getByText('Transaction')).toBeTruthy();
});

it('calls onBack when back button is pressed', () => {
  const onBack = jest.fn();
  const {getByLabelText} = render(
    withSafeArea(
      <TransactionDetailScreen signature="SIG" onBack={onBack} />,
    ),
  );
  fireEvent.press(getByLabelText('Go back'));
  expect(onBack).toHaveBeenCalledTimes(1);
});

it('renders loading state when isLoading is true', () => {
  const {useTransactionDetail} = jest.requireMock('../../../hooks/useSolanaQueries') as {
    useTransactionDetail: jest.Mock;
  };
  useTransactionDetail.mockReturnValueOnce({data: undefined, isLoading: true});

  const {getByText} = render(
    withSafeArea(
      <TransactionDetailScreen signature="SIG" onBack={jest.fn()} />,
    ),
  );
  expect(getByText('Loading transaction…')).toBeTruthy();
});

it('renders not-found state when data is null', () => {
  const {useTransactionDetail} = jest.requireMock('../../../hooks/useSolanaQueries') as {
    useTransactionDetail: jest.Mock;
  };
  useTransactionDetail.mockReturnValueOnce({data: null, isLoading: false});

  const {getByText} = render(
    withSafeArea(
      <TransactionDetailScreen signature="SIG" onBack={jest.fn()} />,
    ),
  );
  expect(getByText("Couldn't load this transaction")).toBeTruthy();
});

it('renders "Save to address book" button when tx.to is present', () => {
  const {getByText} = render(
    withSafeArea(
      <TransactionDetailScreen signature="SIG" onBack={jest.fn()} />,
    ),
  );
  expect(getByText('Save to address book')).toBeTruthy();
});
