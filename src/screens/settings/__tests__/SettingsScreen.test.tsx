import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
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
  useWalletStore: Object.assign(
    jest.fn().mockReturnValue({publicKey: 'ABC123def456'}),
    {getState: jest.fn().mockReturnValue({nocUsdPrice: 0, setNocUsdPrice: jest.fn()})},
  ),
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: mockNavigate}),
}));

const mockFlags = {shielded: false, presale: true};
jest.mock('../../../constants/features', () => ({isShieldedEnabled: () => mockFlags.shielded}));
jest.mock('../../../constants/chain', () => ({isPresaleEnabled: () => mockFlags.presale}));

beforeEach(() => {
  mockFlags.shielded = false;
  mockFlags.presale = true;
  mockNavigate.mockClear();
});

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

describe('SettingsScreen — M1b (R10, S13)', () => {
  it('shielded build: the Export View Key row stays, DISABLED, "Not available in this version." — pressing it goes nowhere', () => {
    mockFlags.shielded = true;
    const {getByTestId, getByText} = render(<SettingsScreen />);
    const row = getByTestId('export-view-key-row');
    expect(row.props.accessibilityState).toEqual({disabled: true});
    expect(getByText('Export View Key')).toBeTruthy();
    expect(getByText('Not available in this version.')).toBeTruthy();
    fireEvent.press(getByText('Export View Key'));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('production build: no Export View Key row', () => {
    const {queryByText} = render(<SettingsScreen />);
    expect(queryByText('Export View Key')).toBeNull();
  });

  it('the presale referral row only where presale exists (mainnet); none in the devnet build', () => {
    const mainnet = render(<SettingsScreen />);
    fireEvent.press(mainnet.getByText('Refer a friend'));
    expect(mockNavigate).toHaveBeenCalledWith('Referral');
    mainnet.unmount();
    mockFlags.presale = false;
    const devnet = render(<SettingsScreen />);
    expect(devnet.queryByText('Refer a friend')).toBeNull();
    expect(devnet.queryByTestId('section-rewards')).toBeNull();
  });

  it('no native prover debug row (the screen is removed)', () => {
    const {queryByText} = render(<SettingsScreen />);
    expect(queryByText(/Native prover test/)).toBeNull();
  });
});
