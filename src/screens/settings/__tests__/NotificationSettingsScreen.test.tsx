import React from 'react';
import {render} from '@testing-library/react-native';
import {NotificationSettingsScreen} from '../NotificationSettingsScreen';

jest.mock('../../../modules/notifications/notificationModule', () => ({
  notificationManager: {
    isEnabled: jest.fn().mockReturnValue(false),
    setEnabled: jest.fn(),
    requestPermission: jest.fn().mockResolvedValue(true),
    registerToken: jest.fn().mockResolvedValue(undefined),
    getEnabledTypes: jest.fn().mockReturnValue([]),
  },
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({goBack: jest.fn()}),
}));

describe('NotificationSettingsScreen', () => {
  it('renders 4 toggle switches', () => {
    const {getByTestId} = render(<NotificationSettingsScreen />);
    expect(getByTestId('toggle-incoming_tx')).toBeTruthy();
    expect(getByTestId('toggle-staking_reward')).toBeTruthy();
    expect(getByTestId('toggle-tx_confirmed')).toBeTruthy();
    expect(getByTestId('toggle-security_alert')).toBeTruthy();
  });

  it('incoming tx toggle is present', () => {
    const {getByTestId} = render(<NotificationSettingsScreen />);
    expect(getByTestId('toggle-incoming_tx')).toBeTruthy();
  });

  it('security alert shows "always recommended" hint', () => {
    const {getByTestId} = render(<NotificationSettingsScreen />);
    expect(getByTestId('security-hint')).toBeTruthy();
  });

  it('security alert hint contains text "recommended"', () => {
    const {getByTestId} = render(<NotificationSettingsScreen />);
    const hint = getByTestId('security-hint');
    expect(hint.props.children).toMatch(/recommended/i);
  });

  it('screen renders without crashing', () => {
    expect(() => render(<NotificationSettingsScreen />)).not.toThrow();
  });
});
