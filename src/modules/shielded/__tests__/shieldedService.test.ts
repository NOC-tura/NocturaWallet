jest.mock('../../sslPinning/pinnedFetch', () => ({pinnedFetch: jest.fn()}));

// Use no-cooldown limiters so sequential calls in tests don't wait 3s/5s.
jest.mock('../../solana/rpcLimiter', () => {
  const {RateLimiter} = jest.requireActual<typeof import('../../solana/rateLimiter')>('../../solana/rateLimiter');
  const rpcLimiter = new RateLimiter({maxConcurrent: 10, maxRetries: 3, baseDelayMs: 1000});
  const proveLimiter = new RateLimiter({maxConcurrent: 1, maxRetries: 1, baseDelayMs: 1000});
  const relayerLimiter = new RateLimiter({maxConcurrent: 1, maxRetries: 1, baseDelayMs: 1000});
  return {
    rpcLimiter,
    proveLimiter,
    relayerLimiter,
    _resetRateLimitersForTest: () => {
      rpcLimiter.reset();
      proveLimiter.reset();
      relayerLimiter.reset();
    },
  };
});

jest.mock('../../../store/mmkv/instances', () => {
  const actual = jest.requireActual('../../../store/mmkv/instances') as Record<string, unknown>;
  return {...actual, mmkvSecure: () => actual.mmkvPublic};
});

jest.mock('../../../store/zustand/presaleStore', () => ({
  usePresaleStore: {getState: jest.fn().mockReturnValue({tgeStatus: 'pre_tge', isZeroFeeEligible: false})},
}));

import {pinnedFetch} from '../../sslPinning/pinnedFetch';
import {_resetRateLimitersForTest} from '../../solana/rpcLimiter';
import {
  fetchCircuitConfig,
  _resetConfigCache,
  submitToRelayer,
  deposit,
  transfer,
  withdraw,
  setWitnessProvider,
} from '../shieldedService';
import {addNote, clearMint, getNotes, getBalance} from '../noteStore';
import {encodeShieldedAddress} from '../shieldedAddressCodec';
import type {ShieldedNote, WitnessProvider} from '../types';

const mockWitnessProvider: WitnessProvider = {
  async buildWitness(note, treeDepth, recipientAddress) {
    return {
      noteCommitment: note.commitment,
      merklePath: Array.from({length: treeDepth}, () => '0'.repeat(64)),
      merklePathIndices: Array.from({length: treeDepth}, () => 0),
      nullifier: note.nullifier,
      amount: note.amount.toString(),
      recipientAddress,
      noteSecret: 'mock-secret-for-testing'.padEnd(64, '0'),
    };
  },
};

