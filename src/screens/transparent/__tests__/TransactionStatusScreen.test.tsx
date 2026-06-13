import React from 'react';
import {render, waitFor} from '@testing-library/react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';

// ── Module mocks (jest.mock is hoisted above all imports) ─────────────────────

jest.mock('../../../modules/solana/sendTransaction', () => ({
  submitTransparentTransfer: jest.fn().mockResolvedValue({signature: 'S', lastValidBlockHeight: 1}),
}));

jest.mock('../../../modules/keyDerivation/derivationScheme', () => ({
  loadTransparentScheme: jest.fn(() => ({kind: 'slip10', account: 0})),
}));

jest.mock('../../../modules/solana/connection', () => ({
  getConnection: () => ({
    getSignatureStatus: jest.fn().mockResolvedValue({
      value: {confirmationStatus: 'confirmed', slot: 42},
    }),
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
});

it('success path: renders "Sent successfully" and tx-status-done', async () => {
  mockSubmit.mockResolvedValueOnce({signature: 'S', lastValidBlockHeight: 1});

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
