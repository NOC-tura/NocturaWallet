import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';

// ── Module mocks (jest.mock is hoisted above all imports) ─────────────────────

jest.mock('../../../modules/solana/sendTransaction', () => ({
  sendTransparentTransfer: jest.fn().mockResolvedValue({signature: 'sig123'}),
}));

jest.mock('../../../modules/keyDerivation/derivationScheme', () => ({
  loadTransparentScheme: jest.fn().mockReturnValue({kind: 'slip10', account: 0}),
}));

jest.mock('../../../modules/session/pendingAuth', () => ({
  awaitUserAuth: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../../modules/addressBook/addressBookModule', () => ({
  addressBook: {
    findByAddress: jest.fn().mockReturnValue(null),
    addContact: jest.fn(),
  },
}));

jest.mock('../../../store/zustand/walletStore', () => ({
  useWalletStore: jest.fn().mockReturnValue({
    publicKey: 'So11111111111111111111111111111111111111112',
    solBalance: '10000000000',
    tokenBalances: {},
  }),
}));

// Mock react-navigation — TxConfirmScreen calls useNavigation to get rootNav
jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn().mockReturnValue({
    navigate: jest.fn(),
  }),
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
import {TxConfirmScreen} from '../TxConfirmScreen';
import {useWalletStore} from '../../../store/zustand/walletStore';
import {addressBook} from '../../../modules/addressBook/addressBookModule';

// Typed aliases for jest.Mock calls — avoids TS2352 cast errors.
const mockUseWalletStore = jest.mocked(useWalletStore);
const mockFindByAddress = jest.mocked(addressBook.findByAddress);

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

it('renders the confirm header', () => {
  const {getByText} = render(
    withSafeArea(
      <TxConfirmScreen intent={intent} onBroadcast={jest.fn()} onCancel={jest.fn()} />,
    ),
  );
  expect(getByText('Confirm')).toBeTruthy();
});

it('headline text matches /Send 0\\.001 SOL to/', () => {
  const {getByText} = render(
    withSafeArea(
      <TxConfirmScreen intent={intent} onBroadcast={jest.fn()} onCancel={jest.fn()} />,
    ),
  );
  // Headline contains "Send 0.001 SOL to <formatted address>"
  expect(getByText(/Send 0\.001 SOL to/)).toBeTruthy();
});

it('renders the send and cancel buttons', () => {
  const {getByTestId} = render(
    withSafeArea(
      <TxConfirmScreen intent={intent} onBroadcast={jest.fn()} onCancel={jest.fn()} />,
    ),
  );
  expect(getByTestId('tx-confirm-send')).toBeTruthy();
  expect(getByTestId('tx-confirm-cancel')).toBeTruthy();
});

it('calls onCancel when Cancel button is pressed', () => {
  const onCancel = jest.fn();
  const {getByTestId} = render(
    withSafeArea(
      <TxConfirmScreen intent={intent} onBroadcast={jest.fn()} onCancel={onCancel} />,
    ),
  );
  const cancelBtn = getByTestId('tx-confirm-cancel');
  fireEvent.press(cancelBtn);
  expect(onCancel).toHaveBeenCalledTimes(1);
});

it('shows detail rows for network, fee, priority, from, to', () => {
  const {getByText} = render(
    withSafeArea(
      <TxConfirmScreen intent={intent} onBroadcast={jest.fn()} onCancel={jest.fn()} />,
    ),
  );
  expect(getByText('Network')).toBeTruthy();
  expect(getByText('Solana mainnet')).toBeTruthy();
  expect(getByText('Fee')).toBeTruthy();
  expect(getByText('Priority')).toBeTruthy();
  expect(getByText('From')).toBeTruthy();
  expect(getByText('To')).toBeTruthy();
});

// ── High-value gate tests ─────────────────────────────────────────────────────

