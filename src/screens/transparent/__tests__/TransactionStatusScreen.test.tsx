import React from 'react';
import {render, waitFor, fireEvent} from '@testing-library/react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';

// ── Module mocks (jest.mock is hoisted above all imports) ─────────────────────

// The chain identity, switchable per test (S13): CHAIN and the explorer link follow mockNetwork.
const mockNetwork = {current: 'mainnet-beta' as 'devnet' | 'mainnet-beta'};
jest.mock('../../../constants/chain', () => {
  const actual = jest.requireActual('../../../constants/chain');
  return {
    ...actual,
    get CHAIN() {
      return actual.chainIdentity(mockNetwork.current);
    },
    explorerTxUrl: (sig: string, explorer?: 'solscan' | 'solanaexplorer' | 'solanafm') =>
      actual.explorerTxUrl(sig, explorer, mockNetwork.current),
  };
});

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

jest.mock('react-native/Libraries/Linking/Linking', () => {
  // react-native's index reads the module's `default`; the same jest.fn under both names.
  const openURL = jest.fn(() => Promise.resolve());
  return {__esModule: true, default: {openURL}, openURL};
});

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
  from: {scheme: 'slip10:0', address: 'So11111111111111111111111111111111111111112', label: 'Account 1', isMain: true}, // M1d: #21 signs from the intent's source (was loadTransparentScheme())
  sourceBalances: {solBalance: '1000000000', tokenBalances: {}}, // M1d: part of the intent (unused by #21)
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

it('landed-but-failed: a confirmed tx WITH err renders "Transaction failed", not success', async () => {
  mockSubmit.mockResolvedValueOnce({signature: 'S', lastValidBlockHeight: 1000});
  // On-chain failure: the tx is confirmed AND carries an err (e.g. CU exceeded).
  mockGetSignatureStatus.mockResolvedValue({
    value: {
      confirmationStatus: 'confirmed',
      slot: 42,
      err: {InstructionError: [3, 'ComputationalBudgetExceeded']},
    },
  });

  const {getByText, getByTestId, queryByText} = render(
    withSafeArea(
      <TransactionStatusScreen intent={intent} onDashboard={jest.fn()} />,
    ),
  );

  await waitFor(() => {
    expect(getByText('Transaction failed')).toBeTruthy();
  });
  expect(getByTestId('tx-status-retry')).toBeTruthy();
  expect(queryByText('Sent successfully')).toBeNull();
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
  // getSignatureStatus stays pending so the blockhash "expires" → resubmit.
  // Second submit resolves with a higher lastValidBlockHeight (20).
  mockSubmit
    .mockResolvedValueOnce({signature: 'S1', lastValidBlockHeight: 10})
    .mockResolvedValueOnce({signature: 'S2', lastValidBlockHeight: 20});

  mockGetSignatureStatus.mockResolvedValue({value: null});
  mockGetBlockHeight.mockResolvedValue(100);

  const {unmount} = render(
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

  // Unmount so the poll loop's `cancelled` cleanup stops it — no dangling timer.
  unmount();
}, 15_000);

describe('the chain the status names and links (S13)', () => {
  const openURL = (jest.requireMock('react-native/Libraries/Linking/Linking') as {openURL: jest.Mock}).openURL;
  beforeEach(() => openURL.mockImplementation(() => Promise.resolve()));
  afterEach(() => {
    mockNetwork.current = 'mainnet-beta';
  });

  it('devnet: "Confirmed on Solana devnet", and View details opens the explorer with ?cluster=devnet', async () => {
    mockNetwork.current = 'devnet';
    mockSubmit.mockResolvedValueOnce({signature: 'S', lastValidBlockHeight: 1000});
    const {getByText, getByTestId, queryByText} = render(
      withSafeArea(<TransactionStatusScreen intent={intent} onDashboard={jest.fn()} />),
    );
    await waitFor(() => {
      expect(getByText('Confirmed on Solana devnet')).toBeTruthy();
    });
    expect(queryByText(/Solana mainnet/)).toBeNull();
    fireEvent.press(getByTestId('tx-status-details'));
    expect(openURL).toHaveBeenCalledWith('https://solscan.io/tx/S?cluster=devnet');
  });

  it('mainnet (control): "Confirmed on Solana mainnet", the link has no cluster', async () => {
    mockSubmit.mockResolvedValueOnce({signature: 'S', lastValidBlockHeight: 1000});
    const {getByText, getByTestId} = render(
      withSafeArea(<TransactionStatusScreen intent={intent} onDashboard={jest.fn()} />),
    );
    await waitFor(() => {
      expect(getByText('Confirmed on Solana mainnet')).toBeTruthy();
    });
    fireEvent.press(getByTestId('tx-status-details'));
    expect(openURL).toHaveBeenCalledWith('https://solscan.io/tx/S');
  });
});

describe('M1d — #21 signs from the intent\'s source (spec §3.3)', () => {
  const A3 = '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k';
  const render21 = (i: typeof intent) =>
    render(withSafeArea(<TransactionStatusScreen intent={i} onDashboard={jest.fn()} onViewDetails={jest.fn()} />));

  it('the scheme parsed from the intent and the expected signer = the source address', async () => {
    mockSubmit.mockResolvedValueOnce({signature: 'S', lastValidBlockHeight: 1000});
    render21({...intent, from: {scheme: 'slip10:3', address: A3, label: 'Account 4', isMain: false}});
    await waitFor(() => expect(mockSubmit).toHaveBeenCalled());
    expect(mockSubmit).toHaveBeenCalledWith(expect.objectContaining({scheme: {kind: 'slip10', account: 3}, expectedSigner: A3}));
  });

  it('Review Focus 2: the signer refusal is shown with its code (nothing was signed)', async () => {
    mockSubmit.mockRejectedValueOnce(new Error(`E_SEND_SIGNER_MISMATCH: this account's key does not derive ${A3}; nothing was signed.`));
    const r = render21({...intent, from: {scheme: 'slip10:3', address: A3, label: 'Account 4', isMain: false}});
    await waitFor(() => expect(r.getByText(/E_SEND_SIGNER_MISMATCH/)).toBeTruthy());
    expect(r.getByText('Transaction failed')).toBeTruthy();
  });

  it('plan A16: a scheme that does not parse strictly → E_SEND_SCHEME, the keychain never asked', async () => {
    const r = render21({...intent, from: {scheme: 'slip10:01', address: A3, label: 'Account 2', isMain: false}});
    await waitFor(() => expect(r.getByText(/E_SEND_SCHEME/)).toBeTruthy());
    expect(mockSubmit).not.toHaveBeenCalled();
  });
});
