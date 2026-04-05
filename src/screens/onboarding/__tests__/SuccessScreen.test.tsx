import React from 'react';
import {render, fireEvent, waitFor} from '@testing-library/react-native';
import {SuccessScreen} from '../SuccessScreen';

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
jest.mock('../../../store/mmkv/instances', () => ({
  mmkvPublic: {
    set: jest.fn(),
    getString: jest.fn(),
  },
  mmkvSecure: jest.fn().mockReturnValue(null),
  initSecureMmkv: jest.fn(),
}));

const TEST_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

describe('SuccessScreen', () => {
  const onComplete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows "Wallet created!" text', () => {
    const {getByText} = render(
      <SuccessScreen mnemonic={TEST_MNEMONIC} onComplete={onComplete} />,
    );
    expect(getByText('Wallet created!')).toBeTruthy();
  });

  it('shows "Enter wallet" CTA', () => {
    const {getByText} = render(
      <SuccessScreen mnemonic={TEST_MNEMONIC} onComplete={onComplete} />,
    );
    expect(getByText('Enter wallet')).toBeTruthy();
  });

  it('on CTA press, calls onComplete after async operations', async () => {
    const {getByText} = render(
      <SuccessScreen mnemonic={TEST_MNEMONIC} onComplete={onComplete} />,
    );
    fireEvent.press(getByText('Enter wallet'));
    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });
});
