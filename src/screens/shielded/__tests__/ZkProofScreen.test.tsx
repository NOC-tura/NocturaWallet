import React from 'react';
import {render, fireEvent, act} from '@testing-library/react-native';
import {Alert} from 'react-native';
import {ZkProofScreen} from '../ZkProofScreen';
import {depositShield} from '../../../modules/shielded/depositFlow';
import {unshield} from '../../../modules/shielded/withdrawFlow';
import {getNotes} from '../../../modules/shielded/noteStore';

jest.mock('../../../modules/shielded/depositFlow', () => ({depositShield: jest.fn()}));
jest.mock('../../../modules/shielded/withdrawFlow', () => ({
  unshield: jest.fn(async () => ({txSignature: 'WSIG', amount: 200_000_000n})),
  MerkleRootStaleError: class extends Error {},
}));
jest.mock('../../../modules/shielded/noteStore', () => ({
  getNotes: jest.fn(() => [
    {commitment: 'c', nullifier: '', mint: 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW', amount: 200_000_000n, index: 0, spent: false, createdAt: 1, noteSecret: '9'},
  ]),
}));
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

// Stable fake mint used across mint-threading tests
const TEST_POOL_MINT = 'PoolMint111111111111111111111111111111111111';
jest.mock('../../../constants/programs', () => ({
  SHIELDED_POOL_MINTS: ['PoolMint111111111111111111111111111111111111'],
  SHIELDED_DEVNET_MINT: 'PoolMint111111111111111111111111111111111111',
}));
jest.mock('../../../modules/shielded/poolTokens', () => ({
  poolTokenMeta: jest.fn((mint: string) => ({
    mint,
    symbol: mint === 'PoolMint111111111111111111111111111111111111' ? 'TEST' : mint.slice(0, 4),
    name: 'Test Token',
    decimals: 9,
  })),
}));

const mockDeposit = depositShield as jest.MockedFunction<typeof depositShield>;
const mockUnshield = unshield as jest.MockedFunction<typeof unshield>;
const mockGetNotes = getNotes as jest.MockedFunction<typeof getNotes>;

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
  mockUnshield.mockReset();
  mockUnshield.mockResolvedValue({txSignature: 'WSIG', amount: 200_000_000n});
  mockGetNotes.mockReset();
  mockGetNotes.mockReturnValue([
    {commitment: 'c', nullifier: '', mint: 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW', amount: 200_000_000n, index: 0, spent: false, createdAt: 1, noteSecret: '9'},
  ]);
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

  // ── Public direction (unshield) tests ─────────────────────────────────────

  it('public direction: calls unshield with matching note and shows "Unshielded" on success', async () => {
    const NOC_MINT = 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW';
    const publicRoute = {
      key: 'ZkProofModal-public-test',
      name: 'ZkProofModal',
      params: {direction: 'public' as const, amount: '200000000', mint: NOC_MINT},
    } as any;
    mockDeposit.mockReturnValue(new Promise(() => {})); // should not be called
    mockUnshield.mockResolvedValue({txSignature: 'WSIG12345678abcdefgh', amount: 200_000_000n});
    const {getByText} = render(<ZkProofScreen navigation={navigation} route={publicRoute} />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => {
      jest.advanceTimersByTime(2100);
    });
    expect(mockUnshield).toHaveBeenCalled();
    expect(mockDeposit).not.toHaveBeenCalled();
    expect(getByText('Unshielded')).toBeTruthy();
    expect(getByText('Your funds are public again in your transparent balance.')).toBeTruthy();
  });

  it('public direction: success screen shows "unshielded" amount label', async () => {
    const NOC_MINT = 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW';
    const publicRoute = {
      key: 'ZkProofModal-public-test-2',
      name: 'ZkProofModal',
      params: {direction: 'public' as const, amount: '200000000', mint: NOC_MINT},
    } as any;
    mockUnshield.mockResolvedValue({txSignature: 'WSIG12345678abcdefgh', amount: 200_000_000n});
    const {getByText} = render(<ZkProofScreen navigation={navigation} route={publicRoute} />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => {
      jest.advanceTimersByTime(2100);
    });
    expect(getByText(/unshielded/)).toBeTruthy();
    expect(getByText('Done')).toBeTruthy();
  });

  it('public direction: fails with error when no matching note found', async () => {
    const NOC_MINT = 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW';
    const publicRoute = {
      key: 'ZkProofModal-public-test-3',
      name: 'ZkProofModal',
      params: {direction: 'public' as const, amount: '999999999', mint: NOC_MINT},
    } as any;
    // getNotes returns a note with amount 200_000_000n, not 999_999_999n
    const {getByText} = render(<ZkProofScreen navigation={navigation} route={publicRoute} />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => {
      jest.advanceTimersByTime(2100);
    });
    expect(getByText("Couldn't generate proof")).toBeTruthy();
    expect(mockUnshield).not.toHaveBeenCalled();
  });

  // ── Mint threading tests ──────────────────────────────────────────────────

  it('depositShield is called with mint from route.params.mint when provided', async () => {
    const specificMint = 'CustomMint1111111111111111111111111111111111';
    const routeWithMint = {
      ...route,
      params: {...route.params, mint: specificMint},
    } as any;
    mockDeposit.mockResolvedValue({txSignature: 'SIG', leafIndex: 0, amount: 5000000000n});
    render(<ZkProofScreen navigation={navigation} route={routeWithMint} />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockDeposit).toHaveBeenCalledWith(
      expect.any(Uint8Array),  // seed
      expect.anything(),        // feePayer
      specificMint,             // mint from params
      BigInt(route.params.amount),
    );
  });

  it('depositShield falls back to SHIELDED_POOL_MINTS[0] when params.mint is absent', async () => {
    mockDeposit.mockResolvedValue({txSignature: 'SIG', leafIndex: 0, amount: 5000000000n});
    // route has no mint field
    render(<ZkProofScreen navigation={navigation} route={route} />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockDeposit).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      expect.anything(),
      TEST_POOL_MINT,           // default pool mint
      BigInt(route.params.amount),
    );
  });

  it('success screen shows token symbol from poolTokenMeta', async () => {
    const routeWithMint = {
      ...route,
      params: {...route.params, mint: TEST_POOL_MINT},
    } as any;
    mockDeposit.mockResolvedValue({txSignature: 'SiGnAtUrEabcdefgh12345678', leafIndex: 3, amount: 5000000000n});
    const {getByText} = render(<ZkProofScreen navigation={navigation} route={routeWithMint} />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => {
      jest.advanceTimersByTime(2100);
    });
    // Success screen should include "TEST shielded" (symbol from poolTokenMeta)
    expect(getByText(/TEST shielded/)).toBeTruthy();
  });
});
