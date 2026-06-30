import React from 'react';
import {render, fireEvent, act} from '@testing-library/react-native';
import {Alert} from 'react-native';
import {ZkProofScreen} from '../ZkProofScreen';
import {depositShield} from '../../../modules/shielded/depositFlow';

jest.mock('../../../modules/shielded/depositFlow', () => ({depositShield: jest.fn()}));
jest.mock('../../../modules/keychain/keychainModule', () => ({
  keychainManager: {retrieveSeed: jest.fn().mockResolvedValue('test mnemonic words')},
}));
jest.mock('../../../modules/keyDerivation/mnemonicUtils', () => ({
  mnemonicToSeed: jest.fn().mockResolvedValue(new Uint8Array(64)),
}));
jest.mock('../../../modules/keyDerivation/derivationScheme', () => ({
  loadTransparentScheme: jest.fn(() => ({kind: 'slip10', account: 0})),
}));
jest.mock('../../../modules/keyDerivation/transparent', () => {
  const {Keypair} = require('@solana/web3.js');
  const kp = Keypair.generate();
  return {deriveTransparentKeypair: jest.fn(() => ({secretKey: kp.secretKey, publicKey: kp.publicKey.toBytes()}))};
});
jest.mock('../../../modules/session/zeroize', () => ({zeroize: jest.fn()}));
jest.mock('@react-native-clipboard/clipboard', () => ({setString: jest.fn()}));

const mockDeposit = depositShield as jest.MockedFunction<typeof depositShield>;

const mockNavigate = jest.fn();
const mockReplace = jest.fn();
const mockGoBack = jest.fn();
const mockPopToTop = jest.fn();
const navigation = {
  navigate: mockNavigate,
  replace: mockReplace,
  goBack: mockGoBack,
  popToTop: mockPopToTop,
} as any;
const route = {
  key: 'ZkProofModal-test',
  name: 'ZkProofModal',
  params: {direction: 'private' as const, amount: '5000000000', recipient: undefined},
} as any;

