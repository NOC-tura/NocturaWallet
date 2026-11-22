import React from 'react';
import {render, fireEvent, act} from '@testing-library/react-native';
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
const mockQuery: {isSuccess: boolean; isLoading: boolean; isError: boolean; isFetching: boolean; refetch: jest.Mock} = {
  isSuccess: true,
  isLoading: false,
  isError: false,
  isFetching: false,
  refetch: jest.fn(() => Promise.resolve()),
};

jest.mock('../../../hooks/useSolanaQueries', () => ({
  useTransactionHistory: jest.fn(() => ({data: mockTxData, ...mockQuery})),
}));

describe('TransactionHistoryScreen', () => {
  const onSelectTx = jest.fn();
  const onBack = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockTxData = [];
    mockQuery.isSuccess = true;
    mockQuery.isLoading = false;
    mockQuery.isError = false;
    mockQuery.isFetching = false;
    mockQuery.refetch = jest.fn(() => Promise.resolve());
  });

  it('I1: there is no filter tab bar (no direction is known)', () => {
    const {queryByTestId, queryByText} = render(
      <TransactionHistoryScreen onSelectTx={onSelectTx} onBack={onBack} />,
    );
    expect(queryByTestId('filter-tabs')).toBeNull();
    expect(queryByText('Sent')).toBeNull();
    expect(queryByText('Received')).toBeNull();
  });

  it('I1: real-shaped rows (no from/to/amount) show a neutral dot, never an arrow', () => {
    mockTxData = [
      {signature: 'realAAAAAAAAAAAAAAAAAAAA', slot: 1, timestamp: 1700000000, type: 'unknown', status: 'confirmed'} as ParsedTransaction,
      {signature: 'realBBBBBBBBBBBBBBBBBBBB', slot: 2, timestamp: 1700000100, type: 'unknown', status: 'finalized'} as ParsedTransaction,
    ];
    const {getAllByText, queryByText} = render(
      <TransactionHistoryScreen onSelectTx={onSelectTx} onBack={onBack} />,
    );
    expect(getAllByText('•')).toHaveLength(2);
    expect(queryByText('↓')).toBeNull();
    expect(queryByText('↑')).toBeNull();
  });

  it('I1: arrows stay when from/to are actually present', () => {
    mockTxData = mockTxs;
    const {getByText} = render(<TransactionHistoryScreen onSelectTx={onSelectTx} onBack={onBack} />);
    expect(getByText('↑')).toBeTruthy();
    expect(getByText('↓')).toBeTruthy();
  });

  it('I2: no selected account shows the loading text, never "No transactions yet"', () => {
    mockHistSelected.current = null;
    mockQuery.isSuccess = false;
    const {getByText, queryByText} = render(<TransactionHistoryScreen onSelectTx={onSelectTx} onBack={onBack} />);
    expect(getByText('Loading transactions…')).toBeTruthy();
    expect(queryByText('No transactions yet')).toBeNull();
    mockHistSelected.current = {address: 'myPublicKey111111111111111111111111111111', label: 'Account 1'};
  });

  it('I2: a read that has not completed (not loading, not error, no data) is not "empty"', () => {
    mockQuery.isSuccess = false;
    const {getByText, queryByText} = render(<TransactionHistoryScreen onSelectTx={onSelectTx} onBack={onBack} />);
    expect(getByText('Loading transactions…')).toBeTruthy();
    expect(queryByText('No transactions yet')).toBeNull();
  });

  it('m5: switching account resets a retry that was in flight', async () => {
    mockQuery.isSuccess = false;
    mockQuery.isError = true;
    mockQuery.refetch = jest.fn(() => new Promise<void>(() => undefined));
    const {getByTestId, getByText, rerender} = render(<TransactionHistoryScreen onSelectTx={onSelectTx} onBack={onBack} />);
    fireEvent.press(getByTestId('history-retry'));
    expect(getByText('Loading transactions…')).toBeTruthy();
    mockHistSelected.current = {address: '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k', label: 'Account 4'};
    rerender(<TransactionHistoryScreen onSelectTx={onSelectTx} onBack={onBack} />);
    expect(getByText("Couldn't load transactions · tap to retry")).toBeTruthy();
    fireEvent.press(getByTestId('history-retry'));
    expect(mockQuery.refetch).toHaveBeenCalledTimes(2);
    mockHistSelected.current = {address: 'myPublicKey111111111111111111111111111111', label: 'Account 1'};
  });

  it('r1-2: has no Private or Staking tab (they could only say "No transactions yet", which is false)', () => {
    const {queryByText} = render(<TransactionHistoryScreen onSelectTx={onSelectTx} onBack={onBack} />);
    expect(queryByText('Private')).toBeNull();
    expect(queryByText('Staking')).toBeNull();
  });

  it('r1-1: loading shows "Loading transactions…", never the empty state', () => {
    mockQuery.isSuccess = false;
    mockQuery.isLoading = true;
    const {getByText, queryByText} = render(<TransactionHistoryScreen onSelectTx={onSelectTx} onBack={onBack} />);
    expect(getByText('Loading transactions…')).toBeTruthy();
    expect(queryByText('No transactions yet')).toBeNull();
  });

  it('r1-1: an error shows the retry line, never the empty state; tapping refetches once', async () => {
    mockQuery.isSuccess = false;
    mockQuery.isError = true;
    let resolve: () => void = () => undefined;
    mockQuery.refetch = jest.fn(() => new Promise<void>(r => { resolve = r; }));
    const {getByTestId, getByText, queryByText, UNSAFE_getAllByProps} = render(<TransactionHistoryScreen onSelectTx={onSelectTx} onBack={onBack} />);
    expect(getByText("Couldn't load transactions · tap to retry")).toBeTruthy();
    expect(queryByText('No transactions yet')).toBeNull();
    // two taps in one tick (before a re-render can disable the button) still read once: the ref guard
    const onPress = UNSAFE_getAllByProps({testID: 'history-retry'})[0]!.props.onPress as () => void;
    act(() => { onPress(); onPress(); });
    fireEvent.press(getByTestId('history-retry')); // disabled while busy
    expect(mockQuery.refetch).toHaveBeenCalledTimes(1);
    expect(getByText('Loading transactions…')).toBeTruthy();
    expect(getByTestId('history-retry').props.accessibilityState).toEqual(expect.objectContaining({busy: true}));
    await act(async () => { resolve(); });
    expect(getByText("Couldn't load transactions · tap to retry")).toBeTruthy();
  });

  it('r1-1: a failed refetch keeps the read transactions and shows the retry line above them', () => {
    mockQuery.isSuccess = false;
    mockQuery.isError = true;
    mockTxData = mockTxs;
    const {getByTestId, getByText} = render(<TransactionHistoryScreen onSelectTx={onSelectTx} onBack={onBack} />);
    expect(getByText("Couldn't load transactions · tap to retry")).toBeTruthy();
    expect(getByTestId('tx-row-sig1aaaaaaaaaaaaaaaaaaaaa')).toBeTruthy();
  });

  it('Review Focus 5: no data for a non-main account shows the empty state after a good read', () => {
    mockHistSelected.current = {address: '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k', label: 'Account 4'};
    const {getByText} = render(<TransactionHistoryScreen onSelectTx={onSelectTx} onBack={onBack} />);
    expect(getByText('No transactions yet')).toBeTruthy();
    mockHistSelected.current = {address: 'myPublicKey111111111111111111111111111111', label: 'Account 1'};
  });

  it('m5: a stale retry finishing does not free the new account\'s in-flight retry', async () => {
    mockQuery.isSuccess = false;
    mockQuery.isError = true;
    const resolvers: Array<() => void> = [];
    mockQuery.refetch = jest.fn(() => new Promise<void>(r => { resolvers.push(r); }));
    const {getByTestId, getByText, rerender, UNSAFE_getAllByProps} = render(<TransactionHistoryScreen onSelectTx={onSelectTx} onBack={onBack} />);
    fireEvent.press(getByTestId('history-retry')); // account 1
    mockHistSelected.current = {address: '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k', label: 'Account 4'};
    rerender(<TransactionHistoryScreen onSelectTx={onSelectTx} onBack={onBack} />);
    fireEvent.press(getByTestId('history-retry')); // account 4
    const onPress = UNSAFE_getAllByProps({testID: 'history-retry'})[0]!.props.onPress as () => void;
    await act(async () => { resolvers[0]!(); }); // account 1's read finishes late
    expect(getByText('Loading transactions…')).toBeTruthy();
    act(() => { onPress(); });
    expect(mockQuery.refetch).toHaveBeenCalledTimes(2);
    mockHistSelected.current = {address: 'myPublicKey111111111111111111111111111111', label: 'Account 1'};
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
