import React from 'react';
import {render, fireEvent, act} from '@testing-library/react-native';
import {Alert} from 'react-native';
import {ZkProofScreen} from '../ZkProofScreen';
import {zkProver} from '../../../modules/zkProver/zkProverModule';
import type {ZKProof} from '../../../modules/zkProver/types';

jest.mock('../../../modules/zkProver/zkProverModule', () => ({
  zkProver: {
    prove: jest.fn(),
  },
}));

const mockProve = zkProver.prove as jest.MockedFunction<typeof zkProver.prove>;

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

const mockProof: ZKProof = {
  proofType: 'deposit',
  proofData: 'mock-base64-proof',
  publicInputs: {root: '0x00', nullifier: '0x00', amount: '5000000000'},
  generatedAt: 1700000000000,
  proofBytes: '',
};

beforeEach(() => {
  jest.useFakeTimers();
  mockProve.mockReset();
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
    mockProve.mockReturnValue(new Promise(() => {})); // never resolves
    const {getByText} = render(<ZkProofScreen navigation={navigation} route={route} />);
    expect(getByText('Build witness')).toBeTruthy();
    expect(getByText('Prove')).toBeTruthy();
    expect(getByText('Verify locally')).toBeTruthy();
    expect(getByText('Ready')).toBeTruthy();
    expect(getByText('FLAG_SECURE · screenshots blocked')).toBeTruthy();
  });

  it('starts in building state with hero "Building witness" after mount', () => {
    mockProve.mockReturnValue(new Promise(() => {}));
    const {getByText} = render(<ZkProofScreen navigation={navigation} route={route} />);
    act(() => {
      jest.advanceTimersByTime(50);
    });
    expect(getByText('Building witness')).toBeTruthy();
  });

  it('advances to proving after 2 seconds when chain pending', () => {
    mockProve.mockReturnValue(new Promise(() => {}));
    const {getByText} = render(<ZkProofScreen navigation={navigation} route={route} />);
    act(() => {
      jest.advanceTimersByTime(2100);
    });
    expect(getByText('Proving')).toBeTruthy();
  });

  it('advances through building → proving → verifying when chain stays pending', () => {
    mockProve.mockReturnValue(new Promise(() => {}));
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
    mockProve.mockResolvedValue(mockProof);
    const {getByText} = render(<ZkProofScreen navigation={navigation} route={route} />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => {
      jest.advanceTimersByTime(2100);
    });
    expect(getByText('Ready')).toBeTruthy();
  });

  it('transitions to failed state when chain fails (chain rejects)', async () => {
    mockProve.mockRejectedValue(new Error('Hosted prover unreachable'));
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
    mockProve.mockRejectedValue(new Error('Hosted prover unreachable'));
    const {getByTestId, getByText} = render(<ZkProofScreen navigation={navigation} route={route} />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => {
      jest.advanceTimersByTime(2100);
    });
    expect(getByText("Couldn't generate proof")).toBeTruthy();
    mockProve.mockClear();
    fireEvent.press(getByTestId('retry-local-button'));
    act(() => {
      jest.advanceTimersByTime(50);
    });
    expect(mockProve).toHaveBeenCalled();
    expect(getByText('Building witness')).toBeTruthy();
  });

  it('tap Use Noctura hosted prover opens sheet with disclosure cards + opt-in + Proceed', async () => {
    mockProve.mockRejectedValue(new Error('Hosted prover unreachable'));
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

  it('sheet Proceed triggers another zkProver.prove call (hosted attempt)', async () => {
    mockProve.mockRejectedValue(new Error('Hosted prover unreachable'));
    const {getByTestId} = render(<ZkProofScreen navigation={navigation} route={route} />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => {
      jest.advanceTimersByTime(2100);
    });
    fireEvent.press(getByTestId('use-hosted-button'));
    mockProve.mockClear();
    fireEvent.press(getByTestId('proceed-hosted-button'));
    act(() => {
      jest.advanceTimersByTime(50);
    });
    expect(mockProve).toHaveBeenCalled();
  });

  it('hosted attempt success → ready → Alert with proof-ready copy', async () => {
    mockProve.mockRejectedValueOnce(new Error('first fail'));
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
    mockProve.mockResolvedValueOnce(mockProof);
    fireEvent.press(getByTestId('proceed-hosted-button'));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(Alert.alert).toHaveBeenCalledWith(
      'Proof ready',
      'Transaction simulation (#19) not yet wired — returning to dashboard.',
      expect.any(Array),
    );
    // Verify pressing OK in the Alert calls navigation.popToTop
    const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
    const buttons = alertCall[2] as Array<{text: string; onPress?: () => void}>;
    buttons[0].onPress?.();
    expect(mockPopToTop).toHaveBeenCalled();
  });

  it('hosted attempt failure shows hostedBanner on failed state', async () => {
    mockProve.mockRejectedValueOnce(new Error('first fail'));
    const {getByTestId, getByText} = render(<ZkProofScreen navigation={navigation} route={route} />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => {
      jest.advanceTimersByTime(2100);
    });
    fireEvent.press(getByTestId('use-hosted-button'));
    mockProve.mockRejectedValueOnce(new Error('hosted 503'));
    fireEvent.press(getByTestId('proceed-hosted-button'));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(getByText('Hosted prover also failed: hosted 503')).toBeTruthy();
  });

  it('tap back × mid-proof shows confirm dialog', () => {
    mockProve.mockReturnValue(new Promise(() => {}));
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
    mockProve.mockRejectedValue(new Error('fail'));
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