beforeEach(() => {
  jest.useFakeTimers();
  mockDeposit.mockReset();
  mockNavigate.mockClear();
  mockReplace.mockClear();
  mockGoBack.mockClear();
  mockPopToTop.mockClear();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('ZkProofScreen', () => {
  it('renders 4 stage titles + footer note on mount', () => {
    mockDeposit.mockReturnValue(new Promise(() => {})); // never resolves
    const {getByText} = render(<ZkProofScreen navigation={navigation} route={route} />);
    expect(getByText('Build witness')).toBeTruthy();
    expect(getByText('Prove')).toBeTruthy();
    expect(getByText('Verify locally')).toBeTruthy();
    expect(getByText('Ready')).toBeTruthy();
    expect(getByText('FLAG_SECURE · screenshots blocked')).toBeTruthy();
  });

  it('starts in building state with hero "Building witness" after mount', () => {
    mockDeposit.mockReturnValue(new Promise(() => {}));
    const {getByText} = render(<ZkProofScreen navigation={navigation} route={route} />);
    act(() => {
      jest.advanceTimersByTime(50);
    });
    expect(getByText('Building witness')).toBeTruthy();
  });

  it('advances to proving after 2 seconds when chain pending', () => {
    mockDeposit.mockReturnValue(new Promise(() => {}));
    const {getByText} = render(<ZkProofScreen navigation={navigation} route={route} />);
    act(() => {
      jest.advanceTimersByTime(2100);
    });
    expect(getByText('Proving')).toBeTruthy();
  });

  it('advances through building → proving → verifying when chain stays pending', () => {
    mockDeposit.mockReturnValue(new Promise(() => {}));
    const {getByText} = render(<ZkProofScreen navigation={navigation} route={route} />);
    act(() => {
      jest.advanceTimersByTime(2100); // end of building → proving
    });
    expect(getByText('Proving')).toBeTruthy();
    act(() => {
      jest.advanceTimersByTime(3100); // end of proving → verifying
    });
    expect(getByText('Verify locally')).toBeTruthy();
  });

  it('fast-forwards to ready when chain succeeds during building', async () => {
    mockDeposit.mockResolvedValue({txSignature: 'SiGnAtUrEabcdefgh12345678', leafIndex: 0, amount: 5000000000n});
    const {getByText} = render(<ZkProofScreen navigation={navigation} route={route} />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => {
      jest.advanceTimersByTime(2100);
    });
    // When ready, the success screen is rendered (not the stage list)
    expect(getByText('Shielded')).toBeTruthy();
  });

  it('transitions to failed state when chain fails (chain rejects)', async () => {
    mockDeposit.mockRejectedValue(new Error('Hosted prover unreachable'));
    const {getByText, queryByText} = render(<ZkProofScreen navigation={navigation} route={route} />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => {
      jest.advanceTimersByTime(2100);
    });
    expect(getByText("Couldn't generate proof")).toBeTruthy();
    expect(queryByText('Retry locally')).toBeTruthy();
    expect(queryByText('Use Noctura hosted prover')).toBeTruthy();
  });

  it('tap Retry locally resets state to idle and re-fires chain', async () => {
    mockDeposit.mockRejectedValue(new Error('Hosted prover unreachable'));
    const {getByTestId, getByText} = render(<ZkProofScreen navigation={navigation} route={route} />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => {
      jest.advanceTimersByTime(2100);
    });
    expect(getByText("Couldn't generate proof")).toBeTruthy();
    mockDeposit.mockClear();
    fireEvent.press(getByTestId('retry-local-button'));
    await act(async () => {
      jest.advanceTimersByTime(50);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockDeposit).toHaveBeenCalled();
    expect(getByText('Building witness')).toBeTruthy();
  });

  it('tap Use Noctura hosted prover opens sheet with disclosure cards + opt-in + Proceed', async () => {
    mockDeposit.mockRejectedValue(new Error('Hosted prover unreachable'));
    const {getByTestId, getByText} = render(<ZkProofScreen navigation={navigation} route={route} />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => {
      jest.advanceTimersByTime(2100);
    });
    fireEvent.press(getByTestId('use-hosted-button'));
    expect(getByText('Use Noctura hosted prover')).toBeTruthy();
    expect(getByText('Server SEES')).toBeTruthy();
    expect(getByText("Server CAN'T SEE")).toBeTruthy();
    expect(getByText('Pedersen-hashed commitments')).toBeTruthy();
    expect(getByText('Spend key')).toBeTruthy();
    expect(
      getByText(
        "By proceeding you opt in to a one-time hosted proof. You'll be asked again on the next failure.",
      ),
    ).toBeTruthy();
    expect(getByText('Proceed with hosted proof')).toBeTruthy();
  });

  it('sheet Proceed triggers another depositShield call (hosted attempt)', async () => {
    mockDeposit.mockRejectedValue(new Error('Hosted prover unreachable'));
    const {getByTestId} = render(<ZkProofScreen navigation={navigation} route={route} />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => {
      jest.advanceTimersByTime(2100);
    });
    fireEvent.press(getByTestId('use-hosted-button'));
    mockDeposit.mockClear();
    fireEvent.press(getByTestId('proceed-hosted-button'));
    await act(async () => {
      jest.advanceTimersByTime(50);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockDeposit).toHaveBeenCalled();
  });

  it('hosted attempt success → ready → success screen with Done', async () => {
    mockDeposit.mockRejectedValueOnce(new Error('first fail'));
    const {getByTestId, getByText} = render(<ZkProofScreen navigation={navigation} route={route} />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => {
      jest.advanceTimersByTime(2100);
    });
    expect(getByText("Couldn't generate proof")).toBeTruthy();
    fireEvent.press(getByTestId('use-hosted-button'));
    mockDeposit.mockResolvedValueOnce({txSignature: 'SiGnAtUrEabcdefgh12345678', leafIndex: 0, amount: 5000000000n});
    fireEvent.press(getByTestId('proceed-hosted-button'));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(getByText('Shielded')).toBeTruthy();
    fireEvent.press(getByTestId('shield-done-button'));
    expect(mockPopToTop).toHaveBeenCalled();
  });

  it('hosted attempt failure shows hostedBanner on failed state', async () => {
    mockDeposit.mockRejectedValueOnce(new Error('first fail'));
    const {getByTestId, getByText} = render(<ZkProofScreen navigation={navigation} route={route} />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => {
      jest.advanceTimersByTime(2100);
    });
    fireEvent.press(getByTestId('use-hosted-button'));
    mockDeposit.mockRejectedValueOnce(new Error('hosted 503'));
    fireEvent.press(getByTestId('proceed-hosted-button'));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(getByText('Hosted prover also failed: hosted 503')).toBeTruthy();
  });

  it('tap back × mid-proof shows confirm dialog', () => {
    mockDeposit.mockReturnValue(new Promise(() => {}));
    const {getByTestId} = render(<ZkProofScreen navigation={navigation} route={route} />);
    act(() => {
      jest.advanceTimersByTime(500);
    });
    fireEvent.press(getByTestId('back-button'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Cancel proof generation?',
      'Your transaction will not be sent.',
      expect.any(Array),
    );
    // Verify tapping "Cancel" in the confirm dialog dismisses the screen
    const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
    const buttons = alertCall[2] as Array<{text: string; onPress?: () => void}>;
    const cancelBtn = buttons.find(b => b.text === 'Cancel');
    cancelBtn?.onPress?.();
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('tap back × from failed state calls navigation.goBack directly', async () => {
    mockDeposit.mockRejectedValue(new Error('fail'));
    const {getByTestId} = render(<ZkProofScreen navigation={navigation} route={route} />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => {
      jest.advanceTimersByTime(2100);
    });
    fireEvent.press(getByTestId('back-button'));
    expect(mockGoBack).toHaveBeenCalled();
  });
});
