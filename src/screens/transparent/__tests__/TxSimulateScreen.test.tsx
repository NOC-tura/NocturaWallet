import React from 'react';
import {render, fireEvent, waitFor} from '@testing-library/react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';

// ── Module mocks (jest.mock is hoisted above all imports) ─────────────────────
// These mocks intercept the lazy require() calls in the try/catch block inside
// TxSimulateScreen.tsx, making all four solana modules available so the real
// simulation path is exercised rather than the stub/best-effort fallback.

// The chain identity, switchable per test (S13).
const mockNetwork = {current: 'mainnet-beta' as 'devnet' | 'mainnet-beta'};
jest.mock('../../../constants/chain', () => {
  const actual = jest.requireActual('../../../constants/chain');
  return {
    ...actual,
    get CHAIN() {
      return actual.chainIdentity(mockNetwork.current);
    },
  };
});

jest.mock('../../../modules/solana/connection', () => ({
  getConnection: jest.fn().mockReturnValue({}),
}));

jest.mock('../../../modules/solana/simulation', () => ({
  simulateTransaction: jest.fn().mockResolvedValue({success: true}),
}));

jest.mock('../../../modules/solana/transactionBuilder', () => ({
  buildTransferTx: jest.fn().mockResolvedValue({}),
  buildSPLTransferTx: jest.fn().mockResolvedValue({}),
  // Mirror the real module: a partial mock leaves new exports undefined, and
  // calling one throws inside the effect, which renders as a simulation
  // failure rather than a missing-export error.
  computeUnitLimitFor: jest.requireActual('../../../modules/solana/transactionBuilder')
    .computeUnitLimitFor,
}));

jest.mock('../../../modules/solana/priorityFee', () => ({
  estimatePriorityFee: jest.fn().mockResolvedValue(50_000),
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
  from: {scheme: 'slip10:0', address: 'GabcDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEF', label: 'Account 1', isMain: true}, // M1d: the sender is the intent's source (was the walletStore mock's publicKey)
  sourceBalances: {solBalance: '1000000000', tokenBalances: {}}, // M1d: "After" from the source's balances (was the walletStore mock's)
  linksAccounts: [], // post-M1d §4: no own-account link in this Send
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

it('while simulating, the eyebrow names the build\'s chain: devnet RPC on devnet, mainnet RPC on mainnet (S13)', () => {
  for (const [network, text] of [['devnet', 'Simulating on devnet RPC'], ['mainnet-beta', 'Simulating on mainnet RPC']] as const) {
    mockNetwork.current = network;
    const r = render(withSafeArea(<TxSimulateScreen intent={intent} onContinue={jest.fn()} onCancel={jest.fn()} />));
    expect(r.getByText(text)).toBeTruthy();
    r.unmount();
  }
  mockNetwork.current = 'mainnet-beta';
});

it('M1d (spec §3.3, §4.2, plan A8): the SOURCE is the sender, its balance gives "After", #19 says "From: Account 4 · …"', async () => {
  const {buildTransferTx} = require('../../../modules/solana/transactionBuilder') as {buildTransferTx: jest.Mock};
  buildTransferTx.mockClear();
  const from = {scheme: 'slip10:3', address: '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k', label: 'Account 4', isMain: false};
  const r = render(
    withSafeArea(
      <TxSimulateScreen intent={{...intent, from, sourceBalances: {solBalance: '3000000', tokenBalances: {}}}} onContinue={jest.fn()} onCancel={jest.fn()} />,
    ),
  );
  expect(r.getByTestId('tx-simulate-from')).toHaveTextContent('From: Account 4 · 3YqEpf…JXT94k');
  await waitFor(() => expect(buildTransferTx).toHaveBeenCalled());
  expect((buildTransferTx.mock.calls[0]![0] as {sender: {toBase58(): string}}).sender.toBase58()).toBe(from.address);
  // 3,000,000 − 1,000,000 sent − 5,000 base fee − 0 priority = 1,995,000 lamports
  await waitFor(() => expect(r.getByText('0.001995 SOL')).toBeTruthy());
});

it('M1d: the main account reads "From: Account 1 (main) · …"', () => {
  const r = render(withSafeArea(<TxSimulateScreen intent={intent} onContinue={jest.fn()} onCancel={jest.fn()} />));
  expect(r.getByTestId('tx-simulate-from')).toHaveTextContent('From: Account 1 (main) · GabcDE…ABCDEF');
});

it('M1d review M10: the recipient uses the same 6…6 short form as the From line', () => {
  const to = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
  const r = render(withSafeArea(<TxSimulateScreen intent={{...intent, recipient: to}} onContinue={jest.fn()} onCancel={jest.fn()} />));
  expect(r.getByText('HAgk14…3DKpqk')).toBeTruthy();
});
