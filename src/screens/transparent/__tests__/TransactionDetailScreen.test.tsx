import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {TransactionDetailScreen} from '../TransactionDetailScreen';
import type {ParsedTransaction} from '../../../modules/solana/types';

jest.mock('../../../store/zustand/walletStore', () => ({
  useWalletStore: jest.fn((selector: (s: {publicKey: string}) => unknown) =>
    selector({publicKey: 'myPublicKey111111111111111111111111111111'}),
  ),
}));

const mockTx: ParsedTransaction = {
  signature: 'test-sig-123',
  slot: 200,
  timestamp: 1700000000,
  type: 'transfer',
  amount: '2.5 SOL',
  from: 'senderAddr333333333333333333333333333333',
  to: 'recipientAddr222222222222222222222222222',
  fee: 5000,
  status: 'confirmed',
};

let mockTxData: ParsedTransaction[] = [];

jest.mock('../../../hooks/useSolanaQueries', () => ({
  useTransactionHistory: jest.fn(() => ({data: mockTxData})),
}));

jest.mock('../../../utils/explorerUrl', () => ({
  getExplorerUrl: jest.fn((sig: string) => `https://solscan.io/tx/${sig}`),
}));


describe('TransactionDetailScreen', () => {
  const onBack = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockTxData = [];
  });

  it('renders Transaction Detail title/heading', () => {
    const {getByText} = render(
      <TransactionDetailScreen signature="test-sig-123" onBack={onBack} />,
    );
    expect(getByText('Transaction Detail')).toBeTruthy();
  });

  it('shows From and To addresses when tx data is present', () => {
    mockTxData = [mockTx];
    const {getByText} = render(
      <TransactionDetailScreen signature="test-sig-123" onBack={onBack} />,
    );
    expect(getByText('From')).toBeTruthy();
    expect(getByText('To')).toBeTruthy();
  });

  it('shows amount when tx data is present', () => {
    mockTxData = [mockTx];
    const {getByText} = render(
      <TransactionDetailScreen signature="test-sig-123" onBack={onBack} />,
    );
    expect(getByText('2.5 SOL')).toBeTruthy();
  });

  it('shows View on Solscan link button', () => {
    const {getByTestId} = render(
      <TransactionDetailScreen signature="test-sig-123" onBack={onBack} />,
    );
    expect(getByTestId('solscan-link')).toBeTruthy();
  });

  it('shows status badge when tx data is present', () => {
    mockTxData = [mockTx];
    const {getByText} = render(
      <TransactionDetailScreen signature="test-sig-123" onBack={onBack} />,
    );
    expect(getByText('Status')).toBeTruthy();
    expect(getByText('confirmed')).toBeTruthy();
  });

  it('calls onBack when back button is pressed', () => {
    const {getByText} = render(
      <TransactionDetailScreen signature="test-sig-123" onBack={onBack} />,
    );
    fireEvent.press(getByText('← Back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