it('shows high-value card and disables send when amount > 5% of balance', () => {
  // solBalance '1000000000' = 1 SOL (1e9 lamports), amount '0.5' = 5e8 lamports = 50%
  mockUseWalletStore.mockReturnValue({
    publicKey: 'So11111111111111111111111111111111111111112',
    solBalance: '1000000000',
    tokenBalances: {},
  });

  const highValueIntent = {
    ...intent,
    amount: '0.5',
  };

  const {getByTestId} = render(
    withSafeArea(
      <TxConfirmScreen intent={highValueIntent} onBroadcast={jest.fn()} onCancel={jest.fn()} />,
    ),
  );

  expect(getByTestId('tx-confirm-highvalue')).toBeTruthy();
  const sendBtn = getByTestId('tx-confirm-send');
  expect(sendBtn.props.accessibilityState?.disabled).toBe(true);
});

it('enables send after typing CONFIRM in the typed-confirm input', () => {
  mockUseWalletStore.mockReturnValue({
    publicKey: 'So11111111111111111111111111111111111111112',
    solBalance: '1000000000',
    tokenBalances: {},
  });

  const highValueIntent = {
    ...intent,
    amount: '0.5',
  };

  const {getByTestId} = render(
    withSafeArea(
      <TxConfirmScreen intent={highValueIntent} onBroadcast={jest.fn()} onCancel={jest.fn()} />,
    ),
  );

  // Send is disabled before typing
  expect(getByTestId('tx-confirm-send').props.accessibilityState?.disabled).toBe(true);

  // Type the sentinel
  fireEvent.changeText(getByTestId('tx-confirm-typed-input'), 'CONFIRM');

  // Send is now enabled
  expect(getByTestId('tx-confirm-send').props.accessibilityState?.disabled).toBe(false);
});

it('does not show high-value card for a small transfer', () => {
  // solBalance '10000000000' = 10 SOL, amount '0.001' = tiny fraction
  mockUseWalletStore.mockReturnValue({
    publicKey: 'So11111111111111111111111111111111111111112',
    solBalance: '10000000000',
    tokenBalances: {},
  });

  const {queryByTestId, getByTestId} = render(
    withSafeArea(
      <TxConfirmScreen intent={intent} onBroadcast={jest.fn()} onCancel={jest.fn()} />,
    ),
  );

  expect(queryByTestId('tx-confirm-highvalue')).toBeNull();
  // Send button should be enabled (not disabled)
  expect(getByTestId('tx-confirm-send').props.accessibilityState?.disabled).toBe(false);
});

// ── First-time recipient tests ────────────────────────────────────────────────

it('shows add-contact prompt when recipient is not in address book', () => {
  mockUseWalletStore.mockReturnValue({
    publicKey: 'So11111111111111111111111111111111111111112',
    solBalance: '10000000000',
    tokenBalances: {},
  });
  mockFindByAddress.mockReturnValue(null);

  const {getByTestId} = render(
    withSafeArea(
      <TxConfirmScreen intent={intent} onBroadcast={jest.fn()} onCancel={jest.fn()} />,
    ),
  );

  expect(getByTestId('tx-confirm-add-contact')).toBeTruthy();
});

it('hides the first-time prompt after pressing Skip', () => {
  mockUseWalletStore.mockReturnValue({
    publicKey: 'So11111111111111111111111111111111111111112',
    solBalance: '10000000000',
    tokenBalances: {},
  });
  mockFindByAddress.mockReturnValue(null);

  const {getByTestId, queryByTestId} = render(
    withSafeArea(
      <TxConfirmScreen intent={intent} onBroadcast={jest.fn()} onCancel={jest.fn()} />,
    ),
  );

  expect(getByTestId('tx-confirm-add-contact')).toBeTruthy();
  fireEvent.press(getByTestId('tx-confirm-skip-contact'));
  expect(queryByTestId('tx-confirm-add-contact')).toBeNull();
});

it('hides the first-time prompt after pressing Add', () => {
  mockUseWalletStore.mockReturnValue({
    publicKey: 'So11111111111111111111111111111111111111112',
    solBalance: '10000000000',
    tokenBalances: {},
  });
  mockFindByAddress.mockReturnValue(null);

  const {getByTestId, queryByTestId} = render(
    withSafeArea(
      <TxConfirmScreen intent={intent} onBroadcast={jest.fn()} onCancel={jest.fn()} />,
    ),
  );

  expect(getByTestId('tx-confirm-add-contact')).toBeTruthy();
  fireEvent.press(getByTestId('tx-confirm-add-contact'));
  expect(queryByTestId('tx-confirm-add-contact')).toBeNull();
});
