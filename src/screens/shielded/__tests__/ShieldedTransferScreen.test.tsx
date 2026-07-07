import React from 'react';
import {render, fireEvent, act} from '@testing-library/react-native';
import {ShieldedTransferScreen} from '../ShieldedTransferScreen';
import {sendPrivateTransfer} from '../../../modules/shielded/transferFlow';

const TEST_POOL_MINT = 'PoolMint111111111111111111111111111111111111';
const VALID_RECIPIENT = 'noc1validrecipient';

jest.mock('../../../modules/sslPinning/pinnedFetch', () => ({pinnedFetch: jest.fn()}));
jest.mock('../../../store/mmkv/instances', () => {
  const actual = jest.requireActual('../../../store/mmkv/instances') as Record<string, unknown>;
  return {...actual, mmkvSecure: () => actual.mmkvPublic};
});
jest.mock('../../../store/zustand/presaleStore', () => ({
  usePresaleStore: Object.assign(
    jest.fn().mockReturnValue({tgeStatus: 'pre_tge', isZeroFeeEligible: false}),
    {getState: jest.fn().mockReturnValue({tgeStatus: 'pre_tge', isZeroFeeEligible: false})},
  ),
}));
jest.mock('../../../store/zustand/walletStore', () => ({
  useWalletStore: Object.assign(
    jest.fn().mockReturnValue({
      publicKey: 'TestPubkey1111111111111111111111111111111111',
      tokens: [{mint: 'NOC_MINT', symbol: 'NOC'}],
    }),
    {getState: jest.fn().mockReturnValue({nocUsdPrice: 0, setNocUsdPrice: jest.fn()})},
  ),
}));
jest.mock('../../../store/zustand/shieldedStore', () => ({
  useShieldedStore: jest.fn().mockReturnValue({merkleLeafCount: 50}),
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({goBack: jest.fn()}),
  useRoute: () => ({params: {}}),
}));

// Real flow + prover warm
jest.mock('../../../modules/shielded/transferFlow', () => ({
  sendPrivateTransfer: jest.fn(),
}));
jest.mock('../../../modules/zkProver/zkProverModule', () => ({
  warmProver: jest.fn().mockResolvedValue(undefined),
}));

// Note selection / storage — cap is well above the test amount
jest.mock('../../../modules/shielded/noteSelect', () => ({
  maxTransferable: jest.fn(() => 1_000_000_000_000n),
}));
jest.mock('../../../modules/shielded/noteStore', () => ({
  getNotes: jest.fn(() => []),
}));

// Address validation — treat our fixture as valid without bech32 decoding
jest.mock('../../../modules/shielded/shieldedAddressCodec', () => ({
  isValidShieldedAddress: jest.fn((a: string) => a === 'noc1validrecipient'),
  decodeShieldedAddress: jest.fn(),
}));

// Seed → feePayer derivation (mirrors ZkProofScreen test)
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
jest.mock('../../../constants/programs', () => ({
  SHIELDED_POOL_MINTS: ['PoolMint111111111111111111111111111111111111'],
  SHIELDED_DEVNET_MINT: 'PoolMint111111111111111111111111111111111111',
}));

const mockSend = sendPrivateTransfer as jest.MockedFunction<typeof sendPrivateTransfer>;

beforeEach(() => {
  mockSend.mockReset();
  mockSend.mockResolvedValue({txSignature: 'T', sent: 200_000_000n, change: 0n});
});

describe('ShieldedTransferScreen', () => {
  it('renders "Send privately" title', () => {
    const {getByTestId} = render(<ShieldedTransferScreen />);
    const title = getByTestId('screen-title');
    expect(title.props.children).toBe('Send privately');
  });

  it('shows ShieldedAddressInput', () => {
    const {getByTestId} = render(<ShieldedTransferScreen />);
    expect(getByTestId('shielded-address-input')).toBeTruthy();
  });

  it('shows "Remainder stays in your private balance"', () => {
    const {getByTestId} = render(<ShieldedTransferScreen />);
    const note = getByTestId('change-note');
    expect(note.props.children).toBe('Remainder stays in your private balance');
  });

  it('confirm button disabled when address is empty', () => {
    const {getByTestId} = render(<ShieldedTransferScreen />);
    const btn = getByTestId('confirm-button');
    expect(btn.props.accessibilityState?.disabled).toBe(true);
  });

  it('shows fee display row', () => {
    const {getByTestId} = render(<ShieldedTransferScreen />);
    expect(getByTestId('fee-display-row')).toBeTruthy();
  });

  it('has no memo input field (on-chain transfer has no memo)', () => {
    const {queryByTestId} = render(<ShieldedTransferScreen />);
    expect(queryByTestId('memo-input')).toBeNull();
  });

  it('wires a valid transfer through review → confirm to sendPrivateTransfer and shows success', async () => {
    const {getByTestId, getByText} = render(<ShieldedTransferScreen />);

    fireEvent.changeText(getByTestId('shielded-address-input'), VALID_RECIPIENT);
    fireEvent.changeText(getByTestId('amount-input'), '0.2');

    // input → confirm
    fireEvent.press(getByTestId('confirm-button'));
    expect(getByTestId('confirm-summary')).toBeTruthy();

    // The review + confirm buttons share a 500ms double-tap guard; wait it out.
    await new Promise(r => setTimeout(r, 600));

    // confirm → proving → success
    await act(async () => {
      fireEvent.press(getByTestId('confirm-button'));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.any(Uint8Array), // seed
      expect.anything(), // feePayer Keypair
      TEST_POOL_MINT, // pool mint
      VALID_RECIPIENT, // recipient
      200_000_000n, // parsed 0.2 * 10^9
      expect.any(Function), // onStep
    );
    expect(getByText('Transfer sent privately')).toBeTruthy();
  });

  it('surfaces the flow error message on failure', async () => {
    mockSend.mockRejectedValue(new Error('insufficient shielded balance for this transfer'));
    const {getByTestId, getByText} = render(<ShieldedTransferScreen />);

    fireEvent.changeText(getByTestId('shielded-address-input'), VALID_RECIPIENT);
    fireEvent.changeText(getByTestId('amount-input'), '0.2');
    fireEvent.press(getByTestId('confirm-button')); // input → confirm

    await new Promise(r => setTimeout(r, 600)); // clear double-tap guard

    await act(async () => {
      fireEvent.press(getByTestId('confirm-button')); // confirm → proving → error
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getByText('insufficient shielded balance for this transfer')).toBeTruthy();
  });
});
