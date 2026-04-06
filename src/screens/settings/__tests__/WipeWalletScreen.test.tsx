import React from 'react';
import {render} from '@testing-library/react-native';
import {WipeWalletScreen} from '../WipeWalletScreen';

jest.mock('../../../modules/keychain/keychainModule', () => ({
  keychainManager: {wipeKeys: jest.fn().mockResolvedValue(undefined)},
}));

jest.mock('../../../store/zustand/walletStore', () => ({
  useWalletStore: Object.assign(
    jest.fn().mockReturnValue({shieldedBalances: {}}),
    {getState: jest.fn().mockReturnValue({reset: jest.fn()})},
  ),
}));

jest.mock('../../../store/zustand/publicSettingsStore', () => ({
  usePublicSettingsStore: {getState: jest.fn().mockReturnValue({reset: jest.fn()})},
}));

jest.mock('../../../store/zustand/secureSettingsStore', () => ({
  useSecureSettingsStore: {getState: jest.fn().mockReturnValue({reset: jest.fn()})},
}));

jest.mock('../../../store/zustand/shieldedStore', () => ({
  useShieldedStore: {getState: jest.fn().mockReturnValue({reset: jest.fn()})},
}));

jest.mock('../../../store/zustand/sessionStore', () => ({
  useSessionStore: {getState: jest.fn().mockReturnValue({lock: jest.fn()})},
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({reset: jest.fn(), goBack: jest.fn()}),
}));

describe('WipeWalletScreen', () => {
  it('shows warning text', () => {
    const {getByTestId} = render(<WipeWalletScreen />);
    expect(getByTestId('wipe-warning')).toBeTruthy();
  });

  it('does NOT show shielded warning when balance is empty', () => {
    const {queryByTestId} = render(<WipeWalletScreen />);
    expect(queryByTestId('shielded-warning')).toBeNull();
  });

  it('shows DELETE text input', () => {
    const {getByTestId} = render(<WipeWalletScreen />);
    expect(getByTestId('delete-input')).toBeTruthy();
  });

  it('wipe button is disabled initially', () => {
    const {getByTestId} = render(<WipeWalletScreen />);
    const btn = getByTestId('wipe-button');
    expect(btn.props.accessibilityState?.disabled ?? btn.props.disabled).toBeTruthy();
  });

  it('screen renders without crashing', () => {
    expect(() => render(<WipeWalletScreen />)).not.toThrow();
  });
});
