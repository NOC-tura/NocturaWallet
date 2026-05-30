import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {Linking} from 'react-native';
import {ShieldedExplainerScreen} from '../ShieldedExplainerScreen';
import {mmkvPublic} from '../../../store/mmkv/instances';
import {MMKV_KEYS} from '../../../constants/mmkvKeys';
import {useShieldedStore} from '../../../store/zustand/shieldedStore';

const mockReplace = jest.fn();
const mockGoBack = jest.fn();
const navigation = {replace: mockReplace, goBack: mockGoBack} as any;
const route = {key: 'ShieldedExplainer-test', name: 'ShieldedExplainer', params: undefined} as any;

beforeEach(() => {
  mockReplace.mockClear();
  mockGoBack.mockClear();
  mmkvPublic.remove(MMKV_KEYS.SHIELDED_EXPLAINED);
  useShieldedStore.getState().setMode('transparent');
  jest.spyOn(Linking, 'openURL').mockImplementation(() => Promise.resolve());
});

describe('ShieldedExplainerScreen', () => {
  it('renders H1, all 3 step titles, and footer note', () => {
    const {getByText} = render(<ShieldedExplainerScreen navigation={navigation} route={route} />);
    expect(getByText('Private SOL, three steps.')).toBeTruthy();
    expect(getByText('Move into the vault')).toBeTruthy();
    expect(getByText('Generate a ZK proof')).toBeTruthy();
    expect(getByText('Send privately')).toBeTruthy();
    expect(getByText('Screenshots disabled across this flow.')).toBeTruthy();
  });

  it('renders Continue and Learn more CTAs', () => {
    const {getByText} = render(<ShieldedExplainerScreen navigation={navigation} route={route} />);
    expect(getByText('Continue')).toBeTruthy();
    expect(getByText('Learn more')).toBeTruthy();
  });

  it('renders close × button with accessibility label', () => {
    const {getByLabelText} = render(<ShieldedExplainerScreen navigation={navigation} route={route} />);
    expect(getByLabelText('Close')).toBeTruthy();
  });

  it('tap Continue persists SHIELDED_EXPLAINED flag in MMKV', () => {
    const {getByTestId} = render(<ShieldedExplainerScreen navigation={navigation} route={route} />);
    fireEvent.press(getByTestId('continue-button'));
    expect(mmkvPublic.getBoolean(MMKV_KEYS.SHIELDED_EXPLAINED)).toBe(true);
  });

  it('tap Continue sets shielded mode in store', () => {
    const {getByTestId} = render(<ShieldedExplainerScreen navigation={navigation} route={route} />);
    fireEvent.press(getByTestId('continue-button'));
    expect(useShieldedStore.getState().mode).toBe('shielded');
  });

  it('tap Continue navigates (replace) to ShieldUnshieldModal with direction private', () => {
    const {getByTestId} = render(<ShieldedExplainerScreen navigation={navigation} route={route} />);
    fireEvent.press(getByTestId('continue-button'));
    expect(mockReplace).toHaveBeenCalledWith('ShieldUnshieldModal', {direction: 'private'});
  });

  it('tap close × does NOT persist the MMKV flag', () => {
    const {getByLabelText} = render(<ShieldedExplainerScreen navigation={navigation} route={route} />);
    fireEvent.press(getByLabelText('Close'));
    expect(mmkvPublic.getBoolean(MMKV_KEYS.SHIELDED_EXPLAINED)).toBeUndefined();
  });

  it('tap close × calls navigation.goBack', () => {
    const {getByLabelText} = render(<ShieldedExplainerScreen navigation={navigation} route={route} />);
    fireEvent.press(getByLabelText('Close'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('tap Learn more opens external privacy URL', () => {
    const {getByTestId} = render(<ShieldedExplainerScreen navigation={navigation} route={route} />);
    fireEvent.press(getByTestId('learn-more-button'));
    expect(Linking.openURL).toHaveBeenCalledWith('https://noc-tura.io/privacy');
  });
});
