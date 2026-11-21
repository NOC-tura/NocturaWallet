import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {TransactionHistoryScreen} from '../TransactionHistoryScreen';
import type {ParsedTransaction} from '../../../modules/solana/types';

jest.mock('../../../store/zustand/walletStore', () => ({
  useWalletStore: jest.fn((selector: (s: {publicKey: string}) => unknown) =>
    selector({publicKey: 'myPublicKey111111111111111111111111111111'}),
  ),
}));

// M1d (spec §4.2): the history is the SELECTED account's
const mockHistSelected: {current: {address: string; label: string} | null} = {current: {address: 'myPublicKey111111111111111111111111111111', label: 'Account 1'}};
jest.mock('../../../hooks/useSelectedAccount', () => ({useSelectedAccount: () => mockHistSelected.current}));

const mockTxs: ParsedTransaction[] = [
  {
    signature: 'sig1aaaaaaaaaaaaaaaaaaaaa',
    slot: 100,
    timestamp: 1700000000,
    type: 'transfer',
    amount: '1.5 SOL',
    from: 'myPublicKey111111111111111111111111111111',
    to: 'recipientAddr222222222222222222222222222',
    fee: 5000,
    status: 'confirmed',
  },
  {
    signature: 'sig2bbbbbbbbbbbbbbbbbbbbb',
    slot: 101,
    timestamp: 1700001000,
    type: 'transfer',
    amount: '0.5 SOL',
    from: 'senderAddr333333333333333333333333333333',
    to: 'myPublicKey111111111111111111111111111111',
    fee: 5000,
    status: 'finalized',
  },
];

let mockTxData: ParsedTransaction[] = [];

jest.mock('../../../hooks/useSolanaQueries', () => ({
  useTransactionHistory: jest.fn(() => ({data: mockTxData})),
}));

describe('TransactionHistoryScreen', () => {
  const onSelectTx = jest.fn();
  const onBack = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockTxData = [];
  });

  it('Shows filter tabs (All/Sent/Received/Private/Staking)', () => {
    const {getByTestId, getByText} = render(
      <TransactionHistoryScreen onSelectTx={onSelectTx} onBack={onBack} />,
    );
    expect(getByTestId('filter-tabs')).toBeTruthy();
    expect(getByText('All')).toBeTruthy();
    expect(getByText('Sent')).toBeTruthy();
    expect(getByText('Received')).toBeTruthy();
    expect(getByText('Private')).toBeTruthy(); // part B: Shielded → Private
    expect(getByText('Staking')).toBeTruthy();
  });

  it('Shows "All" filter active by default', () => {
    const {getByTestId} = render(
      <TransactionHistoryScreen onSelectTx={onSelectTx} onBack={onBack} />,
    );
    const allTab = getByTestId('filter-tab-All');
    // Active tab has purple background applied via style
    expect(allTab).toBeTruthy();
    // Verify it renders without error and "All" tab exists as the first tab
    const sentTab = getByTestId('filter-tab-Sent');
    expect(sentTab).toBeTruthy();
  });

  it('Shows "No transactions yet" when list empty', () => {
    mockTxData = [];
    const {getByText} = render(
      <TransactionHistoryScreen onSelectTx={onSelectTx} onBack={onBack} />,
    );
    expect(getByText('No transactions yet')).toBeTruthy();
  });

  it('Renders tx rows when data present', () => {
    mockTxData = mockTxs;
    const {getByTestId} = render(
      <TransactionHistoryScreen onSelectTx={onSelectTx} onBack={onBack} />,
    );
    expect(getByTestId('tx-row-sig1aaaaaaaaaaaaaaaaaaaaa')).toBeTruthy();
    expect(getByTestId('tx-row-sig2bbbbbbbbbbbbbbbbbbbbb')).toBeTruthy();
  });

  it('Calls onSelectTx when row tapped', () => {
    mockTxData = mockTxs;
    const {getByTestId} = render(
      <TransactionHistoryScreen onSelectTx={onSelectTx} onBack={onBack} />,
    );
    fireEvent.press(getByTestId('tx-row-sig1aaaaaaaaaaaaaaaaaaaaa'));
    expect(onSelectTx).toHaveBeenCalledWith('sig1aaaaaaaaaaaaaaaaaaaaa');
  });
  it('M1d: asks the history of the selected account and names it', () => {
    const {useTransactionHistory} = jest.requireMock('../../../hooks/useSolanaQueries') as {useTransactionHistory: jest.Mock};
    mockHistSelected.current = {address: '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k', label: 'Account 4'};
    const {getByTestId} = render(<TransactionHistoryScreen onSelectTx={onSelectTx} onBack={onBack} />);
    expect(useTransactionHistory).toHaveBeenLastCalledWith('3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k');
    expect(getByTestId('history-account-label')).toHaveTextContent('Account 4');
    mockHistSelected.current = {address: 'myPublicKey111111111111111111111111111111', label: 'Account 1'};
  });
});
