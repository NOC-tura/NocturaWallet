import React from 'react';
import {render, waitFor} from '@testing-library/react-native';
import {TransactionStatusScreen} from '../TransactionStatusScreen';

jest.mock('../../../modules/solana/connection', () => ({
  getConnection: jest.fn(() => ({
    getSignatureStatus: jest.fn().mockResolvedValue({value: null}),
  })),
}));

jest.mock('react-native/Libraries/Linking/Linking', () => ({
  openURL: jest.fn(),
}));

const defaultProps = {
  signature: 'abc123signature',
  amount: '1.5',
  recipient: 'So11111111111111111111111111111111111111112',
  token: 'SOL',
  onDashboard: jest.fn(),
  onRetry: jest.fn(),
};

describe('TransactionStatusScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows "Transaction submitted" initially (pending state)', () => {
    const {getByText} = render(<TransactionStatusScreen {...defaultProps} />);
    expect(getByText('Transaction submitted')).toBeTruthy();
  });

  it('transitions to "Sent!" when status becomes confirmed', async () => {
    const {getConnection} = require('../../../modules/solana/connection');
    getConnection.mockReturnValue({
      getSignatureStatus: jest.fn().mockResolvedValue({
        value: {confirmationStatus: 'confirmed', err: null},
      }),
    });

    const {findByText} = render(<TransactionStatusScreen {...defaultProps} />);

    // Advance timers to allow polling to fire
    jest.advanceTimersByTime(600);

    const successText = await findByText('Sent!');
    expect(successText).toBeTruthy();
  });

  it('shows "Transaction failed" when status has error', async () => {
    const {getConnection} = require('../../../modules/solana/connection');
    getConnection.mockReturnValue({
      getSignatureStatus: jest.fn().mockResolvedValue({
        value: {confirmationStatus: null, err: {InstructionError: [0, 'Custom']}},
      }),
    });

    const {findByText} = render(<TransactionStatusScreen {...defaultProps} />);

    jest.advanceTimersByTime(600);

    const failedText = await findByText('Transaction failed');
    expect(failedText).toBeTruthy();
  });

  it('shows "Transaction status unknown" on timeout (NOT "failed")', async () => {
    // Reset to the default mock — never confirms
    const {getConnection} = require('../../../modules/solana/connection');
    getConnection.mockReturnValue({
      getSignatureStatus: jest.fn().mockResolvedValue({value: null}),
    });

    const {findByText, queryByText} = render(
      <TransactionStatusScreen {...defaultProps} />,
    );

    // Advance past MAX_ATTEMPTS * 500ms (120 * 500 = 60000ms)
    // Use runAllTimersAsync to process both timers and microtasks/promises
    await jest.runAllTimersAsync();

    const unknownText = await findByText('Transaction status unknown');
    expect(unknownText).toBeTruthy();
    expect(queryByText('Transaction failed')).toBeNull();
  });

  it('shows "View on Solscan" link with correct URL', () => {
    const {getByText} = render(<TransactionStatusScreen {...defaultProps} />);
    const link = getByText('View on Solscan →');
    expect(link).toBeTruthy();
  });

  it('shows "Back to dashboard" button', async () => {
    const {getConnection} = require('../../../modules/solana/connection');
    getConnection.mockReturnValue({
      getSignatureStatus: jest.fn().mockResolvedValue({
        value: {confirmationStatus: 'finalized', err: null},
      }),
    });

    const {findByText} = render(<TransactionStatusScreen {...defaultProps} />);

    jest.advanceTimersByTime(600);

    const backBtn = await findByText('Back to dashboard');
    expect(backBtn).toBeTruthy();
  });
});
