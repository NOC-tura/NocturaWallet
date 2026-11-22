import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {Linking} from 'react-native';
import {ShieldedExplainerScreen} from '../ShieldedExplainerScreen';
import {mmkvPublic} from '../../../store/mmkv/instances';
import {MMKV_KEYS} from '../../../constants/mmkvKeys';
import {useShieldedStore} from '../../../store/zustand/shieldedStore';
import {BANNED_WORDS} from '../../../copy/__testing__/copyScan';
import {MAKE_PUBLIC} from '../../../copy/modes';
import {A0_RELAYED_COPY} from '../unshield/unshieldCopy';

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

afterEach(() => {
  // Restore Linking.openURL (and any other spies) so the mock does not leak
  // into other test files that may share the module instance.
  jest.restoreAllMocks();
});

describe('ShieldedExplainerScreen', () => {
  it('renders H1, all 3 step titles, and footer note', () => {
    const {getByText} = render(<ShieldedExplainerScreen navigation={navigation} route={route} />);
    // final review I-1: the title names the private balance, not "SOL" (the pool holds one SPL token; TEST on devnet)
    expect(getByText('Your private balance, three steps.')).toBeTruthy();
    expect(getByText('Move into your private balance')).toBeTruthy(); // part B: Move into the vault → Move into your private balance
    // final review I-1: plain words, no "ZK" (spec §1, no technical term visible by default)
    expect(getByText('Make the proof')).toBeTruthy();
    // final review I-1: step 3 is the exit that exists (relayed Make public), not a private send (M2 does not exist yet)
    expect(getByText(MAKE_PUBLIC)).toBeTruthy();
    expect(getByText('Screenshots disabled across this flow.')).toBeTruthy();
  });

  it('final review I-1: what the screen keeps — a public deposit signed by the main account, a linkable exit, a proof made on the phone, the relayed exit', () => {
    const r = render(<ShieldedExplainerScreen navigation={navigation} route={route} />);
    expect(r.getByText(/The deposit is public on chain and signed by your main account\./)).toBeTruthy();
    expect(r.getByText(/making them public to your main account links the exit to your deposit\./i)).toBeTruthy();
    expect(r.getByText(/Your phone makes the proof itself, on this device\./)).toBeTruthy();
    // owner 2026-11-21 (friendlier #17): the exit says who sends it and that it costs a small fee, without "this transaction"
    expect(r.getByText(/A relayer sends it for you for a small fee, so no key of yours signs it\. Amounts and timing are public\./)).toBeTruthy();
    expect(r.queryByText(A0_RELAYED_COPY, {exact: false})).toBeNull();
    // owner 2026-11-21: the intro no longer opens with "Make private moves…", which read as an imperative
    expect(r.getByText(/^When you make tokens private, they move into a pool and become your private balance\. Moving them in and out is public on chain\.$/)).toBeTruthy();
  });

  it('final review I-1 negative: no "SOL" as a word, no "Send privately", no recipient, no "ZK" or "Groth16", no overclaim', () => {
    const r = render(<ShieldedExplainerScreen navigation={navigation} route={route} />);
    const said = r
      .queryAllByText(/./)
      .map(e => (Array.isArray(e.props.children) ? e.props.children.join('') : String(e.props.children)))
      .join('\n');
    expect(said).toMatch(/three steps/); // the scan read the screen's text (positive control)
    expect(said).not.toMatch(/\bSOL\b/);
    expect(said).not.toMatch(/Send privately/i);
    expect(said).not.toMatch(/recipient/i);
    expect(said).not.toMatch(/\bZK\b|Groth16|zero-knowledge/i);
    expect(said).not.toMatch(/anonymous|untraceable|invisible|no one can see|not shown/i);
  });

  it('#15 overline is the module\'s PRIVATE_MARK, not an old word (Task 6 carry)', () => {
    const {getByText, queryByText} = render(<ShieldedExplainerScreen navigation={navigation} route={route} />);
    expect(getByText('Private')).toBeTruthy();
    expect(queryByText(BANNED_WORDS)).toBeNull(); // Task 7 carry: every banned word (the shared scan's pattern), not two of them
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

  it('M1d (M1 spec §11 R11): who sees what — the relayer, the RPC provider, the chain — in plain words', () => {
    const r = render(<ShieldedExplainerScreen navigation={navigation} route={route} />);
    const block = r.getByTestId('explainer-who-sees-what');
    expect(block).toBeTruthy();
    expect(r.getByText('Who sees what')).toBeTruthy();
    expect(
      r.getByText(
        'When you make tokens public, the relayer that sends them sees the request: the destination, the amount, the time and the network address it came from. The proof does not tell it which deposit is spent, but amounts and timing can hint at it. Otherwise it sees what anyone sees on chain.',
      ),
    ).toBeTruthy();
    expect(r.getByText('The RPC provider the app uses sees every request the app makes, including the balances of all your accounts.')).toBeTruthy();
    expect(r.getByText('On chain, amounts and timing are public.')).toBeTruthy();
  });
});
