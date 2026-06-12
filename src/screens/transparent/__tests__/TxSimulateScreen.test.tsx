import React from 'react';
import {render, fireEvent, waitFor} from '@testing-library/react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';

// ── Module mocks (jest.mock is hoisted above all imports) ─────────────────────
// These mocks intercept the lazy require() calls in the try/catch block inside
// TxSimulateScreen.tsx, making all four solana modules available so the real
// simulation path is exercised rather than the stub/best-effort fallback.

jest.mock('../../../modules/solana/connection', () => ({
  getConnection: jest.fn().mockReturnValue({}),
}));

jest.mock('../../../modules/solana/simulation', () => ({
  simulateTransaction: jest.fn().mockResolvedValue({success: true}),
}));

jest.mock('../../../modules/solana/transactionBuilder', () => ({
  buildTransferTx: jest.fn().mockResolvedValue({}),
  buildSPLTransferTx: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../modules/solana/simulationChecks', () => ({
  deriveTransferChecks: jest.fn().mockResolvedValue([]),
}));

// Mock walletStore — publicKey set so the real simulation path is taken.
jest.mock('../../../store/zustand/walletStore', () => ({
  useWalletStore: jest.fn().mockReturnValue({
    publicKey: 'GabcDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEF',
    solBalance: '1000000000',
  }),
}));

jest.mock('../../../store/zustand/shieldedStore', () => ({
  useShieldedStore: jest.fn((selector: (s: {mode: string}) => unknown) =>
    selector({mode: 'transparent'}),
  ),
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

// Import after all mocks are registered so the lazy require() block inside the
// component module sees the mocked versions.
import {TxSimulateScreen} from '../TxSimulateScreen';

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
  recipient: 'Gabc',
  amount: '0.001',
  tokenMint: 'native',
  tokenSymbol: 'SOL',
  decimals: 9,
  priorityLevel: 'normal' as const,
  createAta: false,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

it('renders the review-transfer header', () => {
  const {getByText} = render(
    withSafeArea(
      <TxSimulateScreen intent={intent} onContinue={jest.fn()} onCancel={jest.fn()} />,
    ),
  );
  expect(getByText('Review transfer')).toBeTruthy();
});

it('reaches ready state and shows continue + cancel buttons; pressing continue calls onContinue', async () => {
  // simulateTransaction resolves {success:true} (default mock)
  const {simulateTransaction} =
    require('../../../modules/solana/simulation') as {
      simulateTransaction: jest.Mock;
    };
  simulateTransaction.mockResolvedValueOnce({success: true});

  const onContinue = jest.fn();
  const {getByTestId} = render(
    withSafeArea(
      <TxSimulateScreen intent={intent} onContinue={onContinue} onCancel={jest.fn()} />,
    ),
  );

  // Wait for the async simulation effect to resolve and transition to ready.
  // In ready state the "Continue to confirm" Pressable is rendered.
  await waitFor(() => {
    const btn = getByTestId('tx-simulate-continue');
    expect(btn.props.accessibilityLabel).toBe('Continue to confirm');
  });

  // Cancel button also present in ready state
  expect(getByTestId('tx-simulate-cancel')).toBeTruthy();

  fireEvent.press(getByTestId('tx-simulate-continue'));

  await waitFor(() => {
    expect(onContinue).toHaveBeenCalledWith(intent);
  });
});

it('reaches failed state and shows retry button when simulation returns an error', async () => {
  // Override the default mock for this test to return failure
  const {simulateTransaction} =
    require('../../../modules/solana/simulation') as {
      simulateTransaction: jest.Mock;
    };
  simulateTransaction.mockResolvedValueOnce({
    success: false,
    error: {action: 'boom', code: 'E1', message: 'boom'},
  });

  const {getByTestId} = render(
    withSafeArea(
      <TxSimulateScreen intent={intent} onContinue={jest.fn()} onCancel={jest.fn()} />,
    ),
  );

  // Wait for the async simulation effect to resolve and transition to failed.
  // In failed state the "Retry" button with testID tx-simulate-retry is rendered.
  await waitFor(() => {
    expect(getByTestId('tx-simulate-retry')).toBeTruthy();
  });
});
