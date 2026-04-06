import React from 'react';
import {render} from '@testing-library/react-native';
import {SecuritySettingsScreen} from '../SecuritySettingsScreen';

jest.mock('../../../store/zustand/secureSettingsStore', () => ({
  useSecureSettingsStore: jest.fn().mockReturnValue({
    biometricEnabled: false,
    sessionTimeoutMinutes: 5,
    autoLockOnBackground: true,
    setBiometricEnabled: jest.fn(),
    setSessionTimeoutMinutes: jest.fn(),
    setAutoLockOnBackground: jest.fn(),
  }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: jest.fn()}),
}));

// mmkvPublic mock: getBoolean returns undefined by default (no jailbreak)
jest.mock('../../../store/mmkv/instances', () => ({
  mmkvPublic: {
    getBoolean: jest.fn().mockReturnValue(undefined),
    getString: jest.fn().mockReturnValue(undefined),
    set: jest.fn(),
  },
}));

describe('SecuritySettingsScreen', () => {
  it('renders biometric toggle', () => {
    const {getByTestId} = render(<SecuritySettingsScreen />);
    expect(getByTestId('biometric-toggle')).toBeTruthy();
  });

  it('renders session timeout display', () => {
    const {getByText} = render(<SecuritySettingsScreen />);
    expect(getByText(/Auto-lock after: 5 min/)).toBeTruthy();
  });

  it('renders auto-lock toggle', () => {
    const {getByTestId} = render(<SecuritySettingsScreen />);
    expect(getByTestId('autolock-toggle')).toBeTruthy();
  });

  it('shows Change PIN button', () => {
    const {getByTestId} = render(<SecuritySettingsScreen />);
    expect(getByTestId('change-pin-button')).toBeTruthy();
  });

  it('does NOT show jailbreak warning by default', () => {
    const {queryByTestId} = render(<SecuritySettingsScreen />);
    expect(queryByTestId('jailbreak-warning')).toBeNull();
  });
});