const mockPinnedFetch = pinnedFetch as jest.MockedFunction<typeof pinnedFetch>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockResponse(status: number, data: unknown) {
  return Promise.resolve({
    status,
    headers: {},
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

const MOCK_CIRCUIT_CONFIG = {maxInputs: 2, maxOutputs: 2, treeDepth: 4};
const MOCK_PROOF_DATA = 'dGVzdFByb29mRGF0YQ=='; // base64 placeholder
const MOCK_TX_SIG = '4xSig1111111111111111111111111111111111111111111111111111111111';
const MINT = 'NOCMint1111111111111111111111111111111111111';

const VALID_RECIPIENT = encodeShieldedAddress(new Uint8Array(48).fill(0xab));

function makeNote(overrides: Partial<ShieldedNote> = {}): ShieldedNote {
  const id = Math.random().toString(16).slice(2, 10);
  return {
    commitment: `commitment_${id}`.padEnd(64, '0'),
    nullifier: `nullifier_${id}`.padEnd(64, '0'),
    mint: MINT,
    amount: 5_000_000n,
    index: 0,
    spent: false,
    createdAt: Date.now(),
    ...overrides,
  };
}

// Hosted prover response
function hostedProverResponse() {
  return mockResponse(200, {
    success: true,
    proofData: MOCK_PROOF_DATA,
    publicInputs: {root: '0'.repeat(64), nullifier: '0'.repeat(64), amount: '5000000'},
  });
}

// Relayer response
function relayerResponse(txSignature: string = MOCK_TX_SIG) {
  return mockResponse(200, {txSignature});
}

// Circuit config response
function configResponse() {
  return mockResponse(200, MOCK_CIRCUIT_CONFIG);
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  setWitnessProvider(mockWitnessProvider);
  _resetConfigCache();
  clearMint(MINT);
  mockPinnedFetch.mockReset();
  _resetRateLimitersForTest();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('shieldedService', () => {
  // 1. fetchCircuitConfig
  it('fetchCircuitConfig returns parsed config from API', async () => {
    mockPinnedFetch.mockReturnValueOnce(configResponse());

    const config = await fetchCircuitConfig();

    expect(config.maxInputs).toBe(2);
    expect(config.maxOutputs).toBe(2);
    expect(config.treeDepth).toBe(4);
    expect(mockPinnedFetch).toHaveBeenCalledWith(
      expect.stringContaining('/v1/config/circuit'),
    );
  });

  // 2. submitToRelayer — success
  it('submitToRelayer POSTs proof and returns txSignature', async () => {
    mockPinnedFetch.mockReturnValueOnce(relayerResponse());

    const fakeProof = {
      proofType: 'transfer' as const,
      proofData: MOCK_PROOF_DATA,
      publicInputs: {root: '', nullifier: '', amount: '1000'},
      generatedAt: Date.now(),
    };

    const sig = await submitToRelayer(fakeProof);

    expect(sig).toBe(MOCK_TX_SIG);
    expect(mockPinnedFetch).toHaveBeenCalledWith(
      expect.stringContaining('/v1/relayer/submit'),
      expect.objectContaining({method: 'POST'}),
    );
  });

  // 3. submitToRelayer — non-200
  it('submitToRelayer throws on non-200 response', async () => {
    mockPinnedFetch.mockReturnValueOnce(mockResponse(500, {error: 'Internal server error'}));

    const fakeProof = {
      proofType: 'transfer' as const,
      proofData: MOCK_PROOF_DATA,
      publicInputs: {root: '', nullifier: '', amount: '1000'},
      generatedAt: Date.now(),
    };

    await expect(submitToRelayer(fakeProof)).rejects.toThrow('HTTP 500');
  });

  // 4. deposit — proves and submits, adds note to store
  it('deposit calls prove and submitToRelayer, adds note to store', async () => {
    // Mock 1: circuit config (fetchCircuitConfig called inside deposit)
    mockPinnedFetch.mockReturnValueOnce(configResponse());
    // Mock 2: hosted prover (called internally by zkProver)
    mockPinnedFetch.mockReturnValueOnce(hostedProverResponse());
    // Mock 3: relayer
    mockPinnedFetch.mockReturnValueOnce(relayerResponse());

    const result = await deposit({
      mint: MINT,
      amount: 10_000_000n,
      senderPubkey: 'SenderPubkey1111111111111111111111111111111',
    });

    expect(result.proofType).toBe('deposit');
    expect(result.txSignature).toBe(MOCK_TX_SIG);
    expect(result.amount).toBe(10_000_000n);

    // Note should have been added
    const notes = getNotes(MINT);
    expect(notes.length).toBeGreaterThanOrEqual(1);
  });

  // 5. transfer — selects notes, proves, submits, marks spent
  it('transfer selects notes, proves, submits, marks spent', async () => {
    // Seed notes into the store
    const note1 = makeNote({amount: 6_000_000n});
    addNote(note1);

    // Mock 1: circuit config (fetched by transfer)
    mockPinnedFetch.mockReturnValueOnce(configResponse());
    // Mock 2: hosted prover
    mockPinnedFetch.mockReturnValueOnce(hostedProverResponse());
    // Mock 3: relayer
    mockPinnedFetch.mockReturnValueOnce(relayerResponse());

    const result = await transfer({
      mint: MINT,
      amount: 5_000_000n,
      recipientAddress: VALID_RECIPIENT,
    });

    expect(result.proofType).toBe('transfer');
    expect(result.txSignature).toBe(MOCK_TX_SIG);
    expect(result.amount).toBe(5_000_000n);

    // Original note should be spent (balance reduced or gone)
    expect(getBalance(MINT)).toBeLessThan(6_000_000n);
  });

  // 6. transfer — consolidation when notes exceed maxInputs
  it('transfer triggers consolidation when notes exceed maxInputs', async () => {
    // Seed 3 notes of 2M each (maxInputs = 2).
    // Selecting for amount=5M requires all 3 notes (2+2=4 < 5, need 2+2+2=6 >= 5),
    // so selected.length=3 > maxInputs=2, triggering consolidation.
    addNote(makeNote({amount: 2_000_000n, index: 0}));
    addNote(makeNote({amount: 2_000_000n, index: 1}));
    addNote(makeNote({amount: 2_000_000n, index: 2}));

    const onProgress = jest.fn();

    // Consolidation produces 2 batches:
    //   batch 1: [note0, note1] → prover + relayer (consolidated into 4M note)
    //   batch 2: [note2]       → prover + relayer (consolidated into 2M note)
    // After consolidation, re-select from merged notes (4M + 2M = 6M >= 5M).
    // Final transfer: prover + relayer.
    // Total pinnedFetch calls: 1 config + 6 prover/relayer = 7

    // config
    mockPinnedFetch.mockReturnValueOnce(configResponse());
    // consolidation batch 1: prover
    mockPinnedFetch.mockReturnValueOnce(hostedProverResponse());
    // consolidation batch 1: relayer
    mockPinnedFetch.mockReturnValueOnce(relayerResponse('consolidation-sig-1'));
    // consolidation batch 2: prover
    mockPinnedFetch.mockReturnValueOnce(hostedProverResponse());
    // consolidation batch 2: relayer
    mockPinnedFetch.mockReturnValueOnce(relayerResponse('consolidation-sig-2'));
    // final transfer: prover
    mockPinnedFetch.mockReturnValueOnce(hostedProverResponse());
    // final transfer: relayer
    mockPinnedFetch.mockReturnValueOnce(relayerResponse());

    const result = await transfer(
      {
        mint: MINT,
        amount: 5_000_000n,
        recipientAddress: VALID_RECIPIENT,
      },
      0,
      onProgress,
    );

    expect(result.proofType).toBe('transfer');
    expect(result.txSignature).toBe(MOCK_TX_SIG);
    // onProgress was called at least once during consolidation
    expect(onProgress).toHaveBeenCalled();
  });

  // 7. withdraw — selects notes, proves, submits, marks spent
  it('withdraw selects notes, proves, submits, marks spent', async () => {
    const note = makeNote({amount: 10_000_000n});
    addNote(note);

    // Mock 1: circuit config
    mockPinnedFetch.mockReturnValueOnce(configResponse());
    // Mock 2: hosted prover
    mockPinnedFetch.mockReturnValueOnce(hostedProverResponse());
    // Mock 3: relayer
    mockPinnedFetch.mockReturnValueOnce(relayerResponse());

    const result = await withdraw({
      mint: MINT,
      amount: 8_000_000n,
      destinationPubkey: 'DestPubkey111111111111111111111111111111111',
    });

    expect(result.proofType).toBe('withdraw');
    expect(result.txSignature).toBe(MOCK_TX_SIG);
    expect(result.amount).toBe(8_000_000n);

    // Note should be marked spent; change note created
    expect(getBalance(MINT)).toBeLessThan(10_000_000n);
  });

  // 8. deposit — propagates prover errors
  it('deposit propagates prover errors', async () => {
    // Both hosted and local provers fail → ProverUnavailableError
    // Mock hosted prover to return non-200
    mockPinnedFetch.mockReturnValueOnce(mockResponse(503, {error: 'prover unavailable'}));

    await expect(
      deposit({
        mint: MINT,
        amount: 5_000_000n,
        senderPubkey: 'SenderPubkey1111111111111111111111111111111',
      }),
    ).rejects.toThrow();
  });

  // 9. deposit — throws when no witness provider is configured
  it('deposit throws when no witness provider is configured', async () => {
    setWitnessProvider(null);
    // Provide circuit config so the guard is reached; no prover/relayer needed
    mockPinnedFetch.mockReturnValueOnce(configResponse());
    await expect(
      deposit({mint: MINT, amount: 1_000_000n, senderPubkey: 'sender1'}),
    ).rejects.toThrow('witness provider');
  });
});
