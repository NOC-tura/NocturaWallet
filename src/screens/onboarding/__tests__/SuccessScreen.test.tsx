import React from 'react';
import {render, fireEvent, waitFor} from '@testing-library/react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {SuccessScreen} from '../SuccessScreen';

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

jest.setTimeout(30_000); // Key derivation + keychain mocks can be slow in full suite

jest.mock('../../../modules/keychain/keychainModule', () => ({
  KeychainManager: jest.fn().mockImplementation(() => ({
    storeSeed: jest.fn().mockResolvedValue(undefined),
    storeViewKey: jest.fn().mockResolvedValue(undefined),
  })),
}));
jest.mock('../../../modules/keyDerivation/mnemonicUtils', () => ({
  mnemonicToSeed: jest.fn().mockResolvedValue(new Uint8Array(64)),
}));
jest.mock('../../../modules/keyDerivation/transparent', () => ({
  deriveTransparentKeypair: jest.fn().mockReturnValue({
    publicKey: new Uint8Array(32).fill(1),
    secretKey: new Uint8Array(64),
  }),
}));
jest.mock('../../../modules/keyDerivation/shielded', () => ({
  deriveShieldedViewKey: jest.fn().mockReturnValue(new Uint8Array(32)),
}));
jest.mock('../../../modules/keyDerivation/derivationScheme', () => ({
  storeTransparentScheme: jest.fn(),
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

// Mock walletStore to avoid persist side effects
jest.mock('../../../store/zustand/walletStore', () => ({
  useWalletStore: Object.assign(
    jest.fn().mockReturnValue({publicKey: null, tokens: []}),
    {getState: jest.fn().mockReturnValue({setPublicKey: jest.fn(), setPkShielded: jest.fn()})},
  ),
}));

const TEST_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

describe('SuccessScreen', () => {
  const onComplete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows "Wallet created" text', () => {
    const {getByText} = render(
      withSafeArea(<SuccessScreen mnemonic={TEST_MNEMONIC} scheme={{kind: 'slip10', account: 0}} onComplete={onComplete} />),
    );
    expect(getByText('Wallet created')).toBeTruthy();
  });

  it('shows "Open wallet" CTA', () => {
    const {getByText} = render(
      withSafeArea(<SuccessScreen mnemonic={TEST_MNEMONIC} scheme={{kind: 'slip10', account: 0}} onComplete={onComplete} />),
    );
    expect(getByText('Open wallet')).toBeTruthy();
  });

  it('on CTA press, calls onComplete after async operations', async () => {
    const {getByTestId} = render(
      withSafeArea(<SuccessScreen mnemonic={TEST_MNEMONIC} scheme={{kind: 'slip10', account: 0}} onComplete={onComplete} />),
    );
    // CTA starts disabled (publicKeyBase58 null) and enables after async key
    // derivation completes. Wait for the accessibilityState.disabled === false
    // before pressing — fireEvent.press on a disabled Pressable is a no-op
    // (Button primitive short-circuits onPress when disabled).
    await waitFor(() => {
      const cta = getByTestId('enter-wallet-button');
      expect(cta.props.accessibilityState?.disabled).toBe(false);
    });
    fireEvent.press(getByTestId('enter-wallet-button'));
    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });
});
