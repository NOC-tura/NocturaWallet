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

// Note selection / storage — cap + balance well above the test amount.
jest.mock('../../../modules/shielded/noteSelect', () => ({
  maxTransferable: jest.fn(() => 1_000_000_000_000n),
}));
jest.mock('../../../modules/shielded/noteStore', () => ({
  getNotes: jest.fn(() => []),
  getBalance: jest.fn(() => 1_000_000_000_000n),
}));

// Address validation — treat our fixture as valid without bech32 decoding.
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
  mockSend.mockResolvedValue({txSignature: 'TxSigABCDEFGH12345678', sent: 200_000_000n, change: 0n});
});

describe('ShieldedTransferScreen', () => {
  it('renders the "Send private" title', () => {
    const {getByTestId} = render(<ShieldedTransferScreen />);
    expect(getByTestId('screen-title').props.children).toBe('Send private');
  });

  it('shows the noc1 recipient input', () => {
    const {getByTestId} = render(<ShieldedTransferScreen />);
    expect(getByTestId('recipient-input')).toBeTruthy();
  });

  it('shows the remainder note', () => {
    const {getByTestId} = render(<ShieldedTransferScreen />);
    expect(getByTestId('change-note').props.children).toBe(
      'The remainder stays in your private balance',
    );
  });

  it('review button disabled when recipient is empty', () => {
    const {getByTestId} = render(<ShieldedTransferScreen />);
    expect(getByTestId('review-button').props.accessibilityState?.disabled).toBe(true);
  });

  it('has no memo input field (on-chain transfer has no memo)', () => {
    const {queryByTestId} = render(<ShieldedTransferScreen />);
    expect(queryByTestId('memo-input')).toBeNull();
  });

  it('wires a valid transfer through review → confirm to sendPrivateTransfer and shows the receipt', async () => {
    const {getByTestId, getByText} = render(<ShieldedTransferScreen />);

    fireEvent.changeText(getByTestId('recipient-input'), VALID_RECIPIENT);
    fireEvent.changeText(getByTestId('amount-input'), '0.2');

    // input → confirm
    fireEvent.press(getByTestId('review-button'));
    expect(getByTestId('confirm-summary')).toBeTruthy();

    // review + confirm share a 500ms double-tap guard; wait it out.
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
    expect(getByText('Sent privately')).toBeTruthy();
    // tx signature surfaced on the receipt (copyable)
    expect(getByTestId('copy-signature')).toBeTruthy();
    expect(getByTestId('view-explorer')).toBeTruthy();
  });

  it('surfaces the flow error message on failure', async () => {
    mockSend.mockRejectedValue(new Error('insufficient shielded balance for this transfer'));
    const {getByTestId, getByText} = render(<ShieldedTransferScreen />);

    fireEvent.changeText(getByTestId('recipient-input'), VALID_RECIPIENT);
    fireEvent.changeText(getByTestId('amount-input'), '0.2');
    fireEvent.press(getByTestId('review-button')); // input → confirm

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
