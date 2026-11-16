import React from 'react';
import {render} from '@testing-library/react-native';
import {WipeWalletScreen} from '../WipeWalletScreen';

jest.mock('../../../modules/keychain/keychainModule', () => ({
  keychainManager: {wipeKeys: jest.fn().mockResolvedValue(undefined)},
}));

jest.mock('../../../store/zustand/walletStore', () => ({
  useWalletStore: Object.assign(
    jest.fn().mockReturnValue({}),
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

// The A0 note store and the build flag (M1b): the wipe warning reads the A0 store.
const mockRisk = {current: 'none' as 'none' | 'notes' | 'unreadable'};
const mockShielded = {current: true};
const mockWipeRisk = jest.fn(() => mockRisk.current);
jest.mock('../../../modules/shielded/a0/noteStore', () => ({a0WipeRisk: () => mockWipeRisk()}));
jest.mock('../../../constants/features', () => ({isShieldedEnabled: () => mockShielded.current}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({reset: jest.fn(), goBack: jest.fn()}),
}));

beforeEach(() => {
  mockRisk.current = 'none';
  mockShielded.current = true;
  mockWipeRisk.mockClear();
});

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

describe('WipeWalletScreen — the shielded warning reads the A0 note store (M1b)', () => {
  it('an unspent or pending A0 note → the warning fires, and names the recovery phrase', () => {
    mockRisk.current = 'notes';
    const {getByTestId, getByText} = render(<WipeWalletScreen />);
    expect(getByTestId('shielded-warning')).toBeTruthy();
    expect(getByText(/only your recovery phrase restores them/)).toBeTruthy();
    expect(mockWipeRisk).toHaveBeenCalled();
  });

  it('a store that cannot be read → the warning fires too (it may hold notes)', () => {
    mockRisk.current = 'unreadable';
    const {getByTestId, getByText} = render(<WipeWalletScreen />);
    expect(getByTestId('shielded-warning')).toBeTruthy();
    expect(getByText(/could not be read/)).toBeTruthy();
  });

  it('no A0 note (none) → no warning', () => {
    mockRisk.current = 'none';
    const {queryByTestId} = render(<WipeWalletScreen />);
    expect(queryByTestId('shielded-warning')).toBeNull();
  });

  it('the production build (shielded off) never reads the A0 store and shows no warning', () => {
    mockShielded.current = false;
    mockRisk.current = 'notes';
    const {queryByTestId} = render(<WipeWalletScreen />);
    expect(queryByTestId('shielded-warning')).toBeNull();
    expect(mockWipeRisk).not.toHaveBeenCalled();
  });
});
