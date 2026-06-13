import React from 'react';
import {render, waitFor} from '@testing-library/react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';

// ── Module mocks (jest.mock is hoisted above all imports) ─────────────────────

jest.mock('../../../modules/solana/priorityFee', () => ({
  estimatePriorityFee: jest.fn().mockResolvedValue(10_000),
}));

jest.mock('../../../modules/solana/sendTransaction', () => ({
  submitTransparentTransfer: jest.fn().mockResolvedValue({signature: 'S', lastValidBlockHeight: 1000}),
}));

jest.mock('../../../modules/keyDerivation/derivationScheme', () => ({
  loadTransparentScheme: jest.fn(() => ({kind: 'slip10', account: 0})),
}));

// Default connection mock: getBlockHeight returns 0 (≤ lastValidBlockHeight=1000)
// so no expiry is triggered in success/failed tests.
const mockGetSignatureStatus = jest.fn().mockResolvedValue({
  value: {confirmationStatus: 'confirmed', slot: 42},
});
const mockGetBlockHeight = jest.fn().mockResolvedValue(0);

jest.mock('../../../modules/solana/connection', () => ({
  getConnection: () => ({
    getSignatureStatus: mockGetSignatureStatus,
    getBlockHeight: mockGetBlockHeight,
  }),
}));

jest.mock('react-native/Libraries/Linking/Linking', () => ({
  openURL: jest.fn(),
}));

jest.mock('../../../store/mmkv/instances', () => ({
  mmkvPublic: {
    set: jest.fn(),
    getString: jest.fn(),
    getBoolean: jest.fn().mockReturnValue(false),
  },
  mmkvSecure: jest.fn().mockReturnValue(null),
  initSecureMmkv: jest.fn(),
  onSecureMmkvReady: jest.fn(),
}));

// Import after mocks so the lazy require() block sees mocked modules.
import {TransactionStatusScreen} from '../TransactionStatusScreen';
import {submitTransparentTransfer} from '../../../modules/solana/sendTransaction';

const mockSubmit = jest.mocked(submitTransparentTransfer);

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

const intent = {
  mode: 'transparent' as const,
  recipient: 'Gabc1234xyz',
  amount: '0.001',
  tokenMint: 'native',
  tokenSymbol: 'SOL',
  decimals: 9,
  priorityLevel: 'normal' as const,
  createAta: false,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  // Re-apply defaults after clearAllMocks
  mockGetSignatureStatus.mockResolvedValue({
    value: {confirmationStatus: 'confirmed', slot: 42},
  });
  mockGetBlockHeight.mockResolvedValue(0);
});

it('success path: renders "Sent successfully" and tx-status-done', async () => {
  mockSubmit.mockResolvedValueOnce({signature: 'S', lastValidBlockHeight: 1000});

  const {getByText, getByTestId} = render(
    withSafeArea(
      <TransactionStatusScreen
        intent={intent}
        onDashboard={jest.fn()}
        onViewDetails={jest.fn()}
      />,
    ),
  );

  await waitFor(() => {
    expect(getByText('Sent successfully')).toBeTruthy();
  });

  expect(getByTestId('tx-status-done')).toBeTruthy();
});

it('failure path: renders "Transaction failed" and tx-status-retry when submitTransparentTransfer rejects', async () => {
  mockSubmit.mockRejectedValueOnce(new Error('Insufficient funds'));

  const {getByText, getByTestId} = render(
    withSafeArea(
      <TransactionStatusScreen
        intent={intent}
        onDashboard={jest.fn()}
      />,
    ),
  );

  await waitFor(() => {
    expect(getByText('Transaction failed')).toBeTruthy();
  });

  expect(getByTestId('tx-status-retry')).toBeTruthy();
});

it('expiry → resubmit: calls submitTransparentTransfer a second time when blockhash expires', async () => {
  // First submit resolves with a low lastValidBlockHeight (10).
  // getBlockHeight returns 100 (> 10) so the expiry check fires.
  // getSignatureStatus always returns pending so the loop keeps running.
  // Second submit resolves with a higher lastValidBlockHeight (20).
  // getSignatureStatus then returns confirmed so the loop exits cleanly.
  mockSubmit
    .mockResolvedValueOnce({signature: 'S1', lastValidBlockHeight: 10})
    .mockResolvedValueOnce({signature: 'S2', lastValidBlockHeight: 20});

  mockGetSignatureStatus
    // First 10 polls (S1): return pending
    .mockResolvedValue({value: null});

  mockGetBlockHeight.mockResolvedValue(100);

  render(
    withSafeArea(
      <TransactionStatusScreen
        intent={intent}
        onDashboard={jest.fn()}
      />,
    ),
  );

  // The expiry check fires at i % 10 === 0, i.e. after 10 × 500 ms = 5 s of poll ticks.
  // We wait up to 10 s (real timers) for the second call to happen.
  await waitFor(
    () => {
      expect(mockSubmit).toHaveBeenCalledTimes(2);
    },
    {timeout: 10_000},
  );
}, 15_000);
