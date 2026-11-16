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

const mockKeychainCalls: string[] = [];
jest.mock('../../../modules/keychain/keychainModule', () => ({
  KeychainManager: jest.fn().mockImplementation(
    () =>
      new Proxy(
        {},
        {
          get: (_t, prop) => {
            mockKeychainCalls.push(String(prop));
            return jest.fn().mockResolvedValue(undefined);
          },
        },
      ),
  ),
  keychainManager: {dropV1ViewKey: jest.fn().mockResolvedValue(undefined)},
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
jest.mock('../../../modules/keyDerivation/derivationScheme', () => ({
  storeTransparentScheme: jest.fn(),
}));
jest.mock('../../../store/mmkv/instances', () => ({
  mmkvPublic: {
    set: jest.fn(),
    remove: jest.fn(),
    getAllKeys: jest.fn().mockReturnValue([]),
    getString: jest.fn(),
    getBoolean: jest.fn().mockReturnValue(false),
  },
  mmkvSecure: jest.fn().mockReturnValue(null),
  initSecureMmkv: jest.fn(),
  onSecureMmkvReady: jest.fn(),
  onSecureMmkvReset: jest.fn(), // a0/startup.ts registers its reset hook at import (R3-N5 N6)
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
    // the seed is stored; no v1 view key is (M1b)
    expect(mockKeychainCalls).toContain('storeSeed');
    expect(mockKeychainCalls.filter(c => /view/i.test(c))).toEqual([]);
  });
});
