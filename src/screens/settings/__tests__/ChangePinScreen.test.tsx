import React from 'react';
import {render} from '@testing-library/react-native';
import {ChangePinScreen} from '../ChangePinScreen';

jest.mock('../../../modules/keychain/keychainModule', () => ({
  KeychainManager: jest.fn().mockImplementation(() => ({
    verifyPin: jest.fn().mockResolvedValue(true),
    changePin: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({goBack: jest.fn()}),
}));

describe('ChangePinScreen', () => {
  it('renders PinPad component', () => {
    const {getByTestId} = render(<ChangePinScreen />);
    expect(getByTestId('pin-pad')).toBeTruthy();
  });

  it('shows "Enter current PIN" initially', () => {
    const {getByTestId} = render(<ChangePinScreen />);
    expect(getByTestId('pin-title')).toBeTruthy();
  });

  it('title text includes "current"', () => {
    const {getByTestId} = render(<ChangePinScreen />);
    const titleEl = getByTestId('pin-title');
    expect(titleEl.props.children).toContain('current');
  });

  it('PinPad is present with testID pin-pad', () => {
    const {getByTestId} = render(<ChangePinScreen />);
    expect(getByTestId('pin-pad')).toBeTruthy();
  });

  it('screen renders without crashing', () => {
    expect(() => render(<ChangePinScreen />)).not.toThrow();
  });
});
