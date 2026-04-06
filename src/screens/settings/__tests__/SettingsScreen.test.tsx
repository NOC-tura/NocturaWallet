import React from 'react';
import {render} from '@testing-library/react-native';
import {SettingsScreen} from '../SettingsScreen';

jest.mock('../../../store/zustand/useSettings', () => ({
  useSettings: jest.fn().mockReturnValue({
    hideBalances: false,
    hideZeroBalanceTokens: false,
    currency: 'USD',
    language: 'en',
    amoledMode: false,
    hapticsEnabled: true,
    explorer: 'solscan',
    analyticsOptOut: false,
    sessionTimeoutMinutes: 5,
    autoLockOnBackground: true,
    biometricEnabled: false,
    customRpcEndpoint: null,
    setBiometricEnabled: jest.fn(),
    setAutoLockOnBackground: jest.fn(),
    setHideBalances: jest.fn(),
    setHideZeroBalanceTokens: jest.fn(),
    setAmoledMode: jest.fn(),
    setHapticsEnabled: jest.fn(),
  }),
}));

jest.mock('../../../store/zustand/walletStore', () => ({
  useWalletStore: jest.fn().mockReturnValue({publicKey: 'ABC123def456'}),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: jest.fn()}),
}));

// mmkv instances are mocked globally via __mocks__/react-native-mmkv.ts
jest.mock('../../../store/mmkv/instances', () => {
  const {createMMKV} = jest.requireActual('react-native-mmkv');
  return {
    mmkvPublic: createMMKV({id: 'noctura-public-test'}),
  };
});

describe('SettingsScreen', () => {
  it('renders Security section header', () => {
    const {getByTestId} = render(<SettingsScreen />);
    expect(getByTestId('section-security')).toBeTruthy();
  });

  it('renders Backup section header', () => {
    const {getByTestId} = render(<SettingsScreen />);
    expect(getByTestId('section-backup')).toBeTruthy();
  });

  it('renders Display section with currency', () => {
    const {getByTestId, getByText} = render(<SettingsScreen />);
    expect(getByTestId('section-display')).toBeTruthy();
    expect(getByText('USD')).toBeTruthy();
  });

  it('renders Advanced section with "Wipe Wallet"', () => {
    const {getByTestId, getByText} = render(<SettingsScreen />);
    expect(getByTestId('section-advanced')).toBeTruthy();
    expect(getByText('Wipe Wallet')).toBeTruthy();
  });

  it('renders Accessibility section', () => {
    const {getByTestId} = render(<SettingsScreen />);
    expect(getByTestId('section-accessibility')).toBeTruthy();
  });
});
